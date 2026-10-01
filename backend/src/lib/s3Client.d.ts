import { S3Client } from '@aws-sdk/client-s3';
export declare const internalS3Client: S3Client;
export declare const publicS3Client: S3Client;
export declare function initMinio(): Promise<void>;
