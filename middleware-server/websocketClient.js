const WebSocket = require('ws');
const { sendStatusCallback, sendHangupCallback } = require('./callWebhookHandler');

function connectToVG(socketURL, callDetails, rtpHandler) {
  console.log(`🔄 Setting up WebSocket connection to ${socketURL} for call ${callDetails.callSid}`);
  
  // Check if we have a custom RTP handler or need to use legacy functions
  let audioHandler;
  if (rtpHandler) {
    console.log(`✅ Using provided RTP handler for call ${callDetails.callSid}`);
    audioHandler = rtpHandler;
  } else {
    console.log(`⚠️ No RTP handler provided for call ${callDetails.callSid}. Using legacy functions.`);
    // Get the legacy functions
    audioHandler = require('./audioHandler');
  }
  
  const ws = new WebSocket(socketURL);

  ws.on('open', () => {
    console.log(`✅ WebSocket connected for call ${callDetails.callSid}`);

    // Send initial status
    console.log(`📤 Sending 'initiated' status to ${callDetails.statusCallbackUrl}`);
    sendStatusCallback(callDetails.statusCallbackUrl, callDetails.callSid, 'initiated')
      .then(() => console.log(`✅ Status callback successful for call ${callDetails.callSid}`))
      .catch(err => console.error(`❌ Status callback failed for call ${callDetails.callSid}:`, err.message));

    // Send start event
    console.log(`📤 Sending start event for call ${callDetails.callSid}`);
    const startEvent = {
      sequenceNumber: 0,
      event: "start",
      start: {
        callId: callDetails.callSid,
        streamId: `stream_${Date.now()}`,
        accountId: "10144634",
        tracks: ["inbound"],
        mediaFormat: {
          encoding: "audio/mulaw",
          sampleRate: 8000
        },
      },
      extra_headers: "{}"
    };
    
    ws.send(JSON.stringify(startEvent));
    console.log(`✅ Start event sent for call ${callDetails.callSid}`);

    // Stream audio from Asterisk to VG
    let sequenceNumber = 1;
    console.log(`🎧 Starting audio streaming from Asterisk for call ${callDetails.callSid}`);
    
    audioHandler.getAudioFromAsterisk((audioChunk) => {
      console.log(`🎤 Received RTP chunk (${audioChunk.length} bytes) from Asterisk for call ${callDetails.callSid}`);
      const base64Audio = audioChunk.toString('base64');
      
      const mediaEvent = {
        sequenceNumber: sequenceNumber++,
        event: 'media',
        media: {
          track: 'inbound',
          timestamp: Date.now().toString(),
          chunk: 1,
          payload: base64Audio
        },
        extra_headers: "{}"
      };
      
      // Only log a preview of the base64 data
      console.log(`📤 Sending audio to VG for call ${callDetails.callSid}: ${base64Audio.slice(0, 30)}...`);
      ws.send(JSON.stringify(mediaEvent));
    });
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.event === 'media' && data.media && data.media.payload) {
        console.log(`📩 Received media event from VG for call ${callDetails.callSid}`);
        
        // Decode the audio
        const audioChunk = Buffer.from(data.media.payload, 'base64');
        console.log(`🔊 Decoded audio chunk (${audioChunk.length} bytes) for call ${callDetails.callSid}`);
        
        // Send to Asterisk
        audioHandler.sendAudioToAsterisk(audioChunk);
      } else {
        console.log(`📩 Received non-media event from VG for call ${callDetails.callSid}:`, 
                   JSON.stringify(data).slice(0, 100) + '...');
      }
    } catch (error) {
      console.error(`❌ Error processing WebSocket message for call ${callDetails.callSid}:`, error.message);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`🔴 WebSocket closed for call ${callDetails.callSid}. Code: ${code}, Reason: ${reason || 'No reason provided'}`);
    
    // Send completed status
    console.log(`📤 Sending 'completed' status for call ${callDetails.callSid}`);
    sendStatusCallback(callDetails.statusCallbackUrl, callDetails.callSid, 'completed')
      .catch(err => console.error(`❌ Failed to send completed status for call ${callDetails.callSid}:`, err.message));
    
    // Send hangup notification
    console.log(`📤 Sending hangup notification for call ${callDetails.callSid}`);
    const hangupPayload = {
      hangupCause: "NORMAL_CLEARING",
      disconnectedBy: callDetails.From,
      AnswerTime: callDetails.AnswerTime || new Date().toISOString(),
      BillDuration: callDetails.BillDuration || "0",  
      BillRate: callDetails.BillRate || "0.006",
      CallStatus: "completed",
      CallUUID: callDetails.callSid,
      Direction: callDetails.Direction || "inbound",
      Duration: callDetails.Duration || "0", 
      EndTime: new Date().toISOString(),
      Event: "Hangup",
      From: callDetails.From,
      HangupSource: "Callee",
      SessionStart: callDetails.SessionStart || new Date().toISOString(),
      StartTime: callDetails.StartTime || new Date().toISOString(),
      To: callDetails.To,
      TotalCost: callDetails.TotalCost || "0.000"
    };
    
    sendHangupCallback(callDetails.HangupUrl, hangupPayload)
      .catch(err => console.error(`❌ Failed to send hangup for call ${callDetails.callSid}:`, err.message));
    
    // Clean up RTP resources if we have a handler
    if (rtpHandler && rtpHandler.cleanup) {
      console.log(`🧹 Cleaning up RTP resources for call ${callDetails.callSid}`);
      rtpHandler.cleanup();
    }
  });

  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for call ${callDetails.callSid}:`, error.message);
  });

  return ws;
}

module.exports = { connectToVG };