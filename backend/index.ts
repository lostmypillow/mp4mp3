import './initEnv.js'
import express, { type Express, type Response } from 'express'
import path from 'node:path'
import ConvertRouter from './routes/convert.js'
import UploadRouter from './routes/upload.js'
import DownloadRouter from './routes/download.js'
import cors from 'cors'
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://mp4mp3-dev.lostmypillow.com',
        'https://mp4mp3-prod.lostmypillow.com',
        'https://mp4mp3.lostmypillow.com',
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
}
const app: Express = express()
const staticPath = path.join(import.meta.dirname, 'public')
app.use(express.json())
app.use(cors(corsOptions))
app.use('/upload', UploadRouter)
app.use('/download', DownloadRouter)
app.use('/convert', ConvertRouter)
app.use(express.static(staticPath))
app.get('{*splat}', (res: Response) => {
    res.sendFile(path.join(staticPath, 'index.html'))
})

export default app
