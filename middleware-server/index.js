const express = require('express');
const axios = require('axios');
require('dotenv').config();
require('./sipRtpBridge');
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
    console.log('📥 /api/calls hit');
    try {
      // Step 1: Get VG WebSocket and webhook URLs
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
  
      console.log('✅ VG responded:', vgResponse.data);
  
      const { socketURL, HangupUrl, statusCallbackUrl, recordingStatusUrl } =
        vgResponse.data.data.data;
  
      // Step 2: Connect to VG WebSocket
      connectToVG(socketURL, {
        callSid,
        From: caller,
        To: called,
        HangupUrl,
        statusCallbackUrl
      });
  
      // Step 3: Originate a new call to "bot leg"
      // Example: Originate call from Asterisk to SIP/6002
      await originateCall('Local/bot@bridge', caller, callSid); // make sure this dialplan exists
  
      // Step 4: Respond back to AGI
      res.json({ socketURL });
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
    const { callChannel } = req.body;
  
    try {
      await endCall(callChannel);
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

  app.listen(MIDDLEWARE_SERVER_PORT, () => {
    console.log(`Middleware server running on port ${MIDDLEWARE_SERVER_PORT}`);
  });