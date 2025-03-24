// audioHandler.js
const dgram = require('dgram');

// Port management for concurrent calls
const allocatedPorts = new Set();

function createRtpHandler(callId) {
  // Allocate a port from the available range
  let rtpPort = 10000;
  for (let port = 10000; port <= 19999; port += 2) {
    if (!allocatedPorts.has(port)) {
      rtpPort = port;
      allocatedPorts.add(port);
      console.log(`🔢 Allocated port ${port} (${allocatedPorts.size} ports in use)`);
      break;
    }
  }
  
  console.log(`⚡ Creating new RTP handler for call ${callId} on port ${rtpPort}`);
  
  const socket = dgram.createSocket('udp4');
  let remoteRtpInfo = null;
  let isBound = false;
  let bufferedAudio = [];
  
  socket.on('error', (err) => {
    console.error(`❌ RTP Socket Error for call ${callId}:`, err);
  });

  socket.on('listening', () => {
    console.log(`🔊 RTP socket for call ${callId} listening on port ${rtpPort}`);
  });

// Function to send audio to Asterisk
function sendAudioToAsterisk(audioChunk) {
  // Always try to send to the return port (rtpPort+1)
  const returnPort = rtpPort + 1;
  console.log(`📤 Sending ${audioChunk.length} bytes to Asterisk return port 127.0.0.1:${returnPort}`);
  socket.send(audioChunk, returnPort, '127.0.0.1', (err) => {
    if (err) console.error(`❌ RTP send error to return port for call ${callId}:`, err);
  });
  
  // If we have an established RTP target, also send there
  if (remoteRtpInfo) {
    console.log(`📤 Also sending to established RTP target ${remoteRtpInfo.address}:${remoteRtpInfo.port}`);
    socket.send(audioChunk, remoteRtpInfo.port, remoteRtpInfo.address, (err) => {
      if (err) console.error(`❌ RTP send error for call ${callId}:`, err);
    });
  } else {
    // Still maintain the buffer for when we get an RTP target
    console.warn(`⚠️ No established RTP target yet. Buffering audio chunk (${bufferedAudio.length + 1} chunks).`);
    bufferedAudio.push(audioChunk);
    if (bufferedAudio.length > 100) {
      console.warn(`⚠️ Buffer getting large (${bufferedAudio.length} chunks). Trimming.`);
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
    allocatedPorts.delete(rtpPort);
    console.log(`🔢 Released port ${rtpPort} back to pool (${allocatedPorts.size} ports still in use)`);
  }

  return {
    rtpPort,
    sendAudioToAsterisk,
    getAudioFromAsterisk,
    cleanup
  };
}

// Legacy functions for backward compatibility
let defaultHandler = null;
function getDefaultHandler() {
  if (!defaultHandler) {
    console.log('⚠️ Creating default RTP handler - not recommended for production use!');
    defaultHandler = createRtpHandler('default_handler');
  }
  return defaultHandler;
}

function sendAudioToAsterisk(audioChunk) {
  console.log('⚠️ Using legacy sendAudioToAsterisk function with default handler');
  return getDefaultHandler().sendAudioToAsterisk(audioChunk);
}

function getAudioFromAsterisk(callback) {
  console.log('⚠️ Using legacy getAudioFromAsterisk function with default handler');
  return getDefaultHandler().getAudioFromAsterisk(callback);
}

// IMPORTANT: Export both the new function and the legacy functions
module.exports = { 
  createRtpHandler,
  sendAudioToAsterisk,
  getAudioFromAsterisk
};