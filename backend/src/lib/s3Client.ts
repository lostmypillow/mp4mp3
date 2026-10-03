import { S3Client } from '@aws-sdk/client-s3'

export const internalS3Client =
    process.env.VITE_IS_AWS === 'true'
        ? new S3Client()
        : new S3Client({
              endpoint: process.env.INTERNAL_S3_ENDPOINT,
              forcePathStyle: true,
          })
export const publicS3Client =
    process.env.VITE_IS_AWS === 'true'
        ? new S3Client()
        : new S3Client({
              endpoint: process.env.PUBLIC_S3_ENDPOINT,
              forcePathStyle: true,
          })
