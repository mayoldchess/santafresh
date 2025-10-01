import { useEffect, useRef, useState } from 'react'
import './App.css'
import ky from 'ky'

const API = (path) => {
  const base = import.meta.env.VITE_WORKER_URL || localStorage.getItem('worker_url') || ''
  return base ? `${base}${path}` : path
}

const ELF_SYSTEM = {
  role: 'system',
  content:
    "You are 'Nimbe the Helpful Elf'. Speak warmly. Short sentences. Friendly humor. Explain consent clearly to kids and parents. If the user says 'knock knock', run a kid-friendly knock-knock routine. Keep it safe and polite."
}

const CONSENT_SPEECH = `
Hello, I am Nimbe the Helpful Elf.
Before we start, I need a parent or guardian to agree.
This chat uses voice and AI. We use it to answer questions and tell kind stories.
If you agree, please press I Agree so your child can continue. Thank you.
`

export default function App() {
  const [consent, setConsent] = useState(() => localStorage.getItem('parent_consent') === 'yes')
  const [workerUrl, setWorkerUrl] = useState(localStorage.getItem('worker_url') || '')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState([
    ELF_SYSTEM,
    { role: 'assistant', content: "Nimbe here, your cheerful elf. Tap Voice, or try knock knock." }
  ])
  const audioRef = useRef(null)
  const [transcript, setTranscript] = useState([])

  useEffect(() => { if (workerUrl) localStorage.setItem('worker_url', workerUrl) }, [workerUrl])

  const speak = async (text) => {
    const arr = await ky.post(API('/api/tts'), { json: { text } }).arrayBuffer()
    const blob = new Blob([arr], { type: 'audio/mpeg' })
    const url = URL.createObjectURL(blob)
    audioRef.current.src = url
    await audioRef.current.play().catch(()=>{})
  }

  const ask = async (text) => {
    const newMsgs = [...messages, { role: 'user', content: text }]
    setMessages(newMsgs); setBusy(true)
    try {
      const res = await ky.post(API('/api/chat'), { json: { messages: newMsgs.slice(-20) } }).json()
      const reply = res.text ?? '(no reply)'
      const updated = [...newMsgs, { role: 'assistant', content: reply }]
      setMessages(updated)
      await speak(reply)
    } catch (e) {
      const updated = [...newMsgs, { role: 'assistant', content: `Error: ${e.message}` }]
      setMessages(updated)
    } finally { setBusy(false) }
  }

  const recordOnce = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('SpeechRecognition not available'); return }
    const r = new SR()
    r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1
    r.onresult = (ev) => {
      const text = ev.results[0][0].transcript
      setTranscript(t => [...t, { role: 'you', text }]); ask(text)
    }
    r.onerror = () => alert('Mic error'); r.start()
  }

  const knockKnock = async () => {
    const lines = [
      "Knock knock.",
      "Who is there?",
      "Snow.",
      "Snow who?",
      "Snow much fun to meet you. I am Nimbe the Elf."
    ]
    for (const line of lines) { await speak(line) }
    await ask("Tell a short wintery elf joke and invite a question.")
  }

  const playConsent = async () => { await speak(CONSENT_SPEECH) }

  if (!consent) {
    return (
      <div className="container">
        <div className="app">
          <div className="header"><div className="elfface" /><h1 className="h1">Nimbe the Helpful Elf</h1></div>
          <div className="panel">
            <div className="card">
              <div className="label">Why we ask for consent</div>
              <p className="small">A parent or guardian must agree before a child can use voice and AI.</p>
              <div className="row">
                <button className="button warn" onClick={playConsent}>Play audio explainer</button>
                <button className="button" onClick={() => { localStorage.setItem('parent_consent','yes'); setConsent(true) }}>I Agree</button>
              </div>
            </div>
            <audio ref={audioRef} controls />
            <div className="card">
              <div className="label">Worker URL (optional override)</div>
              <div className="row">
                <input className="input" placeholder="https://YOURSUBDOMAIN.workers.dev" value={workerUrl} onChange={e=>setWorkerUrl(e.target.value)} />
                <button className="button alt" onClick={()=>localStorage.setItem('worker_url', workerUrl)}>Save</button>
              </div>
              <p className="small">Frontend calls your Worker. No keys in the browser.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="app">
        <div className="header"><div className="elfface" /><h1 className="h1">Elf Chat, GPT-5</h1></div>
        <div className="panel">
          <div className="row">
            <button className="button" onClick={recordOnce} disabled={busy}>Voice</button>
            <button className="button alt" onClick={()=>ask('knock knock')} disabled={busy}>Ask knock knock</button>
            <button className="button warn" onClick={knockKnock} disabled={busy}>Elf Knock Knock</button>
          </div>
          <div className="card">
            <div className="label">Transcript</div>
            <div className="transcript">
              {messages.filter(m=>m.role!=='system').map((m,i)=>(
                <div key={i} className="msg"><span className="role">{m.role}:</span> {m.content}</div>
              ))}
              {transcript.map((t,i)=>(
                <div key={'u'+i} className="msg"><span className="role">you:</span> {t.text}</div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="label">Worker URL (optional override)</div>
            <div className="row">
              <input className="input" placeholder="https://YOURSUBDOMAIN.workers.dev" value={workerUrl} onChange={e=>setWorkerUrl(e.target.value)} />
              <button className="button alt" onClick={()=>localStorage.setItem('worker_url', workerUrl)}>Save</button>
            </div>
            <p className="small">Tip: test /api/health on your Worker.</p>
          </div>
          <audio ref={audioRef} controls />
        </div>
      </div>
    </div>
  )
}
