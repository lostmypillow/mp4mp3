import {S3Client, PutObjectCommand}  from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {v7 as uuid} from "uuid";

const ALLOWED_ORIGINS = [
    'https://mp4mp3.lostmypillow.com',
    'http://localhost:5173'
];

const s3 = new S3Client({});

export const handler = async (event) => {
    try {
        const body = JSON.parse(event.body || '{}');
        const jobId = uuid()
        const rawFilename = (body.filename || 'upload.mp4').replace(/["\r\n]/g, '');
        const safeFilename = rawFilename.toLowerCase().endsWith('.mp4') ? rawFilename : `${rawFilename}.mp4`;
        const contentType = body.contentType || 'application/octet-stream';
        const command = new PutObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: `${jobId}/${safeFilename}`,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(s3, command, {expiresIn: 300});

        return {
            statusCode: 200,
            body: JSON.stringify({
                url: uploadUrl,
                key: `${jobId}/${safeFilename}`
            }
            ),
        };
    } catch (err) {
        console.error("Error generating upload S3 URL", err)
        return {
            statusCode: 500,
            body: JSON.stringify({error: "Error generating upload S3 URL"}),
        };
    }
};