import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import UploadRouter from '../routes/upload.js';
import DownloadRouter from '../routes/download.js';
import ConvertRouter from '../routes/convert.js';
import type { Server } from 'node:http';

describe('Express Backend Routes (Pure Vitest)', () => {
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
        delete process.env.AWS_PROFILE;
        process.env.AWS_ACCESS_KEY_ID = 'test';
        process.env.AWS_SECRET_ACCESS_KEY = 'test';
        process.env.AWS_REGION = 'us-east-1';
        process.env.BUCKET_NAME = 'test-bucket';

        const app = express();
        app.use(express.json());
        app.use('/upload', UploadRouter);
        app.use('/download', DownloadRouter);
        app.use('/convert', ConvertRouter);

        await new Promise<void>((resolve) => {
            server = app.listen(0, () => {
                const addr = server.address();
                if (typeof addr === 'object' && addr !== null) {
                    baseUrl = `http://localhost:${addr.port}`;
                }
                resolve();
            });
        });
    });

    afterAll(async () => {
        if (server) {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

    it('POST /upload should return presigned upload URL', async () => {
        const res = await fetch(`${baseUrl}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: 'test.mp4', contentType: 'video/mp4' }),
        });

        expect(res.status).toBe(200);
        const data: any = await res.json();
        expect(data.url).toBeDefined();
        expect(data.key).toMatch(/test\.mp4$/);
    });

    it('GET /download without UUID should return 400', async () => {
        const res = await fetch(`${baseUrl}/download`);
        expect(res.status).toBe(400);
        const data: any = await res.json();
        expect(data.error).toBe('Missing or invalid UUID.');
    });

    it('GET /convert/stream without UUID should return 400', async () => {
        const res = await fetch(`${baseUrl}/convert/stream`);
        expect(res.status).toBe(400);
    });
});
