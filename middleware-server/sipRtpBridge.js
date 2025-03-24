const dgram = require('dgram');
const { buildSip200OKResponse } = require('./sipHandler');
const { getRtpPort, sendAudioToAsterisk, getAudioFromAsterisk } = require('./audioHandler');

const SIP_PORT = 15000;
const sipSocket = dgram.createSocket('udp4');

sipSocket.on('message', (msg, rinfo) => {
  const message = msg.toString();

  if (message.includes('INVITE')) {
    console.log(`\uD83D\uDCE9 Got SIP INVITE from ${rinfo.address}:${rinfo.port}`);

    const callIdMatch = message.match(/Call-ID:\s*(.*)/);
    const cSeqMatch = message.match(/CSeq:\s*(\d+)/);
    const callId = callIdMatch?.[1]?.trim() || '123456';
    const cSeq = cSeqMatch?.[1]?.trim() || '1';

    const { ip, port } = getRtpPort();
    const sip200ok = buildSip200OKResponse(callId, cSeq, port, ip);

    sipSocket.send(Buffer.from(sip200ok), rinfo.port, rinfo.address, (err) => {
      if (err) console.error('\u274C Failed to send SIP 200 OK:', err);
      else console.log(`\u2705 Sent SIP 200 OK to ${rinfo.address}:${rinfo.port}`);
    });
  } else {
    console.log(`\u2139\uFE0F Received non-INVITE SIP message:\n${message}`);
  }
});

sipSocket.bind(SIP_PORT, () => {
  console.log(`\uD83D\uDE80 SIP server listening on UDP ${SIP_PORT}`);
});

// Start RTP listening
getAudioFromAsterisk((chunk) => {
  console.log('\uD83D\uDCE5 RTP from Asterisk:', chunk.length, 'bytes');
  // Here, forward to VG or handle audio
});
