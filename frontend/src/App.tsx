import { useState, useCallback, useEffect, Component } from 'react'
import Button from '@mui/material/Button'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import LinearProgress from '@mui/material/LinearProgress'
import { styled } from '@mui/material/styles'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import GitHubIcon from '@mui/icons-material/GitHub'
import IconButton from '@mui/material/IconButton'
import FooterCredits from './FooterCredits.tsx'
import HeaderBar from './HeaderBar.tsx'
import {
    Divider,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
} from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
const VisuallyHiddenInput = styled('input')({
    clip: 'rect(0 0 0 0)',
    clipPath: 'inset(50%)',
    height: 1,
    overflow: 'hidden',
    position: 'absolute',
    bottom: 0,
    left: 0,
    whiteSpace: 'nowrap',
    width: 1,
})

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function App({ onUploadComplete }) {
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState(null)
    const [fileKey, setFileKey] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [downloadUrl, setDownloadUrl] = useState('') // New state to hold the final URL
    const [downloadList, setDownloadList] = useState([])
    const uploadFile = useCallback(
        async (file) => {
            setUploading(true)
            setProgress(0)
            setError(null)
            setFileKey('')
            setDownloadUrl('') // Reset URL on new upload
            setIsProcessing(false)

            try {
                const response = await fetch(
                    import.meta.env.VITE_UPLOAD_ENDPOINT,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            filename: file.name,
                            contentType: file.type,
                        }),
                    }
                )

                if (!response.ok) {
                    const data = await response.json()
                    throw new Error(data.error || 'Failed to get upload URL')
                }

                const { url, key } = await response.json()
                setFileKey(key)

                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest()

                    xhr.upload.addEventListener('progress', (event) => {
                        if (event.lengthComputable) {
                            const pct = Math.round(
                                (event.loaded / event.total) * 50
                            )
                            setProgress(pct)
                        }
                    })

                    xhr.addEventListener('load', () => {
                        if (xhr.status === 200) {
                            resolve()
                        } else {
                            reject(
                                new Error(
                                    `Upload failed with status ${xhr.status}`
                                )
                            )
                        }
                    })

                    xhr.addEventListener('error', () =>
                        reject(new Error('Upload failed'))
                    )

                    xhr.open('PUT', url)
                    xhr.setRequestHeader('Content-Type', file.type)
                    xhr.send(file)
                })

                onUploadComplete?.({
                    key,
                    filename: file.name,
                    size: file.size,
                })

                // The file is fully uploaded. We trigger the background processing loop.
                setIsProcessing(true)
            } catch (e) {
                setError(e.message)
            } finally {
                setUploading(false)
            }
        },
        [onUploadComplete]
    )

    // This useEffect is entirely independent of user clicks.
    // It watches `isProcessing` and runs automatically when it becomes true.
    useEffect(() => {
        // We use an active flag to prevent React state errors if the component unmounts
        let isActive = true

        const pollServer = async () => {
            if (!isProcessing || !fileKey) return

            const uuid = fileKey.split('/').at(0)
            if (import.meta.env.DEV) {
                // Open SSE connection to local Express backend
                const sseUrl = `${import.meta.env.VITE_STREAM_ENDPOINT}${uuid}`
                const eventSource = new EventSource(sseUrl)
                eventSource.onmessage = (event) => {
                    if (!isActive) return
                    const data = JSON.parse(event.data)
                    if (data.progress) {
                        setProgress(50 + Math.round(data.progress * 50))
                    }
                    if (data.status === 'complete') {
                        setDownloadUrl(data.url)
                        setIsProcessing(false)
                        eventSource.close()
                    }
                }
                eventSource.onerror = (err) => {
                    console.error('SSE Error:', err)
                    eventSource.close()
                }
                return () => {
                    isActive = false
                    eventSource.close()
                }
            }

            const params = new URLSearchParams({ uuid })
            const endpoint = `${import.meta.env.VITE_DOWNLOAD_ENDPOINT}?${params}`

            try {
                while (isActive && isProcessing) {
                    const res = await fetch(endpoint)

                    if (!res.ok) {
                        throw new Error(`Failed to check status: ${res.status}`)
                    }

                    const data = await res.json()

                    if (data.status === 'complete') {
                        if (isActive) {
                            setDownloadUrl(data.url) // Save the ready-to-use URL
                            setIsProcessing(false) // Stop the polling loop
                        }
                        break
                    } else {
                        await sleep(5000)
                    }
                }
            } catch (err) {
                if (isActive) {
                    console.error('Polling failed:', err)
                    setError('Failed to process the file.')
                    setIsProcessing(false)
                }
            }
        }

        pollServer()

        // Cleanup function runs if the component unmounts mid-poll
        return () => {
            isActive = false
        }
    }, [isProcessing, fileKey]) // The array tells React which variables this effect depends on

    const handleFileSelect = (event) => {
        const file = event.target.files[0]
        setDownloadList([
            {
                filename: file.name,
            },
        ])
        if (file) uploadFile(file)
    }

    // handleDownload no longer worries about backend fetching. It just triggers the browser.
    const handleDownload = () => {
        if (!downloadUrl) return

        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = fileKey.split('/').at(1).replace('mp4', 'mp3')
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <>
            <div className="flex flex-col items-start w-screen h-screen">
                <HeaderBar />

                <div className="p-8 w-full h-full flex flex-col items-center justify-between">
                    <div className="flex flex-col md:flex-row gap-2 items-center justify-center w-full">
                        <Button
                            component="label"
                            role={undefined}
                            variant="contained"
                            tabIndex={-1}
                            startIcon={<CloudUploadIcon />}
                            className="shrink-0"
                        >
                            {`上傳 MP4 (${import.meta.env.VITE_MAX_FILE_SIZE_LABEL || '<600MB'})`}
                            <VisuallyHiddenInput
                                type="file"
                                onChange={handleFileSelect}
                                disabled={uploading}
                                accept="video/mp4"
                            />
                        </Button>
                    </div>

                    <List className="w-full">
                        {downloadList.map((file) => (
                            <>
                                <ListItem>
                                    <ListItemIcon>
                                        <FolderIcon />
                                    </ListItemIcon>
                                    <ListItemText
                                        className="flex-1"
                                        primary={
                                            <>
                                                <span className="truncate md:whitespace-normal md:overflow-visible md:text-clip">
                                                    {file.filename}
                                                </span>{' '}
                                                <span className="font-bold">
                                                    (處理進度:{' '}
                                                    <span className="font-mono tabular-nums">
                                                        {progress}%{' '}
                                                        {uploading
                                                            ? '上傳中...'
                                                            : isProcessing
                                                              ? '轉檔中...'
                                                              : downloadUrl
                                                                ? '轉檔完成!'
                                                                : error
                                                                  ? error
                                                                  : '待命'}{' '}
                                                    </span>
                                                    )
                                                </span>{' '}
                                            </>
                                        }
                                    />
                                    <Button
                                        startIcon={<FileDownloadIcon />}
                                        variant={'contained'}
                                        color="success"
                                        onClick={handleDownload}
                                        disabled={
                                            uploading ||
                                            isProcessing ||
                                            !downloadUrl
                                        }
                                    >
                                        下載 MP3 檔
                                    </Button>
                                </ListItem>{' '}
                                <LinearProgress
                                    className="flex-1 w-full"
                                    variant="determinate"
                                    value={progress}
                                    aria-label="Upload video"
                                />
                                <Divider />
                            </>
                        ))}
                    </List>

                    <FooterCredits />
                </div>
            </div>
        </>
    )
}

export default App
