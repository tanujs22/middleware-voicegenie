const axios = require('axios');

// Call Status Callback webhook
async function sendStatusCallback(statusCallbackUrl, callSid, status) {
  try {
    await axios.post(statusCallbackUrl, {
      CallSid: callSid,
      CallStatus: status
    },
    {
      headers: {
        'User-Agent': 'vicidial',
        'Content-Type': 'application/json'
      }
    });
    console.log(`Call status '${status}' sent successfully.`);
  } catch (err) {
    console.log(err)
    console.error('Error sending call status:', err.message);
  }
}

// Hangup Callback webhook
async function sendHangupCallback(hangupUrl, payload) {
  try {
    await axios.post(hangupUrl, payload,{
      headers: {
        'User-Agent': 'vicidial',
        'Content-Type': 'application/json'
      }
    });
    console.log('Hangup event sent successfully.');
  } catch (err) {
    console.log(err)
    console.error('Error sending hangup event:', err.message);
  }
}

module.exports = { sendStatusCallback, sendHangupCallback };