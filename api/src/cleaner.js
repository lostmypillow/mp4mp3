import {
    S3Client,
    paginateListObjectsV2,
    DeleteObjectsCommand,
    ListMultipartUploadsCommand,
    AbortMultipartUploadCommand
} from '@aws-sdk/client-s3';

const s3 = new S3Client({});

export const handler = async () => {
    const bucketName = process.env.BUCKET_NAME;
    if (!bucketName) {
        throw new Error('BUCKET_NAME environment variable is not defined.');
    }

    let deletedCount = 0;

    // 1. Delete all objects in batches of up to 1,000
    const objectPaginator = paginateListObjectsV2({ client: s3 }, { Bucket: bucketName });

    for await (const page of objectPaginator) {
        if (page.Contents && page.Contents.length > 0) {
            const objectsToDelete = page.Contents.map((obj) => ({ Key: obj.Key }));

            await s3.send(new DeleteObjectsCommand({
                Bucket: bucketName,
                Delete: {
                    Objects: objectsToDelete,
                    Quiet: true,
                },
            }));

            deletedCount += objectsToDelete.length;
        }
    }

    // 2. Abort incomplete multipart uploads with manual pagination
    let keyMarker = undefined;
    let uploadIdMarker = undefined;
    let isTruncated = true;

    while (isTruncated) {
        const response = await s3.send(new ListMultipartUploadsCommand({
            Bucket: bucketName,
            KeyMarker: keyMarker,
            UploadIdMarker: uploadIdMarker,
        }));

        if (response.Uploads && response.Uploads.length > 0) {
            for (const upload of response.Uploads) {
                if (upload.Key && upload.UploadId) {
                    await s3.send(new AbortMultipartUploadCommand({
                        Bucket: bucketName,
                        Key: upload.Key,
                        UploadId: upload.UploadId,
                    }));
                }
            }
        }

        isTruncated = response.IsTruncated ?? false;
        keyMarker = response.NextKeyMarker;
        uploadIdMarker = response.NextUploadIdMarker;
    }

    return {
        statusCode: 200,
        body: `Successfully cleaned up ${deletedCount} objects and aborted multipart uploads in ${bucketName}.`,
    };
};