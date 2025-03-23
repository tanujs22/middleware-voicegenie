const WebSocket = require('ws');
const axios = require('axios');
const { sendAudioToAsterisk, getAudioFromAsterisk } = require('./audioHandler');
const { sendStatusCallback, sendHangupCallback } = require('./callWebhookHandler');

function connectToVG(socketURL, callDetails) {
  const ws = new WebSocket(socketURL);

  ws.on('open', () => {
    console.log('✅ Connected to VG WebSocket.');

    // Explicitly send initial Call Status: initiated
    sendStatusCallback(callDetails.statusCallbackUrl, callDetails.callSid, 'initiated');

    ws.send(JSON.stringify({
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
    }));

    // Start streaming audio from Asterisk to VG
    getAudioFromAsterisk((audioChunk) => {
      const base64Audio = audioChunk.toString('base64');
      ws.send(JSON.stringify({
        sequenceNumber: 1,
        event: 'media',
        media: {
          track: 'inbound',
          timestamp: Date.now().toString(),
          chunk: 1,
          payload: base64Audio
        },
        extra_headers: "{}"
      }));
    });
  });

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    if (data.event === 'media' && data.media.payload) {
      const audioChunk = Buffer.from(data.media.payload, 'base64');
      sendAudioToAsterisk(audioChunk);
    }
  });

  ws.on('close', () => {
    console.log('🔴 VG WebSocket closed.');

    // Send final Call Status: completed
    sendStatusCallback(callDetails.statusCallbackUrl, callDetails.callSid, 'completed');

    // Send Hangup callback explicitly
    sendHangupCallback(callDetails.HangupUrl, {
      hangupCause: "NORMAL_CLEARING",
      disconnectedBy: callDetails.From,
      AnswerTime: callDetails.AnswerTime || new Date().toISOString(),
      BillDuration: callDetails.BillDuration || "0",  
      BillRate: callDetails.BillRate || "0.006",
      CallStatus: "completed",
      CallUUID: callDetails.callSid,
      Direction: callDetails.Direction || "outbound",
      Duration: callDetails.Duration || "0", 
      EndTime: new Date().toISOString(),
      Event: "Hangup",
      From: callDetails.From,
      HangupSource: "Callee",
      SessionStart: callDetails.SessionStart || new Date().toISOString(),
      StartTime: callDetails.StartTime || new Date().toISOString(),
      To: callDetails.To,
      TotalCost: callDetails.TotalCost || "0.000"
    });
  });

  ws.on('error', (error) => {
    console.error('⚠️ WebSocket error:', error.message);
  });

  return ws;
}

module.exports = { connectToVG };