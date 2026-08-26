import { describe, it, expect, beforeEach } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client } from '@aws-sdk/client-s3'
import { handler } from '../src/upload.js'

const s3Mock = mockClient(S3Client)

describe('AWS Upload Handler', () => {
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

    it('should generate upload presigned URL for string event.body (API Gateway format)', async () => {
        const event = {
            body: JSON.stringify({
                filename: 'sample.mp4',
                contentType: 'video/mp4',
            }),
        }

        const result = await handler(event)
        expect(result.statusCode).toBe(200)

        const body = JSON.parse(result.body)
        expect(body.url).toBeDefined()
        expect(body.key).toMatch(/\/sample\.mp4$/)
    })

    it('should generate upload presigned URL for object event (Express format)', async () => {
        const event = {
            filename: 'my_video.mp4',
            contentType: 'video/mp4',
        }

        const result = await handler(event)
        expect(result.statusCode).toBe(200)

        const body = JSON.parse(result.body)
        expect(body.url).toBeDefined()
        expect(body.key).toMatch(/\/my_video\.mp4$/)
    })

    it('should fallback to upload.mp4 if filename is missing', async () => {
        const event = {
            contentType: 'video/mp4',
        }

        const result = await handler(event)
        expect(result.statusCode).toBe(200)

        const body = JSON.parse(result.body)
        expect(body.key).toMatch(/\/upload\.mp4$/)
    })
})
