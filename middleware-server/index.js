const express = require('express');
const axios = require('axios');
require('dotenv').config();
const app = express();

// Import handlers
const {
  stopAudioPlayback,
  startCallRecording,
  stopCallRecording,
  endCall,
  warmTransfer,
  originateCall
} = require('./amiHandler');

const { connectToVG } = require('./websocketClient');
const { createRtpHandler } = require('./audioHandler');

// Import configuration
const {
  VG_WEBHOOK_URL,
  VG_AUTH_TOKEN,
  MIDDLEWARE_SERVER_PORT
} = require('./config');

// Active call sessions storage
const callSessions = new Map();

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

// API Routes
app.post('/api/calls', async (req, res) => {
  const { caller, called, callSid } = req.body;
  console.log(`📞 New call request: Caller=${caller}, Called=${called}, CallSid=${callSid}`);
  
  try {
    // Create RTP handler for this call
    console.log(`🔊 Creating RTP handler for call ${callSid}`);
    const rtpHandler = createRtpHandler(callSid);
    console.log(`✅ RTP handler created on port ${rtpHandler.rtpPort} for call ${callSid}`);
    
    // Call Voicegenie webhook
    console.log(`🌐 Calling Voicegenie webhook at ${VG_WEBHOOK_URL}`);
    const vgResponse = await axios.post(
      VG_WEBHOOK_URL,
      {
        AccountSid: "",
        ApiVersion: "2010-04-01",
        CallSid: callSid,
        CallStatus: "ringing",
        Called: called,
        CalledCity: "",
        CalledCountry: "",
        CalledState: "",
        CalledZip: "",
        Caller: caller,
        CallerCity: "",
        CallerCountry: "",
        CallerState: "",
        CallerZip: "",
        Direction: "inbound",
        From: caller,
        FromCity: "",
        FromCountry: "",
        FromState: "",
        FromZip: "",
        To: called,
        ToCity: "",
        ToCountry: "",
        ToState: "",
        ToZip: ""
      },
      {
        headers: {
          'User-Agent': 'vicidial',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${VG_AUTH_TOKEN}`
        }
      }
    );
    
    console.log(`✅ Voicegenie response received for call ${callSid}`);
    
    // Extract response data
    const { socketURL, HangupUrl, statusCallbackUrl, recordingStatusUrl } = 
      vgResponse.data.data.data;
    
    console.log(`🔗 Socket URL: ${socketURL}`);
    console.log(`🔗 Hangup URL: ${HangupUrl}`);
    console.log(`🔗 Status Callback URL: ${statusCallbackUrl}`);
    
    // Store call session
    callSessions.set(callSid, {
      rtpHandler,
      socketURL,
      statusCallbackUrl,
      HangupUrl,
      recordingStatusUrl,
      caller,
      called,
      startTime: new Date(),
      rtpPort: rtpHandler.rtpPort
    });
    
    console.log(`💾 Call session stored for ${callSid}. Active calls: ${callSessions.size}`);
    
    // Connect to Voicegenie WebSocket
    console.log(`🔌 Connecting to VG WebSocket for call ${callSid}`);
    connectToVG(socketURL, {
      callSid,
      From: caller,
      To: called,
      HangupUrl,
      statusCallbackUrl
    }, rtpHandler);
    
    // Return the response to the AGI script
    console.log(`📤 Responding to AGI with socket URL and RTP port for call ${callSid}`);
    res.json({
      status: "success",
      data: {
        socketURL,
        rtpPort: rtpHandler.rtpPort
      },
      message: "Call initiated successfully"
    });
    
  } catch (error) {
    console.error(`❌ Error in /api/calls for call ${callSid}:`, error.message);
    
    if (error.response) {
      console.error('Response error data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    
    res.status(500).json({ 
      status: "error",
      error: error.message,
      details: error.response ? error.response.data : null
    });
  }
});

// Route to get RTP port for a specific call
app.get('/api/call-port/:callSid', (req, res) => {
  const { callSid } = req.params;
  console.log(`🔍 Looking up port for call ${callSid}`);
  
  const session = callSessions.get(callSid);
  if (session && session.rtpPort) {
    console.log(`✅ Found port ${session.rtpPort} for call ${callSid}`);
    res.json({ rtpPort: session.rtpPort });
  } else {
    console.warn(`⚠️ No session found for call ${callSid}, using default port`);
    res.json({ rtpPort: 40000 });
  }
});

// Start Recording API
app.post('/api/start-recording', async (req, res) => {
  const { callChannel, recordingFileName } = req.body;
  console.log(`🎬 Start recording request for channel ${callChannel}`);
  
  try {
    await startCallRecording(callChannel, recordingFileName);
    console.log(`✅ Recording started for channel ${callChannel}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Error starting recording for channel ${callChannel}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Stop Recording API
app.post('/api/stop-recording', async (req, res) => {
  const { callChannel } = req.body;
  console.log(`⏹️ Stop recording request for channel ${callChannel}`);
  
  try {
    await stopCallRecording(callChannel);
    console.log(`✅ Recording stopped for channel ${callChannel}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Error stopping recording for channel ${callChannel}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Stop Audio Playback API
app.post('/api/stop-audio', async (req, res) => {
  const { callChannel } = req.body;
  console.log(`🔇 Stop audio request for channel ${callChannel}`);
  
  try {
    await stopAudioPlayback(callChannel);
    console.log(`✅ Audio playback stopped for channel ${callChannel}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Error stopping audio for channel ${callChannel}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// End Call API
app.post('/api/end-call', async (req, res) => {
  const { callChannel, callSid } = req.body;
  console.log(`📴 End call request for channel ${callChannel}, SID ${callSid}`);
  
  try {
    await endCall(callChannel);
    console.log(`✅ Call ended for channel ${callChannel}`);
    
    // Clean up if we know the callSid
    if (callSid && callSessions.has(callSid)) {
      const session = callSessions.get(callSid);
      if (session.rtpHandler) {
        session.rtpHandler.cleanup();
      }
      callSessions.delete(callSid);
      console.log(`🧹 Session cleaned up for call ${callSid}`);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Error ending call for channel ${callChannel}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Warm Transfer API
app.post('/api/warm-transfer', async (req, res) => {
  const { callChannel, agentExtension, audioUrl, metadata } = req.body;
  console.log(`🔄 Transfer request for channel ${callChannel} to agent ${agentExtension}`);
  
  try {
    await warmTransfer(callChannel, agentExtension);
    console.log(`✅ Call transferred to agent ${agentExtension}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Error transferring call to agent ${agentExtension}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// System status API
app.get('/api/system-status', (req, res) => {
  const status = {
    activeCalls: Array.from(callSessions.keys()),
    callCount: callSessions.size,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };
  
  console.log(`📊 System status: ${callSessions.size} active calls`);
  res.json(status);
});

// Start the server
app.listen(MIDDLEWARE_SERVER_PORT, () => {
  console.log(`\n🚀 Middleware server running on port ${MIDDLEWARE_SERVER_PORT}`);
  console.log(`🔗 Using Voicegenie webhook: ${VG_WEBHOOK_URL}`);
  console.log(`📞 Ready to handle calls!\n`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully.');
  
  // Clean up all active calls
  for (const [callSid, session] of callSessions.entries()) {
    if (session.rtpHandler) {
      console.log(`🧹 Cleaning up call ${callSid}`);
      session.rtpHandler.cleanup();
    }
  }
  
  process.exit(0);
});