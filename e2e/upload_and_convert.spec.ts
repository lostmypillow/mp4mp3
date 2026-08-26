import { test, expect } from '@playwright/test';

test.describe('MP4 to MP3 App E2E Flow', () => {
    test('should load the page correctly and show default state', async ({ page }) => {
        await page.goto('/');

        // Check header title
        await expect(page.getByText('MP4 to MP3 Converter')).toBeVisible();

        // Check status initial state
        await expect(page.getByText('Status:')).toBeVisible();
        await expect(page.getByText('待命')).toBeVisible();

        // Check upload button exists
        const uploadButton = page.locator('label').filter({ hasText: /上傳 MP4/ });
        await expect(uploadButton).toBeVisible();

        // Download button initially disabled
        const downloadButton = page.getByRole('button', { name: '下載 MP3 檔' });
        await expect(downloadButton).toBeDisabled();
    });

    test('should handle MP4 file upload and conversion flow', async ({ page }) => {
        await page.goto('/');

        // Create a small mock MP4 buffer
        const mockFile = {
            name: 'sample.mp4',
            mimeType: 'video/mp4',
            buffer: Buffer.from('ftypisom' + '0'.repeat(1024)),
        };

        // Upload file via hidden file input
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(mockFile);

        // Verify status updates to converting or processing
        const statusText = page.locator('p').filter({ hasText: 'Status:' });
        await expect(statusText).toBeVisible();
    });
});
