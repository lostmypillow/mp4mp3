import {
    S3Client,
    GetObjectCommand,
    PutObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { execFile as execFileCallback } from 'node:child_process'
import * as fs from 'node:fs'
import { pipeline } from 'node:stream/promises'
import util from 'node:util'
const execFile = util.promisify(execFileCallback)
const s3 = new S3Client({
    endpoint: process.env.SELF_HOSTED_S3_ENDPOINT,
    forcePathStyle: !!process.env.SELF_HOSTED_S3_ENDPOINT,
})
const MAX_FILE_SIZE_BYTES =
    Number(process.env.MAX_FILE_SIZE || 600) * 1024 * 1024
export const handler = async (event) => {
    const detail = event.detail

    // Ensure the event contains the expected S3 object details
    if (!detail || !detail.bucket || !detail.object) {
        console.error('Invalid EventBridge payload')
        return
    }

    const bucketName = detail.bucket.name
    const objectKey = detail.object.key
    const objectSize = detail.object.size

    if (!bucketName || !objectKey) {
        console.log(
            'Ignored: Missing bucket or object key in EventBridge payload.'
        )
        return
    }

    // 1. Check the file size
    if (objectSize > MAX_FILE_SIZE_BYTES) {
        console.warn(
            `File ${objectKey} rejected. Size (${objectSize} bytes) exceeds limit.`
        )

        // 2. Delete the oversized file to protect S3 Free Tier storage
        try {
            await s3.send(
                new DeleteObjectCommand({
                    Bucket: bucketName,
                    Key: objectKey,
                })
            )
            console.log(`Successfully deleted oversized file: ${objectKey}`)
        } catch (deleteErr) {
            console.error(
                `Failed to delete oversized file ${objectKey}:`,
                deleteErr
            )
        }
        return
    }

    console.log(
        `File size is ${objectSize} bytes. Proceeding with conversion for ${objectKey}.`
    )

    if (!objectKey.toLowerCase().endsWith('.mp4')) {
        console.log(`Ignored: Object ${objectKey} is not an MP4 file.`)
        return
    }

    const uniqueId = Date.now()
    const inputPath = `/tmp/input_${uniqueId}.mp4`
    const outputPath = `/tmp/output_${uniqueId}.mp3`

    try {
        console.time('Download S3 Object')
        const response = await s3.send(
            new GetObjectCommand({ Bucket: bucketName, Key: objectKey })
        )
        await pipeline(response.Body, fs.createWriteStream(inputPath))
        console.timeEnd('Download S3 Object')

        console.time('FFmpeg Conversion')
        // 3. Use execFile to prevent shell injection hazards
        await execFile('ffmpeg', [
            '-y',
            '-i',
            inputPath,
            '-vn',
            '-acodec',
            'libmp3lame',
            '-q:a',
            '2',
            outputPath,
        ])
        console.timeEnd('FFmpeg Conversion')

        // 4. Construct valid output key replacing .mp4 with .mp3
        const outputKey = objectKey.replace(/\.mp4$/i, '.mp3')

        console.time('Upload MP3 to S3')
        await s3.send(
            new PutObjectCommand({
                Bucket: bucketName,
                Key: outputKey,
                Body: fs.createReadStream(outputPath),
                ContentType: 'audio/mpeg',
            })
        )
        console.timeEnd('Upload MP3 to S3')
    } catch (err) {
        console.error(`Failed to process ${objectKey}:`, err)
        try {
            await s3.send(
                new DeleteObjectCommand({
                    Bucket: bucketName,
                    Key: objectKey,
                })
            )
            console.log(`Deleted file after failure to process: ${objectKey}`)
        } catch (deleteErr) {
            console.error(
                `Failed to delete failed file ${objectKey}:`,
                deleteErr
            )
        }

        throw err
    } finally {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
        try {
            await s3.send(
                new DeleteObjectCommand({
                    Bucket: bucketName,
                    Key: objectKey,
                })
            )
            console.log(`Successfully deleted processed file: ${objectKey}`)
        } catch (deleteErr) {
            console.error(
                `Failed to delete processed file ${objectKey}:`,
                deleteErr
            )
        }
    }
}
