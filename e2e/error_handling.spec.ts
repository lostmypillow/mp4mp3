import { test, expect } from '@playwright/test'

test.describe('Error Handling E2E Flow', () => {
    test('should display error message when backend /upload fails with 500', async ({
        page,
    }) => {
        await page.goto('/')

        // Intercept upload API and return 500 error
        await page.route('**/upload', async (route) => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({
                    error: 'Server unavailable or S3 error',
                }),
            })
        })

        const mockFile = {
            name: 'test_video.mp4',
            mimeType: 'video/mp4',
            buffer: Buffer.from('fake mp4 content'),
        }

        const fileInput = page.locator('input[type="file"]')
        await fileInput.setInputFiles(mockFile)

        // Error message should be displayed in the list item
        await expect(
            page.getByText('Server unavailable or S3 error')
        ).toBeVisible()

        // Download button should remain disabled
        const downloadButton = page.getByRole('button', { name: '下載 MP3 檔' })
        await expect(downloadButton).toBeDisabled()
    })

    test('should handle download metadata failure gracefully when download API returns 500', async ({
        page,
    }) => {
        await page.goto('/')

        const targetUuid = 'error-download-test-uuid'

        // Mock successful upload endpoint
        await page.route('**/upload', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    url: 'http://localhost:3000/mock-s3-upload',
                    key: `${targetUuid}/test_video.mp4`,
                }),
            })
        })

        // Mock S3 PUT upload
        await page.route('**/mock-s3-upload', async (route) => {
            await route.fulfill({
                status: 200,
                body: '',
            })
        })

        // Mock SSE stream endpoint emitting complete progress
        await page.route(`**/convert/stream?uuid=${targetUuid}`, async (route) => {
            await route.fulfill({
                status: 200,
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive',
                },
                body: 'data: {"progress": 1.0}\n\n',
            })
        })

        // Mock failed download endpoint
        await page.route(`**/download*`, async (route) => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Download failed' }),
            })
        })

        const mockFile = {
            name: 'test_video.mp4',
            mimeType: 'video/mp4',
            buffer: Buffer.from('fake mp4 content'),
        }

        const fileInput = page.locator('input[type="file"]')
        await fileInput.setInputFiles(mockFile)

        // Wait for error state to be reflected in UI
        await expect(
            page.getByText('Failed to fetch download link.')
        ).toBeVisible({
            timeout: 10000,
        })

        // Download button should remain disabled
        const downloadButton = page.getByRole('button', { name: '下載 MP3 檔' })
        await expect(downloadButton).toBeDisabled()
    })
})
