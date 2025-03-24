#!/usr/bin/env node

const AGI = require('asteriskagi');
const fs = require('fs');
const dgram = require('dgram');
const path = require('path');
const { spawn } = require('child_process');

// Function to log to file
function log(file, message) {
  fs.appendFileSync(file, `${new Date().toISOString()} - ${message}\n`);
}

// Initialize AGI connection
const agi = new AGI(process.stdin, process.stdout);
agi.on('ready', async () => {
  try {
    // Get channel variables
    const uniqueId = await agi.getVariable('UNIQUEID');
    const rtpPort = parseInt(await agi.getVariable('RTP_PORT'));
    
    // Setup logging
    const logFile = `/tmp/audio_processor_${uniqueId}.log`;
    log(logFile, `Starting audio processor for call ${uniqueId} on port ${rtpPort}`);
    
    // Setup sockets
    const sendSocket = dgram.createSocket('udp4');
    const receiveSocket = dgram.createSocket('udp4');
    
    // Audio file paths
    const callRecordingPath = `/tmp/call-${uniqueId}.wav`;
    log(logFile, `Will monitor recording at: ${callRecordingPath}`);
    
    // Monitor the recording file
    const monitorRecording = () => {
      if (!fs.existsSync(callRecordingPath)) {
        log(logFile, `Waiting for recording file to appear...`);
        setTimeout(monitorRecording, 500);
        return;
      }
      
      log(logFile, `Recording file found, starting audio processing`);
      
      // Start processing audio with sox
      try {
        const soxProcess = spawn('sox', [
          '-t', 'wav', callRecordingPath,
          '-t', 'raw', '-r', '8000', '-c', '1', '-e', 'mu-law', '-'
        ]);
        
        log(logFile, `Sox process started with PID: ${soxProcess.pid}`);
        
        soxProcess.stdout.on('data', (data) => {
          log(logFile, `Got ${data.length} bytes from sox, sending to middleware`);
          sendSocket.send(data, rtpPort, '127.0.0.1', (err) => {
            if (err) log(logFile, `Error sending to middleware: ${err.message}`);
          });
        });
      } catch (error) {
        log(logFile, `Error starting sox: ${error.message}`);
      }
    };
    
    // Start receiving audio from middleware
    receiveSocket.bind(rtpPort + 1, () => {
      log(logFile, `Receive socket bound to port ${rtpPort + 1}`);
      
      receiveSocket.on('message', async (msg, rinfo) => {
        log(logFile, `Received ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);
        
        // For demonstration, save the audio chunks
        fs.writeFileSync(`/tmp/vg_chunk_${uniqueId}_${Date.now()}.raw`, msg);
        
        // Attempt to play using Asterisk's STREAM FILE
        // Note: This would require converting the raw audio to a format Asterisk can play
        await agi.streamFile('beep', '#');
      });
    });
    
    // Begin monitoring after a brief delay
    setTimeout(monitorRecording, 1000);
    
    // Keep the AGI script alive
    await agi.execute('Wait', '3600');
  } catch (error) {
    log('/tmp/agi_error.log', `AGI error: ${error.message}`);
  }
});

agi.on('error', (err) => {
  fs.appendFileSync('/tmp/agi_error.log', `AGI connection error: ${err.message}\n`);
});