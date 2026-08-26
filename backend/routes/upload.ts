import  { Request, Response, Router} from 'express'
import { handler } from '../../aws/src/upload.js'
import { responseInterface } from '../responseSchema.js'
const router = Router()
function fixPresignedUrl(url: string): string {
    const publicEndpoint = process.env.SELF_HOSTED_S3_PUBLIC_ENDPOINT

    if (!url || !publicEndpoint) return url

    return url.replace(/^https?:\/\/[^\/]+/, publicEndpoint)
}
router.post('/', async (req: Request, res: Response) => {
    try {

        const response: responseInterface = JSON.parse((await handler(req.body)).body)

        if (response?.url) {
            response.url = fixPresignedUrl(response.url)
        }

        res.status(200).json(response)
    } catch (err) {
        console.error('Handler error:', err)
        res.status(500).json({ error: 'Execution failed' })
    }
})
export default router
