import {
    EventBridgeClient,
    DisableRuleCommand,
} from '@aws-sdk/client-eventbridge'

const client = new EventBridgeClient({})

export const handler = async (event) => {
    const ruleName = process.env.RULE_NAME

    if (!ruleName) {
        console.error('RULE_NAME environment variable is missing.')
        throw new Error('Missing RULE_NAME environment variable')
    }

    try {
        console.warn(
            `Killswitch triggered by CloudWatch alarm. Disabling EventBridge rule: ${ruleName}`
        )

        const command = new DisableRuleCommand({ Name: ruleName })
        await client.send(command)

        console.log(
            `Successfully disabled rule: ${ruleName}. Conversion pipeline stopped.`
        )

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Rule ${ruleName} disabled successfully.`,
            }),
        }
    } catch (error) {
        console.error(`Failed to disable EventBridge rule ${ruleName}:`, error)
        throw error
    }
}
