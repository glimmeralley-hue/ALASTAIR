from flask import Flask, request, jsonify
from flask_cors import CORS
import uuid
import time
from collections import defaultdict

app = Flask(__name__)
CORS(app)

# stores
users = {}
chat_sessions = {}
rate_limits = defaultdict(list)  # ip -> list of timestamps
ip_sessions = defaultdict(set)   # ip -> set of session_ids
blocked_ips = set()

# security config
MAX_MESSAGES_PER_MINUTE = 10
SESSION_TIMEOUT = 300  # 5 minutes
MAX_CONNECTIONS_PER_IP = 3

def get_client_ip():
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    return request.remote_addr

def check_rate_limit(ip):
    now = time.time()
    # clean old entries
    rate_limits[ip] = [t for t in rate_limits[ip] if now - t < 60]
    if len(rate_limits[ip]) >= MAX_MESSAGES_PER_MINUTE:
        blocked_ips.add(ip)
        return False
    rate_limits[ip].append(now)
    return True

def check_ip_connection_limit(ip):
    if len(ip_sessions[ip]) >= MAX_CONNECTIONS_PER_IP:
        return False
    return True

def cleanup_expired_sessions():
    now = time.time()
    expired = []
    for sid, session in chat_sessions.items():
        if now - session.get('last_activity', 0) > SESSION_TIMEOUT:
            expired.append(sid)
    for sid in expired:
        del chat_sessions[sid]
        print(f"Session {sid} expired and removed")

# security middleware
@app.before_request
def security_check():
    ip = get_client_ip()
    if ip in blocked_ips:
        return jsonify({'error': 'ip blocked'}), 403

# generate unique code for user
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
    return jsonify({'code': code, 'id': user_id})

# connect two users with codes
@app.route('/connect', methods=['POST'])
def connect():
    data = request.json
    my_code = data.get('myCode')
    their_code = data.get('theirCode')
    ip = get_client_ip()
    
    print(f"CONNECT: {my_code} wants to connect to {their_code} from {ip}")
    
    # check IP connection limit
    if not check_ip_connection_limit(ip):
        return jsonify({'error': 'too many connections from this IP'}), 429
    
    # ensure both users exist in our registry
    if my_code not in users:
        users[my_code] = {'code': my_code, 'partner': None}
        print(f"REGISTERED: {my_code}")
    
    if their_code not in users:
        print(f"ERROR: {their_code} not found")
        return jsonify({'error': 'code not found - ask them to refresh'}), 404
    
    # check if session already exists
    for sid, session in chat_sessions.items():
        if (session['user1'] == my_code and session['user2'] == their_code) or \
           (session['user1'] == their_code and session['user2'] == my_code):
            print(f"FOUND existing session: {sid}")
            ip_sessions[ip].add(sid)
            # update activity
            chat_sessions[sid]['last_activity'] = time.time()
            return jsonify({'sessionId': sid, 'connected': True})
    
    # create new chat session
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
    
    print(f"CREATED new session: {session_id}")
    return jsonify({'sessionId': session_id, 'connected': True})

# get posts for feed
@app.route('/posts', methods=['GET'])
def get_posts():
    return jsonify(posts)

@app.route('/posts', methods=['POST'])
def add_post():
    post = request.json
    posts.insert(0, post)
    return jsonify({'ok': True})

# send message (disappearing) with rate limiting
@app.route('/send', methods=['POST'])
def send_msg():
    ip = get_client_ip()
    
    # check rate limit
    if not check_rate_limit(ip):
        return jsonify({'error': 'rate limit exceeded - IP blocked'}), 429
    
    data = request.json
    session_id = data.get('sessionId')
    
    # check session exists and update activity
    if session_id not in chat_sessions:
        return jsonify({'error': 'session not found or expired'}), 404
    
    # update last activity
    chat_sessions[session_id]['last_activity'] = time.time()
    
    # use id from frontend if provided
    msg_id = data.get('id') or str(uuid.uuid4())
    msg = {
        'id': msg_id,
        'sender': data.get('sender'),
        'text': data.get('text'),
        'type': data.get('type', 'text'),
        'encrypted': data.get('encrypted', False),
        'time': time.time(),
        'read': False
    }
    
    chat_sessions[session_id]['messages'].append(msg)
    print(f"Message sent to {session_id} from {ip}: {msg['text'][:20]}...")
    
    return jsonify({'id': msg['id']})

# get messages - disappearing after read
@app.route('/messages/<session_id>', methods=['GET'])
def get_messages(session_id):
    # cleanup expired sessions periodically
    cleanup_expired_sessions()
    
    if session_id not in chat_sessions:
        return jsonify({'error': 'session expired'}), 404
    
    # update last activity
    chat_sessions[session_id]['last_activity'] = time.time()
    
    msgs = chat_sessions[session_id]['messages']
    
    # find unread messages
    unread = [m for m in msgs if not m.get('read', False)]
    
    # mark them as read
    for m in unread:
        m['read'] = True
    
    # delete ALL read messages immediately (they disappear after seen)
    chat_sessions[session_id]['messages'] = [m for m in msgs if not m.get('read', False)]
    
    print(f"Session {session_id}: returned {len(unread)} messages, {len(chat_sessions[session_id]['messages'])} remaining")
    
    return jsonify(unread)

if __name__ == '__main__':
    app.run(port=5000, debug=True)
