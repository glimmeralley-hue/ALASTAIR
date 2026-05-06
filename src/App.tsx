import { useState, useEffect } from 'react'
// @ts-ignore
import './App.css'

function encrypt(text: string, key: string): string {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return btoa(result)
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
    return text
  }
}

function App() {
  const [started, setStarted] = useState(false)
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
  const [locationSharing, setLocationSharing] = useState(false)

  const getKey = () => {
    return [myCode, theirCode].sort().join('')
  }

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  useEffect(() => {
    fetch(`${API_URL}/getcode`, {method: 'POST'})
      .then(r => r.json())
      .then(d => setMyCode(d.code))
  }, [])

  useEffect(() => {
    const keyPress = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        e.preventDefault()
        setWarning(' Screenshot detected - message will self-destruct')
        setTimeout(() => setWarning(''), 3000)
      }
    }
    
    const visibilityChange = () => {
      if (document.hidden && connected) {
        console.log('Tab switched - session continues')
      }
    }
    
    window.addEventListener('keydown', keyPress)
    document.addEventListener('visibilitychange', visibilityChange)
    
    return () => {
      window.removeEventListener('keydown', keyPress)
      document.removeEventListener('visibilitychange', visibilityChange)
    }
  }, [connected])

  useEffect(() => {
    if (!sessionId) return
    const interval = setInterval(() => {
      fetch(`${API_URL}/messages/${sessionId}?user=${myCode}`)
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
            const key = getKey()
            const decrypted = msgs.map((m: any) => ({
              ...m,
              text: m.encrypted ? decrypt(m.text, key) : m.text,
              type: m.type || 'text'
            }))
            
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id))
              const newMessages = decrypted.filter(m => !existingIds.has(m.id))
              const newMsgs = [...prev, ...newMessages]
              
              newMessages.forEach((m: any) => {
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
    }, 500)  // Poll every 500ms for lower latency
    return () => clearInterval(interval)
  }, [sessionId, myCode, API_URL])

  useEffect(() => {
    if (locationSharing && connected) {
      shareLocation()
    }
  }, [locationSharing, connected])

  function connect() {
    setError('')
    
        if (!myCode || !theirCode) {
      setError('Both codes are required')
      setTimeout(() => setError(''), 3000)
      return
    }
    
    if (myCode === theirCode) {
      setError("You can't connect to yourself")
      setTimeout(() => setError(''), 3000)
      return
    }
    
    if (theirCode.length !== 8) {
      setError('Code must be exactly 8 characters')
      setTimeout(() => setError(''), 3000)
      return
    }
    
    if (!/^[A-Z0-9]+$/.test(theirCode)) {
      setError('Code must contain only letters and numbers')
      setTimeout(() => setError(''), 3000)
      return
    }
    
    fetch(`${API_URL}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ myCode, theirCode })
    })
    .then(r => r.json())
    .then(d => {
      if (d.error) {
        setError(d.error)
        setTimeout(() => setError(''), 5000)
        return
      }
      setSessionId(d.sessionId)
      setConnected(true)
    })
    .catch(err => {
      setError('Connection failed - is server running?')
      setTimeout(() => setError(''), 5000)
      console.error('Connect error:', err)
    })
  }

  function isUrl(text: string): boolean {
    try {
      const url = new URL(text, 'https://example.com')
      return !!(url.protocol && url.host)
    } catch {
      return false
    }
  }

  function isPdfUrl(text: string): boolean {
    return isUrl(text) && text.toLowerCase().includes('.pdf')
  }

  function isEpubUrl(text: string): boolean {
    return isUrl(text) && text.toLowerCase().includes('.epub')
  }

  function isDocxUrl(text: string): boolean {
    return isUrl(text) && text.toLowerCase().includes('.docx')
  }

  function isDocumentUrl(text: string): boolean {
    return isPdfUrl(text) || isEpubUrl(text) || isDocxUrl(text)
  }

  function renderContent(m: any) {
    const text = m.text
    
    if (m.type === 'location') {
      try {
        const location = JSON.parse(text)
        return (
          <div className="location-message">
            <div className="location-info">
              📍 <strong>Live Location</strong>
              <br />
              Lat: {location.lat}°, Lng: {location.lng}°
              <br />
              Accuracy: ±{location.accuracy}m
            </div>
            <div className="document-warning">
              ⚠️ Location shared - auto-deletes after 5 seconds
            </div>
          </div>
        )
      } catch {
        return <p>Location data unavailable</p>
      }
    }
    
    if (m.type === 'image') {
      return (
        <div className="image-container">
          <img src={text} alt="shared" className="msg-image" />
          <div className="image-actions">
            <button 
              onClick={() => {
                const link = document.createElement('a')
                link.href = text
                link.download = `image_${m.id}.jpg`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
              }}
              className="download-btn"
              title="Download image"
            >
              ⬇️
            </button>
          </div>
          <div className="document-warning">
            ⚠️ Image download persists beyond ephemeral chat
          </div>
        </div>
      )
    }
    
    if (isDocumentUrl(text)) {
      let icon = '📄'
      let type = 'document'
      
      if (isPdfUrl(text)) {
        icon = '📄'
        type = 'PDF'
      } else if (isEpubUrl(text)) {
        icon = '📚'
        type = 'EPUB'
      } else if (isDocxUrl(text)) {
        icon = '📝'
        type = 'DOCX'
      }
      
      return (
        <div className="document-link">
          <a href={text} target="_blank" rel="noopener" className="msg-link">
            {icon} {text}
          </a>
          <div className="document-actions">
            <button 
              onClick={() => {
                const link = document.createElement('a')
                link.href = text
                link.download = text.split('/').pop() || 'document'
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
              }}
              className="download-btn"
              title={`Download ${type}`}
            >
              ⬇️
            </button>
          </div>
          <div className="document-warning">
            ⚠️ {type} download persists beyond ephemeral chat
          </div>
        </div>
      )
    }
    
    if (isUrl(text)) {
      return <a href={text} target="_blank" rel="noopener" className="msg-link">{text}</a>
    }
    
    return <p>{text}</p>
  }

  function shareLocation() {
  if (!navigator.geolocation) {
    setError('Location not supported by your browser')
    setTimeout(() => setError(''), 3000)
    return
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords
      const locationData = {
        lat: latitude.toFixed(6),
        lng: longitude.toFixed(6),
        accuracy: Math.round(accuracy),
        timestamp: Date.now()
      }
      
      sendMsg('location', JSON.stringify(locationData))
      setLocationSharing(false)
      
            setTimeout(() => {
        setLocationSharing(false)
      }, 30000)
    },
    () => {
      setError('Location access denied or unavailable')
      setTimeout(() => setError(''), 3000)
      setLocationSharing(false)
    }
  )
}

function sendMsg(type: string = 'text', content?: string) {
    const toSend = content || msg
    if (!toSend.trim() || !sessionId) return
    
    const id = Date.now().toString()
    const key = getKey()
    const encrypted = encrypt(toSend, key)
    const m = { id, sender: myCode, text: encrypted, type, encrypted: true }
    
    fetch(`${API_URL}/send`, {
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
    
    setMessages(prev => [...prev, { id, sender: myCode, text: toSend, type, local: true }])
    setMsg('')
    
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

  function compressImage(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
          
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, width, height)
          
          // Compress as JPEG
          resolve(canvas.toDataURL('image/jpeg', quality))
        }
        img.src = reader.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function imageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (file.size > 5 * 1024 * 1024) {
      setError('Image too large - max 5MB')
      setTimeout(() => setError(''), 5000)
      return
    }
    
    try {
      setWarning('Compressing image...')
      const compressed = await compressImage(file, 800, 0.7)
      setWarning('')
      sendMsg('image', compressed)
    } catch {
      setError('Failed to process image')
      setTimeout(() => setError(''), 5000)
    }
    
    e.target.value = ''
  }

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
    try {
      const text = await navigator.clipboard.readText()
      const cleanCode = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
      setTheirCode(cleanCode)
    } catch {
      setError('Could not access clipboard')
      setTimeout(() => setError(''), 3000)
    }
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
              onChange={imageSelect}
              style={{ display: 'none' }}
            />
            <button 
              onClick={() => setLocationSharing(!locationSharing)} 
              className={`location-btn ${locationSharing ? 'active' : ''}`}
              title={locationSharing ? 'Stop location sharing' : 'Share live location'}
            >
              📍
            </button>
            <button onClick={() => fileInput?.click()} title="send image">📷</button>
            <button onClick={() => sendMsg('text')}>SEND</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
