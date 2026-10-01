import ffmpeg from '@mmomtchev/ffmpeg'
import {
    Muxer,
    Demuxer,
    AudioDecoder,
    AudioEncoder,
    Discarder,
    AudioTransform,
} from '@mmomtchev/ffmpeg/stream'
import { sseEmitter } from './sse.js'
import { once } from 'node:events'
import { pipeline } from 'node:stream/promises'
const { SampleFormat } = ffmpeg
export async function convertMp4ToMp3(
    inputPath: string,
    outputPath: string,
    uuid: string
): Promise<void> {
    console.time('Finished')
    console.log(`Input path: ${inputPath}`)

    const demuxer = new Demuxer({ inputFile: inputPath })

    await once(demuxer, 'ready')

    console.log(`Progress: 0.125`)
    sseEmitter.emit(`progress:${uuid}`, { progress: 0.125 })

    const audioStream = demuxer.audio[0]
    if (!audioStream) {
        throw new Error(`No audio stream found in input file: ${inputPath}`)
    }

    const audioInput = new AudioDecoder(demuxer.audio[0])
    if (demuxer.video?.length) {
        demuxer.video.forEach((vStream: any) => {
            vStream.pipe(new Discarder(vStream))
        })
    }

    console.log(`Progress: 0.25`)
    sseEmitter.emit(`progress:${uuid}`, { progress: 0.25 })

    const audioDefinition = audioInput.definition()

    const sampleFormat = new SampleFormat(ffmpeg.AV_SAMPLE_FMT_S16P)
    const audioOutput = new AudioEncoder({
        type: 'Audio',
        codec: ffmpeg.AV_CODEC_MP3,
        bitRate: 128e3,
        sampleRate: audioDefinition.sampleRate,
        sampleFormat: sampleFormat,
        channelLayout: audioDefinition.channelLayout,
    })
    console.log(`Progress: 0.375`)
    sseEmitter.emit(`progress:${uuid}`, { progress: 0.375 })

    const resampler = new AudioTransform({
        input: audioDefinition,
        output: {
            ...audioOutput.definition(),
            frameSize: 1152,
        },
    })
    console.log(`Progress: 0.5`)
    sseEmitter.emit(`progress:${uuid}`, { progress: 0.5 })

    const output = new Muxer({
        outputFile: outputPath,
        streams: [audioOutput],
    })

    console.log(`Progress: 0.625`)
    sseEmitter.emit(`progress:${uuid}`, { progress: 0.625 })
    await pipeline(
        audioStream,
        audioInput,
        resampler,
        audioOutput,
        output.audio[0]
    )

    console.timeEnd('Finished')
    console.log(`Progress: 0.85`)
    sseEmitter.emit(`progress:${uuid}`, { progress: 0.85 })
}
