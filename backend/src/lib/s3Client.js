import { S3Client } from '@aws-sdk/client-s3'
export const internalS3Client = new S3Client({
    endpoint: process.env.INTERNAL_S3_ENDPOINT,
    forcePathStyle: true,
})
export const publicS3Client = new S3Client({
    endpoint: process.env.PUBLIC_S3_ENDPOINT,
    forcePathStyle: true,
})
