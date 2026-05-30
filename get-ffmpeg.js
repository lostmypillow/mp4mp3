const https = require('https');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

// The standard static build for 64-bit Linux environments
const fileUrl = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz';
const archivePath = path.join(__dirname, 'ffmpeg.tar.xz');
const targetDir = path.join(__dirname, 'ffmpeg-binary');

console.log('Starting FFmpeg download...');

const fileStream = fs.createWriteStream(archivePath);
let ffmpegExecutable = ''
https.get(fileUrl, (response) => {
    // Handle redirects if necessary, though this specific URL usually serves directly
    if (response.statusCode !== 200) {
        console.error(`Failed to download: HTTP ${response.statusCode}`);
        return;
    }

    response.pipe(fileStream);

    fileStream.on('finish', () => {
        fileStream.close();
        console.log('Download complete. Extracting archive...');

        // Create directory and extract using system tar command
        // --strip-components=1 removes the top-level folder from the archive
        const extractCommand = `mkdir -p ${targetDir} && tar -xf ${archivePath} -C ${targetDir} --strip-components=1`;

        exec(extractCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Extraction failed: ${error.message}`);
                return;
            }

            // Clean up the downloaded archive to save space
            fs.unlinkSync(archivePath);

            ffmpegExecutable = path.join(targetDir, 'ffmpeg');
            console.log(`Success! FFmpeg binary is ready at: ${ffmpegExecutable}`);

            // You can now spawn this executable natively
            // const { spawn } = require('child_process');
            // spawn(ffmpegExecutable, ['-version']).stdout.pipe(process.stdout);
        });
    });
}).on('error', (err) => {
    fs.unlinkSync(archivePath);
    console.error(`Download error: ${err.message}`);
});

