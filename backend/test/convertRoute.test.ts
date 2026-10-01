import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import ConvertRouter from '../src/routes/convert.js'
import { sseEmitter } from '../src/lib/sse.js'
import http, { type Server } from 'node:http'
import { mockClient } from 'aws-sdk-client-mock'
import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
} from '@aws-sdk/client-s3'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

const s3Mock = mockClient(S3Client)

describe('Convert Router unit tests (/convert)', () => {
    let server: Server
    let baseUrl: string
    const sampleMp4Path = path.join(process.cwd(), 'test.mp4')

    beforeAll(async () => {
        delete process.env.AWS_PROFILE
        process.env.AWS_ACCESS_KEY_ID = 'test'
        process.env.AWS_SECRET_ACCESS_KEY = 'test'
        process.env.AWS_REGION = 'us-east-1'
        process.env.UPLOAD_BUCKET_NAME = 'test-bucket'

        const app = express()
        app.use(express.json())
        app.use('/convert', ConvertRouter)

        await new Promise<void>((resolve) => {
            server = app.listen(0, () => {
                const addr = server.address()
                if (typeof addr === 'object' && addr !== null) {
                    baseUrl = `http://localhost:${addr.port}`
                }
                resolve()
            })
        })
    })

    afterAll(async () => {
        if (server) {
            await new Promise<void>((resolve) => server.close(() => resolve()))
        }
    })

    beforeEach(() => {
        s3Mock.reset()
    })

    describe('GET /convert/stream (SSE)', () => {
        it('should return 400 when uuid query parameter is missing', async () => {
            const res = await fetch(`${baseUrl}/convert/stream`)
            expect(res.status).toBe(400)
            const text = await res.text()
            expect(text).toBe('Missing UUID')
        })

        it('should establish SSE stream with proper headers and receive progress and complete events', async () => {
            const uuid = 'sse-test-uuid'
            const receivedChunks: string[] = []

            await new Promise<void>((resolve, reject) => {
                const req = http.get(
                    `${baseUrl}/convert/stream?uuid=${uuid}`,
                    (res) => {
                        expect(res.statusCode).toBe(200)
                        expect(res.headers['content-type']).toBe(
                            'text/event-stream'
                        )
                        expect(res.headers['cache-control']).toBe('no-cache')
                        expect(res.headers['connection']).toBe('keep-alive')

                        res.setEncoding('utf8')
                        res.on('data', (chunk) => {
                            receivedChunks.push(chunk)
                        })
                        res.on('end', () => {
                            const fullOutput = receivedChunks.join('')
                            expect(fullOutput).toContain('{"progress":0.5}')
                            expect(fullOutput).toContain(
                                '{"status":"complete"}'
                            )
                            resolve()
                        })
                    }
                )

                req.on('error', reject)

                setTimeout(() => {
                    sseEmitter.emit(`progress:${uuid}`, { progress: 0.5 })
                }, 50)

                setTimeout(() => {
                    sseEmitter.emit(`complete:${uuid}`, { status: 'complete' })
                }, 100)
            })
        })
    })

    describe('POST /convert/events', () => {
        it('should successfully process EventBridge event and convert MP4 to MP3', async () => {
            const uuid = 'conv-test-123'
            const objectKey = `${uuid}/video.mp4`

            s3Mock.on(GetObjectCommand).resolves({
                Body: Readable.from(fs.readFileSync(sampleMp4Path)) as any,
            })
            s3Mock.on(PutObjectCommand).resolves({})

            let completeEmitted = false
            sseEmitter.once(`complete:${uuid}`, () => {
                completeEmitted = true
            })

            const res = await fetch(`${baseUrl}/convert/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    detail: {
                        bucket: { name: 'test-bucket' },
                        object: { key: objectKey, size: 1024 * 1024 },
                    },
                }),
            })

            expect(res.status).toBe(200)
            const text = await res.text()
            expect(text).toBe('OK')
            expect(completeEmitted).toBe(true)

            const putCalls = s3Mock.commandCalls(PutObjectCommand)
            expect(putCalls.length).toBe(1)
            expect(putCalls[0].args[0].input.Key).toBe(`${uuid}/video.mp3`)
            expect(putCalls[0].args[0].input.ContentType).toBe('audio/mpeg')
        })

        it('should normalize S3 event notification format with URL decoded key', async () => {
            const uuid = 's3-norm-test'
            const rawKey = `${uuid}/sample+clip%201.mp4`

            s3Mock.on(GetObjectCommand).resolves({
                Body: Readable.from(fs.readFileSync(sampleMp4Path)) as any,
            })
            s3Mock.on(PutObjectCommand).resolves({})

            const s3NotificationPayload = {
                Records: [
                    {
                        s3: {
                            bucket: { name: 'test-bucket' },
                            object: {
                                key: rawKey,
                                size: 1024 * 1024,
                            },
                        },
                    },
                ],
            }

            const res = await fetch(`${baseUrl}/convert/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(s3NotificationPayload),
            })

            expect(res.status).toBe(200)
            const putCalls = s3Mock.commandCalls(PutObjectCommand)
            expect(putCalls.length).toBe(1)
            expect(putCalls[0].args[0].input.Key).toBe(
                `${uuid}/sample clip 1.mp3`
            )
        })

        it('should return 500 when S3 GetObject fails', async () => {
            s3Mock.on(GetObjectCommand).rejects(new Error('S3 Download Failed'))

            const res = await fetch(`${baseUrl}/convert/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    detail: {
                        bucket: { name: 'test-bucket' },
                        object: { key: 'error-uuid/video.mp4', size: 1024 },
                    },
                }),
            })

            expect(res.status).toBe(500)
            const data = (await res.json()) as { error: string }
            expect(data.error).toBe('S3 Download Failed')
        })
    })
})
