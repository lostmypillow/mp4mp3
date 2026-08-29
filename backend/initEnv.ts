delete process.env.AWS_PROFILE;
process.env.AWS_ACCESS_KEY_ID ??= 'admin';
process.env.AWS_SECRET_ACCESS_KEY ??= 'password123';
process.env.AWS_REGION ??= 'us-east-1';
process.env.SELF_HOSTED_S3_ENDPOINT ??= 'http://minio-server:9000';
process.env.AWS_REQUEST_CHECKSUM_CALCULATION ??= 'WHEN_REQUIRED';
process.env.MAX_FILE_SIZE ??= '10240';

