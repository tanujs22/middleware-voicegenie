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


// in index.js
app.post('/api/calls', async (req, res) => {
    const { caller, called, callSid } = req.body;
    console.log('📥 /api/calls hit with:', { caller, called, callSid });
    
    try {
      // Create audio handler with unique port
      console.log('🔊 Creating RTP handler for call:', callSid);
      const rtpHandler = require('./audioHandler').createRtpHandler(callSid);
      const rtpPort = rtpHandler.rtpPort;
      console.log(`🔌 Allocated RTP port ${rtpPort} for call ${callSid}`);
      
      // Check if VG_WEBHOOK_URL is properly set
      if (!VG_WEBHOOK_URL) {
        console.error('❌ VG_WEBHOOK_URL is not defined in config!');
        throw new Error('Missing Voicegenie webhook URL configuration');
      }
      console.log('🔗 Will call Voicegenie at:', VG_WEBHOOK_URL);
      
      // Step 1: Get VG WebSocket and webhook URLs
      console.log('📤 Sending request to Voicegenie...');
      const vgResponse = await axios.post(
        VG_WEBHOOK_URL,
        {
          Caller: caller,
          Called: called,
          CallSid: callSid,
          CallStatus: "ringing",
          Direction: "inbound",
          From: caller,
          To: called
        },
        {
          headers: {
            'User-Agent': 'vicidial',
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ VG responded:', JSON.stringify(vgResponse.data, null, 2));
      
      const { socketURL, HangupUrl, statusCallbackUrl } = vgResponse.data.data;
      
      // Store in call sessions map
      console.log('📝 Storing call session data');
      callSessions.set(callSid, {
        rtpHandler,
        socketURL,
        rtpPort,
        caller,
        called,
        HangupUrl,
        statusCallbackUrl
      });
      
      // Connect to VG WebSocket
      console.log('🔌 Connecting to VG WebSocket:', socketURL);
      connectToVG(socketURL, {
        callSid,
        From: caller,
        To: called,
        HangupUrl,
        statusCallbackUrl
      }, rtpHandler);
      
      // Respond back to AGI
      console.log('📤 Responding to AGI script');
      res.json(vgResponse.data);
      
    } catch (error) {
      console.error('❌ Error in /api/calls:', error.message);
      if (error.response) {
        console.error('Response error data:', error.response.data);
      }
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

// For debugging/monitoring purposes
app.get('/api/system-status', (req, res) => {
    res.json({
      activeCalls: Array.from(callSessions.keys()),
      callCount: callSessions.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  });

app.listen(MIDDLEWARE_SERVER_PORT, () => {
    console.log(`Middleware server running on port ${MIDDLEWARE_SERVER_PORT}`);
});