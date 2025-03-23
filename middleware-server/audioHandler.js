const dgram = require('dgram');

const RTP_PORT = 40000;
const ASTERISK_IP = '127.0.0.1';
const ASTERISK_PORT = RTP_PORT;

const asteriskSocket = dgram.createSocket('udp4');
let isBound = false;

// Send audio from VG → Asterisk RTP
function sendAudioToAsterisk(audioChunk) {
  asteriskSocket.send(audioChunk, ASTERISK_PORT, ASTERISK_IP);
}

// Receive audio from Asterisk RTP
function getAudioFromAsterisk(callback) {
  if (!isBound) {
    asteriskSocket.bind(RTP_PORT, () => {
      isBound = true;
      console.log(`🔊 RTP socket bound on port ${RTP_PORT}`);
    });
  }

  // Prevent multiple 'message' listeners
  if (asteriskSocket.listenerCount('message') === 0) {
    asteriskSocket.on('message', (audioChunk) => {
      callback(audioChunk);
    });
  }
}

module.exports = { sendAudioToAsterisk, getAudioFromAsterisk };