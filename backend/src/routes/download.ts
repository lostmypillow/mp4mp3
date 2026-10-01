import { Request, Response, Router } from 'express'
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { internalS3Client, publicS3Client } from '../lib/s3Client.js'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
    try {
        if (!req.query.uuid) {
            return res.status(400).json({ error: 'Missing or invalid UUID.' })
        }
        const listCommand = new ListObjectsV2Command({
            Bucket: process.env.UPLOAD_BUCKET_NAME,
            Prefix: `${req.query.uuid}/`,
        })

        const listResults = await internalS3Client.send(listCommand)

        if (!listResults.Contents || listResults.Contents.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'No files found for this UUID.',
            })
        }

        const actualKey = listResults.Contents[0].Key

        if (!actualKey) {
            throw new Error('Missing object key')
        } else if (!actualKey.toLowerCase().endsWith('.mp3')) {
            return res.status(202).json({ status: 'processing' })
        } else {
            const rawFilename = actualKey
                ?.split('/')
                ?.pop()
                ?.replace(/["\r\n]/g, '')
            const safeFilename = rawFilename?.toLowerCase().endsWith('.mp3')
                ? rawFilename
                : `${rawFilename}.mp3`
            const asciiFilename = safeFilename
                .replace(/[—–]/g, '-')
                .replace(/[^\x20-\x7E]/g, '_') // Full UTF-8 encoded filename for modern browsers
            const encodedFilename = encodeURIComponent(safeFilename).replace(
                /\*/g,
                '%2A'
            )

            const command = new GetObjectCommand({
                Bucket: process.env.UPLOAD_BUCKET_NAME,
                Key: actualKey,
                ResponseContentDisposition: `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
            })

            const downloadUrl = await getSignedUrl(publicS3Client, command, {
                expiresIn: 300,
            })

            return res.status(200).json({
                status: 'complete',
                url: downloadUrl,
                key: actualKey,
            })
        }
    } catch (err) {
        console.error('Handler error:', err)
        res.status(500).json({ error: 'Execution failed' })
    }
})
export default router
