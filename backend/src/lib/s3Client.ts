import {
    S3Client,
    CreateBucketCommand,
    PutBucketPolicyCommand,
    PutBucketLifecycleConfigurationCommand,
    PutBucketNotificationConfigurationCommand,
} from '@aws-sdk/client-s3'

export const internalS3Client = new S3Client({
    endpoint: process.env.INTERNAL_S3_ENDPOINT,
    forcePathStyle: true,
})
export const publicS3Client = new S3Client({
    endpoint: process.env.PUBLIC_S3_ENDPOINT,
    forcePathStyle: true,
})
export async function initMinio() {
    const bucket = process.env.UPLOAD_BUCKET_NAME

    try {
        await internalS3Client.send(new CreateBucketCommand({ Bucket: bucket }))
        console.log('Creating bucket because it does not exist')
    } catch (err: any) {
        if (
            err.name !== 'BucketAlreadyOwnedByYou' &&
            err.name !== 'BucketAlreadyExists'
        ) {
            throw err
        } else {
            console.log('Bucket either already owned by you or already exists')
        }
    }

    const uploadOnlyPolicy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [
            {
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:PutObject'],
                Resource: [`arn:aws:s3:::${bucket}/*`],
            },
        ],
    })
    console.log('Setting bucket policy (idempotent)...')
    await internalS3Client.send(
        new PutBucketPolicyCommand({ Bucket: bucket, Policy: uploadOnlyPolicy })
    )

    console.log('Attaching webhook (idempotent)...')
    await internalS3Client.send(
        new PutBucketNotificationConfigurationCommand({
            Bucket: bucket,
            NotificationConfiguration: {
                QueueConfigurations: [
                    {
                        QueueArn: 'arn:minio:sqs::mp4mp3:webhook',
                        Events: ['s3:ObjectCreated:*'],
                    },
                ],
            },
        })
    )

    console.log('Setting expiration rule (idempotent)...')
    await internalS3Client.send(
        new PutBucketLifecycleConfigurationCommand({
            Bucket: bucket,
            LifecycleConfiguration: {
                Rules: [
                    {
                        ID: 'ExpireAfter1Day',
                        Status: 'Enabled',
                        Filter: { Prefix: '' },
                        Expiration: { Days: 1 },
                    },
                ],
            },
        })
    )
}
