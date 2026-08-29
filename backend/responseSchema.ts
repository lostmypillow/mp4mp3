import { z } from 'zod'

export const responseSchema = z.object({
    url: z.string(),
    key: z.string()
})
export type responseInterface = z.infer<typeof responseSchema>