const express = require('express');
const sessions = require('../sessions');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('node:crypto');

// Generates an 8-character hexadecimal random string (e.g., "7f3b2a1d")
const shortString = crypto.randomBytes(4).toString('hex')
const ffmpeg = path.join(process.cwd(), 'ffmpeg-binary', 'ffmpeg');

router.put('/', (req, res) => {
    try {
        function timeToSeconds(timeString) {
            const [hours, minutes, seconds] = timeString.split(':').map(Number);
            return (hours * 3600) + (minutes * 60) + seconds;
        }

        const sessionId = req.query.id;
        const sseRes = sessions.get(sessionId);

        if (!sseRes) {
            return res.status(400).send('Active SSE connection required before uploading');
        }

        let originalFilename = decodeURIComponent(req.query.name);
        if (!originalFilename) {
            return res.status(400).send('Missing x-file-name header');
        }

        // Check if binary exists before doing anything
        if (!fs.existsSync(ffmpeg)) {
            console.error(`CRITICAL: FFmpeg binary not found at calculated path: ${ffmpeg}`);
            return res.status(500).send('Server configuration error: Binary missing');
        }

        const baseNameWithoutExt = path.parse(originalFilename).name;
        const inputPath = path.join(__dirname, shortString);
        const outputPath = path.join(__dirname, `${shortString}.mp3`);
        const writeStream = fs.createWriteStream(inputPath);

        req.pipe(writeStream);

        writeStream.on('error', (err) => {
            console.error("Write stream error:", err);
            sseRes.write(`data: ${JSON.stringify({ status: 'error', message: 'File upload failed' })}\n\n`);
            if (!res.headersSent) {
                res.status(500).send('Upload failed');
            }
        });

        writeStream.on('finish', () => {
            res.status(202).send('Upload complete. Processing started.');

            let totalDuration = 0;
            sseRes.write(`data: ${JSON.stringify({ status: 'converting' })}\n\n`);

            let infoBuffer = '';
            const getInfoCall = spawn(ffmpeg, ['-i', inputPath]);

            getInfoCall.on('error', (err) => {
                console.error("CRITICAL: Failed to start FFmpeg getInfo process. Path issue or permissions issue:", err);
            });

            getInfoCall.stderr.on('data', (data) => {
                infoBuffer += data.toString();
                const match = infoBuffer.match(/Duration:\s(\d{2}:\d{2}:\d{2}\.\d{2})/);
                if (match) {
                    const [hours, minutes, seconds] = match[1].split(':').map(Number);
                    totalDuration = (hours * 3600) + (minutes * 60) + seconds;
                }
            });

            getInfoCall.on('close', (infoCode) => {
                // FFmpeg returns exit code 1 when running a metadata probe (-i without output). This is normal.
                console.log(`Duration parsing complete. Total seconds extracted: ${totalDuration}`);

                const convertVideoCall = spawn(ffmpeg, [
                    '-y',
                    '-i', inputPath,
                    '-f', 'mp3',
                    outputPath
                ]);

                let convertErrorBuffer = '';

                convertVideoCall.on('error', (err) => {
                    console.error("CRITICAL: Failed to execute FFmpeg conversion spawn entirely:", err);
                    sseRes.write(`data: ${JSON.stringify({ status: 'error', message: 'FFmpeg execution engine failed to spawn' })}\n\n`);
                });

                convertVideoCall.stderr.on('data', (data) => {
                    const text = data.toString();
                    convertErrorBuffer += text;

                    const match = text.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
                    if (match && totalDuration > 0) {
                        const currentTimeString = match[1];
                        const currentSeconds = timeToSeconds(currentTimeString);
                        const percentage = Math.min(Math.round((currentSeconds / totalDuration) * 100), 100);

                        sseRes.write(`data: ${JSON.stringify({
                            status: 'progress',
                            time: currentTimeString,
                            progress: percentage
                        })}\n\n`);
                    }
                });

                convertVideoCall.on('close', (code) => {
                    fs.unlink(inputPath, (err) => {
                        if (err) console.error(`Failed to clean up temporary file: ${inputPath}`, err);
                    });

                    if (code === 0) {
                        sseRes.write(`data: ${JSON.stringify({
                            status: 'done',
                            filename: `${baseNameWithoutExt}.mp3`,
                            downloadUrl: `/download?id=${sessionId}&filename=${shortString}&originalFilename=${baseNameWithoutExt}`
                        })}\n\n`);
                    } else {
                        console.error(`\n--- FFmpeg Conversion Failed with Exit Code ${code} ---`);
                        console.error(convertErrorBuffer || "No stderr output generated by binary. Process died instantly.");
                        console.error("----------------------------------------------------\n");

                        sseRes.write(`data: ${JSON.stringify({ status: 'error', message: 'FFmpeg processing failed' })}\n\n`);
                    }
                });
            });
        });
    } catch (e) {
        console.error(e.message);
        console.error(e.stack);
        if (!res.headersSent) {
            return res.status(500).send(`Something broke! ${JSON.stringify(e.message)}`);
        }
    }
});

module.exports = router;