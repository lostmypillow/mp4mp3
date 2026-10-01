import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import express from 'express'
import DownloadRouter from '../src/routes/download.js'
import type { Server } from 'node:http'
import { mockClient } from 'aws-sdk-client-mock'
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

const s3Mock = mockClient(S3Client)

describe('GET /download route unit tests', () => {
    let server: Server
    let baseUrl: string

    beforeAll(async () => {
        delete process.env.AWS_PROFILE
        process.env.AWS_ACCESS_KEY_ID = 'test'
        process.env.AWS_SECRET_ACCESS_KEY = 'test'
        process.env.AWS_REGION = 'us-east-1'
        process.env.UPLOAD_BUCKET_NAME = 'test-bucket'
        process.env.PUBLIC_S3_ENDPOINT = 'http://localhost:9000'
        process.env.INTERNAL_S3_ENDPOINT = 'http://localhost:9000'

        const app = express()
        app.use(express.json())
        app.use('/download', DownloadRouter)

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

    it('should return 404 when no files are found for the given UUID', async () => {
        s3Mock.on(ListObjectsV2Command).resolves({
            Contents: [],
        })

        const res = await fetch(`${baseUrl}/download?uuid=non-existent-uuid`)
        expect(res.status).toBe(404)
        const data = (await res.json()) as { status: string; message: string }
        expect(data.status).toBe('error')
        expect(data.message).toBe('No files found for this UUID.')
    })

    it('should return 202 processing when the file is still an MP4', async () => {
        s3Mock.on(ListObjectsV2Command).resolves({
            Contents: [{ Key: '1234-uuid/video.mp4' }],
        })

        const res = await fetch(`${baseUrl}/download?uuid=1234-uuid`)
        expect(res.status).toBe(202)
        const data = (await res.json()) as { status: string }
        expect(data.status).toBe('processing')
    })

    it('should return 200 with presigned download URL when MP3 conversion is complete', async () => {
        s3Mock.on(ListObjectsV2Command).resolves({
            Contents: [{ Key: '1234-uuid/video.mp3' }],
        })

        const res = await fetch(`${baseUrl}/download?uuid=1234-uuid`)
        expect(res.status).toBe(200)
        const data = (await res.json()) as {
            status: string
            url: string
            key: string
        }
        expect(data.status).toBe('complete')
        expect(data.key).toBe('1234-uuid/video.mp3')
        expect(data.url).toBeDefined()
        expect(typeof data.url).toBe('string')
    })

    it('should properly handle non-ASCII / Unicode filename in S3 key', async () => {
        s3Mock.on(ListObjectsV2Command).resolves({
            Contents: [{ Key: '1234-uuid/測試音頻.mp3' }],
        })

        const res = await fetch(`${baseUrl}/download?uuid=1234-uuid`)
        expect(res.status).toBe(200)
        const data = (await res.json()) as {
            status: string
            url: string
            key: string
        }
        expect(data.status).toBe('complete')
        expect(data.key).toBe('1234-uuid/測試音頻.mp3')
        expect(data.url).toBeDefined()
    })

    it('should return 500 when S3 list operation throws an error', async () => {
        s3Mock
            .on(ListObjectsV2Command)
            .rejects(new Error('S3 connection error'))

        const res = await fetch(`${baseUrl}/download?uuid=error-uuid`)
        expect(res.status).toBe(500)
        const data = (await res.json()) as { error: string }
        expect(data.error).toBe('Execution failed')
    })
})
