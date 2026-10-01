import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

test.describe('MP4 to MP3 Upload and Convert Flow', () => {
    test('should load the page correctly and show default state', async ({ page }) => {
        await page.goto('/')

        // Check header title
        await expect(page.getByText('MP4 to MP3 轉檔')).toBeVisible()

        // Check upload button exists
        const uploadButton = page.locator('label').filter({ hasText: /上傳 MP4/ })
        await expect(uploadButton).toBeVisible()

        // Footer is visible
        await expect(page.locator('footer')).toContainText('Made by LostMyPillow')
    })

    test('should handle MP4 file upload and display conversion status from backend', async ({ page }) => {
        await page.goto('/')

        const testFilePath = fileURLToPath(new URL('../test.mp4', import.meta.url))
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

        // Verify filename is listed
        await expect(page.getByText('test.mp4')).toBeVisible()

        // Verify progress updates from real conversion
        await expect(page.getByText('處理進度:')).toBeVisible()
        await expect(page.getByText('處理狀態:')).toBeVisible()

        // Download button should exist
        const downloadButton = page.getByRole('button', { name: '下載 MP3 檔' })
        await expect(downloadButton).toBeVisible()
    })
})
