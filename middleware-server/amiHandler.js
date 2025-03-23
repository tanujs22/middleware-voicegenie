// middleware-server/amiHandler.js
const AmiClient = require('asterisk-ami-client');

const AMI_CONFIG = {
  username: process.env.AMI_USERNAME,
  password: process.env.AMI_PASSWORD,
  host: process.env.AMI_HOST,
  port: process.env.AMI_PORT,
};

const ami = new AmiClient({ reconnect: true });

ami.connect(AMI_CONFIG.username, AMI_CONFIG.password, { host: AMI_CONFIG.host, port: AMI_CONFIG.port })
  .then(() => console.log('Connected to Asterisk AMI!'))
  .catch(err => console.error('AMI Connection Error:', err));

// Stop audio playback
async function stopAudioPlayback(callChannel) {
  return ami.action({
    Action: 'StopPlayTones',
    Channel: callChannel
  });
}

// Start call recording
async function startCallRecording(callChannel, recordingFileName) {
  return ami.action({
    Action: 'Monitor',
    Channel: callChannel,
    File: recordingFileName,
    Format: 'wav',
    Mix: true
  });
}

// Stop call recording
async function stopCallRecording(callChannel) {
  return ami.action({
    Action: 'StopMonitor',
    Channel: callChannel
  });
}

// Hangup call
async function endCall(callChannel) {
  return ami.action({
    Action: 'Hangup',
    Channel: callChannel
  });
}

// Warm transfer call
async function warmTransfer(callChannel, agentExtension) {
  return ami.action({
    Action: 'Redirect',
    Channel: callChannel,
    Exten: agentExtension,
    Context: 'default',
    Priority: 1
  });
}

// Originate Outbound Call via AMI
async function originateCall(fromNumber, toNumber, callId) {
    return ami.action({
      Action: 'Originate',
      Channel: `SIP/${fromNumber}`,
      Exten: toNumber,
      Context: 'default', // ensure context is correct
      Priority: 1,
      CallerID: fromNumber,
      Async: true,
      Variable: {
        CALL_ID: callId
      }
    });
  }

module.exports = {
  stopAudioPlayback,
  startCallRecording,
  stopCallRecording,
  endCall,
  warmTransfer,
  originateCall
};