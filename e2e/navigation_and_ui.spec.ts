import { test, expect } from '@playwright/test'

test.describe('Navigation, UI and Accessibility E2E tests', () => {
    test('should render header bar with correct title and github repository link', async ({ page }) => {
        await page.goto('/')

        // Header title
        const headerTitle = page.getByText('MP4 to MP3 轉檔')
        await expect(headerTitle).toBeVisible()

        // GitHub repository button
        const githubLink = page.getByRole('link', { name: 'GitHub Repository' })
        await expect(githubLink).toBeVisible()
        await expect(githubLink).toHaveAttribute(
            'href',
            'https://github.com/lostmypillow/mp4mp3'
        )
        await expect(githubLink).toHaveAttribute('target', '_blank')
        await expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer')
    })

    test('should render upload button and footer credits in initial state', async ({ page }) => {
        await page.goto('/')

        // Upload button exists and has file input accepting MP4
        const uploadButton = page.locator('label').filter({ hasText: /上傳 MP4/ })
        await expect(uploadButton).toBeVisible()

        const fileInput = page.locator('input[type="file"]')
        await expect(fileInput).toHaveAttribute('accept', 'video/mp4')

        // Footer credits
        const footer = page.locator('footer')
        await expect(footer).toBeVisible()
        await expect(footer).toContainText('Made by LostMyPillow (Johnny)')
        await expect(footer).toContainText('MP4MP3 v')
    })

    test('should be responsive on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 })
        await page.goto('/')

        const headerTitle = page.getByText('MP4 to MP3 轉檔')
        await expect(headerTitle).toBeVisible()

        const uploadButton = page.locator('label').filter({ hasText: /上傳 MP4/ })
        await expect(uploadButton).toBeVisible()

        const footer = page.locator('footer')
        await expect(footer).toBeVisible()
    })
})
