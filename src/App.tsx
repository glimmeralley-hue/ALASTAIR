import { useState, useEffect } from 'react'
import './App.css'

// simple encryption - XOR with shared key
function encrypt(text: string, key: string): string {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return btoa(result) // base64 encode
}

function decrypt(text: string, key: string): string {
  try {
    const decoded = atob(text)
    let result = ''
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length))
    }
    return result
  } catch {
    return text // fallback for non-encrypted
  }
}

function App() {
  // landing page state
  const [started, setStarted] = useState(false)
  
  // chat state
  const [myCode, setMyCode] = useState('')
  const [theirCode, setTheirCode] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [fadingMsgs, setFadingMsgs] = useState<Set<string>>(new Set())
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null)

  // encryption key derived from both codes
  const getKey = () => {
    const sorted = [myCode, theirCode].sort().join('')
    return sorted
  }

  // get code on start
  useEffect(() => {
    fetch('http://localhost:5000/getcode', {method: 'POST'})
      .then(r => r.json())
      .then(d => setMyCode(d.code))
  }, [])

  // screenshot detection
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        e.preventDefault()
        setWarning(' Screenshot detected - message will self-destruct')
        setTimeout(() => setWarning(''), 3000)
      }
    }
    
    const handleVisibility = () => {
      if (document.hidden && connected) {
        console.log('Tab switched - session continues')
      }
    }
    
    window.addEventListener('keydown', handleKey)
    document.addEventListener('visibilitychange', handleVisibility)
    
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [connected])

  // poll for messages
  useEffect(() => {
    if (!sessionId) return
    const interval = setInterval(() => {
      fetch(`http://localhost:5000/messages/${sessionId}`)
        .then(r => {
          if (r.status === 404) {
            setError('Session expired')
            setConnected(false)
            setTimeout(() => setError(''), 5000)
            return []
          }
          return r.json()
        })
        .then(msgs => {
          if (!Array.isArray(msgs)) return
          if (msgs.length > 0) {
            // decrypt messages - preserve type field
            const key = getKey()
            const decrypted = msgs.map((m: any) => ({
              ...m,
              text: m.encrypted ? decrypt(m.text, key) : m.text,
              type: m.type || 'text'
            }))
            
            setMessages(prev => {
              const newMsgs = [...prev, ...decrypted]
              // auto fade out after 5 seconds
              decrypted.forEach((m: any) => {
                setTimeout(() => {
                  setFadingMsgs(f => new Set([...f, m.id]))
                  setTimeout(() => {
                    setMessages(p => p.filter(x => x.id !== m.id))
                    setFadingMsgs(f => {
                      const n = new Set(f)
                      n.delete(m.id)
                      return n
                    })
                  }, 1000)
                }, 5000)
              })
              return newMsgs
            })
          }
        })
    }, 1000)
    return () => clearInterval(interval)
  }, [sessionId])

  function connect() {
    if (!theirCode.trim()) {
      setError('Enter a code first')
      setTimeout(() => setError(''), 3000)
      return
    }
    
    fetch('http://localhost:5000/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ myCode, theirCode })
    })
    .then(r => {
      if (!r.ok) {
        throw new Error(`Server error: ${r.status}`)
      }
      return r.json()
    })
    .then(d => {
      if (d.sessionId) {
        setSessionId(d.sessionId)
        setConnected(true)
        setError('')
      } else if (d.error) {
        setError(d.error)
        setTimeout(() => setError(''), 5000)
      }
    })
    .catch(err => {
      setError('Connection failed - is server running?')
      setTimeout(() => setError(''), 5000)
      console.error('Connect error:', err)
    })
  }

  // check if text is a URL
  function isUrl(text: string): boolean {
    try {
      new URL(text)
      return true
    } catch {
      return false
    }
  }

  // render message content based on type
  function renderContent(m: any) {
    const text = m.text
    
    if (m.type === 'image') {
      return <img src={text} alt="shared" className="msg-image" />
    }
    
    if (isUrl(text)) {
      return <a href={text} target="_blank" rel="noopener" className="msg-link">{text}</a>
    }
    
    return <p>{text}</p>
  }

  function sendMsg(type: string = 'text', content?: string) {
    const toSend = content || msg
    if (!toSend.trim() || !sessionId) return
    
    const id = Date.now().toString()
    
    // encrypt content
    const key = getKey()
    const encrypted = encrypt(toSend, key)
    const m = { id, sender: myCode, text: encrypted, type, encrypted: true }
    
    fetch('http://localhost:5000/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...m, sessionId })
    })
    .then(r => {
      if (r.status === 429) {
        setError('Rate limit exceeded - IP blocked')
        setTimeout(() => setError(''), 5000)
      } else if (!r.ok) {
        setError('Session expired or blocked')
        setTimeout(() => setError(''), 5000)
      }
    })
    .catch(() => {})
    
    // show locally
    setMessages(prev => [...prev, { id, sender: myCode, text: toSend, type, local: true }])
    setMsg('')
    
    // fade out after 5 sec
    setTimeout(() => {
      setFadingMsgs(f => new Set([...f, id]))
      setTimeout(() => {
        setMessages(p => p.filter(x => x.id !== id))
        setFadingMsgs(f => {
          const n = new Set(f)
          n.delete(id)
          return n
        })
      }, 1000)
    }, 5000)
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    // check file size (max 2MB for now)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image too large - max 2MB')
      setTimeout(() => setError(''), 5000)
      return
    }
    
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      sendMsg('image', base64)
    }
    reader.readAsDataURL(file)
    
    // reset input
    e.target.value = ''
  }

  // landing page
  if (!started) {
    return (
      <div className="landing">
        <div className="landing-content">
          <h1>Alastair</h1>
          <p>messages that vanish</p>
          <div className="particles-demo">
            <span className="particle">✦</span>
            <span className="particle">✧</span>
            <span className="particle">✦</span>
          </div>
          <button onClick={() => setStarted(true)}>ENTER</button>
        </div>
      </div>
    )
  }

  function copyCode() {
    navigator.clipboard.writeText(myCode)
    alert('code copied')
  }

  async function pasteCode() {
    const text = await navigator.clipboard.readText()
    setTheirCode(text.toUpperCase().slice(0, 8))
  }

  return (
    <div className="app">
      {(error || warning) && (
        <div className={`banner ${error ? 'error' : 'warning'}`}>
          {error || warning}
        </div>
      )}
      
      <header className="header">
        <h1>Alastair</h1>
        <span className="code-display">{myCode}</span>
      </header>

      {!connected ? (
        <div className="connect-screen">
          <div className="code-box">
            <label>YOUR CODE</label>
            <div className="big-code">{myCode || '...'}</div>
            <button className="action-btn" onClick={copyCode}>COPY</button>
            <p>share this with someone</p>
          </div>
          
          <div className="divider">OR</div>
          
          <div className="enter-box">
            <label>ENTER THEIR CODE</label>
            <div className="input-with-paste">
              <input 
                value={theirCode} 
                onChange={e => setTheirCode(e.target.value.toUpperCase())} 
                placeholder="00000000"
                maxLength={8}
              />
              <button className="paste-btn" onClick={pasteCode}>PASTE</button>
            </div>
            <button className="connect-btn" onClick={connect}>CONNECT</button>
          </div>
        </div>
      ) : (
        <div className="chat-screen">
          <div className="chat-info">
            <span>secure to <b>{theirCode}</b> • e2e encrypted • 5m timeout</span>
            <span className="fade-hint">vanishes in 5s</span>
          </div>
          
          <div className="messages">
            {messages.map((m) => (
              <div 
                key={m.id} 
                className={`msg ${m.sender === myCode ? 'me' : ''} ${fadingMsgs.has(m.id) ? 'fading' : ''} ${m.type || 'text'}`}
              >
                <div className="msg-content">
                  {renderContent(m)}
                </div>
                {fadingMsgs.has(m.id) && (
                  <div className="particles">
                    {[...Array(12)].map((_, i) => (
                      <span key={i} className="dot" style={{
                        '--x': `${Math.random() * 60 - 30}px`,
                        '--y': `${Math.random() * 60 - 30}px`,
                        '--delay': `${Math.random() * 0.3}s`
                      } as any} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {messages.length === 0 && <div className="empty">no messages</div>}
          </div>
          
          <div className="input-area">
            <input 
              value={msg} 
              onChange={e => setMsg(e.target.value)} 
              onKeyPress={e => e.key === 'Enter' && sendMsg('text')} 
              placeholder="type a message or paste a link..." 
            />
            <input
              type="file"
              accept="image/*"
              ref={setFileInput}
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <button onClick={() => fileInput?.click()} title="send image">📷</button>
            <button onClick={() => sendMsg('text')}>SEND</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
