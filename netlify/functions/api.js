const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const SESSION_TTL = 300;
const MESSAGE_TTL = 5;

exports.handler = async (event, context) => {
  const path = event.path.replace('/.netlify/functions/api', '').replace('/api', '') || '/';
  const method = event.httpMethod;

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // POST /getcode
    if (path === '/getcode' && method === 'POST') {
      const code = generateCode();
      await redis.setex(`user:${code}`, SESSION_TTL, JSON.stringify({ created: Date.now() }));
      return { statusCode: 200, headers, body: JSON.stringify({ code }) };
    }

    // POST /connect
    if (path === '/connect' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { myCode, theirCode } = body;
      
      if (!myCode || !theirCode) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Both codes required' }) };
      }

      // Check for existing session between these two users
      const sessionKey = `session:${[myCode, theirCode].sort().join(':')}`;
      let sessionId = await redis.get(sessionKey);
      
      if (!sessionId) {
        // Create new session
        sessionId = generateUUID();
        await redis.setex(sessionKey, SESSION_TTL, sessionId);
        await redis.setex(`session:${sessionId}`, SESSION_TTL, JSON.stringify({ 
          user1: myCode, user2: theirCode, created: Date.now() 
        }));
      } else {
        // Refresh session TTL
        await redis.expire(sessionKey, SESSION_TTL);
        await redis.expire(`session:${sessionId}`, SESSION_TTL);
      }

      return { statusCode: 200, headers, body: JSON.stringify({ sessionId, connected: true }) };
    }

    // POST /send
    if (path === '/send' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { sessionId, id, sender, text, type, encrypted } = body;

      const msg = {
        id: id || generateUUID(),
        sender,
        text,
        type: type || 'text',
        encrypted: encrypted || false,
        time: Date.now(),
        read_by: []
      };

      await redis.lpush(`messages:${sessionId}`, JSON.stringify(msg));
      await redis.expire(`messages:${sessionId}`, SESSION_TTL);

      return { statusCode: 200, headers, body: JSON.stringify({ id: msg.id }) };
    }

    // GET /messages/<sessionId>
    if (path.match(/^\/messages\/[^/]+$/) && method === 'GET') {
      const sessionId = path.split('/')[2];
      const userCode = event.queryStringParameters?.user;

      if (!userCode) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'User required' }) };
      }

      const messagesRaw = await redis.lrange(`messages:${sessionId}`, 0, -1);
      const messages = messagesRaw.map(m => typeof m === 'string' ? JSON.parse(m) : m);

      const unread = messages.filter(m => !m.read_by.includes(userCode));
      unread.forEach(m => m.read_by.push(userCode));

      const remaining = messages.filter(m => m.read_by.length < 2);
      
      await redis.del(`messages:${sessionId}`);
      if (remaining.length > 0) {
        await redis.lpush(`messages:${sessionId}`, ...remaining.map(m => JSON.stringify(m)));
        await redis.expire(`messages:${sessionId}`, SESSION_TTL);
      }

      return { statusCode: 200, headers, body: JSON.stringify(unread) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };

  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array(8).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36);
}
