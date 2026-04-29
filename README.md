# Alastair

**Messages that vanish.**

Alastair is a secure messaging app where messages disappear after they're read. No accounts, no history, no traces - just private conversations.

---

## Features

### End-to-End Encryption
- Your messages are scrambled with a secret key
- Only you and the person you're chatting with can read them
- Not even the server can see what you're saying

### Self-Destructing Messages
- Messages disappear 5 seconds after being read
- Fade-out animation before they vanish
- No message history stored anywhere

### Anonymous
- No email, no phone number, no registration
- Just share a simple 8-character code
- Each conversation gets a fresh, unique code

### Privacy Features
- Screenshot detection warns you if someone tries to capture
- Messages auto-delete after 5 minutes of inactivity
- Server can't read your encrypted messages

---

## How to Use

### Start the App
```bash
# Start the server
python server.py

# In another terminal, start the app
npm run dev
```

### Get Your Code
- Open the app and you'll see your 8-character code
- Something like: `A1B2C3D4`

### Share & Connect
- **Share your code** with the person you want to chat with
- **Enter their code** in the "Their Code" field
- Click **CONNECT**

### Chat
- Type your message and hit SEND
- Watch it appear, then fade away after 5 seconds
- Share images too (up to 2MB)

---

## Technical Details

### Frontend
- Built with React and TypeScript
- Dark interface with smooth animations
- Works in any modern web browser

### Backend
- Python Flask server
- Messages live in memory only (no database)
- Automatic cleanup of old conversations

### Security
- XOR encryption with shared keys
- Rate limiting (10 messages per minute)
- IP-based protection against abuse

---

## Features Overview

| Feature | What It Does | Why It Matters |
|---------|--------------|----------------|
| **8-Character Codes** | Simple way to connect | No personal info needed |
| **5-Second Messages** | Auto-delete after reading | No conversation history |
| **End-to-End Encryption** | Scrambles your messages | Only intended recipient can read |
| **Image Sharing** | Send photos securely | Same encryption as text |
| **Screenshot Warnings** | Alerts if someone tries to save | Extra privacy protection |
| **No Registration** | Just open and use | Zero personal data collection |

---

## Privacy

- **No accounts created** - you're completely anonymous
- **No message storage** - conversations vanish forever
- **No tracking** - we don't know who you are
- **No data mining** - nothing to mine, nothing to sell

---

## Use Cases

Alastair is designed for:
- **Private conversations**
- **Sensitive information sharing**
- **Digital dead drops**
- **When you need to say something without leaving a trace**

Think of it as passing notes - once read, they disappear forever.

---

## Important Notes

- **Messages truly disappear** - once gone, they're gone forever
- **No recovery option** - by design for privacy
- **5-minute timeout** - conversations end if inactive
- **Browser-based** - nothing installs on your device

---

## Security Best Practices

- Share codes through secure channels (in person, secure messenger)
- Don't reuse codes for different conversations
- Be aware that screenshots can still be taken (we just warn you)
- Remember: once messages vanish, they're truly gone

---

**Alastair** - Because some conversations are better left unrecorded.
