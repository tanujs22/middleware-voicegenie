const dgram = require('dgram');

const RTP_PORT = 40000;
const asteriskSocket = dgram.createSocket('udp4');
let isBound = false;

let remoteRtpInfo = null; // 👈 To store where to send audio back

// Send audio from VG → Asterisk RTP (dynamic target)
function sendAudioToAsterisk(audioChunk) {
  if (remoteRtpInfo) {
    asteriskSocket.send(audioChunk, remoteRtpInfo.port, remoteRtpInfo.address, (err) => {
      if (err) console.error('❌ RTP send error:', err);
    });
  } else {
    console.warn('⚠️ No RTP target yet. Dropping audio chunk.');
  }
}

// Receive audio from Asterisk RTP
function getAudioFromAsterisk(callback) {
  if (!isBound) {
    asteriskSocket.bind(RTP_PORT, () => {
      isBound = true;
      console.log(`🔊 RTP socket bound on port ${RTP_PORT}`);
    });
  }

  if (asteriskSocket.listenerCount('message') === 0) {
    asteriskSocket.on('message', (audioChunk, rinfo) => {
      if (!remoteRtpInfo) {
        remoteRtpInfo = rinfo;
        console.log(`📍 Learned RTP target from Asterisk: ${rinfo.address}:${rinfo.port}`);
      }

      console.log('🎤 Received RTP audio chunk from Asterisk:', audioChunk.length, 'bytes');
      callback(audioChunk);
    });
  }
}

module.exports = { sendAudioToAsterisk, getAudioFromAsterisk };