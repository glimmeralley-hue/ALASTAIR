import os
import json
import uuid
import time
import random
import string
from flask import Flask, request, jsonify
from flask_cors import CORS
import redis

app = Flask(__name__)

# CORS - allow Netlify frontend
CORS(app, origins=[
    "https://alastair-chat.netlify.app",
    "https://*.netlify.app",
    "http://localhost:*"
])

# Redis connection (Upstash)
redis_url = os.environ.get('REDIS_URL')
if redis_url:
    r = redis.from_url(redis_url, decode_responses=True)
else:
    # Fallback for local development
    r = redis.Redis(host='localhost', port=6379, decode_responses=True)

# TTL constants
SESSION_TTL = 300  # 5 minutes
MESSAGE_TTL = 5    # 5 seconds
RATE_LIMIT_WINDOW = 60
MAX_MESSAGES_PER_MINUTE = 10

def generate_code():
    """Generate random 8-character alphanumeric code"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

def get_client_ip():
    """Get client IP from request"""
    forwarded = request.headers.get('X-Forwarded-For')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.remote_addr or 'unknown'

def check_rate_limit(ip):
    """Check if IP has exceeded rate limit"""
    key = f"rate_limit:{ip}"
    now = time.time()
    
    # Get recent requests
    recent = r.zrangebyscore(key, now - RATE_LIMIT_WINDOW, now)
    
    if len(recent) >= MAX_MESSAGES_PER_MINUTE:
        return False
    
    # Add current request
    r.zadd(key, {str(now): now})
    r.expire(key, RATE_LIMIT_WINDOW)
    return True

@app.route('/getcode', methods=['POST'])
def get_code():
    """Generate and return a unique 8-character code"""
    code = generate_code()
    
    # Ensure uniqueness
    while r.exists(f"user:{code}"):
        code = generate_code()
    
    # Store user code with short TTL (refreshed on activity)
    r.setex(f"user:{code}", SESSION_TTL, json.dumps({
        'created': time.time()
    }))
    
    return jsonify({'code': code})

@app.route('/connect', methods=['POST'])
def connect():
    """Connect two users by their codes"""
    data = request.json or {}
    my_code = data.get('myCode', '').upper()
    their_code = data.get('theirCode', '').upper()
    
    # Validate input
    if not my_code or not their_code:
        return jsonify({'error': 'Both codes are required'}), 400
    
    if my_code == their_code:
        return jsonify({'error': "You can't connect to yourself"}), 400
    
    if len(my_code) != 8 or len(their_code) != 8:
        return jsonify({'error': 'Codes must be 8 characters'}), 400
    
    # Refresh my_code TTL if it exists, or create it
    r.setex(f"user:{my_code}", SESSION_TTL, json.dumps({
        'created': time.time()
    }))
    
    # Check if their_code exists
    if not r.exists(f"user:{their_code}"):
        return jsonify({'error': 'Code not found - ask them to refresh their page'}), 404
    
    # Look for existing session between these two codes
    session_pattern = f"session:{min(my_code, their_code)}:{max(my_code, their_code)}"
    existing_session = r.get(session_pattern)
    
    if existing_session:
        session_id = existing_session
        # Refresh session TTL
        r.expire(f"session_data:{session_id}", SESSION_TTL)
    else:
        # Create new session
        session_id = str(uuid.uuid4())
        
        # Store session mapping
        r.setex(session_pattern, SESSION_TTL, session_id)
        
        # Store session data
        r.setex(f"session_data:{session_id}", SESSION_TTL, json.dumps({
            'user1': my_code,
            'user2': their_code,
            'created': time.time()
        }))
    
    return jsonify({'sessionId': session_id, 'connected': True})

@app.route('/send', methods=['POST'])
def send_msg():
    """Send a message to a session"""
    ip = get_client_ip()
    
    # Check rate limit
    if not check_rate_limit(ip):
        return jsonify({'error': 'Rate limit exceeded - try again later'}), 429
    
    data = request.json or {}
    session_id = data.get('sessionId')
    
    if not session_id:
        return jsonify({'error': 'Session ID required'}), 400
    
    # Check session exists
    session_key = f"session_data:{session_id}"
    if not r.exists(session_key):
        return jsonify({'error': 'Session not found or expired'}), 404
    
    # Refresh session TTL
    r.expire(session_key, SESSION_TTL)
    
    # Create message
    msg_id = data.get('id') or str(uuid.uuid4())
    msg = {
        'id': msg_id,
        'sender': data.get('sender'),
        'text': data.get('text', ''),
        'type': data.get('type', 'text'),
        'encrypted': data.get('encrypted', False),
        'time': time.time(),
        'read_by': []
    }
    
    # Add to session's message queue with short TTL
    message_key = f"messages:{session_id}"
    r.lpush(message_key, json.dumps(msg))
    r.expire(message_key, max(MESSAGE_TTL, SESSION_TTL))  # Keep at least as long as session
    
    return jsonify({'id': msg['id']})

@app.route('/messages/<session_id>', methods=['GET'])
def get_messages(session_id):
    """Get and consume messages for a session (destructive read)"""
    user_code = request.args.get('user', '').upper()
    
    if not user_code:
        return jsonify({'error': 'User parameter required'}), 400
    
    # Check session exists
    session_key = f"session_data:{session_id}"
    if not r.exists(session_key):
        return jsonify({'error': 'Session expired'}), 404
    
    # Refresh session TTL on activity
    r.expire(session_key, SESSION_TTL)
    
    message_key = f"messages:{session_id}"
    
    # Get all messages (destructive read - they will be deleted)
    messages_raw = r.lrange(message_key, 0, -1)
    messages = [json.loads(m) for m in messages_raw]
    
    # Filter to only unread messages for this user
    unread = []
    for msg in messages:
        if user_code not in msg.get('read_by', []):
            msg['read_by'].append(user_code)
            unread.append(msg)
    
    # Keep only messages not read by both users (for 5-second display)
    remaining = [m for m in messages if len(m.get('read_by', [])) < 2]
    
    # Clear and re-add remaining messages with fresh TTL
    r.delete(message_key)
    if remaining:
        for msg in remaining:
            r.lpush(message_key, json.dumps(msg))
        r.expire(message_key, max(MESSAGE_TTL, SESSION_TTL))
    
    return jsonify(unread)

# Netlify Function handler
from serverless_wsgi import handle

def handler(event, context):
    return handle(app, event, context)
