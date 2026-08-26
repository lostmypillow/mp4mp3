import { describe, it, expect, beforeEach } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { handler } from '../src/download.js'

const s3Mock = mockClient(S3Client)

describe('AWS Download Handler', () => {
    beforeEach(() => {
        s3Mock.reset()
        delete process.env.AWS_PROFILE
        process.env.AWS_ACCESS_KEY_ID = 'test'
        process.env.AWS_SECRET_ACCESS_KEY = 'test'
        process.env.AWS_REGION = 'us-east-1'
        process.env.BUCKET_NAME = 'test-bucket'
        delete process.env.SELF_HOSTED_S3_PUBLIC_ENDPOINT
        delete process.env.SELF_HOSTED_S3_ENDPOINT
    })

    it('should return 400 error if UUID is missing', async () => {
        const event = { queryStringParameters: {} }
        const result = await handler(event)

        expect(result.statusCode).toBe(400)
        const body = JSON.parse(result.body)
        expect(body.error).toBe('Missing or invalid UUID.')
    })

    it('should return 404 error if no objects match UUID', async () => {
        s3Mock.on(ListObjectsV2Command).resolves({ Contents: [] })

        const event = { queryStringParameters: { uuid: 'test-uuid-123' } }
        const result = await handler(event)

        expect(result.statusCode).toBe(404)
        const body = JSON.parse(result.body)
        expect(body.status).toBe('error')
    })

    it('should return 202 processing status if file is still .mp4', async () => {
        s3Mock.on(ListObjectsV2Command).resolves({
            Contents: [{ Key: 'test-uuid-123/upload.mp4' }],
        })

        const event = { queryStringParameters: { uuid: 'test-uuid-123' } }
        const result = await handler(event)

        expect(result.statusCode).toBe(202)
        const body = JSON.parse(result.body)
        expect(body.status).toBe('processing')
    })

    it('should return 200 complete status with presigned URL if .mp3 exists', async () => {
        s3Mock.on(ListObjectsV2Command).resolves({
            Contents: [{ Key: 'test-uuid-123/upload.mp3' }],
        })

        const event = { queryStringParameters: { uuid: 'test-uuid-123' } }
        const result = await handler(event)

        expect(result.statusCode).toBe(200)
        const body = JSON.parse(result.body)
        expect(body.status).toBe('complete')
        expect(body.url).toBeDefined()
        expect(body.key).toBe('test-uuid-123/upload.mp3')
    })
})
