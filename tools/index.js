const dgram = require('dgram');

const SIP_PORT = 15000; // This port must match rtp.conf and sip.conf
const RTP_PORT = 15000; // Same port must be advertised in the SDP

// Create and bind the SIP UDP socket
const sipServer = dgram.createSocket('udp4');

sipServer.on('message', (msg, rinfo) => {
    const message = msg.toString();

    if (message.includes('INVITE')) {
        console.log(`📩 Got SIP INVITE from ${rinfo.address}:${rinfo.port}`);

        const response = [
            'SIP/2.0 200 OK',
            'Via: SIP/2.0/UDP 127.0.0.1:5060', // Dummy Via header (match from INVITE if needed)
            'From: <sip:asterisk@localhost>',
            'To: <sip:middleware@localhost>',
            'Call-ID: 1234567890',
            'CSeq: 1 INVITE',
            'Contact: <sip:middleware@127.0.0.1>',
            'Content-Type: application/sdp',
            'Content-Length: 129',
            '',
            'v=0',
            'o=- 0 0 IN IP4 127.0.0.1',
            's=Fake SIP',
            'c=IN IP4 127.0.0.1',
            't=0 0',
            `m=audio ${RTP_PORT} RTP/AVP 0`,
            'a=rtpmap:0 PCMU/8000',
            '',
            ''
        ].join('\r\n');

        sipServer.send(Buffer.from(response), rinfo.port, rinfo.address, (err) => {
            if (err) {
                console.error('❌ Failed to send SIP 200 OK:', err);
            } else {
                console.log(`✅ Sent SIP 200 OK to ${rinfo.address}:${rinfo.port}`);
            }
        });
    } else {
        console.log(`ℹ️ Got other SIP message: ${message.split('\r\n')[0]}`);
    }
});

sipServer.bind(SIP_PORT, () => {
    console.log(`🛰️ Fake SIP server listening on UDP ${SIP_PORT}`);
});

// Create and bind the RTP UDP socket
const rtpSocket = dgram.createSocket('udp4');

rtpSocket.on('message', (msg, rinfo) => {
    console.log(`🎧 Got RTP packet from ${rinfo.address}:${rinfo.port} - size: ${msg.length} bytes`);
});

rtpSocket.bind(RTP_PORT, () => {
    console.log(`🎙️ RTP socket also listening on ${RTP_PORT}`);
});

// Prevent Node.js from exiting
setInterval(() => {}, 1000);