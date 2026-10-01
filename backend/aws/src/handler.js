import serverlessExpress from '@codegenie/serverless-express'
import app from '../../index.ts'

export const handler = serverlessExpress({ app })
