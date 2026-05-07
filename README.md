# Alastair

**Messages that vanish.**

A dead-simple private chat app. No signups, no logs, no traces. Just two people talking and then forgetting.

Live at: **https://alastair-sable.vercel.app**

---

## What This Is

I built this because I wanted a way to talk to people without leaving a paper trail. No phone number to give away. No "let me add you on..." Just open a browser, grab a code, and start talking.

Messages disappear 5 seconds after your friend reads them. That's it. No history. No screenshots (well, we try to warn you). No data sitting on some server forever.

---

## How It Works

1. **Open the app** - you get a random 8-character code
2. **Share your code** with someone - text it, say it, write it on paper
3. **They enter your code** and hit connect
4. **Chat** - type, send images, whatever
5. **Watch it vanish** - messages fade away after being read

---

## Running It Yourself

### Local Dev
```bash
# Start the backend
python app.py

# In another terminal
npm install
npm run dev
```

### Deploy Your Own

**Frontend (Vercel):**
- Push this repo to GitHub
- Import to Vercel
- Set env vars: `VITE_API_URL` = your backend URL

**Backend (Render):**
- Uses `render.yaml` - deploys automatically
- Set env vars: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

---

## The Stack

- **Frontend**: React + TypeScript, Vite for building
- **Backend**: Python + Flask
- **Storage**: Upstash Redis (messages expire automatically)
- **Encryption**: XOR cipher (simple but works for this use case)

---

## Features

| Feature | Details |
|---------|---------|
| **No accounts** | Random codes, no personal info |
| **Self-destruct** | 5 seconds after being read |
| **E2E encryption** | Server can't read your messages |
| **Images** | Compressed before sending |
| **Screenshots** | We detect PrintScreen and warn |
| **Rate limits** | 10 messages/min to prevent spam |

---

## Privacy Notes

- Messages live in Redis with TTL (auto-delete after 5 min inactivity)
- Server only sees encrypted blobs
- No cookies, no analytics, no tracking
- We literally can't tell who you are

---

## Limitations

- **XOR encryption** - Not bulletproof. Good enough for casual privacy, but don't use this for state secrets
- **Screenshots** - We can detect the PrintScreen key but can't actually stop someone from screenshotting
- **Server trust** - You have to trust the server isn't logging (though the code is open, so you can check)

---

## Why I Built This

Tired of every app wanting my phone number. Tired of conversations living forever in some database. Sometimes you just want to say something and have it disappear.

That's it. No grand mission. Just a tool for private moments.

---

Built with too much coffee and a healthy distrust of permanent records.
