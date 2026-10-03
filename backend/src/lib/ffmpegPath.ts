import { execSync } from 'node:child_process'

async function getFFmpegPath() {
    try {
        execSync('which ffmpeg', { stdio: 'ignore' })
        return 'ffmpeg'
    } catch (e) {
        // 2. Fallback to npm package for local dev
        const ffmpegModule = await import('ffmpeg-static')

        // Cast through `unknown` to strip TypeScript's module namespace type
        const rawPath = (ffmpegModule.default ?? ffmpegModule) as unknown

        if (typeof rawPath === 'string' && rawPath.length > 0) {
            return rawPath
        }
        throw new Error(
            'ffmpeg-static executable path could not be resolved.',
            { cause: e }
        )
    }
}

export const ffmpegPath: string = await getFFmpegPath()
