import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI
        ? [['github'], ['html', { open: 'never' }]]
        : 'html',
    use: {
        baseURL: process.env.E2E_URL || 'http://localhost:5173',
        trace: 'on-first-retry',
        launchOptions: process.env.CI
            ? {
                  args: [
                      '--host-resolver-rules=MAP *.lostmypillow.com 127.0.0.1',
                  ],
              }
            : {},
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
})
