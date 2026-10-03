import { spawn, execFile, ChildProcessByStdio } from 'node:child_process'
import readline from 'node:readline'
import { promisify } from 'node:util'
import { ffmpegPath, ffprobePath } from './ffmpegPath.js'
import type { Interface } from 'node:readline'
import { once } from 'node:events'
import { sseEmitter } from './sse.js'
import type { Readable } from 'node:stream'
const execFileAsync = promisify(execFile)
export async function convertMp4ToMp3(
    inputPath: string,
    outputPath: string,
    uuid: string
): Promise<void> {
    const { stdout: probedDuration }: { stdout: string } = await execFileAsync(
        ffprobePath,
        [
            '-v',
            'error',
            '-show_entries',
            'format=duration',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            inputPath,
        ]
    )
    const duration: number = parseFloat(probedDuration.trim())
    if (Number.isNaN(duration) || duration <= 0) {
        throw new Error('Unable to determine media duration.')
    }

    const ffmpeg: ChildProcessByStdio<null, Readable, Readable> = spawn(
        ffmpegPath,
        [
            '-y',
            '-i',
            inputPath,
            '-vn',
            '-acodec',
            'libmp3lame',
            '-q:a',
            '2',
            '-progress',
            'pipe:1',
            '-nostats',
            outputPath,
        ],
        {
            stdio: ['ignore', 'pipe', 'pipe'],
        }
    )

    const stderrBuffer: string = ''
    const progressData: Record<string, string> = {}

    const rl: Interface = readline.createInterface({
        input: ffmpeg.stdout,
        terminal: false,
    })
    const readProgress: () => Promise<void> = async (): Promise<void> => {
        for await (const line of rl) {
            const [key, value] = line.split('=')
            if (key && value) {
                progressData[key.trim()] = value.trim()
            }

            if (key === 'progress') {
                if (progressData.progress === 'end') {
                    sseEmitter.emit(`progress:${uuid}`, { progress: 0.9 })
                }

                const currentTimeUs: number = parseInt(
                    progressData.out_time_ms || progressData.out_time_us || '0',
                    10
                )
                const currentTimeSec: number = currentTimeUs / 1_000_000

                if (duration > 0) {
                    const ratio: number =
                        Math.min(
                            1.0,
                            Math.max(0.0, currentTimeSec / duration)
                        ) * 0.9
                    sseEmitter.emit(`progress:${uuid}`, {
                        progress: parseFloat(ratio.toFixed(2)),
                    })
                }
            }
        }
    }

    const progressTask: Promise<void> = readProgress()

    const [exitCode] = await once(ffmpeg, 'close')

    await progressTask

    if (exitCode !== 0) {
        throw new Error(
            `FFmpeg exited with code ${exitCode}. Error: ${stderrBuffer.trim()}`
        )
    }
}
