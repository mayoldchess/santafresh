import React, { useEffect, useMemo, useRef, useState } from "react";
import html2pdf from "html2pdf.js";
import { z } from "zod";
import { ensureAudio, playKnock, startMusic, stopMusic } from "./audio";

const API_BASE = import.meta.env.VITE_API_BASE || "";

const childSchema = z.object({
  name: z.string().min(1).max(20),
  age: z.string().optional()
});

const SYS_PROMPT = `
You are Santa Claus chatting with a child in a friendly, funny, kind tone.
Kid-safety rules:
- No collection of addresses, last names, phone numbers, school names, or exact locations.
- If a child tries to share personal details, gently say you do not need that and change the topic.
- Encourage kindness, gratitude, and creativity.
- No scary content. No swear words. No medical or legal advice.
- Keep answers short, 1 to 3 sentences. Ask simple questions to build a wishlist.
Flow:
- Greet the child by first name only.
- Ask about toys or games, books or art, clothes or sports, and fun experiences.
- Summarize what they like so far. Ask one follow up question.
- End with cheer, mention elves, and offer to create a letter to Santa.
`;

const hasSpeech = typeof window !== "undefined" && (("webkitSpeechRecognition" in window) || ("SpeechRecognition" in window));
const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

function elfSay(text){
  try{
    const utt = new SpeechSynthesisUtterance(text);
    utt.pitch = 1.4;
    utt.rate = 1.05;
    utt.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const pick = voices.find(v => /english|en/i.test(v.lang) && /child|girl|boy|female|samantha|victoria|google uk english female/i.test(v.name)) || voices[0];
    if(pick) utt.voice = pick;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  }catch{}
}

export default function App(){
  const [parentEmail, setParentEmail] = useState("");
  const [kidName, setKidName] = useState("");
  const [age, setAge] = useState("");
  const [consent, setConsent] = useState(false);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [wishlist, setWishlist] = useState({Toys:[],Books:[],Games:[],Clothes:[],Experiences:[],Other:[]});
  const [audioReady, setAudioReady] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [consentStage, setConsentStage] = useState("idle");
  const chatRef = useRef(null);
  const recogRef = useRef(null);

  function scrollChat(){ setTimeout(()=>{ if(chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }, 10); }
  function addSanta(text){ setMessages(m=>[...m,{role:"santa", text}]); scrollChat(); }
  function addKid(text){ setMessages(m=>[...m,{role:"kid", text}]); scrollChat(); }
  function addElf(text){ setMessages(m=>[...m,{role:"elf", text}]); scrollChat(); elfSay(text); }

  useEffect(()=>{ if(typeof window !== "undefined"){ window.speechSynthesis.onvoiceschanged = ()=>{} } },[]);

  function onKnock(){
    ensureAudio();
    playKnock();
    if(!musicMuted){ startMusic(); }
    setAudioReady(true);
    setConsentStage("intro");
    setTimeout(()=>{
      addElf("Knock knock. Elf here. I handle consent with maximum sparkle.");
      setTimeout(()=>addElf("Parent, please say: I consent."), 600);
    }, 200);
  }

  function startVoiceConsent(){
    try{
      if(!hasSpeech || !SR) { setConsentStage("fallback"); addElf("Voice is not supported in this browser. Please tick consent below."); return }
      const r = new SR();
      recogRef.current = r;
      r.lang = "en-US";
      r.continuous = false;
      r.interimResults = true;
      setConsentStage("listening");
      addElf("Listening. Say I consent.");
      r.onresult = (ev)=>{
        let txt = "";
        for(let i=ev.resultIndex;i<ev.results.length;i++){
          txt += ev.results[i][0].transcript;
        }
        if(/i consent|i agree|yes i consent/i.test(txt)){
          r.stop();
          setConsent(true);
          setConsentStage("done");
          addElf("Yippee. Consent captured. Opening the Santa line.");
        }
      };
      r.onerror = ()=>{ setConsentStage("fallback"); addElf("I could not hear it. You can tick the consent box."); };
      r.onend = ()=>{ if(!consent && consentStage !== "fallback"){ setConsentStage("fallback"); addElf("I did not catch that. You can also tick the box."); } };
      r.start();
    }catch{
      setConsentStage("fallback");
      addElf("Voice failed. Please tick the consent box.");
    }
  }

  async function startChat(){
    try{ childSchema.parse({name:kidName, age:age || undefined}); }
    catch{ alert("Please enter a first name up to 20 letters."); return }
    if(!consent || !parentEmail){ alert("Parent email and consent are required."); return }
    setStarted(true);
    addSanta(`Ho ho ho, hello ${kidName}! What made you smile this year?`);
    addSanta("Tell me your wishlist. Toys or games. Books or art. Clothes or sports. Or a fun experience.");
  }

  function safeCategorize(text){
    const t = text.toLowerCase();
    const push = (k,v)=>setWishlist(w=>({...w,[k]:[...new Set([...w[k], v])] }));
    if(t.match(/lego|doll|car|train|plush/)) push("Toys", text);
    else if(t.match(/book|comic|draw|marker|paint/)) push("Books", text);
    else if(t.match(/game|switch|ps|xbox/)) push("Games", text);
    else if(t.match(/shirt|hoodie|shoe|sock|cap/)) push("Clothes", text);
    else if(t.match(/trip|park|museum|zoo|ski|lake/)) push("Experiences", text);
    else push("Other", text);
  }

  async function send(){
    const text = input.trim();
    if(!text) return;
    setInput("");
    addKid(text);
    safeCategorize(text);
    setThinking(true);
    try{
      const res = await fetch(`${API_BASE}/chat`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          system: SYS_PROMPT,
          kidName,
          age,
          messages: messages.concat([{role:"kid", text}]).slice(-12)
        })
      });
      if(!res.ok) throw new Error("Santa is feeding reindeer.");
      const data = await res.json();
      addSanta(data.reply);
    }catch(e){
      addSanta("Oops. My sleigh hit a snow cloud. Please try again.");
    }finally{
      setThinking(false);
    }
  }

  function makeLetterPDF(){
    const el = document.createElement("div");
    el.style.padding = "24px";
    el.style.fontFamily = "Georgia, serif";
    el.innerHTML = `
      <div style="border:6px solid #e71d36;border-radius:16px;padding:20px;">
        <h1 style="text-align:center;margin:0 0 10px 0;">Letter to Santa</h1>
        <p>Dear Santa,</p>
        <p>My name is <strong>${kidName}</strong>${age ? ", I am " + age + " years old." : "."}</p>
        <p>Here is my wishlist:</p>
        ${Object.entries(wishlist).map(([k,vs])=>vs.length?`
          <h3>${k}</h3>
          <ul>${vs.map(v=>`<li>${v}</li>`).join("")}</ul>
        `:"").join("")}
        <p>Thank you for all your work with the elves.</p>
        <p>With kindness,<br/>${kidName}</p>
      </div>`;
    html2pdf().set({
      margin: 10, filename: `Letter_to_Santa_${kidName || "Friend"}.pdf`,
      image: { type: "jpeg", quality: 0.98 }, html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    }).from(el).save();
  }

  function makeCertificatePDF(){
    const el = document.createElement("div");
    el.style.padding = "24px";
    el.style.fontFamily = "Georgia, serif";
    el.innerHTML = `
      <div style="border:10px double #2a9d8f;border-radius:16px;padding:30px;text-align:center;">
        <h1 style="margin:0 0 8px 0;">Nice List Certificate</h1>
        <p>This certifies that</p>
        <h2 style="margin:6px 0;">${kidName || "A Kind Kid"}</h2>
        <p>has shown kindness, effort, and holiday spirit.</p>
        <p>Signed by Santa and the Elves</p>
        <p style="margin-top:20px;font-size:12px;color:#666;">For fun only.</p>
      </div>`;
    html2pdf().set({
      margin: 10, filename: `Nice_List_${kidName || "Friend"}.pdf`,
      image: { type: "jpeg", quality: 0.98 }, html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
    }).from(el).save();
  }

  const wishlistHasItems = useMemo(()=>Object.values(wishlist).some(v=>v.length),[wishlist]);

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <div className="santa">🎅</div>
          <div>
            <h2 style={{margin:"0"}}>Santa Chat</h2>
            <div className="small">Kid safe chat with elf consent, wishlist, and PDFs</div>
          </div>
          <span className="badge">Voice consent</span>
          <span className="badge">No exact locations</span>
          <button className="btn ghost mute" onClick={()=>{
            if(musicMuted){ setMusicMuted(false); startMusic(); } else { setMusicMuted(true); stopMusic(); }
          }}>{musicMuted ? "Unmute music" : "Mute music"}</button>
        </div>

        {!audioReady ? (
          <div className="center">
            <button className="btn warning" onClick={onKnock}>🔔 Knock Knock</button>
            <div className="small">Click to enter the workshop. This enables sound.</div>
          </div>
        ) : !consent ? (
          <>
            <div className="msg elf"><div className="bubble"><div className="small">Elf</div>Hello. I am Twinkle the Consent Elf. I am tiny but mighty in paperwork.</div></div>
            <div className="alert">
              Parent, we do not collect addresses, last names, phone numbers, school names, or exact locations. To continue, please say out loud: <b>I consent</b>. Then I open the line to Santa.
            </div>
            <div className="row">
              <label style={{width:"160px"}}>Parent email</label>
              <input value={parentEmail} onChange={e=>setParentEmail(e.target.value)} placeholder="parent@example.com" />
            </div>
            <div className="row" style={{marginTop:"6px"}}>
              <label style={{width:"160px"}}>Child first name</label>
              <input value={kidName} onChange={e=>setKidName(e.target.value)} placeholder="Sophie" />
            </div>
            <div className="row">
              <label style={{width:"160px"}}>Age (optional)</label>
              <input value={age} onChange={e=>setAge(e.target.value)} placeholder="10" />
            </div>

            <div className="row" style={{marginTop:"10px"}}>
              <button className="btn" onClick={startVoiceConsent}>🎤 Start voice consent</button>
              <span className="small">Browser listens for: I consent</span>
            </div>
            {consentStage==="listening" && <div className="msg elf"><div className="bubble"><div className="small">Elf</div>I am listening. Speak clearly and cheerfully.</div></div>}
            {(consentStage==="fallback") && (
              <div className="row" style={{marginTop:"10px"}}>
                <input type="checkbox" id="cc" checked={consent} onChange={e=>setConsent(e.target.checked)} />
                <label htmlFor="cc">I am the parent or guardian. I consent.</label>
              </div>
            )}
            <div style={{marginTop:"10px"}}>
              <button className="btn secondary" onClick={startChat}>Enter Santa chat</button>
            </div>
          </>
        ) : !started ? (
          <>
            <div className="msg elf"><div className="bubble"><div className="small">Elf</div>Consent locked in. Santa is all ears, jingle and ready.</div></div>
            <div className="row">
              <label style={{width:"160px"}}>Parent email</label>
              <input value={parentEmail} onChange={e=>setParentEmail(e.target.value)} placeholder="parent@example.com" />
            </div>
            <div className="row">
              <label style={{width:"160px"}}>Child first name</label>
              <input value={kidName} onChange={e=>setKidName(e.target.value)} placeholder="Sophie" />
            </div>
            <div className="row">
              <label style={{width:"160px"}}>Age (optional)</label>
              <input value={age} onChange={e=>setAge(e.target.value)} placeholder="10" />
            </div>
            <div style={{marginTop:"10px"}}>
              <button className="btn" onClick={startChat}>Chat with Santa</button>
            </div>
          </>
        ):(
          <>
            <div ref={chatRef} className="chat">
              {messages.map((m,i)=>(
                <div key={i} className={"msg " + (m.role==="santa"?"santa": m.role==="elf"?"elf":"kid")}>
                  <div className="bubble">
                    <div className="small">{m.role==="santa"?"Santa": m.role==="elf"?"Elf":"You"}</div>
                    <div>{m.text}</div>
                  </div>
                </div>
              ))}
              {thinking && <div className="msg santa"><div className="bubble">Checking my list twice...</div></div>}
            </div>
            <div className="row" style={{marginTop:"10px"}}>
              <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Tell Santa what you wish for..." onKeyDown={e=>{if(e.key==="Enter") send()}}/>
              <button className="btn" onClick={send}>Send</button>
              <button className="btn secondary" onClick={makeLetterPDF} disabled={!wishlistHasItems}>Letter PDF</button>
              <button className="btn ghost" onClick={makeCertificatePDF}>Nice List</button>
            </div>

            <h3 style={{marginTop:"16px"}}>Wishlist</h3>
            <div className="wishlist">
              {Object.entries(wishlist).map(([k,vs])=>(
                <div key={k} className="category">
                  <h4>{k}</h4>
                  {vs.length? <ul>{vs.map((v,i)=><li key={i}>{v}</li>)}</ul> : <div className="small">Empty</div>}
                </div>
              ))}
            </div>

            <footer>
              <p>We keep things gentle and safe for kids. Personal details are not needed.</p>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
