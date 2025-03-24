const dgram = require('dgram');
const crypto = require('crypto');

const SIP_PORT = 15000;
const sipServer = dgram.createSocket('udp4');

const rtpPort = 15062; // consistent with your Asterisk audio port in SDP
const rtpSocket = dgram.createSocket('udp4');
rtpSocket.on('message', (msg, rinfo) => {
    console.log(`🎧 Got RTP from ${rinfo.address}:${rinfo.port} - size: ${msg.length} bytes`);
});
rtpSocket.bind(rtpPort, () => {
    console.log(`🎙️ RTP socket listening on ${rtpPort}`);
});

function parseHeadersAndSDP(msg) {
    const [headerPart, sdpPart] = msg.split('\r\n\r\n');
    const headers = {};
    headerPart.split('\r\n').forEach(line => {
        const [key, ...rest] = line.split(':');
        if (key && rest.length) headers[key.trim()] = rest.join(':').trim();
    });

    let rtpPort = 15000; // default fallback
    if (sdpPart) {
        const match = sdpPart.match(/m=audio (\d+)/);
        if (match) rtpPort = parseInt(match[1]);
    }

    return { headers, rtpPort };
}

sipServer.on('message', (msg, rinfo) => {
    const message = msg.toString();

    if (message.startsWith('INVITE')) {
        console.log(`📩 Got SIP INVITE from ${rinfo.address}:${rinfo.port}`);

        const { headers, rtpPort } = parseHeadersAndSDP(message);
        const callId = headers['Call-ID'] || crypto.randomUUID();
        const cseq = headers['CSeq'] || '1 INVITE';
        const via = headers['Via'];
        const to = headers['To'];
        const from = headers['From'];
        const tag = crypto.randomBytes(4).toString('hex');

        const response = [
            'SIP/2.0 200 OK',
            `Via: ${via}`,
            `From: ${from}`,
            `To: ${to};tag=${tag}`,
            `Call-ID: ${callId}`,
            `CSeq: ${cseq}`,
            'Contact: <sip:middleware@127.0.0.1>',
            'Content-Type: application/sdp',
            'Content-Length: 129',
            '',
            'v=0',
            'o=- 0 0 IN IP4 127.0.0.1',
            's=Fake SIP',
            'c=IN IP4 127.0.0.1',
            't=0 0',
            `m=audio ${rtpPort} RTP/AVP 0`,
            'a=rtpmap:0 PCMU/8000',
            '',
            ''
        ].join('\r\n');

        sipServer.send(Buffer.from(response), rinfo.port, rinfo.address, err => {
            if (err) console.error('❌ Failed to send SIP 200 OK:', err);
            else console.log(`✅ Sent SIP 200 OK with RTP port ${rtpPort} to ${rinfo.address}:${rinfo.port}`);
        });

    } else if (message.startsWith('ACK')) {
        console.log(`✅ Got ACK from ${rinfo.address}:${rinfo.port}`);
    } else {
        console.log(`ℹ️ Got other SIP message: ${message.split('\r\n')[0]}`);
    }
});

sipServer.bind(SIP_PORT, () => {
    console.log(`🛰️ Fake SIP server listening on UDP ${SIP_PORT}`);
});