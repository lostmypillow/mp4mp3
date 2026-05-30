const express = require('express');
const sessions = require('../sessions')
const router = express.Router();
const fs = require('fs');
const path = require('path');
router.get('/', (req, res) => {
    const sessionId = req.query.id;
    const outputPath = path.join(__dirname, `${req.query.filename}.mp3`);

    if (fs.existsSync(outputPath)) {
        res.download(outputPath, `${req.query.filename}.mp3`, () => {
            fs.unlink(outputPath, () => {});
        });
    } else {
        res.status(404).send('File not found');
    }
});
module.exports = router