# Alastair - Code Examples for Presentations

Some code snippets you can reference when showing this off.

---

## How The Encryption Works

### Frontend (TypeScript)
```typescript
function encrypt(text: string, key: string): string {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return btoa(result)
}

// Key comes from both users' codes combined
const getKey = () => [myCode, theirCode].sort().join('')
```

Simple XOR cipher. Not military-grade but keeps casual snoops out. The server sees gibberish like `SGVsbG8sIHRoaXMgaXMgcHJpdmF0ZSE=` instead of your actual message.

---

## Messages That Vanish

### Frontend
```typescript
function sendMsg(type: string = 'text', content?: string) {
  const id = Date.now().toString()
  
  // Show message right away
  setMessages(prev => [...prev, { id, sender: myCode, text: toSend, type }])
  
  // Start the countdown
  setTimeout(() => {
    setFadingMsgs(f => new Set([...f, id]))  // Start fade
    setTimeout(() => {
      setMessages(p => p.filter(x => x.id !== id))  // Gone
    }, 1000)
  }, 5000)
}
```

### Backend
```python
# Messages stick around until BOTH people read them
unread_for_user = [m for m in msgs if user_code not in m.get('read_by', [])]

# Mark as read
for m in unread_for_user:
    m['read_by'].append(user_code)

# Delete once both have seen it
chat_sessions[session_id]['messages'] = [
    m for m in msgs if len(m.get('read_by', [])) < 2
]
```

---

## Anonymous By Design

No signup. No email. Just random codes.

```typescript
// Get a random 8-char code on load
useEffect(() => {
  fetch(`${API_URL}/getcode`, {method: 'POST'})
    .then(r => r.json())
    .then(d => setMyCode(d.code))  // "A1B2C3D4"
}, [])
```

```python
@app.route('/getcode', methods=['POST'])
def get_code():
    code = str(uuid.uuid4())[:8].upper()
    redis_set(f"user:{code}", {
        'code': code,
        'partner': None,
        'created': time.time()
    }, ex=3600)
    return jsonify({'code': code})
```

---

## Security Bits

### Screenshot Detection
```typescript
window.addEventListener('keydown', (e) => {
  if (e.key === 'PrintScreen') {
    setWarning('Screenshot detected - message self-destructs')
  }
})
```

Can't stop screenshots, but we can at least warn everyone.

### Rate Limiting
```python
def check_rate_limit(ip):
    now = time.time()
    # Keep only last 60 seconds
    rate_limits[ip] = [t for t in rate_limits[ip] if now - t < 60]
    if len(rate_limits[ip]) >= 10:  # 10 per minute max
        blocked_ips.add(ip)
        return False
    rate_limits[ip].append(now)
    return True
```

Prevents someone from spamming the hell out of the server.

---

## Real Flow Example

```typescript
// User A: "A1B2C3D4"
// User B: "E5F6G7H8"
// Combined key: "A1B2C3D4E5F6G7H8"

const message = "Meeting at 3pm"
const encrypted = encrypt(message, "A1B2C3D4E5F6G7H8")
// Server sees: "U29tZUVuY3J5cHRlZERhdGE="

// User B decrypts
const decrypted = decrypt("U29tZUVuY3J5cHRlZERhdGE=", "A1B2C3D4E5F6G7H8")
// Gets: "Meeting at 3pm"
```

---

## The Stack

- **React + TypeScript** - Frontend
- **Python + Flask** - Backend  
- **Upstash Redis** - Temporary storage with auto-expire
- **XOR encryption** - Simple, fast, good enough

---

## Why No WebSockets?

Polling every 500ms is simpler, works everywhere (even behind weird corporate firewalls), and for this use case it's fast enough. WebSockets add complexity we don't need.

---

That's pretty much it. A simple tool for private conversations that actually disappear.
