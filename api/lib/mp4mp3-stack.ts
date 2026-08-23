import * as cdk from 'aws-cdk-lib/core';
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs'
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as iam from 'aws-cdk-lib/aws-iam';
import {Construct} from 'constructs';
import path from 'node:path'

export class Mp4mp3Stack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        const ffmpegLayer = new lambda.LayerVersion(this, 'mp4mp3-ffmpeg-layer', {
                code: lambda.Code.fromAsset(
                    import.meta.dirname, {
                        exclude: ['*'],
                        bundling: {
                            image: cdk.DockerImage.fromRegistry('alpine:latest'),
                            user: 'root',
                            command: [
                                'sh', '-c',
                                'apk add --no-cache wget tar xz && ' +
                                'mkdir -p /asset-output/bin && ' +
                                'wget -O /tmp/ffmpeg.tar.xz https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz && ' +
                                'tar -xvf /tmp/ffmpeg.tar.xz --strip-components=1 -C /tmp && ' +
                                'mv /tmp/ffmpeg /asset-output/bin/ && ' +
                                'rm -rf /tmp/*'
                            ],
                        },
                    }
                ),
                compatibleArchitectures: [lambda.Architecture.ARM_64],
                compatibleRuntimes: [lambda.Runtime.NODEJS_24_X],
                description: 'FFmpeg static binary for ARM64 (Graviton)',
            }
        );
        const bucket = new s3.Bucket(this, 'mp4mp3-upload-bucket', {
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            eventBridgeEnabled: true,
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.PUT],
                    allowedOrigins: ['mp3mp4.lostmypillow.com', 'http://localhost:5173', 'https://lostmypillow.github.io'],
                    allowedHeaders: ['*'],
                },
            ],
            lifecycleRules: [
                {
                    expiration: cdk.Duration.days(1)
                }
            ]
        });

        const convertRule = new events.Rule(this, 'mp4mp3-convert-rule', {
            eventPattern: {
                source: ['aws.s3'],
                detailType: ['Object Created'],
                detail: {
                    bucket: {
                        name: [bucket.bucketName],
                    },
                },
            },
        });

        const uploadLambda = new lambdaNode.NodejsFunction(this, 'mp4mp3-upload', {
            entry: path.join(import.meta.dirname, '../src', 'upload.js'),
            handler: "handler",
            bundling: {
                minify: true,
                sourceMap: false,
            },
            runtime: lambda.Runtime.NODEJS_24_X,
            architecture: lambda.Architecture.ARM_64,
            memorySize: 128,
            timeout: cdk.Duration.seconds(10),
            environment: {
                BUCKET_NAME: bucket.bucketName,
            },

        })

        uploadLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors: {
                allowedOrigins: ['https://mp4mp3.lostmypillow.com', 'http://localhost:5173', 'https://lostmypillow.github.io'],
                allowedMethods: [
                    lambda.HttpMethod.POST,
                ],
                allowedHeaders: ['Content-Type', 'Authorization'],
                allowCredentials: true,
                maxAge: cdk.Duration.hours(1),
            },
        })

        const convertLambda = new lambdaNode.NodejsFunction(this, 'mp4mp3-convert', {
            entry: path.join(import.meta.dirname, '../src', 'convert.js'),
            handler: "handler",
            bundling: {
                minify: true,
                sourceMap: false,
            },
            runtime: lambda.Runtime.NODEJS_24_X,
            architecture: lambda.Architecture.ARM_64,
            memorySize: 1796,
            ephemeralStorageSize:cdk.Size.mebibytes(1024),
            timeout: cdk.Duration.minutes(1),
            environment: {
                BUCKET_NAME: bucket.bucketName,
            },
            layers: [ffmpegLayer],

        });

        convertRule.addTarget(new targets.LambdaFunction(convertLambda));

        const downloadLambda = new lambdaNode.NodejsFunction(this, 'mp4mp3-download', {
            entry: path.join(import.meta.dirname, '../src', 'download.js'),
            handler: "handler",
            bundling: {
                minify: true,
                sourceMap: false,
            },
            runtime: lambda.Runtime.NODEJS_24_X,
            architecture: lambda.Architecture.ARM_64,
            memorySize: 128,
            timeout: cdk.Duration.seconds(10),
            environment: {
                BUCKET_NAME: bucket.bucketName,
            },

        })

        downloadLambda.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors: {
                allowedOrigins: ['https://mp4mp3.lostmypillow.com', 'http://localhost:5173', 'https://lostmypillow.github.io'],
                allowedMethods: [
                    lambda.HttpMethod.GET,
                ],
                allowedHeaders: ['Content-Type', 'Authorization'],
                allowCredentials: true,
                maxAge: cdk.Duration.hours(1),
            },
        })

        const killSwitchLambda = new lambdaNode.NodejsFunction(this, 'mp4mp3-killswitch', {
            entry: path.join(import.meta.dirname, '../src', 'killswitch.js'),
            handler: "handler",
            bundling: {
                minify: true,
                sourceMap: false,
            },
            runtime: lambda.Runtime.NODEJS_24_X,
            architecture: lambda.Architecture.ARM_64,
            memorySize: 128,
            timeout: cdk.Duration.seconds(10),

        });

        killSwitchLambda.addEnvironment('RULE_NAME', convertRule.ruleName);
        killSwitchLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['events:DisableRule'],
                resources: [convertRule.ruleArn],
            })
        );

        const cleanerLambda = new lambdaNode.NodejsFunction(this, 'mp4mp3-cleaner', {
            runtime: lambda.Runtime.NODEJS_24_X,
            handler: 'handler',
            entry: path.join(import.meta.dirname, '../src', 'cleaner.js'),
            timeout: cdk.Duration.seconds(60),
            memorySize: 128,
            architecture: lambda.Architecture.ARM_64,
            environment: {
                BUCKET_NAME: bucket.bucketName,
            },
        });

        cleanerLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: [
                    's3:ListBucketMultipartUploads',
                    's3:AbortMultipartUpload',
                ],
                resources: [
                    bucket.bucketArn,
                    `${bucket.bucketArn}/*`,
                ],
            })
        );

        const cleanupRule = new events.Rule(this, 'DailyS3CleanupRule', {
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '23',
                month: '*',
                weekDay: '*',
                year: '*',
            }),
        });

        cleanupRule.addTarget(new targets.LambdaFunction(cleanerLambda));


        const convertInvocationMetric = convertLambda.metricInvocations({
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
        });

        const convertAlarm = new cloudwatch.Alarm(this, 'mp4mp3-high-invocations-alarm', {
            metric: convertInvocationMetric,
            threshold: 10,
            evaluationPeriods: 1,
            alarmDescription: 'Automatically triggers kill switch if conversion invocations exceed 100 in 5 minutes.',
        });

        const alarmTopic = new sns.Topic(this, 'mp4mp3-alarm-topic');
        alarmTopic.addSubscription(new subscriptions.LambdaSubscription(killSwitchLambda));
        convertAlarm.addAlarmAction(new cw_actions.SnsAction(alarmTopic));

        bucket.grantPut(uploadLambda);
        bucket.grantReadWrite(convertLambda);
        bucket.grantDelete(convertLambda);
        bucket.grantRead(downloadLambda);
        bucket.grantReadWrite(cleanerLambda)

    }
}
