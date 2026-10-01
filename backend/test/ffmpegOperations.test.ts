import { describe, it, expect, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import { convertMp4ToMp3 } from '../src/lib/ffmpegOperations.js' // Adjust import path to match your module structure

describe('convertMp4ToMp3', () => {
    const rootDir = process.cwd()
    console.log(rootDir)

    const inputPath = path.join(rootDir, 'test.mp4')
    const outputPath = path.join(rootDir, 'output_test.mp3')
    const uuid = 'test-uuid-1234'

    afterEach(() => {
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath)
        }
    })

    it('should successfully convert test.mp4 to mp3', async () => {
        // Ensure the input file exists before running the test
        expect(fs.existsSync(inputPath)).toBe(true)

        await convertMp4ToMp3(inputPath, outputPath, uuid)
        expect(fs.existsSync(outputPath)).toBe(true)
        const stats = fs.statSync(outputPath)
        expect(stats.size).toBeGreaterThan(0)
    })

    it('should reject when provided an invalid input path', async () => {
        const invalidInput = path.join(rootDir, 'non_existent_file.mp4')

        expect(
            convertMp4ToMp3(invalidInput, outputPath, uuid)
        ).rejects.toThrow()
    })
})
