import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import App from './App.js'

describe('App Component Unit Tests', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_API_URL', 'http://localhost:3000')
        vi.stubEnv('VITE_APP_VERSION', '2.1.0')
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('should render the upload button and accept video/mp4 attribute', () => {
        const html = renderToString(<App />)
        expect(html).toContain('上傳 MP4')
        expect(html).toContain('accept="video/mp4"')
        expect(html).toContain('type="file"')
    })

    it('should render HeaderBar and FooterCredits within the App', () => {
        const html = renderToString(<App />)
        expect(html).toContain('MP4 to MP3 轉檔')
        expect(html).toContain('Made by LostMyPillow (Johnny)')
    })
})
