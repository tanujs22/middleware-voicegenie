// audioHandler.js
const dgram = require('dgram');
const portManager = require('./portManager');

function createRtpHandler(callId) {
  const rtpPort = portManager.allocatePort();
  const socket = dgram.createSocket('udp4');
  let remoteRtpInfo = null;

  // Initialize socket
  socket.on('error', (err) => {
    console.error(`RTP Socket Error for call ${callId}:`, err);
  });

  socket.on('listening', () => {
    console.log(`RTP socket for call ${callId} listening on port ${rtpPort}`);
  });

  // Bind immediately
  socket.bind(rtpPort, '0.0.0.0');

  return {
    rtpPort,

    // Send audio to Asterisk
    sendAudioToAsterisk: (audioChunk) => {
      if (remoteRtpInfo) {
        socket.send(audioChunk, remoteRtpInfo.port, remoteRtpInfo.address);
      }
    },

    // Get audio from Asterisk
    getAudioFromAsterisk: (callback) => {
      socket.on('message', (audioChunk, rinfo) => {
        if (!remoteRtpInfo) {
          remoteRtpInfo = rinfo;
          console.log(`Learned RTP target for call ${callId}: ${rinfo.address}:${rinfo.port}`);
        }
        callback(audioChunk);
      });
    },

    // Clean up resources
    cleanup: () => {
      socket.close();
      portManager.releasePort(rtpPort);
      console.log(`Released RTP port ${rtpPort} for call ${callId}`);
    }
  };
}

module.exports = { createRtpHandler };