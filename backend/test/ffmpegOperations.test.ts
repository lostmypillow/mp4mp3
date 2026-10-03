import { describe, it, expect, afterEach } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import process from 'node:process'
import { convertMp4ToMp3 } from '../src/lib/convertMp4ToMp3.js' // Adjust import path to match your module structure

describe('convertMp4ToMp3', () => {
    const rootDir = path.resolve(__dirname, '..', '..')
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
        expect(fs.existsSync(inputPath)).toBe(true)
        await convertMp4ToMp3(inputPath, outputPath, uuid)
        expect(fs.existsSync(outputPath)).toBe(true)
        expect(fs.statSync(outputPath).size).toBeGreaterThan(0)
    })

    it('should reject when provided an invalid input path', async () => {
        return expect(
            convertMp4ToMp3(
                path.join(rootDir, 'non_existent_file.mp4'),
                outputPath,
                uuid
            )
        ).rejects.toThrow()
    })
})
