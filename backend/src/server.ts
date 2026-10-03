#!/usr/bin/env node
delete process.env.AWS_PROFILE
console.log(process.env)
import app from './index.js'
import createDebug from 'debug'
import { internalS3Client } from './lib/s3Client.js'
const debug = createDebug('test:server')
import * as http from 'http'
import {
    CreateBucketCommand,
    PutBucketPolicyCommand,
    PutBucketLifecycleConfigurationCommand,
    PutBucketNotificationConfigurationCommand,
} from '@aws-sdk/client-s3'

/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(process.env.PORT || '3000')
app.set('port', port)

/**
 * Create HTTP server.
 */
const server = http.createServer(app)

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port)
server.on('error', onError)
server.on('listening', onListening)
const bucket = process.env.UPLOAD_BUCKET_NAME
console.time('Create bucket (if it does not exist)')
try {
    await internalS3Client.send(new CreateBucketCommand({ Bucket: bucket }))
    console.log('Creating bucket because it does not exist')
} catch (err: any) {
    if (
        err.name !== 'BucketAlreadyOwnedByYou' &&
        err.name !== 'BucketAlreadyExists'
    ) {
        throw err
    }
}
console.timeEnd('Create bucket (if it does not exist)')

console.time('Set bucket policy (idempotent)')
const uploadOnlyPolicy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [
        {
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:PutObject'],
            Resource: [`arn:aws:s3:::${bucket}/*`],
        },
    ],
})

await internalS3Client.send(
    new PutBucketPolicyCommand({ Bucket: bucket, Policy: uploadOnlyPolicy })
)
console.timeEnd('Set bucket policy (idempotent)')

console.time('Attach webhook')
await internalS3Client.send(
    new PutBucketNotificationConfigurationCommand({
        Bucket: bucket,
        NotificationConfiguration: {
            QueueConfigurations: [
                {
                    QueueArn: `arn:minio:sqs::${process.env.UPLOAD_BUCKET_NAME}:webhook`,
                    Events: ['s3:ObjectCreated:*'],
                },
            ],
        },
    })
)
console.timeEnd('Attach webhook')

console.time('Set expiration rule (idempotent)')
await internalS3Client.send(
    new PutBucketLifecycleConfigurationCommand({
        Bucket: bucket,
        LifecycleConfiguration: {
            Rules: [
                {
                    ID: 'ExpireAfter1Day',
                    Status: 'Enabled',
                    Filter: { Prefix: '' },
                    Expiration: { Days: 1 },
                },
            ],
        },
    })
)
console.timeEnd('Set expiration rule (idempotent)')
/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val: string | number) {
    let port = val
    if (typeof val == 'string') {
        port = parseInt(val, 10)
    }

    if (typeof port == 'number') {
        if (isNaN(port)) {
            // named pipe
            return val
        }

        if (port >= 0) {
            // port number
            return port
        }
    }

    return false
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error: NodeJS.ErrnoException) {
    if (error.syscall !== 'listen') {
        throw error
    }

    const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges')
            process.exit(1)
            break
        case 'EADDRINUSE':
            console.error(bind + ' is already in use')
            process.exit(1)
            break
        default:
            throw error
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    const addr = server.address()
    const bind =
        typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr!.port
    debug('Listening on ' + bind)
}
