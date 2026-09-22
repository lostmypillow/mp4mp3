import { spawn, execFile } from 'node:child_process'
import readline from 'node:readline'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// 1. Get total duration in seconds using ffprobe
export async function getVideoDuration(inputPath) {
    const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        inputPath,
    ])
    const duration = parseFloat(stdout.trim())
    if (Number.isNaN(duration) || duration <= 0) {
        throw new Error('Unable to determine media duration.')
    }
    return duration
}

// 2. Run conversion and emit float progress (0.0 to 1.0)
export function convertMp4ToMp3(
    inputPath,
    outputPath,
    totalDuration,
    onProgress
) {
    return new Promise((resolve, reject) => {
        const ffmpegArgs = [
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
        ]

        const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        let stderrBuffer = ''
        const progressData = {}

        const rl = readline.createInterface({
            input: ffmpeg.stdout,
            terminal: false,
        })

        rl.on('line', (line) => {
            const [key, value] = line.split('=')
            if (key && value) {
                progressData[key.trim()] = value.trim()
            }

            if (key === 'progress') {
                if (progressData.progress === 'end') {
                    if (typeof onProgress === 'function') onProgress(1.0)
                    return
                }

                // out_time_ms is provided in microseconds by ffmpeg
                const currentTimeUs = parseInt(
                    progressData.out_time_ms || progressData.out_time_us || '0',
                    10
                )
                const currentTimeSec = currentTimeUs / 1_000_000

                if (totalDuration > 0 && typeof onProgress === 'function') {
                    const ratio = Math.min(
                        1.0,
                        Math.max(0.0, currentTimeSec / totalDuration)
                    )
                    // Round to 2 decimal places (e.g., 0.56)
                    onProgress(parseFloat(ratio.toFixed(2)))
                }
            }
        })

        ffmpeg.stderr.on('data', (chunk) => {
            stderrBuffer += chunk.toString()
            if (stderrBuffer.length > 2048) {
                stderrBuffer = stderrBuffer.slice(-2048)
            }
        })

        ffmpeg.on('error', (err) => {
            rl.close()
            reject(new Error(`Failed to start FFmpeg: ${err.message}`))
        })

        ffmpeg.on('close', (code) => {
            rl.close()
            if (code === 0) {
                resolve()
            } else {
                reject(
                    new Error(
                        `FFmpeg exited with code ${code}. Error: ${stderrBuffer.trim()}`
                    )
                )
            }
        })
    })
}
