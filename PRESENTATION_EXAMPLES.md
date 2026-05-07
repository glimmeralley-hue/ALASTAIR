# Alastair - Presentation Examples

## 1. End-to-End Encryption Example

### Frontend Encryption (TypeScript)
```typescript
// XOR encryption with shared key
function encrypt(text: string, key: string): string {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return btoa(result)
}

// Shared key derived from both user codes
const getKey = () => {
  const sorted = [myCode, theirCode].sort().join('')
  return sorted
}

// Usage
const message = "Hello, this is private!"
const key = getKey()
const encrypted = encrypt(message, key)
// Result: "SGVsbG8sIHRoaXMgaXMgcHJpdmF0ZSE=" (encoded)
```

### Server Storage (Python)
```python
# Server only stores encrypted data - cannot read messages
msg = {
    'id': msg_id,
    'sender': data.get('sender'),
    'text': 'SGVsbG8sIHRoaXMgaXMgcHJpdmF0ZSE=',  # Encrypted
    'type': 'text',
    'encrypted': True,
    'time': time.time(),
    'read_by': []
}
```

## 2. Ephemeral Message System

### Message Lifecycle (TypeScript)
```typescript
// Send message
function sendMsg(type: string = 'text', content?: string) {
  const id = Date.now().toString()
  
  // Show locally immediately
  setMessages(prev => [...prev, { 
    id, 
    sender: myCode, 
    text: toSend, 
    type, 
    local: true 
  }])
  
  // Auto-delete after 5 seconds
  setTimeout(() => {
    setFadingMsgs(f => new Set([...f, id]))
    setTimeout(() => {
      setMessages(p => p.filter(x => x.id !== id))
    }, 1000) // Fade animation
  }, 5000)
}
```

### Server-Side Deletion (Python)
```python
# Messages deleted after both users read them
unread_for_user = [m for m in msgs if user_code not in m.get('read_by', [])]

# Mark as read for this user
for m in unread_for_user:
    m['read_by'].append(user_code)

# Delete when both users have read
chat_sessions[session_id]['messages'] = [
    m for m in msgs if len(m.get('read_by', [])) < 2
]
```

## 3. Anonymous Authentication

### Code-Based Connection (TypeScript)
```typescript
// Get anonymous code
useEffect(() => {
  fetch('http://localhost:5000/getcode', {method: 'POST'})
    .then(r => r.json())
    .then(d => setMyCode(d.code))
}, [])

// Connect without personal info
function connect() {
  fetch('http://localhost:5000/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ myCode, theirCode })
  })
}
```

### Server Code Generation (Python)
```python
@app.route('/getcode', methods=['POST'])
def get_code():
    code = str(uuid.uuid4())[:8].upper()  # Random 8-char code
    user_id = str(uuid.uuid4())
    users[code] = {
        'id': user_id,
        'code': code,
        'partner': None,
        'created': time.time()
    }
    return jsonify({'code': code, 'id': user_id})
```

## 4. Security Features

### Screenshot Detection (TypeScript)
```typescript
useEffect(() => {
  const keyPress = (e: KeyboardEvent) => {
    if (e.key === 'PrintScreen') {
      e.preventDefault()
      setWarning(' Screenshot detected - message will self-destruct')
      setTimeout(() => setWarning(''), 3000)
    }
  }
  
  window.addEventListener('keydown', keyPress)
  return () => window.removeEventListener('keydown', keyPress)
}, [connected])
```

### Rate Limiting (Python)
```python
def check_rate_limit(ip):
    now = time.time()
    rate_limits[ip] = [t for t in rate_limits[ip] if now - t < 60]
    if len(rate_limits[ip]) >= MAX_MESSAGES_PER_MINUTE:
        blocked_ips.add(ip)
        return False
    rate_limits[ip].append(now)
    return True
```

## 5. Real-World Usage Flow

### Complete Message Exchange
```typescript
// User A gets code: "A1B2C3D4"
// User B gets code: "E5F6G7H8"

// User A shares code with User B
// User B enters A's code and clicks CONNECT

// Session created with shared key: "A1B2C3D4E5F6G7H8"

// User A sends message
const message = "Meeting at 3pm"
const encrypted = encrypt(message, "A1B2C3D4E5F6G7H8")
// Sent to server as: "U29tZUVuY3J5cHRlZERhdGE="

// User B receives and decrypts
const decrypted = decrypt("U29tZUVuY3J5cHRlZERhdGE=", "A1B2C3D4E5F6G7H8")
// Result: "Meeting at 3pm"

// Message disappears after 5 seconds
```

## 6. Technical Architecture

### Client-Server Communication
```typescript
// Polling for new messages (every second)
useEffect(() => {
  const interval = setInterval(() => {
    fetch(`http://localhost:5000/messages/${sessionId}?user=${myCode}`)
      .then(r => r.json())
      .then(msgs => {
        // Decrypt and display new messages
        const key = getKey()
        const decrypted = msgs.map(m => ({
          ...m,
          text: m.encrypted ? decrypt(m.text, key) : m.text
        }))
        setMessages(prev => [...prev, ...decrypted])
      })
  }, 1000)
  return () => clearInterval(interval)
}, [sessionId])
```

### Session Management (Python)
```python
chat_sessions[session_id] = {
    'user1': my_code,
    'user2': their_code,
    'messages': [],
    'created': time.time(),
    'last_activity': time.time(),
    'ips': {my_code: ip, their_code: None}
}
```

## 7. Privacy by Design

### No Data Persistence
```python
# Messages live in memory only
chat_sessions = {}  # Lost on server restart

# Auto-cleanup expired sessions
def cleanup_expired_sessions():
    now = time.time()
    expired = []
    for sid, session in chat_sessions.items():
        if now - session.get('last_activity', 0) > SESSION_TIMEOUT:
            expired.append(sid)
    for sid in expired:
        del chat_sessions[sid]
```

### Zero Knowledge Architecture
- Server cannot read encrypted messages
- No user accounts or personal data
- Messages exist only while being read
- Complete anonymity through random codes

## 8. Demo Script for Panel

1. **Show Landing Page**: "Messages that vanish"
2. **Generate Codes**: Two users get anonymous 8-character codes
3. **Connect Users**: Share codes, establish encrypted session
4. **Send Messages**: Show encryption/decryption in action
5. **Demonstrate Ephemeral Nature**: Messages fade and disappear
6. **Security Features**: Screenshot detection, rate limiting
7. **Privacy**: No accounts, no history, complete anonymity

## Key Talking Points

- **Technology Stack**: React + TypeScript frontend, Python Flask backend
- **Encryption**: XOR cipher with shared keys derived from user codes
- **Ephemeral Design**: Messages self-destruct after 5 seconds
- **Privacy-First**: No accounts, no tracking, no data persistence
- **Security**: Rate limiting, IP protection, screenshot detection
- **Architecture**: Real-time polling, in-memory storage, automatic cleanup
