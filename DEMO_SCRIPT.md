# Alastair - Live Demo Script

## Setup (Before Presentation)
```bash
# Terminal 1: Start server
python server.py

# Terminal 2: Start frontend
npm run dev

# Open two browser windows at http://localhost:5173
```

## Demo Flow

### 1. Introduction (30 seconds)
"Today I'm demonstrating Alastair - a secure messaging app where messages vanish after being read."

### 2. Anonymous Authentication (1 minute)
- **Show landing page**: "Messages that vanish"
- **Generate User A code**: Click ENTER → shows "A1B2C3D4"
- **Generate User B code**: Second window → shows "E5F6G7H8"
- **Point out**: No email, no registration, just random codes

### 3. Secure Connection (1 minute)
- **User A**: Copy code "A1B2C3D4"
- **User B**: Paste in "Their Code" field
- **User B**: Click CONNECT → shows "secure to A1B2C3D4"
- **Explain**: End-to-end encryption established with shared key

### 4. Message Exchange (2 minutes)
- **User A sends**: "Hello World"
- **Show**: Message appears immediately in User A's window
- **User B receives**: Message appears after 1-second poll
- **Demonstrate**: 5-second countdown and fade-out
- **User B replies**: "Got it!"
- **Show**: Bidirectional communication working

### 5. Security Features (1 minute)
- **Screenshot detection**: Press PrintScreen → warning appears
- **Rate limiting**: Try sending messages rapidly → error after 10/minute
- **Session timeout**: Wait 5 minutes → conversation expires

### 6. Privacy Demonstration (1 minute)
- **Show server logs**: Only encrypted messages visible
- **Restart server**: All conversations gone (in-memory only)
- **No accounts**: Completely anonymous, no personal data

### 7. Technical Highlights (30 seconds)
- **Frontend**: React + TypeScript for type safety
- **Backend**: Python Flask with security middleware
- **Encryption**: XOR cipher with shared keys
- **Architecture**: Real-time polling, ephemeral storage

## Key Demo Points to Emphasize

### Security
- "Server cannot read your messages - everything is encrypted"
- "No accounts means no personal data to protect"
- "Messages disappear forever, leaving no digital trail"

### Privacy
- "Anonymous 8-character codes instead of usernames"
- "No tracking, no cookies, no data mining"
- "Complete privacy by design"

### Technical Innovation
- "TypeScript ensures message structure integrity"
- "Real-time polling without WebSockets complexity"
- "Memory-only storage for true ephemerality"

## Troubleshooting Tips

### If server not responding:
```bash
# Check if server is running
curl http://localhost:5000/getcode
```

### If messages not appearing:
- Check browser console for errors
- Verify both users have same session ID
- Ensure no network blocking

### If encryption fails:
- Verify both user codes are entered correctly
- Check that shared key derivation is working

## Q&A Preparation

### Common Questions:
1. **How is this different from Signal?**
   - No accounts, completely ephemeral, web-based

2. **Can screenshots be prevented?**
   - We detect and warn, but cannot completely prevent

3. **Is the encryption strong enough?**
   - XOR is simple but effective for this use case
   - Could upgrade to AES if needed

4. **What about server compromise?**
   - Server only has encrypted data, no keys
   - Memory-only storage limits exposure

5. **Can this scale?**
   - Current design for private conversations
   - Could add Redis for distributed memory

## Closing Statement
"Alastair demonstrates that privacy and security don't have to be complicated. Sometimes the most secure messages are the ones that never existed at all."
