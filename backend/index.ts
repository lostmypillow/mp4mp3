import './initEnv.js';
import express, { type Express, type Response } from 'express';
import path from "node:path";
import ConvertRouter from './routes/convert.js';
import UploadRouter from './routes/upload.js';
import DownloadRouter from './routes/download.js';

const app: Express = express();
const staticPath = path.join(import.meta.dirname, 'public');
app.use(express.json());
app.use('/upload', UploadRouter);
app.use('/download', DownloadRouter);
app.use('/convert', ConvertRouter);
app.use(express.static(staticPath));
app.get('{*splat}', (res: Response) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

app.listen(3000);
