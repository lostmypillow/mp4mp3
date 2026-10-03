import { Component } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import GitHubIcon from '@mui/icons-material/GitHub'

export default class HeaderBar extends Component {
    render() {
        return (
            <AppBar position="static">
                <Toolbar variant="dense">
                    <Typography
                        variant="h6"
                        component="div"
                        sx={{
                            color: 'inherit',
                            flexGrow: 1,
                        }}
                    >
                        MP4 to MP3 轉檔

                    </Typography>

                    <IconButton
                        href="https://github.com/lostmypillow/mp4mp3"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="GitHub Repository"
                        color="inherit"
                    >
                        <GitHubIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>
        )
    }
}
