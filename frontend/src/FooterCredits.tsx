import { Component } from 'react'

export default class FooterCredits extends Component {
    render() {
        return (
            <footer className="text-center text-xs">
                MP4MP3 v{import.meta.env.VITE_APP_VERSION}
                <br />
                Made by LostMyPillow (Johnny)
            </footer>
        )
    }
}
