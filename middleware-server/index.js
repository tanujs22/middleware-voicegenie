const express = require('express');
const axios = require('axios');
require('dotenv').config();
const app = express();

const {
    stopAudioPlayback,
    startCallRecording,
    stopCallRecording,
    endCall,
    warmTransfer,
    originateCall
} = require('./amiHandler');

const { connectToVG } = require('./websocketClient');

const {
    VG_WEBHOOK_URL,
    VG_AUTH_TOKEN,
    MIDDLEWARE_SERVER_PORT
} = require('./config');

app.use(express.json());


// Endpoint that AGI script calls to initiate the bridge and fetch VG socket URL
app.post('/api/calls', async (req, res) => {
    const { caller, called, callSid } = req.body;

    try {
        // Create audio handler with unique port
        const rtpHandler = require('./audioHandler').createRtpHandler(callSid);
        const rtpPort = rtpHandler.rtpPort;

        // Get VG socket URL as before...
        const vgResponse = await axios.post(/* ... */);
        const { socketURL, HangupUrl, statusCallbackUrl } = vgResponse.data.data;

        // Store in call sessions map with all needed info
        callSessions.set(callSid, {
            rtpHandler,
            socketURL,
            rtpPort,
            caller,
            called,
            // other call metadata
        });

        // Connect to VG with the rtpHandler (modified function)
        connectToVG(socketURL, {
            callSid,
            From: caller,
            To: called,
            HangupUrl,
            statusCallbackUrl
        }, rtpHandler);

        // Keep original response structure for compatibility
        res.json({
            status: vgResponse.data.status,
            data: vgResponse.data.data,
            message: vgResponse.data.message
        });

    } catch (error) {
        console.error('❌ Error in /api/calls:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Start Recording API
app.post('/api/start-recording', async (req, res) => {
    const { callChannel, recordingFileName } = req.body;

    try {
        await startCallRecording(callChannel, recordingFileName);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Stop Recording API
app.post('/api/stop-recording', async (req, res) => {
    const { callChannel } = req.body;

    try {
        await stopCallRecording(callChannel);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Stop Audio Playback API
app.post('/api/stop-audio', async (req, res) => {
    const { callChannel } = req.body;

    try {
        await stopAudioPlayback(callChannel);
        res.json({ success: true });
    } catch (err) {
        console.error('Error stopping audio playback:', err);
        res.status(500).json({ error: err.message });
    }
});

// End Call API
app.post('/api/end-call', async (req, res) => {
    const { callChannel, callSid } = req.body;
    const session = callSessions.get(callSid);

    try {
        await endCall(callChannel);
        if (session) {
            session.rtpHandler.cleanup();
            callSessions.delete(callSid);
            res.json({ success: true });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Warm Transfer API
app.post('/api/warm-transfer', async (req, res) => {
    const { callChannel, agentExtension, audioUrl, metadata } = req.body;

    try {
        // TODO: Handle audio playback & metadata clearly on agent side in Vicidial UI separately
        await warmTransfer(callChannel, agentExtension);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Outbound Call Creation API
app.post('/calls/create', async (req, res) => {
    const {
        To,
        From,
        HangupUrl,
        statusCallbackUrl,
        socketUrl,
        recordCall,
        recordingStatusUrl
    } = req.body;

    try {
        // Generate unique Call ID (clearly defined)
        const callId = `OUTCALL_${Date.now()}`;

        // Initiate outbound call via AMI originate command
        await originateCall(From, To, callId);

        // Immediately respond clearly indicating call initiation success
        res.json({
            status: "success",
            callId,
            message: "Outbound call initiated successfully."
        });

        // Handle further logic clearly (websocket, recording, callbacks separately)
        // Store these URLs clearly for managing call lifecycle (recommended: DB or memory store)

    } catch (err) {
        console.error('Error initiating outbound call:', err);
        res.status(500).json({ status: "failure", error: err.message });
    }
});

// in index.js
app.get('/api/call-port/:callSid', (req, res) => {
    const { callSid } = req.params;
    const session = callSessions.get(callSid);

    if (session && session.rtpPort) {
        res.json({ rtpPort: session.rtpPort });
    } else {
        // Fallback to default port if call session not found
        console.warn(`Call session ${callSid} not found, using default port`);
        res.json({ rtpPort: 40000 });
    }
});

app.listen(MIDDLEWARE_SERVER_PORT, () => {
    console.log(`Middleware server running on port ${MIDDLEWARE_SERVER_PORT}`);
});