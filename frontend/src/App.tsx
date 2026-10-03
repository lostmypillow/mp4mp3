import { type ChangeEvent, useCallback, useEffect, useState } from 'react'
import Button from '@mui/material/Button'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import LinearProgress from '@mui/material/LinearProgress'
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
import { VisuallyHiddenInput } from './VisuallyHiddenInput.tsx'

function App() {
    const [uploading, setUploading] = useState<boolean>(false)
    const [progress, setProgress] = useState<number>(0)
    const [error, setError] = useState<string | null>(null)
    const [fileKey, setFileKey] = useState('')
    const [isProcessing, setIsProcessing] = useState<boolean>(false)
    const [downloadUrl, setDownloadUrl] = useState<string>('')
    const [downloadList, setDownloadList] = useState<File[]>([])
    const uploadFile: (file: File) => Promise<void> = useCallback(
        async (file: File) => {
            setUploading(true)
            setProgress(0)
            setError(null)
            setFileKey('')
            setDownloadUrl('')
            setIsProcessing(false)

            try {
                const response = await fetch(
                    `${import.meta.env.VITE_API_URL}/upload`,
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
                        if (xhr.status >= 200 && xhr.status < 300) {
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

                setIsProcessing(true)
            } catch (e) {
                if (e instanceof Error) {
                    setError(e.message)
                } else {
                    setError('Unknown error occurred!')
                }
            } finally {
                setUploading(false)
            }
        },
        []
    )
    async function showNotification(): Promise<void> {
        if ('Notification' in window) {
            let permission: 'default' | 'denied' | 'granted' =
                Notification.permission

            if (permission !== 'granted' && permission !== 'denied') {
                permission = await Notification.requestPermission()
            }

            if (permission === 'granted') {
                new Notification('轉檔完成！', {
                    body: '可以下載 mp3 了！',
                    icon: '/logo.png',
                })
            }
        }
    }
    useEffect((): (() => void) => {
        let isActive: boolean = true
        let eventSource: null | EventSource = null

        const pollServer: () => Promise<void> = async () => {
            if (!isProcessing || !fileKey) return

            const uuid = fileKey.split('/').at(0)

            // if (import.meta.env.VITE_IS_AWS === 'false') {
            const sseUrl = `${import.meta.env.VITE_API_URL}/convert/stream?uuid=${uuid}`
            eventSource = new EventSource(sseUrl)

            eventSource.onmessage = async (event) => {
                if (!isActive) return

                try {
                    const data = JSON.parse(event.data)

                    if (data.progress !== undefined) {
                        setProgress(50 + Math.round(data.progress * 50))

                        if (data.progress >= 1 && eventSource) {
                            eventSource.close()

                            const params = new URLSearchParams({
                                uuid: uuid ?? '',
                            })
                            const endpoint = `${import.meta.env.VITE_API_URL}/download/?${params}`

                            const res: Response = await fetch(endpoint)
                            if (!res.ok)
                                throw new Error(
                                    `Download API failed: ${res.status}`
                                )

                            const downloadData = await res.json()

                            if (isActive && downloadData.url) {
                                setDownloadUrl(downloadData.url)
                                setIsProcessing(false)
                                await showNotification()
                            }
                        }
                    }
                } catch (err) {
                    if (isActive) {
                        console.error('Processing failed:', err)
                        setError('Failed to fetch download link.')
                        setIsProcessing(false)
                        eventSource?.close()
                    }
                }
            }

            eventSource.onerror = (err) => {
                console.error('SSE Error:', err)
                if (isActive) {
                    setError('Connection lost.')
                    setIsProcessing(false)
                }
                eventSource?.close()
            }

            return
            // }
        }

        pollServer()

        return () => {
            isActive = false
            if (eventSource) eventSource.close() // 4. Guaranteed cleanup on unmount
        }
    }, [isProcessing, fileKey])

    const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const file = event.target.files[0]
            setDownloadList([file])
            if (file) {
                uploadFile(file).then(() => console.log('File uploaded'))
            }
        }
    }

    const handleDownload = () => {
        if (!downloadUrl) return

        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = fileKey?.split('/')?.at(1)?.replace('mp4', 'mp3') ?? ''
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
                            上傳 MP4
                            <VisuallyHiddenInput
                                type="file"
                                onChange={handleFileSelect}
                                disabled={uploading}
                                accept="video/mp4"
                            />
                        </Button>
                    </div>

                    <List className="w-full">
                        {downloadList.map((file: File) => (
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
                                                    {file.name}
                                                </span>
                                                <span className="font-bold">
                                                    : 處理進度:{' '}
                                                    <span className="font-mono tabular-nums">
                                                        {progress}%{' '}
                                                    </span>
                                                    <span className="font-bold">
                                                        | 處理狀態:{' '}
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
                                                </span>{' '}
                                            </>
                                        }
                                    />
                                    <Button
                                        startIcon={<FileDownloadIcon />}
                                        variant={'contained'}
                                        color="primary"
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
