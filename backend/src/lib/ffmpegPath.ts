import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

async function getExecutablePath(executable: string) {
    try {
        execSync(`which ${executable}`, { stdio: 'ignore' })
        return executable
    } catch (e) {
        if (existsSync(`/opt/bin/${executable}`)) {
            return `/opt/bin/${executable}`
        }
        throw new Error(
            `${executable} static executable path could not be resolved.`,
            { cause: e }
        )
    }
}

export const ffmpegPath: string = await getExecutablePath('ffmpeg')
export const ffprobePath: string = await getExecutablePath('ffprobe')
