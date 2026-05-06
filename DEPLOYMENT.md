# Alastair Deployment Guide

## Overview
Frontend and backend are both deployed to Netlify. The backend uses Netlify Functions with Upstash Redis for stateless message storage.

## Files Created

### Backend (Netlify Functions)
- `netlify/functions/api.py` - Flask app with Redis-backed endpoints
- `netlify/functions/requirements.txt` - Python dependencies

### Configuration
- `netlify.toml` - Build and Functions configuration

## Prerequisites

1. **Netlify Account**: Sign up at https://netlify.com
2. **Upstash Redis**: Create a free Redis database at https://upstash.com

## Deployment Steps

### 1. Set Up Upstash Redis

1. Go to https://upstash.com and create an account
2. Create a new Redis database
3. Copy the `REDIS_URL` (format: `rediss://default:password@host:port`)

### 2. Deploy to Netlify

**Option A: Git-based Deploy**
1. Push this repo to GitHub
2. Connect repo in Netlify dashboard
3. Build settings will auto-detect from `netlify.toml`

**Option B: Manual Deploy**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

### 3. Configure Environment Variables

In Netlify dashboard → Site Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `REDIS_URL` | Your Upstash Redis URL |

### 4. Update Frontend (if needed)

The `netlify.toml` already sets `VITE_API_URL` to your Netlify Functions URL. If you change the site name, update this value.

## API Endpoints

All endpoints are prefixed with `/.netlify/functions/api`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/getcode` | POST | Generate 8-char connection code |
| `/connect` | POST | Connect two users by codes |
| `/send` | POST | Send encrypted message |
| `/messages/<sessionId>` | GET | Get & delete messages |

## TTL Behavior

- **Sessions**: 5 minutes TTL (refreshed on activity)
- **Messages**: 5 seconds in queue, deleted after both users read
- **Rate Limits**: 10 messages/minute per IP

## Testing Locally

```bash
# Terminal 1: Redis (if local)
redis-server

# Terminal 2: Netlify Dev
netlify dev
```

The app will be available at `http://localhost:8888`
