from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_compress import Compress
import uuid
import time
import os
import json
import requests
from collections import defaultdict

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024  # 10MB max request size
CORS(app)
Compress(app)  # Enable gzip compression

# In-memory storage (primary - works without Redis)
users = {}
chat_sessions = {}
rate_limits = defaultdict(list)
ip_sessions = defaultdict(set)
blocked_ips = set()

# Upstash Redis REST API (optional - for persistence across restarts)
UPSTASH_REDIS_REST_URL = os.environ.get('UPSTASH_REDIS_REST_URL')
UPSTASH_REDIS_REST_TOKEN = os.environ.get('UPSTASH_REDIS_REST_TOKEN')
USE_REDIS = bool(UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)

def redis_get(key):
    if not USE_REDIS:
        return None
    try:
        resp = requests.get(
            f"{UPSTASH_REDIS_REST_URL}/get/{key}",
            headers={"Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}"},
            timeout=2
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("result"):
                return json.loads(data["result"])
    except Exception as e:
        print(f"Redis get error: {e}")
    return None

def redis_set(key, value, ex=None):
    if not USE_REDIS:
        return False
    try:
        body = {"value": json.dumps(value)}
        if ex:
            body["ex"] = ex
        resp = requests.post(
            f"{UPSTASH_REDIS_REST_URL}/set/{key}",
            headers={"Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}"},
            json=body,
            timeout=2
        )
        return resp.status_code == 200
    except Exception as e:
        print(f"Redis set error: {e}")
    return False

MAX_MESSAGES_PER_MINUTE = 10
SESSION_TIMEOUT = 300
MAX_CONNECTIONS_PER_IP = 30
MAX_DOCUMENT_LINKS_PER_SESSION = 5

def get_client_ip():
    forwarded = request.headers.get('X-Forwarded-For')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.remote_addr

def check_rate_limit(ip):
    now = time.time()
    recent = [t for t in rate_limits[ip] if now - t < 60]
    rate_limits[ip] = recent
    if len(recent) >= MAX_MESSAGES_PER_MINUTE:
        blocked_ips.add(ip)
        return False
    rate_limits[ip].append(now)
    return True

def check_ip_connection_limit(ip):
    if len(ip_sessions[ip]) >= MAX_CONNECTIONS_PER_IP:
        return False
    return True

# Cleanup is handled by Redis TTL (ex=SESSION_TIMEOUT)

@app.before_request
def security_check():
    ip = get_client_ip()
    if ip in blocked_ips:
        return jsonify({'error': 'ip blocked'}), 403

@app.route('/getcode', methods=['POST'])
def get_code():
    code = str(uuid.uuid4())[:8].upper()
    user_id = str(uuid.uuid4())
    users[code] = {
        'id': user_id,
        'code': code,
        'partner': None,
        'created': time.time()
    }
    # Also save to Redis if available (for persistence)
    redis_set(f"user:{code}", users[code], ex=3600)
    return jsonify({'code': code, 'id': user_id})

@app.route('/connect', methods=['POST'])
def connect():
    data = request.json
    my_code = data.get('myCode')
    their_code = data.get('theirCode')
    ip = get_client_ip()
    
    print(f"CONNECT: {my_code} wants to connect to {their_code} from {ip}")
    
    if not my_code or not their_code:
        return jsonify({'error': 'both codes are required'}), 400
    
    if my_code == their_code:
        return jsonify({'error': "you can't connect to yourself"}), 400
    
    if len(my_code) != 8 or len(their_code) != 8:
        return jsonify({'error': 'codes must be 8 characters'}), 400
    
    if not check_ip_connection_limit(ip):
        return jsonify({'error': 'too many connections from this IP'}), 429
    
    # Check if target user exists
    if their_code not in users:
        print(f"ERROR: {their_code} not found")
        return jsonify({'error': 'code not found - ask them to refresh their page'}), 404
    
    # Register user if not exists
    if my_code not in users:
        users[my_code] = {'code': my_code, 'partner': None}
        print(f"REGISTERED: {my_code}")
    
    # Check for existing session
    for sid, session in chat_sessions.items():
        if (session['user1'] == my_code and session['user2'] == their_code) or \
           (session['user1'] == their_code and session['user2'] == my_code):
            print(f"FOUND existing session: {sid}")
            ip_sessions[ip].add(sid)
            chat_sessions[sid]['last_activity'] = time.time()
            return jsonify({'sessionId': sid, 'connected': True})
    
    # Create new session
    session_id = str(uuid.uuid4())
    users[my_code]['partner'] = their_code
    users[their_code]['partner'] = my_code
    
    chat_sessions[session_id] = {
        'user1': my_code,
        'user2': their_code,
        'messages': [],
        'created': time.time(),
        'last_activity': time.time(),
        'ips': {my_code: ip, their_code: None}
    }
    
    ip_sessions[ip].add(session_id)
    
    # Also save to Redis if available
    redis_set(f"session:{session_id}", chat_sessions[session_id], ex=SESSION_TIMEOUT)
    
    print(f"CREATED new session: {session_id}")
    return jsonify({'sessionId': session_id, 'connected': True})

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'redis': UPSTASH_REDIS_REST_URL is not None})

@app.route('/send', methods=['POST'])
def send_msg():
    ip = get_client_ip()
    
    if not check_rate_limit(ip):
        return jsonify({'error': 'rate limit exceeded - IP blocked'}), 429
    
    data = request.json
    session_id = data.get('sessionId')
    
    # Use in-memory storage
    if session_id not in chat_sessions:
        return jsonify({'error': 'session not found or expired'}), 404
    
    session = chat_sessions[session_id]
    
    # Check document link limits
    text = data.get('text', '')
    document_extensions = ['.pdf', '.epub', '.docx']
    if any(ext in text.lower() for ext in document_extensions):
        doc_count = sum(1 for m in session.get('messages', [])
                       if any(ext in m.get('text', '').lower() for ext in document_extensions))
        if doc_count >= MAX_DOCUMENT_LINKS_PER_SESSION:
            return jsonify({'error': f'Document limit reached ({MAX_DOCUMENT_LINKS_PER_SESSION} per session)'}), 429
    
    session['last_activity'] = time.time()
    
    msg_id = data.get('id') or str(uuid.uuid4())
    msg = {
        'id': msg_id,
        'sender': data.get('sender'),
        'text': data.get('text'),
        'type': data.get('type', 'text'),
        'encrypted': data.get('encrypted', False),
        'time': time.time(),
        'read_by': []
    }
    
    if 'messages' not in session:
        session['messages'] = []
    session['messages'].append(msg)
    
    # Keep only last 100 messages
    if len(session['messages']) > 100:
        session['messages'] = session['messages'][-100:]
    
    print(f"Message sent to {session_id} from {ip}: {msg['text'][:20]}...")
    
    return jsonify({'id': msg['id']})

@app.route('/messages/<session_id>', methods=['GET'])
def get_messages(session_id):
    cleanup_expired_sessions()
    
    if session_id not in chat_sessions:
        return jsonify({'error': 'session expired'}), 404
    
    session = chat_sessions[session_id]
    session['last_activity'] = time.time()
    
    user_code = request.args.get('user')
    if not user_code:
        return jsonify({'error': 'user parameter required'}), 400
    
    msgs = session.get('messages', [])
    
    unread_for_user = [m for m in msgs if user_code not in m.get('read_by', [])]
    
    for m in unread_for_user:
        if 'read_by' not in m:
            m['read_by'] = []
        m['read_by'].append(user_code)
    
    # Remove fully read messages
    session['messages'] = [
        m for m in msgs if len(m.get('read_by', [])) < 2
    ]
    
    print(f"Session {session_id}: user {user_code} got {len(unread_for_user)} messages, {len(session['messages'])} remaining")
    
    return jsonify(unread_for_user)

def cleanup_expired_sessions():
    now = time.time()
    expired = []
    for sid, session in chat_sessions.items():
        if now - session.get('last_activity', 0) > SESSION_TIMEOUT:
            expired.append(sid)
    for sid in expired:
        del chat_sessions[sid]
        print(f"Session {sid} expired and removed")

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
