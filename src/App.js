import { useState, useEffect } from 'react'
import './App.css'
import io from 'socket.io-client'

// connect to server
const socket = io('http://localhost:5000')

function App() {
  // tab state
  const [activeTab, setActiveTab] = useState('feed')

  // feed state
  const [posts, setPosts] = useState([])
  const [newPost, setNewPost] = useState('')

  // chat state
  const [messages, setMessages] = useState([])
  const [msg, setMsg] = useState('')
  const [user, setUser] = useState('You')

  // get posts when feed opens
  useEffect(() => {
    if (activeTab === 'feed') {
      fetch('http://localhost:5000/posts')
        .then(res => res.json())
        .then(data => setPosts(data))
    }
  }, [activeTab])

  // listen for messages
  useEffect(() => {
    socket.on('message', (data) => {
      setMessages(prev => [...prev, data])
    })

    return () => socket.off('message')
  }, [])

  // post button
  function handlePost() {
    if (!newPost.trim()) return

    const post = {
      text: newPost,
      user: user,
      time: new Date().toLocaleString()
    }

    fetch('http://localhost:5000/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post)
    })

    setPosts([post, ...posts])
    setNewPost('')
  }

  // send chat
  function sendMsg() {
    if (!msg.trim()) return

    const data = {
      user: user,
      text: msg,
      time: new Date().toLocaleTimeString()
    }

    socket.emit('send', data)
    setMsg('')
  }

  return (
    <div className="app">
      <header className="header">
        <h1>✨ Glimmer</h1>
        <input 
          placeholder="your name" 
          value={user} 
          onChange={(e) => setUser(e.target.value)}
          className="name-input"
        />
      </header>

      <div className="tabs">
        <button 
          className={activeTab === 'feed' ? 'active' : ''} 
          onClick={() => setActiveTab('feed')}
        >
          📰 Feed
        </button>
        <button 
          className={activeTab === 'chat' ? 'active' : ''} 
          onClick={() => setActiveTab('chat')}
        >
          💬 Chat
        </button>
      </div>

      {activeTab === 'feed' && (
        <div className="feed">
          <div className="post-box">
            <textarea
              placeholder="what's up?"
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
            />
            <button onClick={handlePost}>Post</button>
          </div>

          <div className="posts">
            {posts.map((p, i) => (
              <div key={i} className="post">
                <div className="post-header">
                  <span className="post-user">{p.user}</span>
                  <span className="post-time">{p.time}</span>
                </div>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="chat">
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`message ${m.user === user ? 'me' : ''}`}>
                <span className="msg-user">{m.user}</span>
                <p>{m.text}</p>
                <span className="msg-time">{m.time}</span>
              </div>
            ))}
          </div>

          <div className="chat-input">
            <input
              placeholder="type a message..."
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMsg()}
            />
            <button onClick={sendMsg}>Send</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
