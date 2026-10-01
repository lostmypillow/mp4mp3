import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import type { Server } from 'node:http'

describe('POST /upload route unit tests', () => {
    let server: Server
    let baseUrl: string

    beforeAll(async () => {
        delete process.env.AWS_PROFILE
        process.env.AWS_ACCESS_KEY_ID = 'test'
        process.env.AWS_SECRET_ACCESS_KEY = 'test'
        process.env.AWS_REGION = 'us-east-1'
        process.env.UPLOAD_BUCKET_NAME = 'test-bucket'
        process.env.PUBLIC_S3_ENDPOINT = 'http://localhost:9000'
        const { default: UploadRouter } =
            await import('../src/routes/upload.js')

        const app = express()
        app.use(express.json())
        app.use('/upload', UploadRouter)

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

    it('should return 200 and presigned URL for a valid MP4 filename', async () => {
        const res = await fetch(`${baseUrl}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: 'my_video.mp4',
                contentType: 'video/mp4',
            }),
        })

        expect(res.status).toBe(200)
        const data = (await res.json()) as { url: string; key: string }
        expect(data.url).toBeDefined()
        expect(typeof data.url).toBe('string')
        expect(data.url.startsWith('http://localhost:9000')).toBeTruthy()
        expect(data.key).toMatch(/^[0-9a-fA-F-]+\/my_video\.mp4$/)
    })

    it('should reject non-MP4 files with status 400', async () => {
        const res = await fetch(`${baseUrl}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: 'song.mp3',
                contentType: 'audio/mpeg',
            }),
        })

        expect(res.status).toBe(400)
        const data = (await res.json()) as { error: string }
        expect(data.error).toBe('Non-MP4 not supported!')
    })

    it('should reject uppercase non-MP4 extensions (e.g. .AVI, .MOV)', async () => {
        const res = await fetch(`${baseUrl}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: 'video.AVI',
                contentType: 'video/avi',
            }),
        })

        expect(res.status).toBe(400)
        const data = (await res.json()) as { error: string }
        expect(data.error).toBe('Non-MP4 not supported!')
    })

    it('should sanitize dangerous characters (quotes, CR, LF) in the filename', async () => {
        const res = await fetch(`${baseUrl}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: 'bad"name\r\n_test.mp4',
                contentType: 'video/mp4',
            }),
        })

        expect(res.status).toBe(200)
        const data = (await res.json()) as { url: string; key: string }
        expect(data.key).not.toContain('"')
        expect(data.key).not.toContain('\r')
        expect(data.key).not.toContain('\n')
        expect(data.url.startsWith('http://localhost:9000')).toBeTruthy()
        expect(data.key).toMatch(/badname_test\.mp4$/)
    })

    it('should accept uppercase .MP4 extension when validating', async () => {
        const res = await fetch(`${baseUrl}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: 'CLIP.MP4',
                contentType: 'video/mp4',
            }),
        })

        expect(res.status).toBe(200)
        const data = (await res.json()) as { url: string; key: string }
        expect(data.key).toMatch(/CLIP\.MP4$/)
    })
})
