import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import HeaderBar from './HeaderBar.js'

describe('HeaderBar Component', () => {
    it('should render the app title correctly', () => {
        const html = renderToString(<HeaderBar />)
        expect(html).toContain('MP4 to MP3 轉檔')
    })

    it('should render the GitHub repository link with proper target and rel attributes', () => {
        const html = renderToString(<HeaderBar />)
        expect(html).toContain('href="https://github.com/lostmypillow/mp4mp3"')
        expect(html).toContain('target="_blank"')
        expect(html).toContain('rel="noopener noreferrer"')
        expect(html).toContain('aria-label="GitHub Repository"')
    })
})
