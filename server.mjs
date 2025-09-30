import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';
const app = express();
app.use(express.json());
app.use(express.static('public'));
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
app.get('/health', (_req,res)=> res.json({ok:true}));
app.post('/api/tts', async (req, res) => {
  try {
    const text = String(req.body?.text || 'Ho ho ho!');
    const role = (req.body?.voiceRole || 'santa').toLowerCase();
    const voice = role==='elf' ? (process.env.OPENAI_TTS_VOICE_ELF||'amber') : (process.env.OPENAI_TTS_VOICE_SANTA||'alloy');
    if (!process.env.OPENAI_API_KEY) return res.status(401).json({error:'Missing OPENAI_API_KEY'});
    const audio = await openai.audio.speech.create({ model: 'gpt-4o-mini-tts', voice, input: text, format: 'mp3' });
    const buf = Buffer.from(await audio.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg'); res.send(buf);
  } catch (e) { console.error('TTS ERROR:', e.message||e); res.status(500).json({error:'TTS failed'}); }
});
app.post('/api/chat', async (req, res) => {
  try {
    const session = req.body?.session || {};
    const text = String(req.body?.text || '');
    const system = `You are Santa. Short, warm, playful; kid-safe. No private details. Steer to wishlist (up to 10). Context: ${JSON.stringify(session)}`;
    const r = await openai.chat.completions.create({ model:'gpt-4o-mini', temperature:0.6, messages:[{role:'system',content:system},{role:'user',content:text||'Greet the child and ask one fun question.'}]});
    res.json({ reply: r.choices?.[0]?.message?.content || 'Ho ho ho!' });
  } catch (e) { console.error('CHAT ERROR:', e.message||e); res.json({ reply:'Ho ho ho! Try again.'}); }
});
const port = Number(process.env.PORT||3000);
app.listen(port, ()=> console.log(`🎅 Server on http://localhost:${port}`));
