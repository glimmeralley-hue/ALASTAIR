

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
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024
CORS(app)
Compress(app)

UPSTASH_REDIS_REST_URL = os.environ.get('UPSTASH_REDIS_REST_URL')
UPSTASH_REDIS_REST_TOKEN = os.environ.get('UPSTASH_REDIS_REST_TOKEN')

def redis_get(key):
    if not UPSTASH_REDIS_REST_URL:
        return None
    try:
        resp = requests.get(
            f"{UPSTASH_REDIS_REST_URL}/get/{key}",
            headers={"Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}"},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("result"):
                return json.loads(data["result"])
    except Exception as e:
        print(f"Redis get error: {e}")
    return None

def redis_set(key, value, ex=None):
    if not UPSTASH_REDIS_REST_URL:
        return False
    try:
        body = {"value": json.dumps(value)}
        if ex:
            body["ex"] = ex
        resp = requests.post(
            f"{UPSTASH_REDIS_REST_URL}/set/{key}",
            headers={"Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}"},
            json=body,
            timeout=10
        )
        return resp.status_code == 200
    except Exception as e:
        print(f"Redis set error: {e}")
    return False

def redis_delete(key):
    if not UPSTASH_REDIS_REST_URL:
        return False
    try:
        resp = requests.get(
            f"{UPSTASH_REDIS_REST_URL}/del/{key}",
            headers={"Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}"},
            timeout=10
        )
        return resp.status_code == 200
    except Exception as e:
        print(f"Redis del error: {e}")
    return False

rate_limits = defaultdict(list)
ip_sessions = defaultdict(set)
blocked_ips = set()

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


@app.before_request
def security_check():
    ip = get_client_ip()
    if ip in blocked_ips:
        return jsonify({'error': 'ip blocked'}), 403

@app.route('/getcode', methods=['POST'])
def get_code():
    code = str(uuid.uuid4())[:8].upper()
    user_id = str(uuid.uuid4())
    user_data = {
        'id': user_id,
        'code': code,
        'partner': None,
        'created': time.time()
    }
    # Don't block response on Redis - user can connect even if Redis is slow
    try:
        redis_set(f"user:{code}", user_data, ex=3600)
    except Exception as e:
        print(f"Redis save failed for {code}: {e}")
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
    
    # Check if target user exists in Redis
    their_user = redis_get(f"user:{their_code}")
    print(f"CONNECT: their_user={their_code}, found={their_user is not None}, session_id={their_user.get('session_id') if their_user else None}")
    if not their_user:
        print(f"ERROR: {their_code} not found")
        return jsonify({'error': 'code not found - ask them to refresh their page'}), 404
    
    # Check for existing session
    my_user = redis_get(f"user:{my_code}")
    print(f"CONNECT: my_user={my_code}, found={my_user is not None}, session_id={my_user.get('session_id') if my_user else None}")
    if not my_user:
        my_user = {'code': my_code, 'partner': None}
        redis_set(f"user:{my_code}", my_user, ex=3600)
        print(f"REGISTERED: {my_code}")
    
    # Look for existing session - check THEIR session FIRST (they might have created it)
    session_id = None
    
    # Check if THEY already have a session with me
    their_sid = their_user.get('session_id')
    if their_sid:
        existing = redis_get(f"session:{their_sid}")
        print(f"CONNECT: Checking their session {their_sid}, found={existing is not None}")
        if existing and ((existing['user1'] == my_code and existing['user2'] == their_code) or
                        (existing['user1'] == their_code and existing['user2'] == my_code)):
            session_id = their_sid
            print(f"FOUND their existing session: {session_id}")
            # Update my user to point to same session
            my_user['session_id'] = session_id
            my_user['partner'] = their_code
            redis_set(f"user:{my_code}", my_user, ex=3600)
            existing['last_activity'] = time.time()
            redis_set(f"session:{session_id}", existing, ex=SESSION_TIMEOUT)
            ip_sessions[ip].add(session_id)
            return jsonify({'sessionId': session_id, 'connected': True})
    
    # Check if I already have a session (only if they don't have one)
    potential_sid = my_user.get('session_id')
    if potential_sid:
        existing = redis_get(f"session:{potential_sid}")
        print(f"CONNECT: Checking my session {potential_sid}, found={existing is not None}")
        if existing and ((existing['user1'] == my_code and existing['user2'] == their_code) or
                        (existing['user1'] == their_code and existing['user2'] == my_code)):
            session_id = potential_sid
            print(f"FOUND my existing session: {session_id}")
            existing['last_activity'] = time.time()
            redis_set(f"session:{session_id}", existing, ex=SESSION_TIMEOUT)
            ip_sessions[ip].add(session_id)
            return jsonify({'sessionId': session_id, 'connected': True})
    
    # Create new session
    session_id = str(uuid.uuid4())
    print(f"CREATING new session: {session_id}")
    
    my_user['partner'] = their_code
    my_user['session_id'] = session_id
    their_user['partner'] = my_code
    their_user['session_id'] = session_id
    
    # Save both users - retry if needed
    my_saved = redis_set(f"user:{my_code}", my_user, ex=3600)
    their_saved = redis_set(f"user:{their_code}", their_user, ex=3600)
    print(f"User save: my={my_saved}, their={their_saved}")
    
    session_data = {
        'user1': my_code,
        'user2': their_code,
        'messages': [],
        'created': time.time(),
        'last_activity': time.time(),
        'ips': {my_code: ip, their_code: None}
    }
    
    session_saved = redis_set(f"session:{session_id}", session_data, ex=SESSION_TIMEOUT)
    print(f"Session save: {session_saved}")
    
    ip_sessions[ip].add(session_id)
    
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
    
    session = redis_get(f"session:{session_id}")
    print(f"SEND: Looking for session {session_id}, found: {session is not None}")
    
    if not session:
        return jsonify({'error': 'session not found or expired'}), 404
    
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
    
    # Keep only last 100 messages to prevent Redis bloat
    if len(session['messages']) > 100:
        session['messages'] = session['messages'][-100:]
    
    success = redis_set(f"session:{session_id}", session, ex=SESSION_TIMEOUT)
    print(f"Message sent to {session_id} from {ip}: {msg['text'][:20]}... Redis save: {success}")
    print(f"Session now has {len(session['messages'])} messages")
    
    return jsonify({'id': msg['id']})

@app.route('/messages/<session_id>', methods=['GET'])
def get_messages(session_id):
    session = redis_get(f"session:{session_id}")
    print(f"GET MESSAGES: session {session_id}, found: {session is not None}")
    
    if not session:
        return jsonify({'error': 'session expired'}), 404
    
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
    
    redis_set(f"session:{session_id}", session, ex=SESSION_TIMEOUT)
    
    print(f"Session {session_id}: user {user_code} got {len(unread_for_user)} messages, {len(session['messages'])} remaining")
    
    return jsonify(unread_for_user)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
