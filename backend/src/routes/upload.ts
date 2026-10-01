import { Request, Response, Router } from 'express'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'node:crypto'
import { publicS3Client } from '../lib/s3Client.js'

const router = Router()

router.post('/', async (req: Request, res: Response) => {
    try {
        const jobId = randomUUID()
        const body = req.body
        const contentType = body.contentType
        if (!body.filename.toLowerCase().endsWith('.mp4')) {
            return res.status(400).json({ error: 'Non-MP4 not supported!' })
        }
        const originalFilename = (
            body.filename || `${randomUUID()}.mp4`
        ).replace(/["\r\n]/g, '')

        const command = new PutObjectCommand({
            Bucket: process.env.UPLOAD_BUCKET_NAME,
            Key: `${jobId}/${originalFilename}`,
            ContentType: contentType,
        })

        const uploadUrl = await getSignedUrl(publicS3Client, command, {
            expiresIn: 300,
        })
        console.log({
            url: uploadUrl,
            key: `${jobId}/${originalFilename}`,
        })

        return res.status(200).json({
            url: uploadUrl,
            key: `${jobId}/${originalFilename}`,
        })
    } catch (err) {
        console.error('Handler error:', err)
        return res.status(500).json({ error: 'Error generating upload S3 URL' })
    }
})
export default router
