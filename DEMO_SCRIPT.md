# Demo Script - Alastair

Quick guide for showing this thing off.

---

## Setup

```bash
# Start the server
python app.py

# In another terminal
npm run dev

# Open two browser tabs at http://localhost:5173
```

---

## The Flow

### Intro (30 sec)
"This is Alastair - a chat app where messages actually disappear after you read them."

### Get Codes (1 min)
1. Open the app in two windows
2. Click ENTER on both
3. You get random codes like "A1B2C3D4" and "E5F6G7H8"
4. Point out: no signup, no email, nothing

### Connect (1 min)
1. User A copies their code
2. User B pastes it into "Their Code" field
3. Click CONNECT
4. Both screens show "secure to [code]"

### Chat (2 min)
1. User A: type "Hello" and hit SEND
2. Message appears on both screens
3. Count down 5 seconds... watch it fade... gone.
4. User B replies: "Nice!"
5. Same thing - appears, fades, disappears

### Try Breaking It (1 min)
1. Hit PrintScreen - warning pops up
2. Spam messages - after 10 it blocks you
3. Wait 5 min - session dies automatically

### The Tech Bit (30 sec)
- Everything encrypted in the browser
- Server sees gibberish
- No database, everything in memory
- Messages delete after both people read them

---

## Things That Might Go Wrong

**Server won't start?**
```bash
curl http://localhost:5000/getcode
```

**Messages not showing?**
- Check browser console
- Make sure both connected to same session

**Encryption looks broken?**
- Codes need to be exact
- Both users need to have each other's codes

---

## Questions You'll Get

**"How's this different from Signal?"**
No accounts. No app to install. Just open and chat.

**"Can you stop screenshots?"**
Nope. We detect PrintScreen and warn, but can't actually prevent them.

**"Is it really secure?"**
Good enough for casual privacy. XOR encryption, not military-grade. Don't use for state secrets.

**"What if the server gets hacked?"**
All they get is encrypted blobs. No keys stored server-side.

---

## Closing Line

"That's it. A chat app that actually forgets your conversations. Because some things are better left unrecorded."
