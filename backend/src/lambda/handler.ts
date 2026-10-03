import serverless from 'serverless-http'
import app from '../index.ts'

export const handler = serverless(app)
