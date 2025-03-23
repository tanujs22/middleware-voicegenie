const dgram = require('dgram');

// Placeholder for RTP sockets setup
const RTP_PORT = 40000; // Example RTP port (set correctly for real use)
const asteriskSocket = dgram.createSocket('udp4');

// Sends audio from VG to Asterisk via RTP
function sendAudioToAsterisk(audioChunk) {
  // Replace with actual RTP destination (Asterisk IP and Port)
  const ASTERISK_IP = '127.0.0.1';
  const ASTERISK_PORT = RTP_PORT;
  asteriskSocket.send(audioChunk, ASTERISK_PORT, ASTERISK_IP);
}

// Receives audio from Asterisk RTP stream
function getAudioFromAsterisk(callback) {
  asteriskSocket.bind(RTP_PORT);

  asteriskSocket.on('message', (audioChunk) => {
    callback(audioChunk);
  });
}

module.exports = { sendAudioToAsterisk, getAudioFromAsterisk };