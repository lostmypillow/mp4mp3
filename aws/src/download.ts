import {
    S3Client,
    GetObjectCommand,
    ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type {
    APIGatewayProxyEventV2 as LambdaFunctionUrlEvent
} from 'aws-lambda'

const internalS3 = new S3Client({
    endpoint: process.env.SELF_HOSTED_S3_ENDPOINT,
    forcePathStyle: !!process.env.SELF_HOSTED_S3_ENDPOINT,
})
const publicS3 = process.env.SELF_HOSTED_S3_PUBLIC_ENDPOINT
    ? new S3Client({
          endpoint: process.env.SELF_HOSTED_S3_PUBLIC_ENDPOINT,
          forcePathStyle: true,
      })
    : internalS3

export const handler = async (event:LambdaFunctionUrlEvent) => {
    try {
        const queryParams =
            event.queryStringParameters || {}
        const uuid = queryParams.uuid

        if (!uuid) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing or invalid UUID.' }),
            }
        }

        const listCommand = new ListObjectsV2Command({
            Bucket: process.env.BUCKET_NAME,
            Prefix: `${uuid}/`,
        })

        const listResults = await internalS3.send(listCommand)

        if (!listResults.Contents || listResults.Contents.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    status: 'error',
                    message: 'No files found for this UUID.',
                }),
            }
        }

        const actualKey = listResults.Contents[0].Key

        if (!actualKey) {
            throw new Error("Missing object key")
        }

        if (!actualKey.toLowerCase().endsWith('.mp3')) {
            return {
                statusCode: 202,
                body: JSON.stringify({ status: 'processing' }),
            }
        }

        const rawFilename = (
            actualKey.split('/').pop() || 'download.mp3'
        ).replace(/["\r\n]/g, '')
        const safeFilename = rawFilename.toLowerCase().endsWith('.mp3')
            ? rawFilename
            : `${rawFilename}.mp3`
        const asciiFilename = safeFilename
            .replace(/[—–]/g, '-')
            .replace(/[^\x20-\x7E]/g, '_')

        // Full UTF-8 encoded filename for modern browsers
        const encodedFilename = encodeURIComponent(safeFilename)
            .replace(/['()]/g, escape)
            .replace(/\*/g, '%2A')

        const command = new GetObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: actualKey,
            ResponseContentDisposition: `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
        })

        const downloadUrl = await getSignedUrl(publicS3, command, {
            expiresIn: 300,
        })

        return {
            statusCode: 200,
            body: JSON.stringify({
                status: 'complete',
                url: downloadUrl,
                key: actualKey,
            }),
        }
    } catch (err) {
        console.error('Error generating presigned download URL:', err)
        return {
            statusCode: 500,
            body: JSON.stringify({
                status: 'error',
                message: 'Error generating presigned download URL',
            }),
        }
    }
}
