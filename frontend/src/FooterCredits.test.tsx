import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import FooterCredits from './FooterCredits.js'

describe('FooterCredits Component', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('should render author credits text', () => {
        const html = renderToString(<FooterCredits />)
        expect(html).toContain('Made by LostMyPillow (Johnny)')
        expect(html).toContain('MP4MP3 v')
    })

    it('should display version when VITE_APP_VERSION is defined', () => {
        vi.stubEnv('VITE_APP_VERSION', '2.1.0-TEST')
        const html = renderToString(<FooterCredits />)
        expect(html.replace(/<!-- -->/g, '')).toContain('MP4MP3 v2.1.0-TEST')
        expect(html).toContain('2.1.0-TEST')
    })
})
