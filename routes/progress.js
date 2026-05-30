const express = require('express');
const sessions = require('../sessions')
const router = express.Router();

router.get('/', (req, res) => {
    const sessionId = req.query.id;
    if (!sessionId) {
        return res.status(400).send('Missing session ID');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sessions.set(sessionId, res);

    req.on('close', () => {
        sessions.delete(sessionId);
    });
});
module.exports = router