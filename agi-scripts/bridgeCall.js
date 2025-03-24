#!/usr/bin/env node

const axios = require('axios');

const caller = process.argv[2];
const called = process.argv[3];
const callSid = `CALL_${Date.now()}`;

console.log('🟡 Sending request to middleware...');
console.log({ caller, called, callSid });

(async () => {
  try {
    // Call the middleware to initiate the call
    const res = await axios.post('http://127.0.0.1:3000/api/calls', {
      caller,
      called,
      callSid
    });

    console.log('✅ Got response from middleware: ', JSON.stringify(res.data, null, 2));
    
    // Set variables for Asterisk to use
    const socketURL = res.data.data.socketURL;
    const rtpPort = res.data.data.rtpPort;
    
    console.log(`Setting SOCKET_URL=${socketURL}`);
    process.stdout.write(`SET VARIABLE SOCKET_URL "${socketURL}"\n\n`);
    
    console.log(`Setting RTP_PORT=${rtpPort}`);
    process.stdout.write(`SET VARIABLE RTP_PORT "${rtpPort}"\n\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Middleware error:', error.message);
    
    // Set empty values in case of error
    process.stdout.write(`SET VARIABLE SOCKET_URL ""\n\n`);
    process.stdout.write(`SET VARIABLE RTP_PORT "40000"\n\n`); // Default port
    
    process.exit(0); // Don't break the dialplan
  }
})();