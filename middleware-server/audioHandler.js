// audioHandler.js
const dgram = require('dgram');
const portManager = require('./portManager'); // Use the dedicated port manager

function createRtpHandler(callId) {
  // Get port from the port manager
  const rtpPort = portManager.allocatePort();
  console.log(`⚡ Creating new RTP handler for call ${callId} on port ${rtpPort}`);
  
  const socket = dgram.createSocket('udp4');
  let remoteRtpInfo = null;
  let isBound = false;
  let bufferedAudio = [];
  
  // Socket error handling
  socket.on('error', (err) => {
    console.error(`❌ RTP Socket Error for call ${callId}:`, err);
  });

  socket.on('listening', () => {
    console.log(`🔊 RTP socket for call ${callId} listening on port ${rtpPort}`);
  });

  // Function to send audio to Asterisk
  function sendAudioToAsterisk(audioChunk) {
    if (remoteRtpInfo) {
      console.log(`📤 Sending ${audioChunk.length} bytes to Asterisk at ${remoteRtpInfo.address}:${remoteRtpInfo.port}`);
      socket.send(audioChunk, remoteRtpInfo.port, remoteRtpInfo.address, (err) => {
        if (err) console.error(`❌ RTP send error for call ${callId}:`, err);
      });
    } else {
      console.warn(`⚠️ No RTP target yet for call ${callId}. Buffering audio chunk (${bufferedAudio.length + 1} chunks).`);
      bufferedAudio.push(audioChunk);
      if (bufferedAudio.length > 100) {
        console.warn(`⚠️ Buffer getting large (${bufferedAudio.length} chunks) for call ${callId}. Trimming.`);
        bufferedAudio = bufferedAudio.slice(-50); // Keep only last 50 chunks
      }
    }
  }

  // Function to get audio from Asterisk
  function getAudioFromAsterisk(callback) {
    if (!isBound) {
      console.log(`🔌 Binding RTP socket for call ${callId} to port ${rtpPort}`);
      socket.bind(rtpPort, '0.0.0.0', () => {
        isBound = true;
        console.log(`✅ RTP socket successfully bound on port ${rtpPort} for call ${callId}`);
      });
    }

    if (socket.listenerCount('message') === 0) {
      console.log(`🎧 Setting up message listener for call ${callId}`);
      socket.on('message', (audioChunk, rinfo) => {
        if (!remoteRtpInfo) {
          remoteRtpInfo = rinfo;
          console.log(`📍 Learned RTP target for call ${callId}: ${rinfo.address}:${rinfo.port}`);

          if (bufferedAudio.length > 0) {
            console.log(`🔄 Flushing ${bufferedAudio.length} buffered chunks to ${rinfo.address}:${rinfo.port}`);
            bufferedAudio.forEach((chunk, index) => {
              socket.send(chunk, remoteRtpInfo.port, remoteRtpInfo.address, (err) => {
                if (err) console.error(`❌ RTP send error (flush ${index}) for call ${callId}:`, err);
              });
            });
            bufferedAudio = [];
          }
        }

        console.log(`🎤 Received RTP audio chunk (${audioChunk.length} bytes) from Asterisk for call ${callId}`);
        callback(audioChunk);
      });
    } else {
      console.log(`ℹ️ Message listener already set up for call ${callId}`);
    }
  }

  // Function to clean up resources
  function cleanup() {
    console.log(`🧹 Cleaning up RTP handler for call ${callId} on port ${rtpPort}`);
    socket.close(() => {
      console.log(`🔌 Socket closed for call ${callId}`);
    });
    // Release the port back to the manager
    portManager.releasePort(rtpPort);
    console.log(`🔢 Released port ${rtpPort} back to pool`);
  }

  // Keep old functions for backward compatibility but make them use a singleton handler
let defaultHandler = null;
function getDefaultHandler() {
  if (!defaultHandler) {
    console.log('⚠️ Creating default RTP handler - not recommended for production use!');
    defaultHandler = createRtpHandler('default_handler');
  }
  return defaultHandler;
}

// Legacy functions that use the default handler
function sendAudioToAsterisk(audioChunk) {
  console.log('⚠️ Using legacy sendAudioToAsterisk function with default handler');
  return getDefaultHandler().sendAudioToAsterisk(audioChunk);
}

function getAudioFromAsterisk(callback) {
  console.log('⚠️ Using legacy getAudioFromAsterisk function with default handler');
  return getDefaultHandler().getAudioFromAsterisk(callback);
}

  return {
    rtpPort,
    sendAudioToAsterisk,
    getAudioFromAsterisk,
    cleanup,
    sendAudioToAsterisk,
    getAudioFromAsterisk
  };
}

// Rest of your code...