import { Request, Response, NextFunction, Router } from 'express'
import { handler } from '../../aws/src/convert.js'
import { sseEmitter } from '../sse.js'
import { handler as downloadHandler } from '../../aws/src/download.js'

const router = Router()
function normalizeS3Events(req: Request, res: Response, next: NextFunction) {
    const body = req.body

    if (body?.Records?.[0]?.s3) {
        const s3Record = body.Records[0].s3

        // Normalize payload structure to mirror EventBridge
        req.body = {
            detail: {
                bucket: {
                    name: s3Record.bucket.name,
                },
                object: {
                    // MinIO URL-encodes spaces (+ or %20); decode to retain original file name
                    key: decodeURIComponent(
                        s3Record.object.key.replace(/\+/g, ' ')
                    ),
                    size: s3Record.object.size,
                },
            },
        }
    }

    next()
}
function fixPresignedUrl(url: string): string {
    const publicEndpoint = process.env.SELF_HOSTED_S3_PUBLIC_ENDPOINT

    if (!url || !publicEndpoint) return url

    return url.replace(/^https?:\/\/[^\/]+/, publicEndpoint)
}
import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { execFile as execFileCallback } from 'node:child_process'
import * as fs from 'node:fs'
import { pipeline } from 'node:stream/promises'
import util from 'node:util'
import { convertMp4ToMp3, getVideoDuration } from './ffmpegOperations.js'
const execFile = util.promisify(execFileCallback)
const s3 = new S3Client({
    endpoint: process.env.SELF_HOSTED_S3_ENDPOINT,
    forcePathStyle: !!process.env.SELF_HOSTED_S3_ENDPOINT,
})
const MAX_FILE_SIZE_BYTES =
    Number(process.env.MAX_FILE_SIZE || 600) * 1024 * 1024

// Attach middleware directly to your events endpoint
router.post(
    '/events',
    normalizeS3Events,
    async (req: Request, res: Response) => {
        try {
            const event = req.body
            const detail = event.detail

            // Ensure the event contains the expected S3 object details
            if (!detail || !detail.bucket || !detail.object) {
                console.error('Invalid EventBridge payload')
                return
            }

            const bucketName = detail.bucket.name
            const objectKey = detail.object.key
            const objectSize = detail.object.size

            if (!bucketName || !objectKey) {
                console.log(
                    'Ignored: Missing bucket or object key in EventBridge payload.'
                )
                return
            }

            // 1. Check the file size
            if (objectSize > MAX_FILE_SIZE_BYTES) {
                console.warn(
                    `File ${objectKey} rejected. Size (${objectSize} bytes) exceeds limit.`
                )

                // 2. Delete the oversized file to protect S3 Free Tier storage
                try {
                    await s3.send(
                        new DeleteObjectCommand({
                            Bucket: bucketName,
                            Key: objectKey,
                        })
                    )
                    console.log(
                        `Successfully deleted oversized file: ${objectKey}`
                    )
                } catch (deleteErr) {
                    console.error(
                        `Failed to delete oversized file ${objectKey}:`,
                        deleteErr
                    )
                }
                return
            }

            console.log(
                `File size is ${objectSize} bytes. Proceeding with conversion for ${objectKey}.`
            )

            if (!objectKey.toLowerCase().endsWith('.mp4')) {
                console.log(`Ignored: Object ${objectKey} is not an MP4 file.`)
                return
            }

            const uniqueId = Date.now()
            const inputPath = `/tmp/input_${uniqueId}.mp4`
            const outputPath = `/tmp/output_${uniqueId}.mp3`
            const key = req.body?.detail?.object?.key
            const uuid = key?.split('/')[0]

            try {
                console.time('Download S3 Object')
                const response = await s3.send(
                    new GetObjectCommand({ Bucket: bucketName, Key: objectKey })
                )
                await pipeline(response.Body, fs.createWriteStream(inputPath))
                console.timeEnd('Download S3 Object')

                console.time('FFmpeg Conversion')
                // 3. Use execFile to prevent shell injection hazards
                const totalDuration = await getVideoDuration(inputPath)

                await convertMp4ToMp3(
                    inputPath,
                    outputPath,
                    totalDuration,
                    (progress) => {
                        console.log(`Progress: ${progress}`)
                        sseEmitter.emit(`progress:${uuid}`, {
                            progress: progress,
                        })
                    }
                )

                // 4. Construct valid output key replacing .mp4 with .mp3
                const outputKey = objectKey.replace(/\.mp4$/i, '.mp3')

                console.time('Upload MP3 to S3')
                await s3.send(
                    new PutObjectCommand({
                        Bucket: bucketName,
                        Key: outputKey,
                        Body: fs.createReadStream(outputPath),
                        ContentType: 'audio/mpeg',
                    })
                )
                console.timeEnd('Upload MP3 to S3')
            } catch (err) {
                console.error(`Failed to process ${objectKey}:`, err)
                try {
                    await s3.send(
                        new DeleteObjectCommand({
                            Bucket: bucketName,
                            Key: objectKey,
                        })
                    )
                    console.log(
                        `Deleted file after failure to process: ${objectKey}`
                    )
                } catch (deleteErr) {
                    console.error(
                        `Failed to delete failed file ${objectKey}:`,
                        deleteErr
                    )
                }

                throw err
            } finally {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
                try {
                    await s3.send(
                        new DeleteObjectCommand({
                            Bucket: bucketName,
                            Key: objectKey,
                        })
                    )
                    console.log(
                        `Successfully deleted processed file: ${objectKey}`
                    )
                } catch (deleteErr) {
                    console.error(
                        `Failed to delete processed file ${objectKey}:`,
                        deleteErr
                    )
                }
            }
            if (uuid) {
                // Generate the presigned download URL immediately
                const response = JSON.parse(
                    (
                        await downloadHandler({
                            queryStringParameters: { uuid },
                        } as any)
                    ).body
                )

                if (response?.url) {
                    response.url = fixPresignedUrl(response.url)
                }
                sseEmitter.emit(`complete:${uuid}`, response)
            }

            res.status(200).send('OK')
        } catch (err: any) {
            console.error('Convert handler error:', err?.message || err)
            res.status(500).json({
                error: err?.message || 'Conversion event processing failed',
            })
        }
    }
)

router.get('/stream', (req: Request, res: Response) => {
    const uuid = req.query.uuid as string
    if (!uuid) return res.status(400).send('Missing UUID')
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    const onProgress = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`)
    }
    const onComplete = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`)
        res.end()
    }
    sseEmitter.on(`progress:${uuid}`, onProgress)
    sseEmitter.once(`complete:${uuid}`, onComplete)

    req.on('close', () => {
        sseEmitter.removeListener(`complete:${uuid}`, onComplete)
    })
})
export default router
