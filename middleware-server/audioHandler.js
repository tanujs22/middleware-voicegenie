const dgram = require('dgram');

const RTP_PORT = 50000;
const asteriskSocket = dgram.createSocket('udp4');
let isBound = false;

let remoteRtpInfo = null;
let bufferedAudio = []; // 👈 VG → Asterisk buffer before we learn IP

function sendAudioToAsterisk(audioChunk) {
  if (remoteRtpInfo) {
    // Send immediately if we know the destination
    asteriskSocket.send(audioChunk, remoteRtpInfo.port, remoteRtpInfo.address, (err) => {
      if (err) console.error('❌ RTP send error:', err);
    });
  } else {
    // Buffer until we know where to send
    console.warn('⚠️ No RTP target yet. Buffering audio chunk.');
    bufferedAudio.push(audioChunk);
  }
}

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

        // Flush buffered audio chunks
        bufferedAudio.forEach(chunk => {
          asteriskSocket.send(chunk, remoteRtpInfo.port, remoteRtpInfo.address, (err) => {
            if (err) console.error('❌ RTP send error (flush):', err);
          });
        });
        bufferedAudio = [];
      }

      console.log('🎤 Received RTP audio chunk from Asterisk:', audioChunk.length, 'bytes');
      callback(audioChunk);
    });
  }
}

module.exports = { sendAudioToAsterisk, getAudioFromAsterisk };