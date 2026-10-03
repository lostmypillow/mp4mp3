import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

test.describe('File Download Complete Flow', () => {
    test('should upload MP4, wait for backend conversion to complete, enable download button and download MP3', async ({
        page,
    }) => {
        await page.goto('/')

        const testFilePath = fileURLToPath(
            new URL('../test.mp4', import.meta.url)
        )
        const fileInput = page.locator('input[type="file"]')

        if (fs.existsSync(testFilePath)) {
            await fileInput.setInputFiles(testFilePath)
        } else {
            await fileInput.setInputFiles({
                name: 'test.mp4',
                mimeType: 'video/mp4',
                buffer: Buffer.from('ftypisom' + '0'.repeat(1024)),
            })
        }

        await expect(page.getByText('test.mp4')).toBeVisible()

        await expect(page.getByText('轉檔完成!')).toBeVisible({
            timeout: 60000,
        })

        const downloadButton = page.getByRole('button', { name: '下載 MP3 檔' })
        await expect(downloadButton).toBeEnabled()

        const downloadPromise = page.waitForEvent('download')
        await downloadButton.click()
        const download = await downloadPromise

        expect(download.suggestedFilename()).toBe('test.mp3')
    })
})
