const dgram = require('dgram');

const SIP_PORT = 40000; // Port must match what's in sip.conf for middleware
const server = dgram.createSocket('udp4');

server.on('message', (msg, rinfo) => {
  const message = msg.toString();

  if (message.includes('INVITE')) {
    console.log(`📩 Got SIP INVITE from ${rinfo.address}:${rinfo.port}`);

    const response = [
      'SIP/2.0 200 OK',
      'Via: SIP/2.0/UDP 127.0.0.1:5060', // Fake Via header
      'From: <sip:asterisk@localhost>',
      'To: <sip:middleware@localhost>',
      'Call-ID: 1234567890',
      'CSeq: 1 INVITE',
      'Contact: <sip:middleware@127.0.0.1>',
      'Content-Length: 0',
      '',
      ''
    ].join('\r\n');

    server.send(Buffer.from(response), rinfo.port, rinfo.address, (err) => {
      if (err) console.error('❌ Failed to send SIP 200 OK:', err);
      else console.log(`✅ Sent SIP 200 OK to ${rinfo.address}:${rinfo.port}`);
    });
  } else {
    console.log(`ℹ️ Got other SIP message: ${message.split('\r\n')[0]}`);
  }
});

server.bind(SIP_PORT, () => {
  console.log(`🛰️ Fake SIP server listening on UDP ${SIP_PORT}`);
});