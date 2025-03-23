#!/usr/bin/env node

const axios = require('axios');

const caller = process.argv[2];
const called = process.argv[3];
const callSid = `CALL_${Date.now()}`;

console.log('🟡 Sending request to middleware...');
console.log({ caller, called, callSid });

(async () => {
  try {
    const res = await axios.post('http://localhost:3000/api/calls', {
      caller,
      called,
      callSid
    });

    console.log('✅ Got response from middleware');
    process.stdout.write(`SET VARIABLE SOCKET_URL "${res.data.data.socketURL}"\n\n`);
    process.exit(0);
  }  catch (error) {
    console.error('❌ Middleware error:', error.message);
    process.stdout.write(`SET VARIABLE SOCKET_URL ""\n\n`);
    process.exit(0); // ✅ Don't break the dialplan
  }
})();