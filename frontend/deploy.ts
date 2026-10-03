import {
    PutObjectCommand,
    CreateBucketCommand,
    PutBucketPolicyCommand,
    S3Client,
} from '@aws-sdk/client-s3'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import mime from 'mime-types'
const publicS3Client = new S3Client({
    endpoint: process.env.PUBLIC_S3_ENDPOINT,
    forcePathStyle: true,
})

const UPLOAD_BUCKET_NAME = process.env.VITE_BUCKET_NAME || 'frontend-assets'
const BUILD_DIR = join(process.cwd(), 'dist')
async function* getFiles(
    dir: string = BUILD_DIR
): AsyncGenerator<string, void, unknown> {
    const dirents = await readdir(dir, { withFileTypes: true })
    for (const dirent of dirents) {
        const res = join(dir, dirent.name)
        if (dirent.isDirectory()) {
            yield* getFiles(res)
        } else {
            yield res
        }
    }
}

async function uploadBuild() {
    console.log(
        `Starting upload from "${BUILD_DIR}" to MinIO bucket "${UPLOAD_BUCKET_NAME}"...`
    )
    try {
        await publicS3Client.send(
            new CreateBucketCommand({ Bucket: UPLOAD_BUCKET_NAME })
        )
        console.log('Creating bucket because it does not exist')
    } catch (err) {
        if (
            err instanceof Error &&
            err.name !== 'BucketAlreadyOwnedByYou' &&
            err.name !== 'BucketAlreadyExists'
        ) {
            throw err
        }
    }

    const publicReadPolicy = {
        Version: '2012-10-17',
        Statement: [
            {
                Sid: 'PublicReadGetObject',
                Effect: 'Allow',
                Principal: '*',
                Action: 's3:GetObject',
                Resource: `arn:aws:s3:::${UPLOAD_BUCKET_NAME}/*`,
            },
        ],
    }

    await publicS3Client.send(
        new PutBucketPolicyCommand({
            Bucket: UPLOAD_BUCKET_NAME,
            Policy: JSON.stringify(publicReadPolicy),
        })
    )

    try {
        for await (const filePath of getFiles()) {
            const relativePath = relative(BUILD_DIR, filePath).replace(
                /\\/g,
                '/'
            )
            const fileBuffer = await readFile(filePath)

            const contentType =
                mime.lookup(filePath) || 'application/octet-stream'

            const uploadParams = {
                Bucket: UPLOAD_BUCKET_NAME,
                Key: relativePath,
                Body: fileBuffer,
                ContentType: contentType,
                CacheControl: relativePath.includes('assets/')
                    ? 'public, max-age=31536000, immutable'
                    : 'no-cache',
            }

            await publicS3Client.send(new PutObjectCommand(uploadParams))
            console.log(`Uploaded: ${relativePath} (${contentType})`)
        }

        console.log('Successfully deployed build to MinIO!')
    } catch (error) {
        console.error('Error uploading build to MinIO:', error)
        process.exit(1)
    }
}
console.log(process.env)
uploadBuild()
