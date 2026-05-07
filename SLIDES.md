# Alastair - Presentation Slides

## Slide 1: Title
**Alastair: Messages That Vanish**

A dead-simple private chat with zero paper trail.

---

## Slide 2: The Problem
**Every chat app wants something from you:**
- Phone number
- Email
- Account registration
- Data stored forever

**Result:** Every conversation becomes permanent record.

---

## Slide 3: What Is Alastair?
- No signups
- No downloads
- Open browser → get code → start chatting
- Messages disappear 5-10 seconds after reading
- That's it.

---

## Slide 4: Live Demo (2 min)
1. **Two browsers open** → Both click ENTER
2. **Codes appear** → A1B2C3D4 and E5F6G7H8
3. **Connect** → Type code, hit CONNECT
4. **Chat** → Send "Hello", watch it fade away
5. **Image** → Send photo, 10 seconds then gone

---

## Slide 5: How It Works (The Tech)

**Key Exchange (Zero-Knowledge):**
```
User A: "A1B2C3D4"      User B: "E5F6G7H8"
         ↓                      ↓
    Combined key: "A1B2C3D4E5F6G7H8"
         ↑                      ↑
Both derive same key from each other's codes
```
- No key server, no certificate authority
- If either user disconnects, key is lost forever

**Encryption (XOR Cipher):**
```
Message: "Meet at 3pm"
Key:     "A1B2C3D4E5F6G7H8"
         ↓
Result:  "U29tZUVuY3J5cHRlZERhdGE=" ← Server sees this
```
- 50+ year old technique, fast, no dependencies
- Good enough for casual privacy (not state secrets)
- Server literally cannot read your messages

**Message Lifecycle:**
1. **Sent** → Stored in Redis, encrypted
2. **Delivered** → Recipient gets it, marked as "read"
3. **Pending deletion** → Waits for other user to read
4. **Both read** → Permanently deleted from Redis
5. **Timeout** → Auto-delete after 5 min inactivity

**Result:** Message exists only while being read, then gone.

---

## Slide 6: Technical Stack (Why These Choices)

**Frontend: React + TypeScript + Vite**
- TypeScript catches bugs at compile time (critical for crypto code)
- Vite builds in milliseconds (fast dev cycle)
- Single HTML file output = easy to deploy anywhere

**Backend: Python + Flask**
- Lightweight, no bloat (perfect for simple API)
- Flask-CORS handles cross-origin in one line
- Flask-Compress adds gzip with zero config

**Storage: Upstash Redis**
- Auto-expiring keys (TTL = perfect for ephemeral messages)
- Survives Render free tier spin-down (unlike in-memory)
- REST API = no Redis client dependencies

**Why HTTP Polling Over WebSockets:**
| Polling | WebSockets |
|---------|------------|
| Works through firewalls | Often blocked by proxies |
| No connection state | Complex reconnection logic |
| 500ms = "instant enough" | Overkill for 2-person chat |
| Free tier friendly | Needs persistent connections |

**Deployment:**
- **Vercel** (frontend) - Auto-deploy from GitHub, global CDN
- **Render** (backend) - Free tier, sleep after 15min (Redis saves state)

**Result:** Entire stack costs $0/month to run.

---

## Slide 7: Why Not WebSockets?
**Polling wins because:**
- Works through corporate firewalls
- No connection state to manage
- Free tier friendly
- 500ms = "instant enough" for 2 people

---

## Slide 8: Security Features
- Screenshot detection (PrintScreen warning)
- Rate limiting (10 msg/min)
- IP-based spam protection
- Session timeout (5 min inactivity)

---

## Slide 9: Limitations (We're Honest)
- XOR encryption ≠ military grade
- Screenshots can still happen (we just warn)
- Server could theoretically log (but code is open)
- Not for state secrets

---

## Slide 10: Use Cases
- **Private convos** without app install
- **Sensitive info** sharing
- **Digital dead drops**
- **Anything you want forgotten**

---

## Slide 11: The Philosophy
> "Some conversations are better left unrecorded."

Privacy shouldn't require:
- Downloading apps
- Creating accounts
- Trusting companies

Sometimes you just need to talk and forget.

---

## Slide 12: Questions?

**Live:** https://alastair-sable.vercel.app

**Code:** github.com/glimmeralley-hue/ALASTAIR

