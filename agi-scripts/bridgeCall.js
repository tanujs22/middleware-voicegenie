#!/usr/bin/env node
const axios = require('axios');

const caller = process.argv[2];
const called = process.argv[3];
const callSid = `CALL_${Date.now()}`;

(async () => {
  try {
    // Make call to middleware
    const res = await axios.post('http://127.0.0.1:3000/api/calls', {
      caller,
      called,
      callSid
    });

    // Get socket URL from original response structure
    process.stdout.write(`SET VARIABLE SOCKET_URL "${res.data.data.socketURL}"\n\n`);

    // Make a separate call to get the RTP port for this call
    const portRes = await axios.get(`http://127.0.0.1:3000/api/call-port/${callSid}`);
    process.stdout.write(`SET VARIABLE RTP_PORT "${portRes.data.rtpPort}"\n\n`);

    process.exit(0);
  } catch (error) {
    console.error('Middleware error:', error.message);
    process.stdout.write(`SET VARIABLE SOCKET_URL ""\n\n`);
    process.stdout.write(`SET VARIABLE RTP_PORT "40000"\n\n`); // Fallback port
    process.exit(0); // Don't break the dialplan
  }
})();