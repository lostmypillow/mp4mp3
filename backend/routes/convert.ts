import { Request, Response, NextFunction, Router } from 'express'
import { handler } from '../../aws/src/convert.js'
import { sseEmitter } from '../sse.js'
import { handler as downloadHandler } from '../../aws/src/download.js'

const router = Router()
function normalizeS3Events(req: Request, res: Response, next: NextFunction) {
    const body = req.body

    if (body?.Records?.[0]?.s3) {
        const s3Record = body.Records[0].s3

        // Normalize payload structure to mirror EventBridge
        req.body = {
            detail: {
                bucket: {
                    name: s3Record.bucket.name,
                },
                object: {
                    // MinIO URL-encodes spaces (+ or %20); decode to retain original file name
                    key: decodeURIComponent(
                        s3Record.object.key.replace(/\+/g, ' ')
                    ),
                    size: s3Record.object.size,
                },
            },
        }
    }

    next()
}
function fixPresignedUrl(url: string): string {
    const publicEndpoint = process.env.SELF_HOSTED_S3_PUBLIC_ENDPOINT

    if (!url || !publicEndpoint) return url

    return url.replace(/^https?:\/\/[^\/]+/, publicEndpoint)
}

// Attach middleware directly to your events endpoint
router.post(
    '/events',
    normalizeS3Events,
    async (req: Request, res: Response) => {
        try {
            await handler(req.body)
            const key = req.body?.detail?.object?.key
            const uuid = key?.split('/')[0]
            if (uuid) {
                // Generate the presigned download URL immediately
                const response = JSON.parse(
                    (
                        await downloadHandler({
                            queryStringParameters: { uuid },
                        } as any)
                    ).body
                )

                if (response?.url) {
                    response.url = fixPresignedUrl(response.url)
                }
                sseEmitter.emit(`complete:${uuid}`, response)
            }

            res.status(200).send('OK')
        } catch (err: any) {
            console.error('Convert handler error:', err?.message || err)
            res.status(500).json({
                error: err?.message || 'Conversion event processing failed',
            })
        }
    }
)

router.get('/stream', (req: Request, res: Response) => {
    const uuid = req.query.uuid as string
    if (!uuid) return res.status(400).send('Missing UUID')
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    const onComplete = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`)
        res.end() // Close stream after delivery
    }
    sseEmitter.once(`complete:${uuid}`, onComplete)
    req.on('close', () => {
        sseEmitter.removeListener(`complete:${uuid}`, onComplete)
    })
})
export default router
