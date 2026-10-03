import serverless from 'serverless-http'
import app from '../index.ts'

const httpHandler = serverless(app)

export const handler = async (event: any, context: any) => {
    console.log(event, context)
    const isS3Direct = Boolean(event?.Records?.[0]?.s3)
    const isEventBridgeS3 = event?.source === 'aws.s3' && Boolean(event?.detail)

    if (isS3Direct || isEventBridgeS3) {
        const syntheticEvent = {
            version: '2.0',
            rawPath: '/convert/events',
            requestContext: {
                http: {
                    method: 'POST',
                    path: '/convert/events',
                },
            },
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify(event),
            isBase64Encoded: false,
        }

        return await httpHandler(syntheticEvent, context)
    }

    return await httpHandler(event, context)
}
