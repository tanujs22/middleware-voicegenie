# /opt/middleware-voicegenie/audio_bridge.sh
#!/bin/bash

CALL_ID=$1
RTP_PORT=$2
LOG_FILE="/tmp/audio_bridge_${CALL_ID}.log"

echo "Starting audio bridge for call $CALL_ID on port $RTP_PORT" > $LOG_FILE
date >> $LOG_FILE

# Create named pipes for audio exchange
PIPE_IN="/tmp/call_in_${CALL_ID}"
PIPE_OUT="/tmp/call_out_${CALL_ID}"

mkfifo $PIPE_IN $PIPE_OUT

# Monitor the call recording file and stream to middleware
mkfifo /tmp/call_audio_${CALL_ID}
sox -t wav /tmp/call-${CALL_ID}.wav -t raw -r 8000 -c 1 -e mu-law - > /tmp/call_audio_${CALL_ID} &

# Send audio to middleware
cat /tmp/call_audio_${CALL_ID} | nc -u 127.0.0.1 $RTP_PORT > $LOG_FILE 2>&1 &
SEND_PID=$!

# Receive audio from middleware
nc -u -l 127.0.0.1 $((RTP_PORT+1)) | play -t raw -r 8000 -c 1 -e mu-law - > $LOG_FILE 2>&1 &
RECV_PID=$!

echo "Bridge established. PIDs: $SEND_PID, $RECV_PID" >> $LOG_FILE

# Keep running until call ends
while kill -0 $SEND_PID 2>/dev/null && kill -0 $RECV_PID 2>/dev/null; do
  sleep 1
done

# Cleanup
rm -f $PIPE_IN $PIPE_OUT /tmp/call_audio_${CALL_ID}
echo "Audio bridge terminated" >> $LOG_FILE