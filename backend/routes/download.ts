import { Request, Response, Router} from 'express'
import { handler } from '../../aws/src/download.js'
import { responseInterface} from '../responseSchema.js'
const router = Router()
function fixPresignedUrl(url: string): string {
    const publicEndpoint = process.env.SELF_HOSTED_S3_PUBLIC_ENDPOINT

    if (!url || !publicEndpoint) return url

    return url.replace(/^https?:\/\/[^\/]+/, publicEndpoint)
}

router.get('/', async (req: Request, res: Response) => {
    try {
        const rawRes = await handler({ queryStringParameters: req.query as any } as any)
        const statusCode = rawRes.statusCode || 200
        const response: responseInterface = JSON.parse(rawRes.body)

        if (response?.url) {
            response.url = fixPresignedUrl(response.url)
        }

        res.status(statusCode).json(response)
    } catch (err) {
        console.error('Handler error:', err)
        res.status(500).json({ error: 'Execution failed' })
    }
})
export default router
