#!/usr/bin/env node

const axios = require('axios');
const caller = process.argv[2];
const called = process.argv[3];
const callSid = `CALL_${Date.now()}`;

(async () => {
  try {
    const res = await axios.post('http://localhost:3000/api/calls', {
      caller,
      called,
      callSid
    });
    console.log(`SET VARIABLE SOCKET_URL "${res.data.socketURL}"`);
    process.exit(0);
  } catch (error) {
    console.error('VERBOSE', `"Error: ${error.message}"`, 1);
    process.exit(1);
  }
})();