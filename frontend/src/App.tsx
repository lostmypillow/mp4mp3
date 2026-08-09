import {useState, useCallback, useEffect} from 'react'
import Button from '@mui/material/Button';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LinearProgress from '@mui/material/LinearProgress';
import {styled} from '@mui/material/styles';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import GitHubIcon from '@mui/icons-material/GitHub';
import IconButton from '@mui/material/IconButton';

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
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function App({onUploadComplete}) {
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState(null)
    const [fileKey, setFileKey] = useState("")
    const [isProcessing, setIsProcessing] = useState(false)
    const [downloadUrl, setDownloadUrl] = useState("") // New state to hold the final URL

    const uploadFile = useCallback(async (file) => {
        setUploading(true)
        setProgress(0)
        setError(null)
        setFileKey("")
        setDownloadUrl("") // Reset URL on new upload
        setIsProcessing(false)

        try {
            const response = await fetch(`https://ski3tvmrp2rz335huef7ri5jwi0odyph.lambda-url.ap-northeast-2.on.aws/`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    filename: file.name,
                    contentType: file.type,
                }),
            })

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to get upload URL');
            }

            const {url, key} = await response.json();
            setFileKey(key)

            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const pct = Math.round((event.loaded / event.total) * 100);
                        setProgress(pct);
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        resolve();
                    } else {
                        reject(new Error(`Upload failed with status ${xhr.status}`));
                    }
                });

                xhr.addEventListener('error', () => reject(new Error('Upload failed')));

                xhr.open('PUT', url);
                xhr.setRequestHeader('Content-Type', file.type);
                xhr.send(file);
            });

            onUploadComplete?.({key, filename: file.name, size: file.size});

            // The file is fully uploaded. We trigger the background processing loop.
            setIsProcessing(true);

        } catch (e) {
            setError(e.message);
        } finally {
            setUploading(false)
        }

    }, [onUploadComplete])

    // This useEffect is entirely independent of user clicks.
    // It watches `isProcessing` and runs automatically when it becomes true.
    useEffect(() => {
        // We use an active flag to prevent React state errors if the component unmounts
        let isActive = true;

        const pollServer = async () => {
            if (!isProcessing || !fileKey) return;

            const uuid = fileKey.split('/').at(0)
            const params = new URLSearchParams({uuid});
            const endpoint = `https://jsd5btcuf3gqqxy3wqiylol4yy0sizmt.lambda-url.ap-northeast-2.on.aws/?${params}`;

            try {
                while (isActive && isProcessing) {
                    const res = await fetch(endpoint);

                    if (!res.ok) {
                        throw new Error(`Failed to check status: ${res.status}`);
                    }

                    const data = await res.json();

                    if (data.status === 'complete') {
                        if (isActive) {
                            setDownloadUrl(data.url); // Save the ready-to-use URL
                            setIsProcessing(false); // Stop the polling loop
                        }
                        break;
                    } else {
                        await sleep(5000);
                    }
                }
            } catch (err) {
                if (isActive) {
                    console.error('Polling failed:', err);
                    setError('Failed to process the file.');
                    setIsProcessing(false);
                }
            }
        };

        pollServer();

        // Cleanup function runs if the component unmounts mid-poll
        return () => {
            isActive = false;
        };
    }, [isProcessing, fileKey]); // The array tells React which variables this effect depends on

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) uploadFile(file);
    };

    // handleDownload no longer worries about backend fetching. It just triggers the browser.
    const handleDownload = () => {
        if (!downloadUrl) return;

        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileKey.split('/').at(1).replace('mp4', 'mp3');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <>
            <div className="flex flex-col items-start w-screen h-screen">
                <AppBar position="static">
                    <Toolbar variant="dense">
                        <Typography
                            variant="h6"
                            component="div"
                            sx={{
                                color: 'inherit',
                                flexGrow: 1 }}
                        >
                            MP4 to MP3 Converter
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

                <div className="p-8 w-full h-full flex flex-col items-center justify-between">
                    <p className='text-lg'><span className='font-bold'>Status:</span> {uploading ? 'Uploading' : isProcessing ? 'Processing...' : downloadUrl ? 'Ready to download' : 'Standby'} </p>

                    {error && <p className="error text-red-500">{error}</p>}

                    <div className="flex flex-col md:flex-row gap-2 items-center justify-center w-full">
                        <Button
                            component="label"
                            role={undefined}
                            variant="contained"
                            tabIndex={-1}
                            startIcon={<CloudUploadIcon/>}
                            className="shrink-0"
                        >
                            {`Upload an MP4 (<50MB)`}
                            <VisuallyHiddenInput
                                type="file"
                                onChange={handleFileSelect}
                                disabled={uploading}
                                accept="video/mp4"
                            />
                        </Button>

                        <LinearProgress
                            className="flex-1"
                            variant="determinate"
                            value={progress}
                            aria-label="Upload video"
                        />
                        <span className="font-mono shrink-0">{progress}%</span>

                        <Button
                            variant="contained"
                            onClick={handleDownload}
                            // We safely disable the button until uploading finishes, processing finishes, and we have a final URL.
                            disabled={uploading || isProcessing || !downloadUrl}
                        >
                            {isProcessing ? 'Processing...' : `Download the MP3`}
                        </Button>
                    </div>

                    <footer className="text-center">
                        Made with Vite, React, MUI, TailwindCSS, AWS Lambda and FFmpeg<br/>
                        Made by LostMyPillow (Johnny)
                    </footer>
                </div>
            </div>
        </>
    )
}

export default App