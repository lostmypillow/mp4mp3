import express, { type Express } from 'express'
import ConvertRouter from './routes/convert.js'
import UploadRouter from './routes/upload.js'
import DownloadRouter from './routes/download.js'
import cors from 'cors'

const app: Express = express()
app.use(express.json())
app.use(
    cors({
        origin: [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:5174',
            'https://mp4mp3-dev.lostmypillow.com',
            'https://mp4mp3-prod.lostmypillow.com',
            'https://mp4mp3.lostmypillow.com',
        ],
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true,
    })
)
app.use('/upload', UploadRouter)
app.use('/download', DownloadRouter)
app.use('/convert', ConvertRouter)

export default app
