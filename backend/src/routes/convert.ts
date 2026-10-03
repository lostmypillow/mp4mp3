import { Request, Response, NextFunction, Router } from 'express'
import { sseEmitter } from '../lib/sse.js'
import {
    GetObjectCommand,
    PutObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import * as fs from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { convertMp4ToMp3 } from '../lib/convertMp4ToMp3.js'
import { internalS3Client } from '../lib/s3Client.js'

let inputPath: string, outputPath: string, bucketName: string, objectKey: string
const router = Router()

const MAX_FILE_SIZE_BYTES =
    Number(process.env.MAX_FILE_SIZE || 600) * 1024 * 1024

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

router.post(
    '/events',
    normalizeS3Events,
    async (req: Request, res: Response) => {
        try {
            const event = req.body
            const detail = event.detail

            if (!detail || !detail.bucket || !detail.object) {
                console.error('Invalid EventBridge payload')
                return res.status(400).send('Invalid EventBridge payload')
            }

            bucketName = detail.bucket.name
            objectKey = detail.object.key
            const objectSize = detail.object.size

            if (!bucketName || !objectKey) {
                return res
                    .status(200)
                    .send('Ignored: Missing bucket or object key')
            }
            if (!objectKey.toLowerCase().endsWith('.mp4')) {
                return res.status(200).send('Ignored: Not an MP4 file')
            }
            if (
                objectSize > MAX_FILE_SIZE_BYTES &&
                process.env.VITE_IS_AWS === 'true'
            ) {
                console.warn(
                    `File ${objectKey} rejected. Size (${objectSize} bytes) exceeds limit.`
                )

                try {
                    await internalS3Client.send(
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

            const uuid = req.body?.detail?.object?.key?.split('/')[0]
            inputPath = `/tmp/input_${uuid}.mp4`
            outputPath = `/tmp/output_${uuid}.mp3`

            console.time('Download S3 Object')
            const response = await internalS3Client.send(
                new GetObjectCommand({ Bucket: bucketName, Key: objectKey })
            )
            if (!response.Body) {
                throw new Error('S3 GetObject returned empty body')
            }
            await pipeline(
                response.Body as NodeJS.ReadableStream,
                fs.createWriteStream(inputPath)
            )
            console.timeEnd('Download S3 Object')

            console.time('FFmpeg Conversion')
            await convertMp4ToMp3(inputPath, outputPath, uuid)
            console.timeEnd('FFmpeg Conversion')

            // 4. Construct valid output key replacing .mp4 with .mp3
            const outputKey = objectKey.replace(/\.mp4$/i, '.mp3')

            console.time('Upload MP3 to S3')
            await internalS3Client.send(
                new PutObjectCommand({
                    Bucket: bucketName,
                    Key: outputKey,
                    Body: fs.createReadStream(outputPath),
                    ContentType: 'audio/mpeg',
                })
            )
            console.timeEnd('Upload MP3 to S3')
            sseEmitter.emit(`complete:${uuid}`, { progress: 1.0 })

            res.status(200).send('OK')
        } catch (err: any) {
            console.error(
                `Failed to process ${objectKey}:`,
                err?.message || err
            )

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
