let ctx;
let musicNodes = [];
let musicOn = false;

export function ensureAudio(){
  if(!ctx){
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return ctx;
}

export async function playKnock(){
  const ac = ensureAudio();
  const now = ac.currentTime;
  for(let i=0;i<2;i++){
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(180, now + i*0.25);
    g.gain.setValueAtTime(0.001, now + i*0.25);
    g.gain.exponentialRampToValueAtTime(0.2, now + i*0.25 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i*0.25 + 0.12);
    o.connect(g).connect(ac.destination);
    o.start(now + i*0.25);
    o.stop(now + i*0.25 + 0.13);
  }
}

export function startMusic(){
  const ac = ensureAudio();
  if(musicOn) return;
  musicOn = true;
  const master = ac.createGain();
  master.gain.value = 0.03;
  master.connect(ac.destination);

  const notes = [523.25,659.25,587.33,523.25,440.00,523.25];
  const tempo = 60;
  const beat = 60/tempo;

  function schedule(){
    const start = ac.currentTime + 0.05;
    for(let i=0;i<notes.length;i++){
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "triangle";
      o.frequency.value = notes[i];
      g.gain.value = 0.0001;
      g.gain.setValueAtTime(0.0001, start + i*beat);
      g.gain.exponentialRampToValueAtTime(0.18, start + i*beat + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + i*beat + 0.5);
      o.connect(g).connect(master);
      o.start(start + i*beat);
      o.stop(start + i*beat + 0.6);
      musicNodes.push(o,g);
    }
    if(musicOn){
      setTimeout(schedule, (notes.length*beat*1000)-400);
    }
  }
  schedule();
}

export function stopMusic(){
  musicOn = false;
  try{
    for(const n of musicNodes){
      if(n.stop) n.stop(0);
      if(n.disconnect) n.disconnect();
    }
  }catch{}
  musicNodes = [];
}
