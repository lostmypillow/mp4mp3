import { describe, it, expect, beforeEach } from 'vitest'
import { responseSchema } from '../src/lib/responseSchema.js'
import { sseEmitter } from '../src/lib/sse.js'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client } from '@aws-sdk/client-s3'

const s3Mock = mockClient(S3Client)

describe('Backend Core Utilities & Schema Unit Tests', () => {
    beforeEach(() => {
        s3Mock.reset()
        process.env.UPLOAD_BUCKET_NAME = 'mp4mp3-test-bucket'
    })

    describe('responseSchema (Zod validation)', () => {
        it('should successfully parse valid response object', () => {
            const validData = {
                url: 'https://s3.example.com/file.mp4',
                key: 'uuid-1234/file.mp4',
            }
            const result = responseSchema.safeParse(validData)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.url).toBe(validData.url)
                expect(result.data.key).toBe(validData.key)
            }
        })

        it('should fail validation when url is missing', () => {
            const invalidData = { key: 'uuid-1234/file.mp4' }
            const result = responseSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
        })

        it('should fail validation when key is missing', () => {
            const invalidData = { url: 'https://s3.example.com/file.mp4' }
            const result = responseSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
        })

        it('should fail validation when fields are not strings', () => {
            const invalidData = { url: 12345, key: true }
            const result = responseSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
        })
    })

    describe('sseEmitter', () => {
        it('should support subscribe, emit, and remove listener pattern', () => {
            let received: any = null
            const listener = (data: any) => {
                received = data
            }

            sseEmitter.on('test-event', listener)
            sseEmitter.emit('test-event', { value: 42 })

            expect(received).toEqual({ value: 42 })

            sseEmitter.removeListener('test-event', listener)
            sseEmitter.emit('test-event', { value: 99 })

            expect(received).toEqual({ value: 42 })
        })
    })
})
