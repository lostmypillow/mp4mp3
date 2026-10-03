import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import app from '../src/index.js'
import type { Server } from 'node:http'
import { mockClient } from 'aws-sdk-client-mock'
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

const s3Mock = mockClient(S3Client)

describe('Express App Integration Tests (backend/index.ts)', () => {
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

    it('should generate presigned upload URL on POST /upload', async () => {
        const res = await fetch(`${baseUrl}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: 'integration_test.mp4',
                contentType: 'video/mp4',
            }),
        })

        expect(res.status).toBe(200)
        const data = (await res.json()) as { url: string; key: string }
        expect(data.url).toBeDefined()
        expect(data.key).toMatch(/integration_test\.mp4$/)
    })

    it('should reject invalid file format on POST /upload', async () => {
        const res = await fetch(`${baseUrl}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: 'document.pdf',
                contentType: 'application/pdf',
            }),
        })

        expect(res.status).toBe(400)
        const data = (await res.json()) as { error: string }
        expect(data.error).toBe('Non-MP4 not supported!')
    })

    it('should return 400 on GET /convert/stream without UUID parameter', async () => {
        const res = await fetch(`${baseUrl}/convert/stream`)
        expect(res.status).toBe(400)
        const text = await res.text()
        expect(text).toBe('Missing UUID')
    })

    it('should return 404 on GET /download when UUID has no objects', async () => {
        s3Mock.on(ListObjectsV2Command).resolves({
            Contents: [],
        })

        const res = await fetch(`${baseUrl}/download?uuid=empty-uuid`)
        expect(res.status).toBe(404)
        const data = (await res.json()) as { status: string; message: string }
        expect(data.status).toBe('error')
        expect(data.message).toBe('No files found for this UUID.')
    })

    it('should handle CORS headers properly for allowed origins', async () => {
        const res = await fetch(`${baseUrl}/upload`, {
            method: 'OPTIONS',
            headers: {
                Origin: 'http://localhost:5173',
                'Access-Control-Request-Method': 'POST',
            },
        })

        expect(res.headers.get('access-control-allow-origin')).toBe(
            'http://localhost:5173'
        )
        expect(res.headers.get('access-control-allow-credentials')).toBe('true')
    })
})
