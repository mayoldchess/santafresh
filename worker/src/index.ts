export interface Env {
  OPENAI_API_KEY: string
  OPENAI_BASE: string
  OPENAI_MODEL: string
  OPENAI_TTS_MODEL: string
  OPENAI_VOICE: string
}
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
}
const html = (b:string)=>`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Santa/Elf Worker</title><style>body{font:14px system-ui;margin:24px}code{background:#f2f2f2;padding:2px 6px;border-radius:6px}</style>${b}`
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (url.pathname === '/' && req.method === 'GET') {
      return new Response(html(`<h1>Santa/Elf Worker</h1><ul>
      <li><code>/api/health</code></li><li><code>/api/chat</code> POST {messages}</li><li><code>/api/tts</code> POST {text}</li></ul>`),
        { headers: { 'content-type':'text/html; charset=utf-8', ...cors } })
    }
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ ok:true, worker:'up' }), { headers: { 'content-type':'application/json', ...cors } })
    }
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      const body = await req.json().catch(()=>({}))
      const messages = Array.isArray(body.messages) ? body.messages : []
      const r = await fetch(`${env.OPENAI_BASE}/v1/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: env.OPENAI_MODEL, messages, top_p: 0.9, temperature: 0.6 })
      })
      if (!r.ok) return new Response(JSON.stringify({ error: await r.text() }), { status: 500, headers: { 'content-type':'application/json', ...cors } })
      const data = await r.json()
      const text = data.output_text || data.content?.[0]?.text || data.choices?.[0]?.message?.content || 'Sorry, I have no reply'
      return new Response(JSON.stringify({ text }), { headers: { 'content-type':'application/json', ...cors } })
    }
    if (url.pathname === '/api/tts' && req.method === 'POST') {
      const { text } = await req.json().catch(()=>({ text: '' }))
      if (!text) return new Response('Missing text', { status: 400, headers: cors })
      const r = await fetch(`${env.OPENAI_BASE}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: env.OPENAI_TTS_MODEL, voice: env.OPENAI_VOICE, input: text, format: 'mp3' })
      })
      if (!r.ok) return new Response(await r.text(), { status: 500, headers: cors })
      return new Response(await r.arrayBuffer(), { headers: { 'content-type': 'audio/mpeg', ...cors } })
    }
    return new Response('Not found', { status: 404, headers: cors })
  }
}
