import { describe, it, expect, beforeEach } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { handler } from '../src/convert.js'

const s3Mock = mockClient(S3Client)

describe('AWS Convert Handler', () => {
    beforeEach(() => {
        s3Mock.reset()
        process.env.BUCKET_NAME = 'test-bucket'
        process.env.MAX_FILE_SIZE = '600'
    })

    it('should ignore invalid payload missing bucket or object key', async () => {
        const event = { detail: {} }
        await expect(handler(event)).resolves.not.toThrow()
    })

    it('should reject and delete oversized files', async () => {
        s3Mock.on(DeleteObjectCommand).resolves({})

        const oversizedEvent = {
            detail: {
                bucket: { name: 'test-bucket' },
                object: {
                    key: 'uuid-123/large.mp4',
                    size: 700 * 1024 * 1024, // 700MB > 600MB
                },
            },
        }

        await handler(oversizedEvent)
        expect(s3Mock.commandCalls(DeleteObjectCommand).length).toBe(1)
    })

    it('should ignore non-MP4 files', async () => {
        const txtEvent = {
            detail: {
                bucket: { name: 'test-bucket' },
                object: {
                    key: 'uuid-123/document.txt',
                    size: 1024,
                },
            },
        }

        await handler(txtEvent)
        expect(s3Mock.commandCalls(DeleteObjectCommand).length).toBe(0)
    })
})
