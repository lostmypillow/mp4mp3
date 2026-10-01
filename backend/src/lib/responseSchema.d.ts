import { z } from 'zod';
export declare const responseSchema: z.ZodObject<{
    url: z.ZodString;
    key: z.ZodString;
}, z.core.$strip>;
export type responseInterface = z.infer<typeof responseSchema>;
