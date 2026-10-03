import * as cdk from 'aws-cdk-lib/core'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
export class Mp4mp3Stack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)
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
                    allowedOrigins: ['mp4mp3-public.lostmypillow.com'],
                    allowedHeaders: ['*'],
                },
            ],
            lifecycleRules: [
                {
                    expiration: cdk.Duration.days(1),
                },
            ],
        })

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
        })
        const ffmpegLayer = new lambda.LayerVersion(this, 'FfmpegArm64Layer', {
            code: lambda.Code.fromDockerBuild(
                path.dirname(fileURLToPath(import.meta.url)),
                {
                    platform: 'linux/arm64',
                }
            ),
            compatibleArchitectures: [lambda.Architecture.ARM_64],
            compatibleRuntimes: [
                lambda.Runtime.NODEJS_24_X,
                lambda.Runtime.PYTHON_3_14,
            ],
            description: 'Static FFmpeg/FFprobe binaries for ARM64 Lambda',
        })
        const mainHandler = new lambdaNode.NodejsFunction(
            this,
            'mp4mp3-upload',
            {
                entry: path.resolve(
                    path.dirname(fileURLToPath(import.meta.url)),
                    './src/lambda/handler.ts'
                ),
                handler: 'handler',
                bundling: {
                    format: lambdaNode.OutputFormat.ESM,
                    target: 'node24',
                    externalModules: ['@aws-sdk/*', '@smithy/*'],
                    banner: [
                        'delete process.env.AWS_PROFILE;',
                        "import { createRequire } from 'module';",
                        'const require = createRequire(import.meta.url);',
                    ].join(' '),
                },
                runtime: lambda.Runtime.NODEJS_24_X,
                architecture: lambda.Architecture.ARM_64,
                memorySize: 256,
                layers: [ffmpegLayer],
                timeout: cdk.Duration.seconds(30),
                environment: {
                    UPLOAD_BUCKET_NAME: bucket.bucketName,
                },
            }
        )

        mainHandler.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors: {
                allowedOrigins: [
                    'https://mp4mp3-public.lostmypillow.com',
                    'http://localhost:5173',
                ],
                allowedMethods: [lambda.HttpMethod.POST, lambda.HttpMethod.GET],
                allowedHeaders: ['Content-Type', 'Authorization'],
                allowCredentials: true,
                maxAge: cdk.Duration.hours(1),
            },
        })

        const killSwitchLambda = new lambdaNode.NodejsFunction(
            this,
            'mp4mp3-killswitch',
            {
                entry: path.join(
                    import.meta.dirname,
                    './src',
                    'lambda',
                    'killswitch.ts'
                ),
                handler: 'handler',
                bundling: {
                    minify: true,
                    sourceMap: false,
                },
                runtime: lambda.Runtime.NODEJS_24_X,
                architecture: lambda.Architecture.ARM_64,
                memorySize: 128,
                timeout: cdk.Duration.seconds(10),
            }
        )

        killSwitchLambda.addEnvironment('RULE_NAME', convertRule.ruleName)
        killSwitchLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['events:DisableRule'],
                resources: [convertRule.ruleArn],
            })
        )

        const cleanerLambda = new lambdaNode.NodejsFunction(
            this,
            'mp4mp3-cleaner',
            {
                runtime: lambda.Runtime.NODEJS_24_X,
                handler: 'handler',
                entry: path.join(
                    import.meta.dirname,
                    './src',
                    'lambda',
                    'cleaner.ts'
                ),
                timeout: cdk.Duration.seconds(60),
                memorySize: 128,
                architecture: lambda.Architecture.ARM_64,
                environment: {
                    UPLOAD_BUCKET_NAME: bucket.bucketName,
                },
            }
        )

        cleanerLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: [
                    's3:ListBucketMultipartUploads',
                    's3:AbortMultipartUpload',
                ],
                resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
            })
        )

        const cleanupRule = new events.Rule(this, 'DailyS3CleanupRule', {
            schedule: events.Schedule.cron({
                minute: '0',
                hour: '23',
                month: '*',
                weekDay: '*',
                year: '*',
            }),
        })

        cleanupRule.addTarget(new targets.LambdaFunction(cleanerLambda))

        const convertInvocationMetric = mainHandler.metricInvocations({
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
        })

        const convertAlarm = new cloudwatch.Alarm(
            this,
            'mp4mp3-high-invocations-alarm',
            {
                metric: convertInvocationMetric,
                threshold: 100,
                comparisonOperator:
                    cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
                evaluationPeriods: 1,
                alarmDescription:
                    'Automatically triggers kill switch if conversion invocations exceed 100 in 5 minutes.',
            }
        )

        const alarmTopic = new sns.Topic(this, 'mp4mp3-alarm-topic')
        alarmTopic.addSubscription(
            new subscriptions.LambdaSubscription(killSwitchLambda)
        )
        convertAlarm.addAlarmAction(new cw_actions.SnsAction(alarmTopic))

        bucket.grantPut(mainHandler)
        bucket.grantReadWrite(mainHandler)
        bucket.grantDelete(mainHandler)
        bucket.grantReadWrite(cleanerLambda)
    }
}
