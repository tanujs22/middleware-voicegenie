function buildSip200OKResponse(callId, cSeq, rtpPort, localIp = '127.0.0.1') {
    return [
      'SIP/2.0 200 OK',
      'Via: SIP/2.0/UDP 127.0.0.1:5060', // You can dynamically set if needed
      'From: <sip:asterisk@localhost>',
      'To: <sip:middleware@localhost>;tag=66cf78d5',
      `Call-ID: ${callId}`,
      `CSeq: ${cSeq} INVITE`,
      `Contact: <sip:middleware@${localIp}>`,
      'Content-Type: application/sdp',
      'Content-Length: 129',
      '',
      'v=0',
      'o=- 0 0 IN IP4 ' + localIp,
      's=Fake SIP',
      'c=IN IP4 ' + localIp,
      't=0 0',
      `m=audio ${rtpPort} RTP/AVP 0`,
      'a=rtpmap:0 PCMU/8000',
      '',
      ''
    ].join('\r\n');
  }
  
  module.exports = { buildSip200OKResponse };