// ============================================================
// স্মৃতির জঙ্গল — standalone 3D educational action game
// An astronaut wakes in a jungle, finds a child to protect, and
// fights memory-eating monsters with the power of right answers.
// Same Tuition Account, same server-checked battle API.
// Jungle props: Kenney Nature Kit (CC0).
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import * as MATCH from './match.js';

// ============================== DOM ==============================
const $ = id => document.getElementById(id);
const canvas = $('gl');
const el = {
  loading: $('screen-loading'), ldFill: $('ld-fill'), ldMsg: $('ld-msg'),
  title: $('screen-title'), login: $('screen-login'),
  tpName: $('tp-name'), tpLv: $('tp-lv'), tpXpTxt: $('tp-xp-txt'), tpXpFill: $('tp-xp-fill'),
  titlePlayer: $('title-player'),
  btnPlay: $('btn-play'), btnInstall: $('btn-install'), btnLogout: $('btn-logout'),
  liName: $('li-name'), liPass: $('li-pass'), liErr: $('li-err'), btnLogin: $('btn-login'), btnLoginBack: $('btn-login-back'),
  hud: $('hud'), hudName: $('hud-name'), hudLv: $('hud-lv'), hudHpFill: $('hud-hp-fill'), hudHpTxt: $('hud-hp-txt'),
  hudXpFill: $('hud-xp-fill'), hudCoins: $('hud-coins'), hudObjective: $('hud-objective'), hudHint: $('hud-hint'),
  btnPause: $('btn-pause'), hudMatch: $('btn-hud-match'),
  joy: $('joystick'), joyKnob: $('joystick-knob'),
  battleHud: $('battle-hud'), bhName: $('bh-player-name'), bhHpNum: $('bh-hp-num'), bHpFill: $('battle-hp-fill'),
  bCombo: $('battle-combo'), bMName: $('battle-monster-name'), bMNum: $('battle-mhp-num'), bMFill: $('battle-mhp-fill'),
  bTimer: $('battle-timer'), trFg: $('tr-fg'), bTimerNum: $('battle-timer-num'),
  qPanel: $('q-panel'), qText: $('q-text'), qAngel: $('q-angel'), qOpts: $('q-opts'),
  pause: $('screen-pause'), btnResume: $('btn-resume'), btnSound: $('btn-sound'), btnQuit: $('btn-quit'),
  victory: $('screen-victory'), vTitle: $('v-title'), vSub: $('v-sub'), vXp: $('v-xp'), vCoins: $('v-coins'),
  vAcc: $('v-acc'), vTotalXp: $('v-total-xp'), vLevel: $('v-level'), btnVCont: $('btn-v-continue'),
  defeat: $('screen-defeat'), dSub: $('d-sub'), dStat: $('d-stat'), btnDRetry: $('btn-d-retry'), btnDLeave: $('btn-d-leave'),
  toast: $('toast'), subtitle: $('subtitle'), fade: $('fade-black'),
  dmgFlash: $('damage-flash'), healFlash: $('heal-flash'), offline: $('offline-badge'),
  btnMatch: $('btn-match'), matchHud: $('match-hud'), mhAlive: $('mh-alive'), mhKills: $('mh-kills'),
  mhZone: $('mh-zone'), mhPause: $('mh-pause'), mhHpFill: $('mh-hp-fill'), mhHpNum: $('mh-hp-num'),
  mhInv: $('mh-inv'), mhPrompt: $('mh-prompt'), killFeed: $('kill-feed'), dropBtn: $('drop-btn'),
  mhFire: $('mh-fire'), mhWall: $('mh-wall'), mhBomb: $('mh-bomb'), mhCrouch: $('mh-crouch'),
  mhWallN: $('mh-wall-n'), mhBombN: $('mh-bomb-n'), mhMap: $('mh-map'),
  qHead: $('q-head'), qHeadTxt: $('q-head-txt'), qClose: $('q-close'), dStatLabel: $('d-stat-label'),
  btnReview: $('btn-hud-review'), reviewN: $('review-n'),
  btnShop: $('btn-shop'), shop: $('screen-shop'), shopWallet: $('shop-wallet'), shopTabs: $('shop-tabs'),
  shopGrid: $('shop-grid'), btnShopClose: $('btn-shop-close'),
  worlds: $('screen-worlds'), worldsGrid: $('worlds-grid'), btnWorldsClose: $('btn-worlds-close'),
};

function toast(msg, ms=2200){
  el.toast.textContent = msg; el.toast.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(()=> el.toast.classList.remove('show'), ms);
}
// in-world dialogue line (monster taunts, jungle whispers)
function subtitle(text, ms=3000){
  el.subtitle.textContent = text; el.subtitle.classList.add('show');
  clearTimeout(subtitle._t); subtitle._t = setTimeout(()=> el.subtitle.classList.remove('show'), ms);
}
function show(screen){ screen.classList.remove('hidden'); }
function hide(screen){ screen.classList.add('hidden'); }
function fadeBlack(on){ el.fade.classList.toggle('on', !!on); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function slugify(name){ return name.trim().toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g,'_').slice(0,40) || 'student'; }

// ============================== API ==============================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxY6ILwU6q3Sao7dgeabhpwijEDXL1n9ED04LEJdYUqGYgxXAPO4kz1mRWdbZxiPGF3/exec';
let offlineMode = false;

const API_TIMEOUT = 15000;
async function api(action, params={}, tries=2){
  for(let attempt = 1; attempt <= tries; attempt++){
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), API_TIMEOUT);
    try{
      const r = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...params }),
        signal: ac.signal
      });
      clearTimeout(timer);
      const text = await r.text();
      let json; try{ json = JSON.parse(text); }catch(e){ console.error(action, 'non-JSON', text.slice(0,200)); return null; }
      if(json.status !== 'success'){ console.warn(action, json.message); return json; }
      offlineMode = false; el.offline.classList.remove('show');
      return json;
    }catch(e){
      clearTimeout(timer);
      const timedOut = e && e.name === 'AbortError';
      console.warn(action, timedOut ? 'timeout' : 'network error', e);
      if(attempt < tries && timedOut) continue;
      offlineMode = true; el.offline.classList.add('show');
      return null;
    }
  }
  return null;
}
function getLoggedStudent(){
  try{ const raw = localStorage.getItem('tuition_logged_student'); return raw ? JSON.parse(raw) : null; }
  catch(e){ return null; }
}
function setLoggedStudent(s){ try{ localStorage.setItem('tuition_logged_student', JSON.stringify(s)); }catch(e){} }

// ============================== AUDIO ==============================
const AU = {
  ctx: null, master: null, sfxGain: null, musicGain: null,
  enabled: true, started: false,
  init(){
    if(this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain(); this.master.gain.value = this.enabled ? 1 : 0;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.35; this.musicGain.connect(this.master);
  },
  resume(){ if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setEnabled(on){
    this.enabled = on;
    if(this.master) this.master.gain.linearRampToValueAtTime(on ? 1 : 0, this.ctx.currentTime + 0.15);
  },
  noiseBuffer(dur=1){
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
    return buf;
  },
  env(g, t0, a, peak, d, sustain=0.0001){
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0+a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain,0.0001), t0+a+d);
  },
  tone({type='sine', f0=440, f1=null, dur=0.2, vol=0.3, attack=0.01, when=0}){
    if(!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if(f1) o.frequency.exponentialRampToValueAtTime(Math.max(1,f1), t0+dur);
    this.env(g, t0, attack, vol, dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t0); o.stop(t0+dur+0.1);
  },
  noise({dur=0.2, vol=0.3, fType='lowpass', f0=1000, f1=null, q=1, when=0, attack=0.005}){
    if(!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuffer(Math.min(dur+0.1, 2));
    const fl = this.ctx.createBiquadFilter(); fl.type = fType; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t0);
    if(f1) fl.frequency.exponentialRampToValueAtTime(Math.max(10,f1), t0+dur);
    const g = this.ctx.createGain();
    this.env(g, t0, attack, vol, dur);
    src.connect(fl); fl.connect(g); g.connect(this.sfxGain);
    src.start(t0); src.stop(t0+dur+0.1);
  },
  sfx(name){
    if(!this.ctx || !this.enabled) return;
    switch(name){
      case 'zap': this.tone({type:'sawtooth', f0:1400, f1:180, dur:0.28, vol:0.25});
                  this.noise({dur:0.18, vol:0.18, fType:'highpass', f0:2200}); break;
      case 'boom': this.noise({dur:0.5, vol:0.5, f0:900, f1:90});
                   this.tone({type:'sine', f0:160, f1:40, dur:0.45, vol:0.5}); break;
      case 'slam': this.noise({dur:0.3, vol:0.45, f0:500, f1:70});
                   this.tone({type:'square', f0:110, f1:45, dur:0.25, vol:0.3}); break;
      case 'roar': this.tone({type:'sawtooth', f0:95, f1:55, dur:0.9, vol:0.4, attack:0.08});
                   this.noise({dur:0.9, vol:0.28, f0:600, f1:150, q:2, attack:0.08}); break;
      case 'hurt': this.tone({type:'square', f0:320, f1:140, dur:0.18, vol:0.28}); break;
      case 'step': this.noise({dur:0.07, vol:0.07, f0:700, f1:250}); break;
      case 'coin': this.tone({type:'sine', f0:880, dur:0.09, vol:0.22});
                   this.tone({type:'sine', f0:1320, dur:0.14, vol:0.22, when:0.08}); break;
      case 'click': this.tone({type:'sine', f0:660, dur:0.05, vol:0.15}); break;
      case 'right': this.tone({type:'sine', f0:620, dur:0.1, vol:0.2});
                    this.tone({type:'sine', f0:930, dur:0.16, vol:0.2, when:0.09}); break;
      case 'wrong': this.tone({type:'sawtooth', f0:220, f1:120, dur:0.3, vol:0.22}); break;
      case 'victory': [523,659,784,1047].forEach((f,i)=> this.tone({type:'triangle', f0:f, dur:0.28, vol:0.25, when:i*0.13})); break;
      case 'defeat': [392,330,262,196].forEach((f,i)=> this.tone({type:'triangle', f0:f, dur:0.34, vol:0.25, when:i*0.17})); break;
      case 'gate': this.tone({type:'sine', f0:180, f1:720, dur:0.8, vol:0.2, attack:0.2}); break;
    }
  },
  startAmbient(){
    if(!this.ctx || this.started) return;
    this.started = true;
    // leaf rustle: looped filtered noise, slowly modulated
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuffer(4); src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1150; f.Q.value=0.5;
    const g = this.ctx.createGain(); g.gain.value = 0.045;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 420;
    lfo.connect(lfoG); lfoG.connect(f.frequency);
    src.connect(f); f.connect(g); g.connect(this.musicGain);
    src.start(); lfo.start();
    // soft warm pad underneath
    const d1 = this.ctx.createOscillator(); d1.type='sine'; d1.frequency.value = 82;
    const d2 = this.ctx.createOscillator(); d2.type='sine'; d2.frequency.value = 123.5;
    const dg = this.ctx.createGain(); dg.gain.value = 0.03;
    d1.connect(dg); d2.connect(dg); dg.connect(this.musicGain);
    d1.start(); d2.start();
    // jungle life: occasional bird call + crickets
    const chirp = () => {
      if(!this.enabled){ setTimeout(chirp, 2500); return; }
      const base = 1400 + Math.random()*1600;
      const n = 2 + Math.floor(Math.random()*3);
      for(let i=0;i<n;i++){
        this.tone({type:'sine', f0: base*(1+i*0.12), f1: base*(1.5+i*0.12), dur:0.08, vol:0.075, when:i*0.09});
      }
      setTimeout(chirp, 3500 + Math.random()*9000);
    };
    const crickets = () => {
      if(this.enabled){
        for(let i=0;i<4;i++) this.tone({type:'triangle', f0:4300, dur:0.03, vol:0.028, when:i*0.075});
      }
      setTimeout(crickets, 1800 + Math.random()*2600);
    };
    setTimeout(chirp, 2200); setTimeout(crickets, 1400);
  }
};

// ============================== STATE ==============================
const LEVEL_XP = 100;
const G = {
  mode: 'loading',            // loading | title | world | battle | paused
  student: null, progress: null, world: null, worlds: [],
  playerHp: 100, playerMaxHp: 100,
  keys: {}, joyVec: {x:0, y:0}, camYaw: Math.PI, camPitch: 0.32,
  monsters: [], battle: null,
  askedThisSession: [], correctThisSession: 0,
  shake: 0, hitStop: 0, time: 0,
  deferredInstall: null,
};

function levelFromXp(xp){ return Math.floor(xp / LEVEL_XP) + 1; }
function xpProgress(xp){ return { lvl: levelFromXp(xp), cur: xp % LEVEL_XP }; }
function bnNum(n){ return String(n).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]); }

// Each HSC subject earns its own currency, so a student cannot farm Physics
// and spend it on Chemistry — every subject has to be practised on its own.
const CURRENCIES = {
  physics:   { name:'পদার্থবিজ্ঞান', icon:'⚡', unit:'শক্তি-ক্রিস্টাল' },
  chemistry: { name:'রসায়ন',          icon:'🧪', unit:'রাসায়নিক মুদ্রা' },
  math:      { name:'গণিত',           icon:'📐', unit:'গণনা-টোকেন' },
  biology:   { name:'জীববিজ্ঞান',     icon:'🌿', unit:'জীবন-বীজ' },
  ict:       { name:'আইসিটি',         icon:'💾', unit:'ডেটা-চিপ' },
};
const SUBJECT_ALIASES = [
  ['physics',   /physics|পদার্থ|ভাবার্থ/i],
  ['chemistry', /chem|রসায়ন|রসায়ন|রসাযন/i],
  ['math',      /math|গণিত/i],
  ['biology',   /bio|জীব|জিব/i],
  ['ict',       /ict|আইসিটি|তথ্য/i],
];
function subjectKey(s){
  const v = String(s ?? '');
  for(const [key, re] of SUBJECT_ALIASES) if(re.test(v)) return key;
  return 'physics';
}
function currencyOf(key){ return CURRENCIES[key] || CURRENCIES.physics; }
function currentSubject(){ return subjectKey(G.world && G.world.subject); }

function defaultProgress(){
  const currencies = {};
  for(const k in CURRENCIES) currencies[k] = 0;
  return { gameXP:0, level:1, coins:0, currencies, unlockedWorlds:['physics'],
    chapterProgress:{}, bossProgress:{}, completedBattles:0,
    achievements:[], inventory:[], equippedItems:{}, lastPlayedAt:null };
}
function addCurrency(key, amount){
  const p = G.progress; if(!p || !amount) return;
  if(!p.currencies) p.currencies = {};
  const k = CURRENCIES[key] ? key : 'physics';
  p.currencies[k] = Math.max(0, Math.round((p.currencies[k] || 0) + amount));
}
function mergeProgress(base, inc){
  for(const k in inc){
    if(inc[k] === undefined || inc[k] === null) continue;
    if(typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k])) Object.assign(base[k], inc[k]);
    else base[k] = inc[k];
  }
  return base;
}

// ============================== দোকান ==============================
const SHOP_TABS = {
  physics:  'গান ও অস্ত্র',
  chemistry:'ক্যারেক্টার',
  biology:  'পেট সঙ্গী',
  ict:      'ড্রেস ও টেক-স্যুট',
  math:     'গ্যাজেট',
};
// একবার কিনলেই চিরকালের — slot প্রতি একটাই জিনিস পরে থাকবে
const SHOP_ITEMS = [
  { id:'gun_blaster', subject:'physics', slot:'gun', tier:1, icon:'🔫', name:'ব্লাস্টার পিস্তল', price:60,
    desc:'হালকা অস্ত্র। ম্যাচ শুরুতেই ব্লাস্টার হাতে নেমে যাবে।' },
  { id:'gun_rifle', subject:'physics', slot:'gun', tier:2, icon:'🔫', name:'রেপিড রাইফেল', price:160,
    desc:'দ্রুত গতি আর ভালো ক্ষতি — ম্যাচের শুরু থেকেই রাইফেল হাতে।' },
  { id:'gun_sniper', subject:'physics', slot:'gun', tier:3, icon:'🎯', name:'দূরপাল্লার স্নাইপার', price:320,
    desc:'সবচেয়ে শক্তিশালী অস্ত্র। দূর থেকে এক গুলিতেই বিপুল ক্ষতি।' },

  { id:'skin_ember', subject:'chemistry', slot:'skin', icon:'🔥', name:'অগ্নি-স্যুট', price:80,
    suit:0xd6452a, suitDark:0x7a2413,
    desc:'গলিত লাভার মতো জ্বলজ্বলে লাল পোশাক। মাঠে সবাই তোমাকে চিনে ফেলবে।' },
  { id:'skin_mint', subject:'chemistry', slot:'skin', icon:'💧', name:'জল-স্যুট', price:80,
    suit:0x2ec4a0, suitDark:0x14655a,
    desc:'গভীর জলের মতো শান্ত সবুজ-নীল পোশাক। জঙ্গলের রঙের সাথে মিশে যাবে।' },
  { id:'skin_gold', subject:'chemistry', slot:'skin', icon:'👑', name:'স্বর্ণ-স্যুট', price:200,
    suit:0xe8b53a, suitDark:0x8f6512,
    desc:'খাঁটি সোনার তৈরি রাজকীয় পোশাক। বিজয়ীর মতো দেখতে হবে, তাই না?' },

  { id:'pet_tuki', subject:'biology', slot:'pet', kind:0, icon:'🦜', name:'টুকি', price:100,
    desc:'সবুজ টিয়া। তোমার কাঁধের পাশে উড়ে বেড়াবে আর পথ দেখাবে।' },
  { id:'pet_bagha', subject:'biology', slot:'pet', kind:1, icon:'🐯', name:'বাঘছানা', price:240,
    desc:'ছোট্ট বাঘ। তোমার পিছু পিছু হাঁটবে আর লেজ নেড়ে সাহস জোগাবে।' },

  { id:'suit_vest', subject:'ict', slot:'suit', armor:true, bonus:0, icon:'🎽', name:'সুরক্ষা-ভেস্ট', price:120,
    desc:'হালকা বর্ম — ম্যাচে গায়ে বর্ম পরেই নামবে, ক্ষতি কিছুটা কম লাগবে।' },
  { id:'suit_heavy', subject:'ict', slot:'suit', armor:true, bonus:25, icon:'🛡️', name:'ভারী টেক-বর্ম', price:280,
    desc:'ভারী বর্ম — বর্মের সাথে বাড়তি ২৫ জীবন নিয়েও যুদ্ধে নামবে।' },

  { id:'gad_double', subject:'math', slot:'gadget', bombs:1, walls:1, icon:'💣', name:'দ্বিগুণ বোমা', price:90,
    desc:'ম্যাচ শুরুতেই এক বাড়তি বোমা আর এক বাড়তি গ্লু-প্রাচীর।' },
  { id:'gad_builder', subject:'math', slot:'gadget', bombs:0, walls:2, icon:'🧱', name:'নির্মাতার বাক্স', price:90,
    desc:'দুই বাড়তি গ্লু-প্রাচীর — আড়াল বানিয়ে শত্রুকে চমকে দাও।' },
  { id:'gad_master', subject:'math', slot:'gadget', bombs:2, walls:2, icon:'🧨', name:'গ্যাজেট-মাস্টার', price:260,
    desc:'দুই বাড়তি বোমা আর দুই বাড়তি প্রাচীর — পুরো মাঠ তোমার দখলে।' },
];
function ownedIds(){ return (G.progress && G.progress.inventory) || []; }
function isOwned(id){ return ownedIds().includes(id); }
function itemById(id){ return SHOP_ITEMS.find(i => i.id === id) || null; }
function equippedId(slot){
  const e = (G.progress && G.progress.equippedItems) || {};
  return e[slot] || null;
}
function equippedItem(slot){
  const id = equippedId(slot);
  return id ? itemById(id) : null;
}

// ============================== THREE SETUP ==============================
let renderer, scene, camera, clock, sunLight, hemi, skyMat;
const WORLD_R = 100;
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
// আড়ালের জায়গা (বড় ম্যাচে লুকানোর জন্য): ঝোপ + বড় পাথর
const CONCEAL_SPOTS = [];

function setLoad(pct, msg){
  el.ldFill.style.width = pct + '%';
  if(msg) el.ldMsg.textContent = msg;
}

// ---------- Kenney Nature Kit models (CC0, plain material colors) ----------
const MODELS = {};
const MODEL_FILES = ['tree_palmTall','tree_palmDetailedTall','tree_palmBend','tree_default','tree_tall','tree_fat',
  'plant_bushLarge','plant_bush','plant_flatTall','grass','grass_large','grass_leafsLarge',
  'rock_largeA','rock_largeC','rock_tallA','rock_smallA',
  'mushroom_redTall','mushroom_redGroup','log_large','log','flower_redA','flower_yellowA','lily_large','campfire_stones',
  'guns/blaster-l','guns/blaster-p','guns/blaster-f',
  'gear/backpack','gear/armor'];
async function loadModels(){
  const loader = new GLTFLoader();
  await Promise.all(MODEL_FILES.map(name => new Promise(resolve => {
    loader.load('./assets/' + name + '.glb', gltf => {
      gltf.scene.updateMatrixWorld(true);
      const parts = [];
      gltf.scene.traverse(o => { if(o.isMesh) parts.push({ geo: o.geometry, mat: o.material, mtx: o.matrixWorld.clone() }); });
      if(parts.length) MODELS[name] = parts;
      resolve();
    }, undefined, err => { console.warn('model failed:', name, err); resolve(); });
  })));
}
// one InstancedMesh per model part; per-instance matrix = placement × part local matrix
function scatterModel(name, count, place, opts={}){
  const parts = MODELS[name];
  if(!parts) return null;
  const m4 = new THREE.Matrix4(), pm = new THREE.Matrix4(), q = new THREE.Quaternion(),
        s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const spots = [];
  for(let i=0;i<count;i++) spots.push(place(i));
  const out = [];
  for(const part of parts){
    let mat = part.mat;
    if(opts.glow){
      mat = part.mat.clone();
      mat.emissive = new THREE.Color(opts.glow);
      mat.emissiveIntensity = opts.glowI || 0.9;
    }
    const im = new THREE.InstancedMesh(part.geo, mat, count);
    spots.forEach((spot, i) => {
      p.copy(spot.p); e.set(spot.rx||0, spot.ry||0, spot.rz||0); q.setFromEuler(e);
      s.setScalar(spot.s); if(spot.sy) s.y = spot.sy;
      m4.compose(p, q, s);
      pm.multiplyMatrices(m4, part.mtx);
      im.setMatrixAt(i, pm);
    });
    im.castShadow = opts.shadow !== false;
    im.receiveShadow = opts.receive !== false;
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
    out.push(im);
  }
  return out;
}
// single placed instance of a model (for camp props, arena stones)
function modelGroup(name, scale=1){
  const parts = MODELS[name]; if(!parts) return null;
  const g = new THREE.Group();
  for(const part of parts){
    const m = new THREE.Mesh(part.geo, part.mat);
    m.applyMatrix4(part.mtx);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  g.scale.setScalar(scale);
  return g;
}

// ---------- দোকানের আসল বন্দুকের ৩ডি মডেল (Kenney Blaster Kit, CC0) ----------
// tier 1-3: পিস্তল(নীল), রাইফেল(সবুজ), স্কোপ-স্নাইপার(বেগুনি) — গুলির রঙের সাথে মিলিয়ে বাছা
const GUN_TIER_MODELS = ['guns/blaster-l','guns/blaster-p','guns/blaster-f'];
const GUN_TIER_MOUNT = [   // হাতের ক্যাননে বসানোর মান (rig-পরীক্ষায় মিলিয়ে দেখা)
  { y:-0.70, z:0.02, tilt:0    },   // ১ — সাধারণ বন্দুক
  { y:-0.62, z:0.06, tilt:0.22 },   // ২ — উন্নত বন্দুক
  { y:-0.58, z:0.10, tilt:0.38 },   // ৩ — স্নাইপার রাইফেল
];
const _gunPartsC = {};   // tier → ক্লোন করা অংশ (সব বট একই মেটেরিয়াল ভাগ করে)
function gunTierParts(tier){
  if(_gunPartsC[tier]) return _gunPartsC[tier];
  const parts = MODELS[GUN_TIER_MODELS[tier-1]];
  if(!parts) return null;
  _gunPartsC[tier] = parts.map(p => {
    const mat = p.mat.clone();
    mat.roughness = 0.6; mat.metalness = 0.15;
    return { geo: p.geo, mat, mtx: p.mtx };
  });
  return _gunPartsC[tier];
}
// হাতে-ধরা বন্দুক: মডেলের মুখ (+Z) কোণ-মতো ঘুরিয়ে হাত বরাবর করা হয়; holder দিয়েই দেখা/লুকানো হয়
// opts.raw = true হলে মডেল সোজা অবস্থায়ই থাকে (মাটিতে শোয়া লুটের জন্য)
function buildGunModel(tier, scale=1, opts={}){
  const parts = gunTierParts(tier);
  if(!parts) return null;
  const inner = new THREE.Group();
  for(const p of parts){
    const m = new THREE.Mesh(p.geo, p.mat);
    m.applyMatrix4(p.mtx);
    m.castShadow = true; m.receiveShadow = true;
    inner.add(m);
  }
  const mt = GUN_TIER_MOUNT[tier-1];
  inner.rotation.x = opts.raw ? 0 : (Math.PI/2 + mt.tilt);
  inner.position.set(0, opts.raw ? 0 : mt.y, opts.raw ? 0 : mt.z);
  inner.scale.setScalar(scale);
  const holder = new THREE.Group();
  holder.add(inner);
  holder.visible = false;
  return holder;
}
// বটের হাতে বন্দুক: মডেলের মুখ এমনিই সামনে (+Z) — বটের সামনের দিকও +Z
function buildBotGun(tier, scale=1){
  const parts = gunTierParts(tier);
  if(!parts) return null;
  const holder = new THREE.Group();
  const inner = new THREE.Group();
  for(const p of parts){
    const m = new THREE.Mesh(p.geo, p.mat);
    m.applyMatrix4(p.mtx);
    m.castShadow = true; m.receiveShadow = true;
    inner.add(m);
  }
  inner.rotation.x = 0.08;   // হালকা নিচু করে ধরা
  inner.scale.setScalar(scale);
  holder.add(inner);
  holder.position.set(0.3, 1.15, 0.32);
  holder.visible = false;
  return holder;
}

// ---------- আসল গিয়ার মডেল (poly.pizza, CC0): পিঠের ব্যাকপ্যাক ও ভারী বর্ম ----------
// "Hiking Backpack" — Voxel_dev | "Armor Metal" — Quaternius (দুটোই CC0 1.0)
const GEAR_KEYS = { pack: 'gear/backpack', armor: 'gear/armor' };
const GEAR_HEIGHT = { pack: 0.6, armor: 0.62 };   // রিগ-পরীক্ষায় মিলিয়ে দেখা উচ্চতা
const _gearPartsC = {};
function gearParts(kind){
  if(kind in _gearPartsC) return _gearPartsC[kind];
  const parts = MODELS[GEAR_KEYS[kind]];
  if(!parts){ _gearPartsC[kind] = null; return null; }
  const box = new THREE.Box3(), tb = new THREE.Box3();
  for(const p of parts){
    if(!p.geo.boundingBox) p.geo.computeBoundingBox();
    tb.copy(p.geo.boundingBox).applyMatrix4(p.mtx);
    box.union(tb);
  }
  _gearPartsC[kind] = { parts, size: box.getSize(new THREE.Vector3()), ctr: box.getCenter(new THREE.Vector3()) };
  return _gearPartsC[kind];
}
// মডেলের কেন্দ্র মূলবিন্দুতে রেখে ঠিক উচ্চতায় ছোট-বড় করা হয় — এরপর যেখানে খুশি বসাও
function buildGearModel(kind, height){
  const gp = gearParts(kind);
  if(!gp) return null;
  const holder = new THREE.Group();
  const inner = new THREE.Group();
  for(const p of gp.parts){
    const m = new THREE.Mesh(p.geo, p.mat);
    m.applyMatrix4(p.mtx);
    m.castShadow = true; m.receiveShadow = true;
    inner.add(m);
  }
  const s = (height || GEAR_HEIGHT[kind]) / gp.size.y;
  inner.scale.setScalar(s);
  inner.position.set(-gp.ctr.x * s, -gp.ctr.y * s, -gp.ctr.z * s);
  holder.add(inner);
  return holder;
}
// সুরক্ষা-ভেস্ট: টর্সোর গায়ে বর্মের খোলস + বুক-প্লেট + পাউচ (নিজ হাতে গড়া, আলাদা ফাইল লাগে না)
function buildVestVisual(){
  const grp = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x4a5248, flatShading: true, roughness: 0.85 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x333a38, flatShading: true, roughness: 0.8 });
  const pouchMat = new THREE.MeshStandardMaterial({ color: 0x5d6552, flatShading: true, roughness: 0.9 });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.47, 0.56, 12), shellMat);
  shell.position.y = 1.12; shell.castShadow = true; grp.add(shell);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.1), plateMat);
  plate.position.set(0, 1.2, -0.42); plate.castShadow = true; grp.add(plate);
  for(const sx of [-1, 1]){
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.09), pouchMat);
    pouch.position.set(0.15 * sx, 1.0, -0.44); pouch.castShadow = true; grp.add(pouch);
  }
  return grp;
}

const P_GUNS = {};
function buildPlayerGuns(){
  for(let t = 1; t <= 3; t++){
    const g = buildGunModel(t);
    if(!g) continue;
    P.cannon.add(g); P_GUNS[t] = g;
  }
  updatePlayerGun();
}
function updatePlayerGun(){
  // ম্যাচ চললে মাঠের লুট-বন্দুক, নইলে দোকান থেকে পরা বন্দুক
  let tier = playerGunTier();
  if(MATCH.isActive() && MATCH.gunTier) tier = MATCH.gunTier();
  for(let t = 1; t <= 3; t++) if(P_GUNS[t]) P_GUNS[t].visible = (t === tier);
  if(P.cannonRing) P.cannonRing.visible = tier < 1;   // বন্দুক থাকলে হাতের আংটি লুকাও
}
function scatterSpot(seed, minPath, spread=310){
  let x = 0, z = 0, tries = 0;
  do{ x = (hash(seed+tries, 1)-0.5)*spread; z = (hash(seed+tries, 2)-0.5)*spread; tries++; }
  while(!awayFromPath(x, z, minPath) && tries < 40);
  return { x, z };
}

// ---------- noise ----------
function hash(x, z){ const n = Math.sin(x*127.1 + z*311.7) * 43758.5453; return n - Math.floor(n); }
function vnoise(x, z){
  const xi = Math.floor(x), zi = Math.floor(z), xf = x-xi, zf = z-zi;
  const u = xf*xf*(3-2*xf), v = zf*zf*(3-2*zf);
  const a = hash(xi,zi), b = hash(xi+1,zi), c = hash(xi,zi+1), d = hash(xi+1,zi+1);
  return a + (b-a)*u + (c-a)*v + (a-b-c+d)*u*v;
}
function fbm(x, z){ return vnoise(x,z)*0.6 + vnoise(x*2.1,z*2.1)*0.28 + vnoise(x*4.3,z*4.3)*0.12; }

// ---------- world layout ----------
const ARENA_R = 6.5;
function pathPoint(t){ // t: 0..1 along the valley path
  return new THREE.Vector3(Math.sin(t*2.2)*20, 0, 52 - t*118);
}
function arenaPos(i, n){
  const t = n === 1 ? 0.32 : 0.14 + (i/(n-1))*0.66;
  return pathPoint(t);
}
const gatePos = pathPoint(0.94);
const spawnPos = pathPoint(0.0).add(new THREE.Vector3(0,0,6));

function distToPath(x, z){
  let best = 1e9;
  for(let i=0;i<=48;i++){
    const p = pathPoint(i/48);
    const d = Math.hypot(p.x-x, p.z-z);
    if(d < best) best = d;
  }
  return best;
}

// ---------- terrain ----------
const RIVER_X = z => 36 + Math.sin(z*0.05)*7;
function riverD(x, z){ return Math.abs(x - RIVER_X(z)); }
function isWater(x, z, m=0){ return riverD(x, z) < 6.5 + m; }
function heightAt(x, z){
  const d = Math.hypot(x, z);
  let h = fbm(x*0.045, z*0.045) * 4.2 - 1.2;
  // valley rim: rises into the foothills, then caps
  const edge = Math.min(1, Math.max(0, d - 118) / 62);
  h += edge * edge * 26;
  // flatten near path & arenas
  const pd = distToPath(x, z);
  const flat = Math.min(1, Math.max(0, (pd - 4) / 14));
  h = h * (0.25 + 0.75*flat);
  if(G.world){
    for(const m of G.monsters){
      const md = Math.hypot(m.pos.x - x, m.pos.z - z);
      const mf = Math.min(1, Math.max(0, (md - ARENA_R) / 8));
      h = h * (0.15 + 0.85*mf) ;
    }
    const gd = Math.hypot(gatePos.x - x, gatePos.z - z);
    const gf = Math.min(1, Math.max(0, (gd - 9) / 9));
    h = h * (0.2 + 0.8*gf);
  }
  // carve the river bed last so it cuts through everything
  const rd = riverD(x, z);
  if(rd < 12){
    const w = Math.min(1, Math.max(0, (12 - rd) / 6));
    h = h*(1 - w) + (-0.85)*w;
  }
  return h;
}

function buildTerrain(){
  const size = 360, segs = 168;
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cFloor = new THREE.Color(0x24361c), cMoss = new THREE.Color(0x3f6b2e),
        cDirt = new THREE.Color(0x54452c), cPath = new THREE.Color(0x6a5a3c),
        cWet = new THREE.Color(0x1e3a33), cRock = new THREE.Color(0x4a5248),
        cFrost = new THREE.Color(0xb9c6ca);
  for(let i=0;i<pos.count;i++){
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const n = fbm(x*0.15+9, z*0.15+3);
    const c = cFloor.clone().lerp(cMoss, Math.min(1, Math.max(0, h/6 + n*0.35)));
    // damp green-blue tint along the river bed
    const rd = riverD(x, z);
    if(rd < 13) c.lerp(cWet, (1 - rd/13) * 0.55);
    const pd = distToPath(x, z);
    if(pd < 4.5) c.lerp(cPath, 0.62);
    if(pd > 5 && pd < 9 && n > 0.62) c.lerp(cDirt, 0.35);
    // high ground turns rocky, the rim catches frost
    if(h > 9) c.lerp(cRock, Math.min(1, (h - 9)/9) * 0.5);
    if(h > 16) c.lerp(cFrost, Math.min(1, (h - 16)/7) * 0.55);
    colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.96, metalness: 0.02 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// ---------- sky ----------
function buildSky(){
  const geo = new THREE.SphereGeometry(900, 24, 16);
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(0.02,0.09,0.11) },
      uMid: { value: new THREE.Color(0.10,0.25,0.22) },
      uHor: { value: new THREE.Color(0.72,0.60,0.34) },
      uSun: { value: new THREE.Color(1.00,0.86,0.55) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vP;
      uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uSun;
      void main(){
        float h = normalize(vP).y;
        vec3 c = mix(uHor, uMid, smoothstep(-0.02,0.22,h));
        c = mix(c, uTop, smoothstep(0.2,0.65,h));
        // sun glow toward -z
        vec3 d = normalize(vP);
        float sun = pow(max(0.0, dot(d, normalize(vec3(-0.35,0.16,-0.92)))), 18.0);
        c += uSun*sun*0.8;
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  scene.add(new THREE.Mesh(geo, skyMat));
}

// ---------- প্রতি বিষয়ের জগতের নিজস্ব পরিবেশ ----------
// একই জঙ্গল, কিন্তু বিষয় বদলালে আলো-কুয়াশা-আকাশের রং বদলে আলাদা জগৎ মনে হয়
const WORLD_MOODS = {
  physics:  { fog:0x0e1a16, hemiSky:0x3a5a40, hemiGround:0x141c10, sun:0xffd9a0,
              skyTop:[0.02,0.09,0.11], skyMid:[0.10,0.25,0.22], skyHor:[0.72,0.60,0.34], skySun:[1.00,0.86,0.55] },
  chemistry:{ fog:0x1a0d0d, hemiSky:0x5a3230, hemiGround:0x180d0a, sun:0xffb072,
              skyTop:[0.09,0.03,0.05], skyMid:[0.28,0.10,0.10], skyHor:[0.78,0.42,0.26], skySun:[1.00,0.60,0.35] },
  math:     { fog:0x0d1220, hemiSky:0x38466a, hemiGround:0x10141c, sun:0xcfe0ff,
              skyTop:[0.02,0.05,0.12], skyMid:[0.10,0.18,0.34], skyHor:[0.55,0.62,0.80], skySun:[0.82,0.90,1.00] },
  biology:  { fog:0x0c1a10, hemiSky:0x2f6a3c, hemiGround:0x0c1a0c, sun:0xd8ffc0,
              skyTop:[0.02,0.08,0.05], skyMid:[0.08,0.28,0.14], skyHor:[0.50,0.72,0.36], skySun:[0.90,1.00,0.70] },
  ict:      { fog:0x120c1c, hemiSky:0x4a3a6a, hemiGround:0x120e18, sun:0xd8c4ff,
              skyTop:[0.06,0.03,0.12], skyMid:[0.20,0.10,0.34], skyHor:[0.62,0.44,0.82], skySun:[0.85,0.75,1.00] },
};
function applyWorldMood(){
  if(!scene || !sunLight || !hemi) return;
  const m = WORLD_MOODS[currentSubject()] || WORLD_MOODS.physics;
  if(scene.fog) scene.fog.color.setHex(m.fog);
  hemi.color.setHex(m.hemiSky); hemi.groundColor.setHex(m.hemiGround);
  sunLight.color.setHex(m.sun);
  if(skyMat){
    skyMat.uniforms.uTop.value.setRGB(m.skyTop[0], m.skyTop[1], m.skyTop[2]);
    skyMat.uniforms.uMid.value.setRGB(m.skyMid[0], m.skyMid[1], m.skyMid[2]);
    skyMat.uniforms.uHor.value.setRGB(m.skyHor[0], m.skyHor[1], m.skyHor[2]);
    skyMat.uniforms.uSun.value.setRGB(m.skySun[0], m.skySun[1], m.skySun[2]);
  }
}

// ---------- river ----------
const waterMats = [];
function buildRiver(){
  const geo = new THREE.CircleGeometry(1, 20);
  for(let i=0;i<28;i++){
    const z = 92 - i*7.0;
    const x = RIVER_X(z) + (hash(i,7)-0.5)*3.4;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0d3138, emissive: 0x1d7a7a, emissiveIntensity: 0.35,
      roughness: 0.22, metalness: 0.25, transparent: true, opacity: 0.9
    });
    waterMats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI/2;
    m.position.set(x, 0.05, z);
    m.scale.setScalar(4.6 + hash(i,3)*2.6);
    m.receiveShadow = true;
    scene.add(m);
  }
  const l1 = new THREE.PointLight(0x2e8a7a, 24, 46, 2); l1.position.set(RIVER_X(22), 3, 22); scene.add(l1);
  const l2 = new THREE.PointLight(0x2e8a7a, 20, 42, 2); l2.position.set(RIVER_X(-44), 3, -44); scene.add(l2);
}

// ---------- mountains & far haze ----------
function buildMountains(){
  const cone = new THREE.ConeGeometry(1, 1, 8);
  const hazeT = new THREE.Color(0x14212a);
  const layers = [
    { n: 26, r0: 152, r1: 198, h0: 26, h1: 52, rad0: 22, rad1: 44, col: 0x22352a, mix: 0.34, snow: 0   },
    { n: 20, r0: 205, r1: 258, h0: 50, h1: 90, rad0: 34, rad1: 62, col: 0x2a3d44, mix: 0.52, snow: 0.42 },
    { n: 12, r0: 268, r1: 335, h0: 92, h1: 152, rad0: 52, rad1: 88, col: 0x35485a, mix: 0.62, snow: 0.38 }
  ];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(),
        sc = new THREE.Vector3(), e = new THREE.Euler();
  let seed = 5;
  for(const L of layers){
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(L.col).lerp(hazeT, L.mix),
      flatShading: true, roughness: 0.95, metalness: 0.02, fog: false
    });
    const im = new THREE.InstancedMesh(cone, mat, L.n);
    im.castShadow = false; im.receiveShadow = false;
    let sm = null;
    if(L.snow){
      const sMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xd7e4ea).lerp(hazeT, L.mix*0.5),
        flatShading: true, roughness: 0.85, fog: false
      });
      sm = new THREE.InstancedMesh(cone, sMat, L.n);
      sm.castShadow = false; sm.receiveShadow = false;
    }
    for(let i=0;i<L.n;i++){
      seed += 7;
      const a = hash(seed, 1) * Math.PI * 2;
      const rr = L.r0 + hash(seed, 2) * (L.r1 - L.r0);
      const h = L.h0 + hash(seed, 3) * (L.h1 - L.h0);
      const rad = L.rad0 + hash(seed, 4) * (L.rad1 - L.rad0);
      const x = Math.cos(a)*rr, z = Math.sin(a)*rr;
      const baseY = 6 + hash(seed, 5) * 5;
      e.set(0, hash(seed, 6)*6.28, 0); q.setFromEuler(e);
      p.set(x, baseY + h/2, z); sc.set(rad, h, rad);
      m4.compose(p, q, sc);
      im.setMatrixAt(i, m4);
      if(sm){
        p.set(x, baseY + h - h*L.snow/2, z);
        sc.set(rad*L.snow, h*L.snow, rad*L.snow);
        m4.compose(p, q, sc);
        sm.setMatrixAt(i, m4);
      }
    }
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
    if(sm){ sm.instanceMatrix.needsUpdate = true; scene.add(sm); }
  }
  // haze floor beyond the valley rim — the horizon never shows a void
  const ring = new THREE.Mesh(new THREE.RingGeometry(170, 650, 48),
    new THREE.MeshBasicMaterial({ color: 0x101d18, fog: false }));
  ring.rotation.x = -Math.PI/2;
  ring.position.y = 6.5;
  scene.add(ring);
}

// ---------- vegetation & rocks (instanced) ----------
function scatterInstanced(geo, mat, count, place){
  const im = new THREE.InstancedMesh(geo, mat, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const e = new THREE.Euler();
  for(let i=0;i<count;i++){
    const spot = place(i);
    p.copy(spot.p); e.set(spot.rx||0, spot.ry||0, spot.rz||0); q.setFromEuler(e);
    s.setScalar(spot.s); if(spot.sy) s.y = spot.sy;
    m4.compose(p, q, s);
    im.setMatrixAt(i, m4);
  }
  im.castShadow = true; im.receiveShadow = true;
  im.instanceMatrix.needsUpdate = true;
  scene.add(im);
  return im;
}
function awayFromPath(x, z, min){ return distToPath(x,z) > min && Math.hypot(x,z) < 158 && riverD(x,z) > 7.5 && Math.hypot(x-spawnPos.x, z-spawnPos.z) > 8; }
function buildVegetation(){
  if(!MODELS['tree_palmTall']){ buildVegetationLegacy(); return; }
  const ground = (x, z, dy=0) => new THREE.Vector3(x, heightAt(x,z)+dy, z);

  // palms
  const palms = [['tree_palmTall',34],['tree_palmDetailedTall',22],['tree_palmBend',20]];
  palms.forEach(([name, count], pi) => scatterModel(name, count, i => {
    const { x, z } = scatterSpot(i*7 + pi*300, 6.5);
    return { p: ground(x, z, -0.06), s: 0.85 + hash(x,z)*0.75, ry: hash(z,x)*6.28, rz: (hash(x,z*2)-0.5)*0.14 };
  }));

  // broadleaf canopy trees
  const trees = [['tree_default',40],['tree_tall',26],['tree_fat',20]];
  trees.forEach(([name, count], ti) => scatterModel(name, count, i => {
    const { x, z } = scatterSpot(i*13 + ti*500, 7);
    return { p: ground(x, z, -0.06), s: 0.8 + hash(x*2,z)*0.8, ry: hash(z,x*3)*6.28 };
  }));

  // underbrush
  const bushes = [['plant_bushLarge',40],['plant_bush',32],['plant_flatTall',22]];
  bushes.forEach(([name, count], bi) => scatterModel(name, count, i => {
    const { x, z } = scatterSpot(i*17 + bi*700, 3.2);
    CONCEAL_SPOTS.push({ x, z });
    return { p: ground(x, z, -0.04), s: 0.8 + hash(i,bi)*0.9, ry: hash(i,bi*2)*6.28 };
  }));

  // grass tufts — no shadows, cheap fill
  const grasses = [['grass',80],['grass_large',64],['grass_leafsLarge',48]];
  grasses.forEach(([name, count], gi) => scatterModel(name, count, i => {
    const { x, z } = scatterSpot(i*23 + gi*900, 2.6, 250);
    return { p: ground(x, z), s: 0.9 + hash(i,gi*3)*0.9, ry: hash(i,gi*5)*6.28 };
  }, { shadow: false, receive: false }));

  // rocks
  const rocks = [['rock_largeA',22],['rock_largeC',18],['rock_tallA',14],['rock_smallA',16]];
  rocks.forEach(([name, count], ri) => scatterModel(name, count, i => {
    const { x, z } = scatterSpot(i*29 + ri*1100, 4);
    if(name !== 'rock_smallA') CONCEAL_SPOTS.push({ x, z });
    return { p: ground(x, z, -0.05), s: 0.5 + hash(i,ri)*1.1, sy: 0.6 + hash(i,ri*2)*0.8, ry: hash(i,ri*4)*6.28 };
  }));

  // magic mushrooms (amber glow = the jungle's memory lights)
  scatterModel('mushroom_redTall', 26, i => {
    const { x, z } = scatterSpot(i*31 + 1300, 5);
    return { p: ground(x, z, -0.03), s: 0.9 + hash(i,9)*1.2, ry: hash(i,11)*6.28 };
  }, { glow: 0xffa42e, glowI: 0.85 });
  scatterModel('mushroom_redGroup', 16, i => {
    const { x, z } = scatterSpot(i*37 + 1500, 6);
    return { p: ground(x, z, -0.03), s: 0.9 + hash(i,9)*1.0, ry: hash(i,12)*6.28 };
  }, { glow: 0xffa42e, glowI: 0.7 });

  // flowers & fallen logs
  scatterModel('flower_redA', 24, i => {
    const { x, z } = scatterSpot(i*41 + 1700, 3, 280);
    return { p: ground(x, z, -0.02), s: 0.9 + hash(i,13)*0.8, ry: hash(i,14)*6.28 };
  }, { shadow: false });
  scatterModel('flower_yellowA', 20, i => {
    const { x, z } = scatterSpot(i*43 + 1900, 3, 280);
    return { p: ground(x, z, -0.02), s: 0.9 + hash(i,15)*0.8, ry: hash(i,16)*6.28 };
  }, { shadow: false });
  scatterModel('log', 10, i => {
    const { x, z } = scatterSpot(i*47 + 2100, 6);
    return { p: ground(x, z, -0.03), s: 0.9 + hash(i,17)*0.6, ry: hash(i,18)*6.28 };
  });
  scatterModel('log_large', 7, i => {
    const { x, z } = scatterSpot(i*53 + 2300, 7);
    return { p: ground(x, z, -0.03), s: 0.8 + hash(i,19)*0.6, ry: hash(i,20)*6.28 };
  });

  // lily pads on the river
  scatterModel('lily_large', 26, i => {
    const z = 90 - i*7.0;
    const x = RIVER_X(z) + (hash(i,21)-0.5)*7;
    return { p: new THREE.Vector3(x, 0.12, z), s: 0.9 + hash(i,22)*0.9, ry: hash(i,23)*6.28 };
  });
}

// fallback if the model pack didn't load
function buildVegetationLegacy(){
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2e2a1c, flatShading: true, roughness: 1 });
  const branchMat = new THREE.MeshStandardMaterial({ color: 0x2f5a26, flatShading: true, roughness: 1 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x3d4a3a, flatShading: true, roughness: 0.95 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x123a3a, emissive: 0xffa42e, emissiveIntensity: 0.7, flatShading: true, roughness: 0.4 });
  scatterInstanced(new THREE.CylinderGeometry(0.14, 0.3, 2.6, 5), trunkMat, 90, () => {
    const { x, z } = scatterSpot(1, 6);
    return { p: new THREE.Vector3(x, heightAt(x,z)+1.1, z), s: 0.8+hash(x,z)*0.9, ry: hash(z,x)*6.28, rz: (hash(x,z*2)-0.5)*0.2 };
  });
  scatterInstanced(new THREE.ConeGeometry(1.0, 1.9, 5), branchMat, 90, (i) => {
    const x = (hash(i, 11)-0.5)*176, z = (hash(i, 12)-0.5)*176;
    return { p: new THREE.Vector3(x, heightAt(x,z)+2.5+hash(i,5)*0.8, z), s: 0.7+hash(i,6)*0.8, ry: hash(i,7)*6.28 };
  });
  scatterInstanced(new THREE.DodecahedronGeometry(1, 0), rockMat, 110, (i) => {
    const x = (hash(i, 21)-0.5)*186, z = (hash(i, 22)-0.5)*186;
    return { p: new THREE.Vector3(x, heightAt(x,z)+0.15, z), s: 0.35+hash(i,23)*1.5, sy: 0.3+hash(i,24)*0.9, ry: hash(i,25)*6.28 };
  });
  scatterInstanced(new THREE.OctahedronGeometry(0.7, 0), glowMat, 40, (i) => {
    const { x, z } = scatterSpot(i*5 + 30, 4.5, 170);
    return { p: new THREE.Vector3(x, heightAt(x,z)+0.5, z), s: 0.5+hash(i,33)*1.1, sy: 1.2+hash(i,34)*1.6, ry: hash(i,35)*6.28 };
  });
}

// ---------- fireflies ----------
let motes, moteVel;
function buildFireflies(){
  const N = 260;
  const posArr = new Float32Array(N*3);
  moteVel = new Float32Array(N);
  for(let i=0;i<N;i++){
    posArr[i*3] = (Math.random()-0.5)*210;
    posArr[i*3+1] = 0.4 + Math.random()*9.2;
    posArr[i*3+2] = (Math.random()-0.5)*230;
    moteVel[i] = 0.15 + Math.random()*0.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xd9ffa8, size: 0.12, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  });
  motes = new THREE.Points(geo, mat);
  scene.add(motes);
}
function updateFireflies(dt){
  const a = motes.geometry.attributes.position;
  for(let i=0;i<a.count;i++){
    let y = a.getY(i) + moteVel[i]*dt*0.6;
    if(y > 10) y = 0.4;
    a.setY(i, y);
    a.setX(i, a.getX(i) + Math.sin(G.time*0.9 + i)*0.6*dt);
    a.setZ(i, a.getZ(i) + Math.cos(G.time*0.7 + i*1.3)*0.6*dt);
  }
  a.needsUpdate = true;
}

// ---------- arenas & gate ----------
function buildArenaDecor(pos, defeated){
  const grp = new THREE.Group();
  const platMat = new THREE.MeshStandardMaterial({ color: 0x2c3a26, flatShading: true, roughness: 0.9 });
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R, ARENA_R+0.7, 0.55, 18), platMat);
  plat.position.y = 0.12; plat.receiveShadow = true;
  grp.add(plat);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x101418, emissive: defeated ? 0x1a5a50 : 0x2ee6c8, emissiveIntensity: defeated ? 0.35 : 0.9, roughness: 0.5
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ARENA_R-0.35, 0.09, 8, 40), ringMat);
  ring.rotation.x = Math.PI/2; ring.position.y = 0.45;
  grp.add(ring);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3d4a34, flatShading: true, roughness: 0.95 });
  for(let i=0;i<5;i++){
    const a = (i/5)*Math.PI*2;
    let st;
    const rockM = MODELS['rock_tallA'] ? modelGroup('rock_tallA', 1.4 + hash(i,pos.x)*0.5) : null;
    if(rockM) st = rockM;
    else {
      st = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4+hash(i,pos.x)*1.2, 0.9), stoneMat);
      st.castShadow = true;
    }
    st.position.set(Math.cos(a)*(ARENA_R+1.6), 1.4, Math.sin(a)*(ARENA_R+1.6));
    st.rotation.y = a; st.rotation.z = (hash(i,pos.z)-0.5)*0.14;
    grp.add(st);
  }
  if(defeated){
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0),
      new THREE.MeshStandardMaterial({ color: 0x0f2f2c, emissive: 0x2ee6c8, emissiveIntensity: 1.1, flatShading: true }));
    orb.position.y = 2.2;
    grp.add(orb);
    grp.userData.orb = orb;
  }
  grp.position.copy(pos);
  scene.add(grp);
  return grp;
}

let gateGroup, gateBarrier, gateLight;
function buildGate(locked){
  gateGroup = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x3b4a30, flatShading: true, roughness: 0.92 });
  const pil1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 8.5, 1.6), stoneMat);
  pil1.position.set(-3.4, 4.2, 0); pil1.castShadow = true;
  const pil2 = pil1.clone(); pil2.position.x = 3.4;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(9.4, 1.5, 1.9), stoneMat);
  lintel.position.y = 8.6; lintel.castShadow = true;
  gateGroup.add(pil1, pil2, lintel);
  const portalMat = new THREE.MeshBasicMaterial({ color: locked ? 0xff5030 : 0x35f0d2, transparent: true, opacity: locked ? 0.16 : 0.34, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  gateBarrier = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 7.4), portalMat);
  gateBarrier.position.y = 4.1;
  gateGroup.add(gateBarrier);
  gateLight = new THREE.PointLight(locked ? 0xff5030 : 0x35f0d2, 30, 26, 2);
  gateLight.position.y = 4.5;
  gateGroup.add(gateLight);
  gateGroup.position.copy(gatePos);
  gateGroup.lookAt(spawnPos.x, 0, spawnPos.z);
  scene.add(gateGroup);
}
function setGateLocked(locked){
  if(!gateBarrier) return;
  gateBarrier.material.color.set(locked ? 0xff5030 : 0x35f0d2);
  gateBarrier.material.opacity = locked ? 0.16 : 0.34;
  gateLight.color.set(locked ? 0xff5030 : 0x35f0d2);
}

// ============================== PLAYER ==============================
const P = { grp: null, body: null, legL: null, legR: null, armL: null, cannon: null, visor: null,
  suitMat: null, suitDMat: null, vest: null, armorV: null,
  baseSuitColor: 0xe8edf2, baseSuitDarkColor: 0xc44e1e,
  vel: new THREE.Vector3(), facing: 0, walkPhase: 0, speed: 5.6, regenT: 0 };

function buildPlayer(){
  const grp = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0xe8edf2, flatShading: true, roughness: 0.55, metalness: 0.08 });
  const suitD = new THREE.MeshStandardMaterial({ color: 0xc44e1e, flatShading: true, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22282e, flatShading: true, roughness: 0.8 });
  P.suitMat = suit; P.suitDMat = suitD;   // দোকানের স্কিন এদের রঙ বদলায়

  const body = new THREE.Group(); grp.add(body);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.5, 4, 8), suit);
  torso.position.y = 1.15; torso.castShadow = true; body.add(torso);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.16, 8), suitD);
  belt.position.y = 0.86; body.add(belt);
  const pack = buildGearModel('pack', GEAR_HEIGHT.pack);
  if(pack){ pack.position.set(0, 1.26, 0.44); pack.rotation.y = Math.PI; body.add(pack); }
  else {
    const packBox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.34), dark);
    packBox.position.set(0, 1.3, 0.42); packBox.castShadow = true; body.add(packBox);
  }

  // দোকানের পোশাক: সুরক্ষা-ভেস্ট (নিজ হাতে গড়া) ও ভারী টেক-বর্ম (আসল মডেল) — কিনলে পরে গায়ে দেখা যাবে
  P.vest = buildVestVisual(); P.vest.visible = false; body.add(P.vest);
  const armorV = buildGearModel('armor', GEAR_HEIGHT.armor);
  if(armorV){ armorV.position.set(0, 1.22, -0.32); armorV.rotation.y = Math.PI; armorV.visible = false; body.add(armorV); }
  P.armorV = armorV;

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), suit);
  helmet.position.y = 1.98; helmet.castShadow = true; body.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x0d3038, emissive: 0x35f0d2, emissiveIntensity: 0.85, flatShading: true, roughness: 0.2, metalness: 0.6 }));
  visor.position.set(0, 1.98, -0.14); visor.scale.set(1, 0.82, 0.72); body.add(visor);
  P.visor = visor;

  const legGeo = new THREE.CapsuleGeometry(0.15, 0.5, 3, 6);
  P.legL = new THREE.Group(); P.legL.position.set(-0.2, 0.82, 0);
  const ll = new THREE.Mesh(legGeo, suitD); ll.position.y = -0.42; ll.castShadow = true; P.legL.add(ll);
  P.legR = new THREE.Group(); P.legR.position.set(0.2, 0.82, 0);
  const lr = new THREE.Mesh(legGeo, suitD); lr.position.y = -0.42; lr.castShadow = true; P.legR.add(lr);
  body.add(P.legL, P.legR);

  P.armL = new THREE.Group(); P.armL.position.set(-0.52, 1.5, 0);
  const al = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.44, 3, 6), suit);
  al.position.y = -0.32; al.castShadow = true; P.armL.add(al);
  body.add(P.armL);

  P.cannon = new THREE.Group(); P.cannon.position.set(0.52, 1.5, 0);
  const cannonBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.62, 8), dark);
  cannonBody.position.y = -0.42; cannonBody.castShadow = true;
  const cannonRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x0d3038, emissive: 0xff8a3c, emissiveIntensity: 1.4, roughness: 0.3 }));
  cannonRing.rotation.x = Math.PI/2; cannonRing.position.y = -0.68;
  P.cannonBody = cannonBody; P.cannonRing = cannonRing;
  P.cannon.add(cannonBody, cannonRing);
  body.add(P.cannon);

  grp.position.copy(spawnPos);
  grp.position.y = heightAt(spawnPos.x, spawnPos.z);
  scene.add(grp);
  P.grp = grp; P.body = body;
}

function animatePlayer(dt, moving){
  P.walkPhase += dt * (moving ? 9 : 2.2);
  const sw = moving ? 0.62 : 0.04;
  P.legL.rotation.x = Math.sin(P.walkPhase) * sw;
  P.legR.rotation.x = -Math.sin(P.walkPhase) * sw;
  P.armL.rotation.x = -Math.sin(P.walkPhase) * sw * 0.7;
  P.body.position.y = moving ? Math.abs(Math.sin(P.walkPhase)) * 0.09 : Math.sin(P.walkPhase*0.5) * 0.025;
  P.body.rotation.x = moving ? 0.08 : 0;
}

// ---------- পেট সঙ্গী (দোকান থেকে কেনা প্রাণী, শুধু জগৎ-যুদ্ধে পাশে চলে) ----------
const PET = { grp: null, kind: -1, body: null, wingL: null, wingR: null, tail: null, t: 0 };

function buildPet(kind){
  const grp = new THREE.Group();
  if(kind === 0){
    // টুকি — ছোট টিয়া
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x39b26b, flatShading: true, roughness: 0.6 });
    const bellyMat = new THREE.MeshStandardMaterial({ color: 0xf0d24a, flatShading: true, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), bodyMat);
    body.scale.set(1, 1.15, 1.3); grp.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 7), bellyMat);
    belly.position.set(0, -0.04, 0.09); grp.add(belly);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), bodyMat);
    head.position.set(0, 0.22, 0.06); grp.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 6),
      new THREE.MeshStandardMaterial({ color: 0xf2913c, flatShading: true }));
    beak.rotation.x = Math.PI/2; beak.position.set(0, 0.22, 0.2); grp.add(beak);
    PET.wingL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.26), bodyMat);
    PET.wingL.position.set(-0.2, 0.03, 0);
    PET.wingR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.26), bodyMat);
    PET.wingR.position.set(0.2, 0.03, 0);
    grp.add(PET.wingL, PET.wingR);
    PET.tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xd8452e, flatShading: true }));
    PET.tail.position.set(0, -0.03, -0.32); grp.add(PET.tail);
    PET.body = grp;
  } else {
    // বাঘছানা — ছোট হলদে-কালো প্রাণী
    const furMat = new THREE.MeshStandardMaterial({ color: 0xe8a13a, flatShading: true, roughness: 0.75 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x35291c, flatShading: true, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.34, 4, 8), furMat);
    body.rotation.x = Math.PI/2; body.position.y = 0.28; grp.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), furMat);
    head.position.set(0, 0.42, 0.26); grp.add(head);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), darkMat);
    snout.position.set(0, 0.38, 0.39); grp.add(snout);
    const earGeo = new THREE.ConeGeometry(0.06, 0.12, 4);
    const earL = new THREE.Mesh(earGeo, furMat); earL.position.set(-0.1, 0.55, 0.24); grp.add(earL);
    const earR = new THREE.Mesh(earGeo, furMat); earR.position.set(0.1, 0.55, 0.24); grp.add(earR);
    const legGeo = new THREE.CapsuleGeometry(0.05, 0.16, 3, 6);
    [[-0.11,0.16],[0.11,0.16],[-0.11,-0.14],[0.11,-0.14]].forEach(([x,z]) => {
      const leg = new THREE.Mesh(legGeo, darkMat); leg.position.set(x, 0.13, z); grp.add(leg);
    });
    PET.tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.3, 3, 6), furMat);
    PET.tail.rotation.x = Math.PI/2.6; PET.tail.position.set(0, 0.38, -0.32); grp.add(PET.tail);
    PET.body = grp;
  }
  grp.traverse(o => { if(o.isMesh) o.castShadow = true; });
  PET.wingL = PET.wingL || null; PET.wingR = PET.wingR || null;
  scene.add(grp);
  PET.grp = grp; PET.kind = kind; PET.t = 0;
  return grp;
}

function refreshPet(){
  const pe = equippedItem('pet');
  const wantKind = pe ? pe.kind : -1;
  if(wantKind === PET.kind) return;
  if(PET.grp){ scene.remove(PET.grp); PET.grp = null; PET.body = null; PET.wingL = PET.wingR = PET.tail = null; }
  PET.kind = -1;
  if(wantKind >= 0) buildPet(wantKind);
}

function updatePet(dt){
  if(!PET.grp || !P.grp) return;
  PET.grp.visible = !G.mode.startsWith('match');
  if(!PET.grp.visible) return;
  PET.t += dt;
  const back = new THREE.Vector3(Math.sin(P.facing), 0, Math.cos(P.facing));
  const side = new THREE.Vector3(back.z, 0, -back.x);
  if(PET.kind === 0){
    // উড়ন্ত টিয়া — কাঁধের পাশে ভেসে থাকে
    const target = tmpV.copy(P.grp.position)
      .add(side).multiplyScalar(0);
    target.copy(P.grp.position).addScaledVector(side, 0.85).addScaledVector(back, -0.15);
    target.y += 2.1 + Math.sin(PET.t * 3.1) * 0.16;
    PET.grp.position.lerp(target, Math.min(1, dt * 5));
    PET.grp.rotation.y = Math.atan2(P.grp.position.x - PET.grp.position.x, P.grp.position.z - PET.grp.position.z);
    const flap = Math.sin(PET.t * 13) * 0.85;
    if(PET.wingL) PET.wingL.rotation.z = -flap;
    if(PET.wingR) PET.wingR.rotation.z = flap;
    if(PET.tail) PET.tail.rotation.x = Math.sin(PET.t * 4) * 0.25;
  } else {
    // হাঁটা বাঘছানা — পিছনে পিছনে
    const target = tmpV.copy(P.grp.position).addScaledVector(back, 1.5).addScaledVector(side, -0.5);
    target.y = heightAt(target.x, target.z);
    PET.grp.position.lerp(target, Math.min(1, dt * 4));
    PET.grp.rotation.y = Math.atan2(P.grp.position.x - PET.grp.position.x, P.grp.position.z - PET.grp.position.z);
    if(PET.tail) PET.tail.rotation.z = Math.sin(PET.t * 6) * 0.5;
  }
}

// ============================== CHILD NPC (the one you protect) ==============================
const CHILD_SCALES = [0.72, 0.85, 1.0, 1.18];
const childCamp = pathPoint(0.045).add(new THREE.Vector3(-5.5, 0, 4));
const CH = { grp: null, body: null, head: null, armL: null, armR: null, legL: null, legR: null,
  satchel: null, fire: null, fireLight: null, t: 0, stage: -1, greeted: false, cheerT: 0, baseY: 0, walkPhase: 0 };

function childStage(){
  const chapters = (G.world && G.world.chapters) || [];
  const total = Math.max(1, chapters.length);
  const done = chapters.filter(c => c.defeated).length;
  const bossDone = !!(G.world && G.world.bossUnlocked && G.progress &&
    G.progress.bossProgress && Object.keys(G.progress.bossProgress).length);
  if(bossDone) return 3;
  if(done >= total) return 2;
  if(done > 0) return 1;
  return 0;
}

function buildChild(){
  const grp = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98f5e, flatShading: true, roughness: 0.75 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0xcf7a3a, flatShading: true, roughness: 0.85 });
  const clothD = new THREE.MeshStandardMaterial({ color: 0x8a4d24, flatShading: true, roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x2a1d14, flatShading: true, roughness: 0.9 });
  const bagMat = new THREE.MeshStandardMaterial({ color: 0x6b5330, flatShading: true, roughness: 0.95 });

  const body = new THREE.Group(); grp.add(body); CH.body = body;

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.3, 4, 8), cloth);
  torso.position.y = 0.86; torso.castShadow = true; body.add(torso);
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.42, 7), clothD);
  skirt.position.y = 0.62; skirt.castShadow = true; body.add(skirt);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
  head.position.y = 1.32; head.castShadow = true; body.add(head); CH.head = head;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.285, 10, 8, 0, Math.PI*2, 0, Math.PI*0.55), hair);
  cap.position.y = 1.33; body.add(cap);
  const eyeGeo = new THREE.SphereGeometry(0.036, 6, 6);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x16120e, roughness: 0.3 });
  const e1 = new THREE.Mesh(eyeGeo, eyeMat); e1.position.set(-0.095, 1.33, -0.245); body.add(e1);
  const e2 = new THREE.Mesh(eyeGeo, eyeMat); e2.position.set(0.095, 1.33, -0.245); body.add(e2);

  const armGeo = new THREE.CapsuleGeometry(0.065, 0.26, 3, 6);
  CH.armL = new THREE.Group(); CH.armL.position.set(-0.28, 1.05, 0);
  const a1 = new THREE.Mesh(armGeo, cloth); a1.position.y = -0.2; a1.castShadow = true; CH.armL.add(a1);
  CH.armR = new THREE.Group(); CH.armR.position.set(0.28, 1.05, 0);
  const a2 = new THREE.Mesh(armGeo, cloth); a2.position.y = -0.2; a2.castShadow = true; CH.armR.add(a2);
  body.add(CH.armL, CH.armR);

  const legGeo = new THREE.CapsuleGeometry(0.08, 0.22, 3, 6);
  CH.legL = new THREE.Group(); CH.legL.position.set(-0.12, 0.5, 0);
  const l1 = new THREE.Mesh(legGeo, clothD); l1.position.y = -0.2; l1.castShadow = true; CH.legL.add(l1);
  CH.legR = new THREE.Group(); CH.legR.position.set(0.12, 0.5, 0);
  const l2 = new THREE.Mesh(legGeo, clothD); l2.position.y = -0.2; l2.castShadow = true; CH.legR.add(l2);
  body.add(CH.legL, CH.legR);

  CH.satchel = new THREE.Group();
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.14), bagMat); bag.castShadow = true;
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.022, 5, 14), bagMat);
  strap.rotation.y = Math.PI/2; strap.position.y = 0.18;
  CH.satchel.add(bag, strap);
  CH.satchel.position.set(0.28, 0.88, 0.1); CH.satchel.visible = false;
  body.add(CH.satchel);

  // camp around the child — fire ring, glow, bedroll, log seat
  const campY = heightAt(childCamp.x, childCamp.z);
  grp.position.set(childCamp.x, campY, childCamp.z);
  CH.baseY = campY;
  const angle = Math.atan2(spawnPos.x - childCamp.x, spawnPos.z - childCamp.z);
  grp.rotation.y = angle;

  const camp = new THREE.Group();
  camp.position.set(1.7, 0, 0.5);   // child-local: a couple of steps to the side
  if(MODELS['campfire_stones']) camp.add(modelGroup('campfire_stones', 0.9));
  CH.fire = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 6),
    new THREE.MeshStandardMaterial({ color: 0x3a1c06, emissive: 0xffa42e, emissiveIntensity: 2.2, flatShading: true, roughness: 0.6 }));
  CH.fire.position.y = 0.22; camp.add(CH.fire);
  CH.fireLight = new THREE.PointLight(0xffa42e, 12, 12, 2);
  CH.fireLight.position.y = 0.7; camp.add(CH.fireLight);
  if(MODELS['log']) { const lg = modelGroup('log', 0.85); lg.rotation.y = 0.7; lg.position.set(0.95, 0, 0.6); camp.add(lg); }
  const bedroll = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x7d6a44, flatShading: true, roughness: 1 }));
  bedroll.position.set(-0.5, 0.05, -1.9); bedroll.rotation.y = 0.4; bedroll.castShadow = true; bedroll.receiveShadow = true;
  camp.add(bedroll);
  grp.add(camp);

  scene.add(grp);
  CH.grp = grp;
  setChildStage(childStage(), true);
}

function setChildStage(stage, silent){
  CH.stage = stage;
  const s = CHILD_SCALES[Math.min(3, Math.max(0, stage))];
  if(CH.body) CH.body.scale.setScalar(s);
  if(CH.satchel) CH.satchel.visible = stage >= 1;
  if(!silent && stage > 0) toast('🌱 শিশুটি একটু বড় হয়েছে — তোমার শেখার সাথেই সে বাড়ছে', 3400);
}

function updateChild(dt){
  if(!CH.grp || G.mode.startsWith('match')) return;
  CH.t += dt;
  const near = P.grp ? CH.grp.position.distanceTo(P.grp.position) : 999;
  // idle breathing + nervous glance
  CH.body.position.y = Math.sin(CH.t*1.6) * 0.02;
  CH.head.rotation.y = Math.sin(CH.t*0.7) * 0.3;
  CH.legL.rotation.x = Math.sin(CH.t*1.1) * 0.06;
  CH.legR.rotation.x = -Math.sin(CH.t*1.1) * 0.06;
  let armWave = 0.1 + Math.sin(CH.t*1.6) * 0.06;
  if(CH.cheerT > 0){
    CH.cheerT = Math.max(0, CH.cheerT - dt);
    CH.body.position.y = Math.abs(Math.sin(CH.cheerT*14)) * 0.26;
    armWave = -2.1 + Math.sin(CH.cheerT*18) * 0.35;
  } else if(near < 9){
    armWave = -1.5 + Math.sin(CH.t*6) * 0.4;   // waves when you come close
  }
  CH.armL.rotation.x = armWave * 0.3;
  CH.armR.rotation.x = armWave;
  if(near < 14 && P.grp){
    CH.grp.rotation.y = Math.atan2(P.grp.position.x - CH.grp.position.x, P.grp.position.z - CH.grp.position.z);
  }
  if(CH.fire){
    const fl = 0.9 + Math.sin(CH.t*11) * 0.14 + Math.sin(CH.t*23) * 0.08;
    CH.fire.scale.set(0.9 + Math.sin(CH.t*9)*0.08, fl, 0.9 + Math.cos(CH.t*7)*0.08);
    CH.fire.material.emissiveIntensity = 1.9 + Math.sin(CH.t*13) * 0.5;
    CH.fireLight.intensity = 10 + Math.sin(CH.t*12) * 3.4;
  }
  if(near < 6 && !CH.greeted && G.mode === 'world'){
    CH.greeted = true;
    setTimeout(() => subtitle(CHILD_LINES.safe[childStage()], 4200), 400);
  }
}

const CHILD_LINES = {
  safe: [
    'তুমি… তুমি কে? আমি এখানে একা… ওরা সবাই ঘুমিয়ে গেছে, তুমিও কি হারিয়ে গেছ?',
    'তুমি ফিরে এসেছ! ওদের হারানোর পর থেকে আমার মনে পড়তে শুরু করেছে…',
    'আমি এখন কাঠ কাটতে পারি, আগুনও জ্বালাতে পারি — তুমি শেখাচ্ছ বলেই না?',
    'আমি সেই কথাগুলো আর ভুলব না — যেগুলো তুমি আমাকে শিখিয়ে গেলে।',
  ],
  cheer: [
    'তুমি পেরেছ! ওটা… ওটা ভুলে গিয়েছিল, তুমি মনে করিয়ে দিলে!',
    'আরেকটা! আরেকটা! আমি দেখছি — লিখে রাখছি সব!',
    'তুমি যত জানো, আমি তত বড় হচ্ছি — এটা কেমন জাদু?',
    'শেষটা… সবচেয়ে বড়টা। আমি ভয় পাচ্ছি না, তুমি আছো।',
  ],
};

function childCheer(){
  if(!CH.grp) return;
  CH.cheerT = 1.2;
  setTimeout(() => subtitle(CHILD_LINES.cheer[Math.min(3, CH.stage)], 4200), 900);
}

// ============================== MONSTER GOSSIP ==============================
const GOSSIP = [
  'খালি একবার হারিয়েছে… কয়েকদিন পরে সব ভুলে যাবে, দেখো।',
  'ওর মাথায় যা ঢোকে, বেরিয়েও যায় — আমরা অপেক্ষা করি।',
  'এই মানুষটা প্রতিবার ফিরে আসে, আর প্রতিবার আরও ভুলে যায়।',
  'শিশুটাকে বড় হতে দিও না… বড় হলে ও সব মনে রাখবে।',
  'যা পড়েছে, তা না লিখলে আমরা খেয়ে ফেলি — এই নিয়ম।',
];
let lastGossipAt = 0;
function maybeGossip(){
  if(!G.world || !G.monsters.length) return;
  const t = G.time;
  if(t - lastGossipAt < 34) return;
  if(Math.random() > 0.35) return;
  lastGossipAt = t;
  const alive = G.monsters.filter(m => m.type === 'chapter' && !m.defeated);
  if(!alive.length) return;
  const m = alive[Math.floor(Math.random()*alive.length)];
  if(m.pos.distanceTo(P.grp.position) > 34) return;
  subtitle('🌀 ' + GOSSIP[Math.floor(Math.random()*GOSSIP.length)], 4200);
}

// ============================== GOLEM ==============================
function makeGolemMaterials(variant){
  const hues = [0x4d5a44, 0x5c6a4a, 0x46543f, 0x55604a, 0x4a5a52, 0x606a4e, 0x44503e, 0x525c46];
  const rock = new THREE.Color(hues[variant % hues.length]);
  return {
    rock: new THREE.MeshStandardMaterial({ color: rock, flatShading: true, roughness: 0.95 }),
    dark: new THREE.MeshStandardMaterial({ color: rock.clone().multiplyScalar(0.55), flatShading: true, roughness: 1 }),
    glow: new THREE.MeshStandardMaterial({ color: 0x241a08, emissive: 0xffa42e, emissiveIntensity: 1.5, roughness: 0.6 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x241a08, emissive: 0xffc24d, emissiveIntensity: 2.4, roughness: 0.3 }),
  };
}
function buildGolem(variant, scale=1){
  const M = makeGolemMaterials(variant);
  const root = new THREE.Group();
  const rig = { root, M, t: 0, state: 'idle', stateT: 0, scale };

  const hips = new THREE.Group(); hips.position.y = 1.6; root.add(hips); rig.hips = hips;
  const pelvis = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72, 0), M.dark);
  pelvis.scale.set(1.1, 0.8, 0.9); pelvis.castShadow = true; hips.add(pelvis);

  const torso = new THREE.Group(); torso.position.y = 0.85; hips.add(torso); rig.torso = torso;
  const chest = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 0), M.rock);
  chest.scale.set(1.15, 1.05, 0.85); chest.castShadow = true; torso.add(chest);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), M.glow);
  core.position.set(0, 0.1, -0.78); torso.add(core); rig.core = core;
  for(let i=0;i<3;i++){
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55+hash(i,variant)*0.4, 0.05), M.glow);
    crack.position.set(-0.4+i*0.4, -0.15+hash(i,3)*0.3, -0.86);
    crack.rotation.z = (hash(i,8)-0.5)*0.7;
    torso.add(crack);
  }
  const head = new THREE.Group(); head.position.y = 1.35; torso.add(head); rig.head = head;
  const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), M.rock);
  skull.scale.set(1, 0.85, 0.95); skull.castShadow = true; head.add(skull);
  const eyeGeo = new THREE.SphereGeometry(0.09, 6, 6);
  const eL = new THREE.Mesh(eyeGeo, M.eye); eL.position.set(-0.2, 0.05, -0.4); head.add(eL);
  const eR = new THREE.Mesh(eyeGeo, M.eye); eR.position.set(0.2, 0.05, -0.4); head.add(eR);

  function makeArm(side){
    const arm = new THREE.Group(); arm.position.set(side*1.15, 0.72, 0); torso.add(arm);
    const shoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), M.dark);
    shoulder.castShadow = true; arm.add(shoulder);
    const fore = new THREE.Group(); fore.position.y = -0.62; arm.add(fore);
    const fMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 0), M.rock);
    fMesh.position.y = -0.5; fMesh.scale.set(0.9, 1.25, 0.9); fMesh.castShadow = true; fore.add(fMesh);
    const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), M.dark);
    fist.position.y = -1.15; fist.castShadow = true; fore.add(fist);
    return { arm, fore };
  }
  const aL = makeArm(-1), aR = makeArm(1);
  rig.armL = aL.arm; rig.foreL = aL.fore; rig.armR = aR.arm; rig.foreR = aR.fore;

  function makeLeg(side){
    const leg = new THREE.Group(); leg.position.set(side*0.5, -0.4, 0); hips.add(leg);
    const l = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), M.rock);
    l.position.y = -0.75; l.scale.set(0.85, 1.5, 0.9); l.castShadow = true; leg.add(l);
    return leg;
  }
  rig.legL = makeLeg(-1); rig.legR = makeLeg(1);

  root.scale.setScalar(scale);
  root.userData.rig = rig;
  return rig;
}
function setGolemState(rig, state){
  rig.state = state; rig.stateT = 0;
}
function animateGolem(rig, dt){
  rig.t += dt; rig.stateT += dt;
  const s = rig.state, t = rig.t, st = rig.stateT;
  const idleSway = Math.sin(t*1.4) * 0.04;
  rig.torso.rotation.x = 0.06 + idleSway;
  rig.torso.position.y = 0.85 + Math.sin(t*1.8) * 0.05;
  rig.head.rotation.y = Math.sin(t*0.6) * 0.22;
  rig.armL.rotation.x = 0.15 + Math.sin(t*1.4) * 0.08;
  rig.armR.rotation.x = 0.15 - Math.sin(t*1.4) * 0.08;
  const corePulse = 1.3 + Math.sin(t*3.2) * 0.5;
  rig.M.glow.emissiveIntensity = corePulse;

  if(s === 'roar'){
    const k = Math.min(1, st/0.25);
    rig.head.rotation.x = -0.5 * k + Math.sin(st*22) * 0.05;
    rig.armL.rotation.z = 0.9 * k; rig.armR.rotation.z = -0.9 * k;
    rig.torso.rotation.x = -0.25 * k;
  } else if(s === 'attack'){
    // windup (0-.35) → lunge+slam (.35-.7) → recover
    if(st < 0.35){
      const k = st/0.35;
      rig.armR.rotation.x = 0.15 - 1.9*k;
      rig.torso.rotation.x = 0.06 - 0.3*k;
      rig.torso.rotation.y = -0.35*k;
    } else if(st < 0.7){
      const k = (st-0.35)/0.35;
      rig.armR.rotation.x = -1.75 + 2.6*k;
      rig.torso.rotation.x = -0.24 + 0.75*k;
      rig.torso.rotation.y = -0.35 + 0.45*k;
      rig.root.position.z = rig.baseZ - Math.sin(k*Math.PI) * 1.6;
    } else {
      rig.armR.rotation.x = 0.85; rig.torso.rotation.x = 0.45; rig.torso.rotation.y = 0.1;
      if(st > 1.05){ rig.root.position.z = rig.baseZ; setGolemState(rig, 'idle'); }
    }
  } else if(s === 'hit'){
    const k = Math.min(1, st/0.4);
    rig.torso.rotation.x = 0.06 - 0.55 * Math.sin(k*Math.PI);
    rig.torso.position.z = 0.35 * Math.sin(k*Math.PI);
    rig.M.glow.emissiveIntensity = 3.2;
    if(st > 0.5) setGolemState(rig, 'idle');
  } else if(s === 'die'){
    const k = Math.min(1, st/1.8);
    rig.root.rotation.x = -1.35 * k*k;
    rig.root.position.y = rig.baseY - k * 1.1;
    rig.M.glow.emissiveIntensity = Math.max(0, 1.5 - k*1.5);
    rig.M.eye.emissiveIntensity = Math.max(0, 2.4 - k*2.4);
    rig.M.rock.transparent = true; rig.M.rock.opacity = 1 - k*0.85;
    rig.M.dark.transparent = true; rig.M.dark.opacity = 1 - k*0.85;
  }
}
function makeStatue(variant, scale){
  const rig = buildGolem(variant, scale);
  const gray = new THREE.MeshStandardMaterial({ color: 0x49543c, flatShading: true, roughness: 1, transparent: true, opacity: 0.96 });
  rig.root.traverse(o => { if(o.isMesh) o.material = gray; });
  rig.root.rotation.x = 0; rig.root.position.y = 0;
  return rig;
}

// ============================== FX ==============================
let fxGroup;
const activeProjectiles = [], activeBursts = [];
// বন্দুকের স্তর অনুযায়ী গুলির রঙ (০ = হাতে-গোনা সাধারণ, ১-৩ = দোকানের অস্ত্র)
const GUN_FX = [
  { core: 0xffd9a0, halo: 0xff8a3c, light: 0xffa14d },
  { core: 0xd8f2ff, halo: 0x3fa8ff, light: 0x59b6ff },
  { core: 0xe2ffc4, halo: 0x62e04a, light: 0x74ea58 },
  { core: 0xfff0b8, halo: 0xd06bff, light: 0xc06bff },
];
function playerGunTier(){
  const g = equippedItem('gun');
  return g ? (g.tier || 0) : 0;
}
function fireProjectile(from, to, onHit){
  const fx = GUN_FX[Math.min(playerGunTier(), GUN_FX.length-1)];
  const grp = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshBasicMaterial({ color: fx.core }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8),
    new THREE.MeshBasicMaterial({ color: fx.halo, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  const light = new THREE.PointLight(fx.light, 26, 14, 2);
  grp.add(core, halo, light);
  grp.position.copy(from);
  scene.add(grp);
  const dir = tmpV.copy(to).sub(from);
  const dist = dir.length();
  const dur = Math.max(0.18, dist * 0.045);
  activeProjectiles.push({ grp, from: from.clone(), to: to.clone(), t: 0, dur, onHit });
}
function updateProjectiles(dt){
  for(let i=activeProjectiles.length-1;i>=0;i--){
    const p = activeProjectiles[i];
    p.t += dt;
    const k = Math.min(1, p.t/p.dur);
    p.grp.position.lerpVectors(p.from, p.to, k);
    p.grp.position.y += Math.sin(k*Math.PI) * 1.1;
    if(k >= 1){
      scene.remove(p.grp);
      activeProjectiles.splice(i,1);
      impactBurst(p.to);
      if(p.onHit) p.onHit();
    }
  }
}
function impactBurst(pos){
  const N = 26;
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(N*3), vels = [];
  for(let i=0;i<N;i++){
    arr[i*3] = pos.x; arr[i*3+1] = pos.y; arr[i*3+2] = pos.z;
    const v = new THREE.Vector3((Math.random()-0.5), Math.random()*0.9, (Math.random()-0.5)).normalize().multiplyScalar(3+Math.random()*5);
    vels.push(v);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffb35c, size: 0.22, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  const light = new THREE.PointLight(0xffa14d, 50, 18, 2);
  light.position.copy(pos); scene.add(light);
  activeBursts.push({ pts, light, vels, t: 0, dur: 0.55 });
  AU.sfx('boom');
}
function updateBursts(dt){
  for(let i=activeBursts.length-1;i>=0;i--){
    const b = activeBursts[i];
    b.t += dt;
    const k = b.t / b.dur;
    const a = b.pts.geometry.attributes.position;
    for(let j=0;j<b.vels.length;j++){
      a.setXYZ(j, a.getX(j)+b.vels[j].x*dt, a.getY(j)+b.vels[j].y*dt - 4*dt*k, a.getZ(j)+b.vels[j].z*dt);
    }
    a.needsUpdate = true;
    b.pts.material.opacity = Math.max(0, 1-k);
    b.light.intensity = Math.max(0, 50*(1-k));
    if(k >= 1){ scene.remove(b.pts); scene.remove(b.light); activeBursts.splice(i,1); }
  }
}
function floater(worldPos, text, color){
  tmpV.copy(worldPos).project(camera);
  if(tmpV.z > 1) return;
  const x = (tmpV.x*0.5+0.5) * innerWidth, y = (-tmpV.y*0.5+0.5) * innerHeight;
  const d = document.createElement('div');
  d.className = 'floater'; d.textContent = text; d.style.color = color;
  d.style.left = x+'px'; d.style.top = y+'px';
  document.body.appendChild(d);
  setTimeout(()=> d.remove(), 1000);
}
function screenFlash(kind){
  const f = kind === 'heal' ? el.healFlash : el.dmgFlash;
  f.classList.add('on');
  setTimeout(()=> f.classList.remove('on'), kind === 'heal' ? 350 : 260);
}

// ============================== WORLD DATA ==============================
// সব বিষয়ের জগৎ একসাথে আনা হয়; শিক্ষার্থী যে বিষয়ে পড়তে চায়, সেই জগতে যায়।
// পছন্দটা ডিভাইসে থেকে যায়, তাই পরে খুললে আগের জগৎেই ফেরা যায়।
async function loadWorldData(){
  const slug = G.student.slug;
  const res = await api('getBattleWorldMap', { slug });
  if(!res || res.status !== 'success') return null;
  const worlds = res.worlds || [];
  G.worlds = worlds;
  let saved = null;
  try{ saved = localStorage.getItem('smritir_jungle_world'); }catch(e){}
  return worlds.find(w => w.id === saved && w.chapters.length) ||
         worlds.find(w => /physics|পদার্থ/i.test(w.subject) && w.chapters.length) ||
         worlds.find(w => w.chapters && w.chapters.length) || null;
}
function pickWorld(id){
  try{ localStorage.setItem('smritir_jungle_world', id); }catch(e){}
}
async function loadProgress(){
  const res = await api('getGameProgress', { slug: G.student.slug });
  if(res && res.status === 'success' && res.data){
    const p = defaultProgress(); mergeProgress(p, res.data);
    try{ localStorage.setItem('smritir_jungle_progress', JSON.stringify(p)); }catch(e){}
    return p;
  }
  try{ const raw = localStorage.getItem('smritir_jungle_progress'); if(raw) return mergeProgress(defaultProgress(), JSON.parse(raw)); }catch(e){}
  return defaultProgress();
}
async function saveProgress(){
  if(!G.progress) return;
  G.progress.gameXP = Math.max(0, Math.round(G.progress.gameXP));
  G.progress.coins = Math.max(0, Math.round(G.progress.coins));
  if(!G.progress.currencies) G.progress.currencies = {};
  for(const k in CURRENCIES) G.progress.currencies[k] = Math.max(0, Math.round(G.progress.currencies[k] || 0));
  G.progress.level = levelFromXp(G.progress.gameXP);
  try{ localStorage.setItem('smritir_jungle_progress', JSON.stringify(G.progress)); }catch(e){}
  await api('saveGameProgress', { slug: G.student.slug, data: JSON.stringify(G.progress) });
}

// ============================== MONSTERS ==============================
function spawnMonsters(){
  const chapters = (G.world.chapters || []).slice(0, 8);
  const n = chapters.length;
  chapters.forEach((ch, i) => {
    const pos = arenaPos(i, n);
    pos.y = 0.4;
    const defeated = !!ch.defeated;
    const rig = defeated ? makeStatue(i, 1.05) : buildGolem(i, 1.05);
    rig.root.position.copy(pos);
    rig.baseY = pos.y; rig.baseZ = pos.z;
    rig.root.lookAt(spawnPos.x, pos.y, spawnPos.z);
    rig.root.rotateY(Math.PI); // face spawn (golem front is -z)
    scene.add(rig.root);
    const decor = buildArenaDecor(new THREE.Vector3(pos.x, heightAt(pos.x,pos.z), pos.z), defeated);
    G.monsters.push({ id: ch.id, type: 'chapter', chapter: ch, pos, rig, decor, defeated, name: ch.title });
  });
  // world boss at the gate
  const boss = { id: 'boss', type: 'boss', pos: gatePos.clone().add(new THREE.Vector3(0,0.4,6)), defeated: false, name: (G.world.title || 'ওয়ার্ল্ড') + ' বস' };
  const bossRig = buildGolem(3, 1.65);
  bossRig.root.position.copy(boss.pos);
  bossRig.baseY = boss.pos.y; bossRig.baseZ = boss.pos.z;
  bossRig.root.lookAt(spawnPos.x, boss.pos.y, spawnPos.z);
  bossRig.root.rotateY(Math.PI);
  bossRig.root.visible = false; // appears when gate unlocked & player near
  scene.add(bossRig.root);
  boss.rig = bossRig;
  G.monsters.push(boss);
  setGateLocked(!G.world.bossUnlocked);
}

// ============================== UI: HUD ==============================
function refreshHud(){
  const p = G.progress; if(!p) return;
  const { lvl, cur } = xpProgress(p.gameXP);
  el.hudName.textContent = G.student.name;
  el.hudLv.textContent = 'LV ' + lvl;
  el.hudXpFill.style.width = cur + '%';
  const ck = currentSubject(), c = currencyOf(ck);
  el.hudCoins.textContent = c.icon + ' ' + ((p.currencies && p.currencies[ck]) || 0);
  el.hudCoins.title = c.name + ' — ' + c.unit;
  el.tpName.textContent = G.student.name;
  el.tpLv.textContent = 'লেভেল ' + lvl;
  el.tpXpTxt.textContent = cur + '/' + LEVEL_XP + ' XP';
  el.tpXpFill.style.width = cur + '%';
}
function updateWorldHp(){
  const pct = Math.max(0, G.playerHp) / G.playerMaxHp * 100;
  el.hudHpFill.style.width = pct + '%';
  el.hudHpTxt.textContent = Math.max(0, Math.round(G.playerHp)) + '/' + G.playerMaxHp;
}
function setObjective(txt){ el.hudObjective.textContent = '🎯 ' + txt; }
function objectiveText(){
  const alive = G.monsters.filter(m => m.type === 'chapter' && !m.defeated);
  if(alive.length){
    const nearest = alive.slice().sort((a,b) => a.pos.distanceTo(P.grp.position) - b.pos.distanceTo(P.grp.position))[0];
    const d = Math.round(nearest.pos.distanceTo(P.grp.position));
    return `নিকটতম দানব: "${nearest.name}" — দূরত্ব ${d}m`;
  }
  if(!G.world.bossUnlocked) return 'সব চ্যাপ্টার সম্পন্ন! বসের ফটকের দিকে এগিয়ে যাও';
  return 'ওয়ার্ল্ড বস তোমার অপেক্ষায় — গেটের কাছে যাও!';
}

// ============================== BATTLE ==============================
const BATTLE_TIME = 45;
let battleTimerInt = null;

// ============================== দেবদূত (পুরোনো ভুলের রিভিউ) ==============================
// No timer, no monster, no damage — just old mistakes coming back to be mended.
// A correct review answer makes the question leave the pool for good.
const REVIEW = { active:false, locked:false, list:[], idx:0, correct:0, answered:0, sessionId:null, count:0, oldestDays:0 };

function enterBattle(monster){
  if(G.battle) return;
  AU.sfx('roar');
  setGolemState(monster.rig, 'roar');
  G.mode = 'battle';
  G.battle = { monster, sessionId: null, phase: 'intro', locked: true, combo: 0, bestCombo: 0 };
  G.askedThisSession = []; G.correctThisSession = 0;
  hide(el.hud); hide(el.qPanel);
  show(el.battleHud);
  el.bMName.textContent = monster.name;
  el.bhName.textContent = G.student.name;
  updateBattleHp();
  el.bMFill.style.width = '100%';
  toast('⚔️ ' + monster.name + ' এবারের লড়াই শুরু!');
  setTimeout(async () => {
    if(!G.battle) return;
    const res = await api('startBattleSession', {
      slug: G.student.slug, subject: G.world.subject,
      monsterRef: monster.type === 'boss' ? 'boss' : monster.id,
      monsterType: monster.type
    });
    if(!res || res.status !== 'success'){ toast('সার্ভারে সংযোগ ব্যর্থ — আবার চেষ্টা করো'); exitBattle(false); return; }
    G.battle.sessionId = res.sessionId;
    nextQuestion();
  }, 1300);
}
function updateBattleHp(){
  const pct = Math.max(0, G.playerHp) / G.playerMaxHp * 100;
  el.bHpFill.style.width = pct + '%';
  el.bhHpNum.textContent = Math.max(0, Math.round(G.playerHp)) + '/' + G.playerMaxHp;
  el.bCombo.textContent = G.battle && G.battle.combo >= 2 ? '🔥 কম্বো ×' + G.battle.combo : '';
}

async function nextQuestion(){
  const b = G.battle; if(!b) return;
  b.phase = 'loading'; hide(el.qPanel);
  const m = b.monster;
  const params = { slug: G.student.slug, monsterType: m.type, excludeIds: G.askedThisSession.join(',') };
  if(m.type === 'chapter') params.topicId = m.id; else params.courseId = G.world.id;
  const res = await api('getQuestionForBattle', params);
  if(!res){
    if(offlineMode){ toast('⚠️ যুদ্ধ চালিয়ে যেতে ইন্টারনেট লাগবে'); }
    else toast('প্রশ্ন আনতে সমস্যা হয়েছে');
    exitBattle(false); return;
  }
  if(res.status !== 'success'){ toast('যুদ্ধ চালিয়ে যাওয়া গেল না'); exitBattle(false); return; }
  if(res.defeated){ onMonsterDefeated(); return; }
  if(!G.battle) return;
  b.question = res.question; b.topicId = res.topicId;
  b.hp = res.hp; b.maxHp = res.maxHp;
  G.askedThisSession.push(res.question.id);
  el.bMFill.style.width = (b.hp / b.maxHp * 100) + '%';
  el.bMNum.textContent = b.hp + '/' + b.maxHp;
  renderQuestion(res.question);
  b.phase = 'answering';
  startBattleTimer();
}

function renderMath(elm){
  if(window.renderMathInElement){
    try{ window.renderMathInElement(elm, { delimiters: [
      { left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }
    ], throwOnError: false }); }catch(e){}
  }
}
function renderQuestion(q){
  el.qText.innerHTML = esc(q.text);
  renderAngelChip(q.angel);
  el.qOpts.innerHTML = '';
  (q.options || []).forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'opt';
    btn.innerHTML = '<span class="k">' + 'ABCD'[i] + '</span><span>' + esc(opt) + '</span>';
    btn.addEventListener('click', () => onOptClick(i, btn));
    el.qOpts.appendChild(btn);
  });
  show(el.qPanel);
  renderMath(el.qText); Array.from(el.qOpts.children).forEach(o => renderMath(o));
  el.qPanel.style.animation = 'none'; void el.qPanel.offsetWidth; el.qPanel.style.animation = '';
}
function onOptClick(i, btn){
  if(REVIEW.active) answerReview(i, btn);
  else answerQuestion(i, btn);
}
// ভালো/খারাপ দেবদূত — পুরোনো ভুল ফিরে এলে মনে করিয়ে দেয়, কখনো ভর্ৎসনা নয়।
function renderAngelChip(angel){
  if(!angel || !angel.wrong){ hide(el.qAngel); el.qAngel.innerHTML = ''; return; }
  const d = angel.daysAgo || 0;
  const when = d <= 0 ? 'এইমাত্র' : (d === 1 ? 'গতকাল' : d + ' দিন আগে');
  const good = d <= 0
    ? '🪽 ভালো দেবদূত: "এই প্রশ্নটাই এইমাত্র তোমাকে থামিয়ে দিল — এবার তার জবাব নিজের করে নাও।"'
    : '🪽 ভালো দেবদূত: "' + when + ' এই প্রশ্নটা তোমাকে একবার থামিয়েছিল — আজ সেটা শোধরানোর সুন্দর সময়।"';
  let html = '<div class="ang good">' + good + '</div>';
  if(Math.random() < 0.3){
    html += '<div class="ang bad">😈 খারাপ দেবদূত ফিসফিসায়: "ভুলে গেছ ভেবে এসেছিলাম — কিন্তু তোমার ভুল কি তোমাকে ভুলেছে? দেখি এবার…"</div>';
  }
  el.qAngel.innerHTML = html;
  show(el.qAngel);
}

function startBattleTimer(){
  stopBattleTimer();
  const b = G.battle; if(!b) return;
  b.timeLeft = BATTLE_TIME; b.qStart = Date.now();
  updateTimerRing();
  battleTimerInt = setInterval(() => {
    if(!G.battle || G.battle.phase !== 'answering'){ stopBattleTimer(); return; }
    G.battle.timeLeft -= 0.25;
    updateTimerRing();
    if(G.battle.timeLeft <= 0){ stopBattleTimer(); onTimeout(); }
  }, 250);
}
function stopBattleTimer(){ if(battleTimerInt){ clearInterval(battleTimerInt); battleTimerInt = null; } }
function updateTimerRing(){
  const b = G.battle; if(!b) return;
  const frac = Math.max(0, b.timeLeft / BATTLE_TIME);
  el.trFg.style.strokeDashoffset = String(169.6 * (1 - frac));
  el.bTimerNum.textContent = Math.ceil(Math.max(0, b.timeLeft));
  el.bTimer.classList.toggle('danger', b.timeLeft <= 10);
}
function lockOptions(selBtn, correctIdx, chosen){
  Array.from(el.qOpts.children).forEach((btn, i) => {
    btn.setAttribute('disabled', '');
    if(i === correctIdx) btn.classList.add('reveal-right');
  });
  if(chosen >= 0 && selBtn) selBtn.classList.add(chosen === correctIdx ? 'sel-right' : 'sel-wrong');
}

async function answerQuestion(idx, btn){
  const b = G.battle; if(!b || b.phase !== 'answering') return;
  b.phase = 'resolving'; stopBattleTimer();
  AU.sfx('click');
  await submitAnswer(idx, btn);
}
async function onTimeout(){
  const b = G.battle; if(!b || b.phase !== 'answering') return;
  b.phase = 'resolving'; stopBattleTimer();
  toast('⏰ সময় শেষ!');
  await submitAnswer(-1, null);
}

async function submitAnswer(chosen, btn){
  const b = G.battle; if(!b || !b.question) return;
  const timeTaken = Math.min(BATTLE_TIME, Math.round((Date.now() - b.qStart)/1000));
  const params = {
    sessionId: b.sessionId, slug: G.student.slug, topicId: b.topicId,
    questionId: b.question.id, chosenIndex: chosen, timeTakenSec: timeTaken,
    isReview: 'false', monsterType: b.monster.type
  };
  const res = await api('submitBattleAnswer', params);
  if(!res || res.status !== 'success'){ toast('উত্তর জমা ব্যর্থ — সংযোগ দেখো'); if(G.battle){ G.battle.phase = 'answering'; startBattleTimer(); } return; }

  lockOptions(btn, res.correctIndex, chosen);
  if(res.correct){
    G.correctThisSession++;
    b.combo++; b.bestCombo = Math.max(b.bestCombo, b.combo);
    AU.sfx('right');
    playerFireSequence(() => {
      if(res.hpUpdate){
        b.hp = res.hpUpdate.hp; b.maxHp = res.hpUpdate.maxHp;
        el.bMFill.style.width = (b.hp / b.maxHp * 100) + '%';
        el.bMNum.textContent = b.hp + '/' + b.maxHp;
        if(res.hpUpdate.defeated){ setTimeout(onMonsterDefeated, 650); return; }
      }
      setTimeout(nextQuestion, 1050);
    });
  } else {
    b.combo = 0;
    AU.sfx('wrong');
    monsterAttackSequence(() => {
      if(G.playerHp <= 0){ setTimeout(onPlayerDefeated, 500); return; }
      setTimeout(nextQuestion, 1250);
    });
  }
  updateBattleHp();
}

function playerFireSequence(onHit){
  const b = G.battle, m = b.monster;
  // aim: face monster, raise cannon
  P.grp.lookAt(m.rig.root.position.x, P.grp.position.y, m.rig.root.position.z);
  P.cannon.rotation.x = 1.35;
  AU.sfx('zap');
  const muzzle = new THREE.Vector3();
  P.cannon.getWorldPosition(muzzle);
  muzzle.y -= 0.55;
  const target = m.rig.root.position.clone(); target.y += 2.3 * m.rig.scale;
  const crit = b.combo >= 5;
  setTimeout(() => {
    fireProjectile(muzzle, target, () => {
      setGolemState(m.rig, 'hit');
      G.hitStop = 0.085;
      floater(target, crit ? 'ক্রিট! -1' : '-1', crit ? '#FFC46B' : '#FF8A3C');
      if(crit) floater(target.clone().add(new THREE.Vector3(0.6,0.4,0)), '🔥', '#FFC46B');
      onHit && onHit();
    });
    setTimeout(() => { P.cannon.rotation.x = 0; }, 500);
  }, 220);
}
function monsterAttackSequence(done){
  const b = G.battle, m = b.monster;
  setGolemState(m.rig, 'attack');
  AU.sfx('roar');
  setTimeout(() => {
    G.playerHp -= 20;
    AU.sfx('slam'); AU.sfx('hurt');
    G.shake = 0.55;
    G.hitStop = 0.13;
    screenFlash('dmg');
    updateBattleHp(); updateWorldHp();
    const at = P.grp.position.clone(); at.y += 1.6;
    floater(at, '-20', '#FF6A55');
    P.body.rotation.x = -0.35;
    setTimeout(() => { P.body.rotation.x = 0; }, 300);
    done && done();
  }, 620);
}

async function onMonsterDefeated(){
  const b = G.battle; if(!b) return;
  b.phase = 'over'; stopBattleTimer(); hide(el.qPanel);
  const m = b.monster;
  setGolemState(m.rig, 'die');
  AU.sfx('victory');
  // rewards
  const isBoss = m.type === 'boss';
  const xpGain = G.correctThisSession * 10 + (isBoss ? 300 : 100);
  const coinGain = G.correctThisSession * 5 + (isBoss ? 150 : 50);
  const ck = currentSubject(), cur = currencyOf(ck);
  G.progress.gameXP += xpGain;
  G.progress.coins += coinGain;
  addCurrency(ck, coinGain);
  G.progress.completedBattles++;
  if(isBoss){ G.progress.bossProgress[G.world.id] = { defeatedAt: new Date().toISOString() }; }
  else {
    const cp = G.progress.chapterProgress[m.id] || { battlesWon: 0, bestCombo: 0 };
    cp.battlesWon++; cp.bestCombo = Math.max(cp.bestCombo || 0, b.bestCombo); cp.defeatedAt = new Date().toISOString();
    G.progress.chapterProgress[m.id] = cp;
  }
  checkAchievements(isBoss);
  await saveProgress();
  if(b.sessionId) api('endBattleSession', { sessionId: b.sessionId, outcome: 'won' });

  const asked = G.askedThisSession.length;
  const acc = asked ? Math.round(G.correctThisSession / asked * 100) : 0;
  setTimeout(async () => {
    el.vTitle.textContent = isBoss ? '🏆 ওয়ার্ল্ড বস পরাজিত!' : 'দানব পরাজিত!';
    el.vSub.textContent = '"' + m.name + '" — তোমার জয় হয়েছে!';
    el.vXp.textContent = '+' + xpGain;
    el.vCoins.textContent = '+' + coinGain + ' ' + cur.icon;
    el.vAcc.textContent = acc + '%';
    el.vTotalXp.textContent = G.progress.gameXP + ' XP';
    el.vLevel.textContent = 'লেভেল ' + levelFromXp(G.progress.gameXP);
    show(el.victory);
    G.mode = 'cinematic';
    m.defeated = true;
    // refresh world state from server for accurate gates + child growth
    const w = await loadWorldData();
    if(w){ G.world = w; }
    const st = childStage();
    if(st !== CH.stage) setChildStage(st);
    childCheer();
  }, 1700);
}
function checkAchievements(isBoss){
  const earned = id => G.progress.achievements.some(a => a.id === id);
  const give = (id, title) => {
    if(earned(id)) return;
    G.progress.achievements.push({ id, title, earnedAt: new Date().toISOString() });
    setTimeout(() => toast('🏅 অর্জন আনলক: ' + title, 3200), 2500);
  };
  const won = c => c.defeated || (G.progress.chapterProgress[c.id] && G.progress.chapterProgress[c.id].defeatedAt);
  const worldDone = w => (w.chapters || []).length > 0 && w.chapters.every(won);
  if(G.progress.completedBattles === 1) give('first_win', 'প্রথম জয়');
  if(isBoss) give('boss_slayer', 'বস স্লেয়ার');
  if(G.world && worldDone(G.world)) give('valley_free', 'জঙ্গল মুক্ত');
  // সব জগতের সব অধ্যায় শেষ — খেলার একেবারে শেষে তবেই গল্পের আসল মোচড়টা খোলে
  const doneWorlds = (G.worlds || []).filter(w => (w.chapters || []).length > 0);
  if(doneWorlds.length && doneWorlds.every(worldDone) && !earned('twist_revealed')){
    G.progress.achievements.push({ id:'twist_revealed', title:'নিজের অতীতের দেখা', earnedAt: new Date().toISOString() });
    setTimeout(() => toast('🏅 অর্জন আনলক: নিজের অতীতের দেখা', 3600), 5600);
    setTimeout(() => subtitle('🎙️ "জঙ্গল এখন মুক্ত। আজ শোনো সেই সত্যটা — যে শিশুকে তুমি আগলে বড় করলে, সে আর কেউ নয়: সেই ছোট্ট তুমি। ভবিষ্যৎ থেকে ফেরা অ্যাস্ট্রোনট, তুমি আসলে তোমার নিজের অতীতকেই বাঁচাতে এসেছিলে।"', 11000), 6400);
  }
}

async function onPlayerDefeated(){
  const b = G.battle; if(!b) return;
  b.phase = 'over'; stopBattleTimer(); hide(el.qPanel);
  AU.sfx('defeat');
  if(b.sessionId) api('endBattleSession', { sessionId: b.sessionId, outcome: 'lost' });
  el.dStat.textContent = G.correctThisSession + '/' + G.askedThisSession.length;
  el.dSub.textContent = '💬 "' + b.monster.name + '": ' + TAUNT[Math.floor(Math.random()*TAUNT.length)];
  show(el.defeat);
  G.mode = 'cinematic';
}

// the monster's echo — a hook for review rounds, never a punishment
const TAUNT = [
  'একবার হারানো মানেই হাজার বার হারানো না — আমি ফিরে আসব, যতক্ষণ না তুমি সত্যিই ভুলে যাও।',
  'আজ যা ভুলেছ, কাল আবার আনবে — আমি অপেক্ষা করব।',
  'তোমার ভয় নেই? ভালো। ভয় না থাকলে ভুলও টের পাবে না।',
  'যাও, বিশ্রাম নাও। মাথায় যা থাকবে না, সেটাই আমার খাবার।',
];

function exitBattle(restore=true){
  stopBattleTimer(); hide(el.qPanel); hide(el.battleHud); hide(el.victory); hide(el.defeat);
  G.battle = null;
  G.mode = 'world';
  G.playerHp = G.playerMaxHp;
  P.cannon.rotation.x = 0;
  show(el.hud); updateWorldHp(); refreshHud();
  setObjective(objectiveText());
  fetchReviewSummary();
}

// ============================== দেবদূত (পুরোনো ভুলের রিভিউ) ==============================
// টাইমার নেই, মনস্টার নেই, ক্ষতিও নেই — শুধু পুরোনো ভুলগুলো ফিরে আসে শোধরানোর জন্য।
// রিভিউয়ে সঠিক উত্তর দিলে প্রশ্নটা চিরতরে পুল থেকে বেরিয়ে যায়।
async function fetchReviewSummary(){
  if(!G.student || !G.world || !G.progress) return;
  const topicIds = (G.world.chapters || []).map(c => c.id).join(',');
  if(!topicIds){ REVIEW.count = 0; updateReviewBtn(); return; }
  const res = await api('getReviewSummary', { slug: G.student.slug, topicIds }, 1);
  REVIEW.count = (res && res.status === 'success') ? (res.count || 0) : 0;
  REVIEW.oldestDays = (res && res.status === 'success') ? (res.oldestDays || 0) : 0;
  updateReviewBtn();
}
function updateReviewBtn(){
  if(!el.btnReview || !el.reviewN) return;
  el.btnReview.classList.toggle('hidden', !(REVIEW.count > 0));
  el.reviewN.textContent = REVIEW.count > 99 ? '৯৯+' : bnNum(REVIEW.count);
}
async function startReviewDrill(){
  if(G.mode !== 'world') return;
  if(!G.student || !G.world || !G.progress){ toast('আগে টিউশন অ্যাকাউন্টে লগইন করো'); return; }
  if(!REVIEW.count){ toast('🪽 এখন রিভিউ করার মতো পুরোনো ভুল নেই — দুর্দান্ত চলছে!'); return; }
  AU.sfx('click');
  const topicIds = (G.world.chapters || []).map(c => c.id).join(',');
  const res = await api('getReviewQuestions', { slug: G.student.slug, topicIds, limit: 5 });
  if(!res || res.status !== 'success' || !res.questions || !res.questions.length){
    toast('🪽 এখন রিভিউ প্রশ্ন আনা গেল না — একটু পরে আবার এসো');
    fetchReviewSummary();
    return;
  }
  const sess = await api('startBattleSession', { slug: G.student.slug, subject: G.world.subject, monsterType: 'review', monsterRef: 'review' });
  if(!sess || sess.status !== 'success'){ toast('সার্ভারে সংযোগ ব্যর্থ — আবার চেষ্টা করো'); return; }
  REVIEW.active = true; REVIEW.locked = false;
  REVIEW.list = res.questions; REVIEW.idx = 0; REVIEW.correct = 0; REVIEW.answered = 0;
  REVIEW.sessionId = sess.sessionId;
  hide(el.hud); hide(el.battleHud); hide(el.victory); hide(el.defeat);
  G.mode = 'battle';
  showReviewQuestion();
}
function showReviewQuestion(){
  const item = REVIEW.list[REVIEW.idx]; if(!item){ finishReview(); return; }
  el.qHeadTxt.textContent = '🪽 পুরোনো ভুলের রিভিউ — প্রশ্ন ' + (REVIEW.idx + 1) + '/' + REVIEW.list.length;
  show(el.qHead);
  renderQuestion(item);
  REVIEW.locked = false;
}
async function answerReview(chosen, btn){
  if(!REVIEW.active || REVIEW.locked) return;
  REVIEW.locked = true;
  const item = REVIEW.list[REVIEW.idx]; if(!item) return;
  const res = await api('submitBattleAnswer', {
    sessionId: REVIEW.sessionId, slug: G.student.slug, topicId: item.topicId,
    questionId: item.id, chosenIndex: chosen, timeTakenSec: 0,
    isReview: 'true', monsterType: 'review'
  });
  if(!res || res.status !== 'success'){ toast('উত্তর জমা ব্যর্থ — সংযোগ দেখো'); REVIEW.locked = false; return; }
  lockOptions(btn, res.correctIndex, chosen);
  REVIEW.answered++;
  if(res.correct){ REVIEW.correct++; AU.sfx('right'); } else { AU.sfx('wrong'); }
  setTimeout(() => {
    REVIEW.idx++;
    if(REVIEW.idx >= REVIEW.list.length) finishReview();
    else showReviewQuestion();
  }, res.correct ? 950 : 1500);
}
function finishReview(){
  const total = REVIEW.list.length, c = REVIEW.correct;
  subtitle('🪽 ' + (c === total
    ? 'সবগুলো ঠিক! পুরোনো ভুল আজ শুধরে গেল — অসাধারণ স্মৃতি!'
    : c + 'টা ঠিক হলো, বাকিগুলো আবার ফিরে আসবে — শোধরানোর সময় এখনো আছে।'), 4500);
  closeReview();
}
function closeReview(){
  if(!REVIEW.active) return;
  const total = REVIEW.list.length, c = REVIEW.correct, answered = REVIEW.answered;
  REVIEW.active = false; REVIEW.locked = false;
  hide(el.qPanel); hide(el.qHead); hide(el.qAngel);
  const xpGain = c * 2 + (total > 0 && c === total ? 5 : 0);
  const coinGain = c * 2;
  const ck = currentSubject(), cur = currencyOf(ck);
  if(xpGain) G.progress.gameXP += xpGain;
  if(coinGain){ G.progress.coins += coinGain; addCurrency(ck, coinGain); }
  refreshHud();
  if(xpGain || coinGain) saveProgress();
  if(REVIEW.sessionId) api('endBattleSession', { sessionId: REVIEW.sessionId, outcome: answered >= total && total > 0 ? 'won' : 'abandoned' });
  REVIEW.sessionId = null;
  if(xpGain) toast('🪽 রিভিউ পুরস্কার — +' + xpGain + ' XP, +' + coinGain + ' ' + cur.icon, 3200);
  G.mode = 'world';
  show(el.hud);
  setObjective(objectiveText());
  rebuildWorldState();
}

// বড় ম্যাচ শেষে ফেরার পথ: ম্যাচ চলমান থাকলে বন্ধ করে ওয়ার্ল্ডে ফেরাও (ওয়ার্ল্ড না থাকলে টাইটেলে)
function exitToAfterMatch(){
  hide(el.victory); hide(el.defeat); hide(el.qPanel); hide(el.qHead);
  if(MATCH.isActive()) MATCH.exitMatch();
  if(G.world){ G.mode = 'world'; show(el.hud); setObjective(objectiveText()); }
  else showTitle();
}
function startMatchFlow(){
  if(!G.student || !G.progress){
    toast('আগে টিউশন অ্যাকাউন্টে লগইন করো — ম্যাচের XP সেভ হবে না!');
    show(el.login); hide(el.title);
    return;
  }
  AU.init(); AU.resume(); AU.sfx('click');
  hide(el.title);
  MATCH.startMatch();
}

// ============================== INPUT ==============================
function bindInput(){
  addEventListener('keydown', e => {
    G.keys[e.key.toLowerCase()] = true;
    if(G.battle && G.battle.phase === 'answering' && ['1','2','3','4'].includes(e.key)){
      const btn = el.qOpts.children[Number(e.key)-1];
      if(btn) answerQuestion(Number(e.key)-1, btn);
    }
    if(REVIEW.active && !REVIEW.locked && ['1','2','3','4'].includes(e.key)){
      const btn = el.qOpts.children[Number(e.key)-1];
      if(btn) answerReview(Number(e.key)-1, btn);
    }
    if(MATCH.answering() && ['1','2','3','4'].includes(e.key)) MATCH.answerKey(Number(e.key)-1);
    if(e.key === 'Escape' && (G.mode === 'world' || G.mode === 'battle' || G.mode.startsWith('match'))) togglePause(true);
    if(e.key === 'Enter' && G.mode === 'match_live' && !MATCH.answering()) MATCH.usePrompt();
    if(e.key === ' ' && G.mode === 'match_plane') MATCH.jumpNow();
    if((e.key === ' ' || e.key.toLowerCase() === 'f') && G.mode === 'match_live' && !MATCH.answering()) MATCH.setFiring(true);
    if(e.key.toLowerCase() === 'c' && G.mode === 'match_live' && !MATCH.answering()) MATCH.toggleCrouch();
  });
  addEventListener('keyup', e => {
    G.keys[e.key.toLowerCase()] = false;
    if(e.key === ' ' || e.key.toLowerCase() === 'f') MATCH.setFiring(false);
  });

  // touch: left half joystick, right half camera
  let joyId = null, joyOrigin = {x:0,y:0}, camId = null, camLast = {x:0,y:0}, mouseDown = false;
  function joyStart(x, y, id){
    joyId = id; joyOrigin = {x, y};
    el.joy.style.display = 'block';
    el.joy.style.left = (x - 64) + 'px'; el.joy.style.top = (y - 64) + 'px';
  }
  function joyMove(x, y){
    let dx = x - joyOrigin.x, dy = y - joyOrigin.y;
    const len = Math.hypot(dx, dy), max = 52;
    if(len > max){ dx = dx/len*max; dy = dy/len*max; }
    el.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    G.joyVec.x = dx/max; G.joyVec.y = dy/max;
  }
  function joyEnd(){
    joyId = null; G.joyVec.x = 0; G.joyVec.y = 0;
    el.joy.style.display = 'none';
    el.joyKnob.style.transform = 'translate(-50%,-50%)';
  }
  canvas.addEventListener('touchstart', e => {
    AU.init(); AU.resume();
    for(const t of e.changedTouches){
      if(t.clientX < innerWidth/2 && joyId === null && (G.mode === 'world' || MATCH.moveEnabled())) joyStart(t.clientX, t.clientY, t.identifier);
      else if(camId === null){ camId = t.identifier; camLast = {x: t.clientX, y: t.clientY}; }
    }
    e.preventDefault();
  }, {passive: false});
  canvas.addEventListener('touchmove', e => {
    for(const t of e.changedTouches){
      if(t.identifier === joyId) joyMove(t.clientX, t.clientY);
      else if(t.identifier === camId){
        G.camYaw -= (t.clientX - camLast.x) * 0.006;
        G.camPitch = Math.min(0.9, Math.max(0.05, G.camPitch + (t.clientY - camLast.y) * 0.004));
        camLast = {x: t.clientX, y: t.clientY};
      }
    }
    e.preventDefault();
  }, {passive: false});
  const endTouch = e => {
    for(const t of e.changedTouches){
      if(t.identifier === joyId) joyEnd();
      if(t.identifier === camId) camId = null;
    }
  };
  canvas.addEventListener('touchend', endTouch);
  canvas.addEventListener('touchcancel', endTouch);

  canvas.addEventListener('mousedown', e => { mouseDown = true; camLast = {x: e.clientX, y: e.clientY}; });
  addEventListener('mousemove', e => {
    if(!mouseDown) return;
    G.camYaw -= (e.clientX - camLast.x) * 0.005;
    G.camPitch = Math.min(0.9, Math.max(0.05, G.camPitch + (e.clientY - camLast.y) * 0.0035));
    camLast = {x: e.clientX, y: e.clientY};
  });
  addEventListener('mouseup', () => mouseDown = false);

  // first gesture → audio
  addEventListener('pointerdown', () => { AU.init(); AU.resume(); AU.startAmbient(); }, {once: false});

  el.btnPause.addEventListener('click', () => togglePause(true));
  el.hudMatch.addEventListener('click', () => { if(G.mode === 'world') startMatchFlow(); });
  el.btnResume.addEventListener('click', () => togglePause(false));
  el.btnSound.addEventListener('click', () => {
    AU.setEnabled(!AU.enabled);
    el.btnSound.textContent = AU.enabled ? '🔊 সাউন্ড: চালু' : '🔇 সাউন্ড: বন্ধ';
  });
  el.btnQuit.addEventListener('click', () => {
    togglePause(false);
    if(REVIEW.active){ closeReview(); return; }
    if(MATCH.isActive()){ exitToAfterMatch(); return; }
    if(G.battle && G.battle.sessionId && G.battle.phase !== 'over') api('endBattleSession', { sessionId: G.battle.sessionId, outcome: 'abandoned' });
    exitBattle();
  });

  // বড় ম্যাচের বাটনগুলো
  el.mhPause.addEventListener('click', () => togglePause(true));
  el.dropBtn.addEventListener('click', () => MATCH.jumpNow());
  el.mhPrompt.addEventListener('click', () => MATCH.usePrompt());
  el.qClose.addEventListener('click', () => {
    if(REVIEW.active){ closeReview(); return; }
    MATCH.closePanel();
  });
  el.btnReview.addEventListener('click', () => { if(G.mode === 'world') startReviewDrill(); });

  // চাপ ধরে রাখো → গুলি ছুটছে
  const fireDown = e => { e.preventDefault(); el.mhFire.classList.add('down'); MATCH.setFiring(true); };
  const fireUp = () => { el.mhFire.classList.remove('down'); MATCH.setFiring(false); };
  el.mhFire.addEventListener('pointerdown', fireDown);
  el.mhFire.addEventListener('pointerup', fireUp);
  el.mhFire.addEventListener('pointercancel', fireUp);
  el.mhFire.addEventListener('pointerleave', fireUp);
  el.mhWall.addEventListener('click', () => MATCH.placeWall());
  el.mhBomb.addEventListener('click', () => MATCH.throwBomb());
  el.mhCrouch.addEventListener('click', () => MATCH.toggleCrouch());
}

function togglePause(on){
  if(on && (G.mode === 'world' || G.mode === 'battle' || G.mode.startsWith('match'))){
    G.prevMode = G.mode; G.mode = 'paused';
    MATCH.setFiring(false);
    show(el.pause);
  } else if(!on && G.mode === 'paused'){
    G.mode = G.prevMode || 'world';
    hide(el.pause);
  }
}

// ============================== PAUSE ON HIDE (anti-cheat) ==============================
document.addEventListener('visibilitychange', () => {
  if(document.hidden){
    if(G.mode === 'world' || G.mode === 'battle' || G.mode.startsWith('match')) togglePause(true);
    if(G.battle && G.battle.sessionId){
      api('logCheatFlag', { sessionId: G.battle.sessionId, type: 'lookAway3D', questionId: G.battle.question ? G.battle.question.id : '', detail: 'tab hidden during battle' });
    }
  }
});

// ============================== MOVEMENT & CAMERA ==============================
function updatePlayer(dt){
  if(G.mode.startsWith('match')){ MATCH.tickPlayer(dt); return; }
  if(G.mode !== 'world') return;
  let mx = 0, mz = 0;
  if(G.keys['w'] || G.keys['arrowup']) mz -= 1;
  if(G.keys['s'] || G.keys['arrowdown']) mz += 1;
  if(G.keys['a'] || G.keys['arrowleft']) mx -= 1;
  if(G.keys['d'] || G.keys['arrowright']) mx += 1;
  mx += G.joyVec.x; mz += G.joyVec.y;
  const len = Math.hypot(mx, mz);
  const moving = len > 0.12;
  if(moving){
    mx /= Math.max(1, len); mz /= Math.max(1, len);
    // movement relative to camera yaw
    const sin = Math.sin(G.camYaw), cos = Math.cos(G.camYaw);
    const wx = mx*cos - mz*sin, wz = mx*sin + mz*cos;
    P.grp.position.x += wx * P.speed * dt;
    P.grp.position.z += wz * P.speed * dt;
    P.facing = Math.atan2(wx, wz);
    P.grp.rotation.y = P.facing + Math.PI;
    if(Math.floor(P.walkPhase) !== Math.floor(P.walkPhase + dt*9)) AU.sfx('step');
  }
  // bounds
  const d = Math.hypot(P.grp.position.x, P.grp.position.z);
  if(d > WORLD_R){ P.grp.position.x *= WORLD_R/d; P.grp.position.z *= WORLD_R/d; }
  P.grp.position.y = heightAt(P.grp.position.x, P.grp.position.z);
  animatePlayer(dt, moving);

  // slow HP regen in world
  if(G.playerHp < G.playerMaxHp){
    G.playerHp = Math.min(G.playerMaxHp, G.playerHp + 4*dt);
    updateWorldHp();
  }

  // encounter check
  for(const m of G.monsters){
    if(m.defeated) continue;
    const dist = m.pos.distanceTo(P.grp.position);
    if(m.type === 'boss'){
      m.rig.root.visible = G.world.bossUnlocked && dist < 42;
      if(G.world.bossUnlocked && dist < 10){ enterBattle(m); break; }
    } else if(dist < ARENA_R + 1.2){
      enterBattle(m); break;
    }
  }
}

function updateCamera(dt){
  if(!MATCH.camUpdate(dt)){
    if(G.mode === 'battle' || G.mode === 'cinematic'){
      if(!G.battle && !G.lastBattleCam){ /* fallback */ }
      const m = G.battle ? G.battle.monster : null;
      if(m){
        const mid = tmpV.copy(P.grp.position).add(m.rig.root.position).multiplyScalar(0.5);
        mid.y += 2.2;
        const side = tmpV2.copy(m.rig.root.position).sub(P.grp.position).normalize();
        const px = -side.z, pz = side.x;
        const dist = 9.5;
        camera.position.x += (mid.x + px*dist - camera.position.x) * Math.min(1, dt*3.2);
        camera.position.y += (mid.y + 2.4 - camera.position.y) * Math.min(1, dt*3.2);
        camera.position.z += (mid.z + pz*dist - camera.position.z) * Math.min(1, dt*3.2);
        camera.lookAt(mid);
      }
    } else if(G.mode === 'title' || G.mode === 'loading'){
      const t = G.time * 0.06;
      camera.position.set(Math.sin(t)*46, 15 + Math.sin(t*0.6)*3, Math.cos(t)*46);
      camera.lookAt(0, 2, -10);
    } else {
      const target = P.grp.position;
      const R = 8.2;
      const cx = target.x + Math.sin(G.camYaw) * Math.cos(G.camPitch) * R;
      const cz = target.z + Math.cos(G.camYaw) * Math.cos(G.camPitch) * R;
      const cy = target.y + 1.4 + Math.sin(G.camPitch) * R;
      camera.position.x += (cx - camera.position.x) * Math.min(1, dt*7);
      camera.position.y += (cy - camera.position.y) * Math.min(1, dt*7);
      camera.position.z += (cz - camera.position.z) * Math.min(1, dt*7);
      tmpV.set(target.x, target.y + 1.7, target.z);
      camera.lookAt(tmpV);
    }
  }
  if(G.shake > 0){
    G.shake = Math.max(0, G.shake - dt*1.8);
    camera.position.x += (Math.random()-0.5) * G.shake * 0.7;
    camera.position.y += (Math.random()-0.5) * G.shake * 0.7;
  }
  // keep sun shadow frustum near the player
  if(sunLight && P.grp){
    sunLight.position.set(P.grp.position.x - 38, 42, P.grp.position.z - 52);
    sunLight.target.position.copy(P.grp.position);
    sunLight.target.updateMatrixWorld();
  }
}

// ============================== LOOP ==============================
function loop(){
  requestAnimationFrame(loop);
  const rawDt = Math.min(0.05, clock.getDelta());
  G.time += rawDt;
  // hit-stop: world animations freeze for a few frames on impact, camera stays smooth
  let dt = rawDt;
  if(G.hitStop > 0){ G.hitStop = Math.max(0, G.hitStop - rawDt); dt = 0; }
  if(G.mode !== 'paused'){
    updatePlayer(dt);
    if(G.mode.startsWith('match')) MATCH.tick(dt);
    updateCamera(rawDt);
    updateChild(dt);
    updateFireflies(dt);
    updateProjectiles(dt);
    updateBursts(dt);
    updatePet(dt);
    for(const m of G.monsters){ if(m.rig && m.rig.root.visible !== false) animateGolem(m.rig, dt); }
    if(G.mode === 'world' && Math.floor(G.time*2) !== Math.floor((G.time-rawDt)*2)){ setObjective(objectiveText()); maybeGossip(); }
    for(const m of G.monsters){ if(m.decor && m.decor.userData.orb){ m.decor.userData.orb.rotation.y += dt; m.decor.userData.orb.position.y = 2.2 + Math.sin(G.time*1.5)*0.16; } }
    const wp = 0.3 + Math.sin(G.time*1.6)*0.12;
    for(const wm of waterMats) wm.emissiveIntensity = wp;
    if(gateBarrier) gateBarrier.material.opacity = (G.world && G.world.bossUnlocked ? 0.3 : 0.13) + Math.sin(G.time*2)*0.05;
  }
  renderer.render(scene, camera);
}

// ============================== INIT ==============================
async function initThree(){
  setLoad(8, '৩ডি ইঞ্জিন চালু হচ্ছে…');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0e1a16, 0.0075);
  camera = new THREE.PerspectiveCamera(58, innerWidth/innerHeight, 0.1, 1300);
  camera.position.set(30, 18, 60);
  clock = new THREE.Clock();

  hemi = new THREE.HemisphereLight(0x3a5a40, 0x141c10, 0.9);
  scene.add(hemi);
  sunLight = new THREE.DirectionalLight(0xffd9a0, 1.9);
  sunLight.position.set(-38, 42, -52);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -34; sunLight.shadow.camera.right = 34;
  sunLight.shadow.camera.top = 34; sunLight.shadow.camera.bottom = -34;
  sunLight.shadow.camera.far = 160;
  sunLight.shadow.bias = -0.0008;
  scene.add(sunLight); scene.add(sunLight.target);

  setLoad(16, 'জঙ্গলের গাছপালা আনা হচ্ছে…');
  await loadModels();
  setLoad(38, 'আকাশ আর মাটি তৈরি হচ্ছে…');
  buildSky(); buildTerrain();
  await frame();
  setLoad(54, 'নদী, পাহাড় আর হিমালয়…');
  buildRiver();
  buildMountains();
  await frame();
  setLoad(68, 'গভীর বন…');
  buildVegetation(); buildFireflies();
  await frame();
  setLoad(84, 'স্মৃতি জাগছে…');
  buildPlayer(); buildPlayerGuns(); buildGate(true); buildChild();
  fxGroup = new THREE.Group(); scene.add(fxGroup);
  setLoad(92, 'শেষ টান…');
}
function frame(){ return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }

addEventListener('resize', () => {
  if(!renderer) return;
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ============================== AUTH & SCREENS ==============================
function showTitle(){
  G.mode = 'title';
  hide(el.loading); hide(el.login); show(el.title);
  const logged = !!G.student;
  el.titlePlayer.classList.toggle('hidden', !logged);
  el.btnPlay.textContent = logged ? '🌴  জগৎ-যুদ্ধ (গল্প)' : '🔑  অ্যাকাউন্টে প্রবেশ করো';
  el.btnMatch.textContent = logged ? '🪂  বড় ম্যাচ (ব্যাটল রয়্যাল)' : '🔑  অ্যাকাউন্টে প্রবেশ করো';
  el.btnMatch.classList.toggle('ghost', !logged);
  el.btnPlay.classList.toggle('ghost', logged);
  el.btnLogout.classList.toggle('hidden', !logged);
  el.btnShop.classList.toggle('hidden', !logged);
  refreshHud();
}

// ---------- দোকানের পর্দা ----------
let shopTab = 'physics';
function openShop(){
  if(!G.student){ show(el.login); hide(el.title); return; }
  AU.sfx('click');
  shopTab = currentSubject();
  hide(el.title);
  show(el.shop);
  renderShop();
}
function closeShop(){
  AU.sfx('click');
  hide(el.shop);
  showTitle();
}

// ---------- জগৎ বাছাইয়ের পর্দা ----------
let worldsBusy = false;
function openWorlds(){
  if(!G.student){ show(el.login); hide(el.title); return; }
  AU.sfx('click');
  hide(el.title);
  show(el.worlds);
  renderWorlds();
}
function closeWorlds(){
  AU.sfx('click');
  hide(el.worlds);
  showTitle();
}
function renderWorlds(){
  const ws = G.worlds || [];
  if(!ws.length){
    el.worldsGrid.innerHTML = '<div class="shop-empty">এখনো কোনো বিষয়-জগৎ যোগ হয়নি — শিক্ষক অধ্যায় যোগ করলে এখানে দেখা যাবে।</div>';
    return;
  }
  const curId = G.world ? G.world.id : null;
  el.worldsGrid.innerHTML = ws.map(w => {
    const key = subjectKey(w.subject);
    const c = currencyOf(key);
    const total = w.totalChapters || 0, cleared = w.clearedChapters || 0;
    const playable = (w.chapters || []).length > 0;
    const cur = w.id === curId;
    let btn = '';
    if(playable){
      btn = cur
        ? `<button class="btn small" data-world="${esc(w.id)}">▶ খেলা চালিয়ে যাও</button>`
        : `<button class="btn small" data-world="${esc(w.id)}">এই জগতে যাও</button>`;
    }
    return `<div class="world-card${cur ? ' cur' : ''}${playable ? '' : ' off'}">
      <div class="wc-top">
        <span class="wc-ico">${c.icon}</span>
        <div><div class="wc-name">${esc(w.title || c.name)}</div><div class="wc-sub">${c.name} — ${c.unit}</div></div>
      </div>
      <div class="wc-meta">${playable
        ? `অধ্যায় সম্পন্ন: <b>${cleared}/${total}</b>${w.bossUnlocked ? '<span class="wc-badge">👑 বস উন্মুক্ত</span>' : ''}`
        : 'এখনো কোনো অধ্যায় যোগ হয়নি'}</div>
      ${btn}
    </div>`;
  }).join('');
}
async function enterWorldFromPicker(id){
  if(worldsBusy) return;
  const w = (G.worlds || []).find(x => x.id === id);
  if(!w || !(w.chapters || []).length) return;
  AU.init(); AU.resume(); AU.sfx('gate');
  if(G.world && G.world.id === id){ hide(el.worlds); startPlay(); return; }
  worldsBusy = true;
  pickWorld(id);
  await rebuildWorldState();
  worldsBusy = false;
  hide(el.worlds);
  startPlay();
}
function renderShop(){
  // টাকার থলি
  el.shopWallet.innerHTML = Object.keys(CURRENCIES).map(k => {
    const c = CURRENCIES[k];
    const active = k === shopTab ? ' hi' : '';
    return `<div class="wal${active}">${c.icon} ${c.unit} <b>${(G.progress.currencies && G.progress.currencies[k]) || 0}</b></div>`;
  }).join('');

  // বিষয়ের ট্যাব
  el.shopTabs.innerHTML = Object.keys(SHOP_TABS).map(k =>
    `<button class="shop-tab${k === shopTab ? ' active' : ''}" data-tab="${k}">${CURRENCIES[k].icon} ${SHOP_TABS[k]}</button>`
  ).join('');

  // জিনিসের তালিকা
  const goods = SHOP_ITEMS.filter(i => i.subject === shopTab);
  el.shopGrid.innerHTML = goods.map(it => {
    const owned = isOwned(it.id);
    const equipped = equippedId(it.slot) === it.id;
    const have = (G.progress.currencies && G.progress.currencies[it.subject]) || 0;
    const affordable = have >= it.price;
    let btn;
    if(equipped) btn = `<button class="btn small ghost" data-act="unequip" data-id="${it.id}" data-slot="${it.slot}">✔ পরে আছে — খুলব?</button>`;
    else if(owned) btn = `<button class="btn small" data-act="equip" data-id="${it.id}">পরে নাও</button>`;
    else btn = `<button class="btn small ${affordable ? '' : 'ghost'}" data-act="buy" data-id="${it.id}" ${affordable ? '' : 'disabled style="opacity:.5"'}>কিনে ফেলো</button>`;
    const cls = 'shop-item' + (equipped ? ' equipped' : (owned ? ' owned' : ''));
    const priceTxt = owned ? '<span class="price-tag ok">তোমার কাছে আছে</span>'
      : `<span class="price-tag">${CURRENCIES[it.subject].icon} ${it.price}</span>`;
    return `<div class="${cls}">
      <div class="si-top">
        <span class="si-ico">${it.icon}</span>
        <div><div class="si-name">${it.name}</div><div class="si-sub">${SHOP_TABS[it.subject]}</div></div>
      </div>
      <div class="si-desc">${it.desc}</div>
      <div class="si-price">${priceTxt}${btn}</div>
    </div>`;
  }).join('') || '<div class="shop-empty">এই বিষয়ে এখনো কিছু নেই।</div>';
}
function buyItem(id){
  const it = itemById(id);
  if(!it || isOwned(id)) return;
  const cur = G.progress.currencies || (G.progress.currencies = {});
  const have = cur[it.subject] || 0;
  if(have < it.price){ toast('যথেষ্ট ' + CURRENCIES[it.subject].unit + ' নেই — আরও পড়াশোনা করে রোজগার করো'); AU.sfx('wrong'); return; }
  cur[it.subject] = have - it.price;
  if(!G.progress.inventory) G.progress.inventory = [];
  G.progress.inventory.push(id);
  if(!G.progress.equippedItems) G.progress.equippedItems = {};
  if(!G.progress.equippedItems[it.slot]){
    G.progress.equippedItems[it.slot] = id;
    applyEquipVisuals();
    toast('🎉 ' + it.name + ' কিনে সোজা পরে নিলে!');
  } else {
    toast('🎉 ' + it.name + ' কিনে ফেলেছ — চাইলে পরে নিতে পারো');
  }
  AU.sfx('coin');
  refreshHud(); renderShop(); saveProgress();
}
function equipItem(id){
  const it = itemById(id);
  if(!it || !isOwned(id)) return;
  if(!G.progress.equippedItems) G.progress.equippedItems = {};
  G.progress.equippedItems[it.slot] = id;
  applyEquipVisuals();
  AU.sfx('click');
  toast(it.icon + ' ' + it.name + ' পরে নিয়েছ');
  renderShop(); saveProgress();
}
function unequipSlot(slot){
  const cur = equippedId(slot);
  if(!cur) return;
  delete G.progress.equippedItems[slot];
  applyEquipVisuals();
  AU.sfx('click');
  renderShop(); saveProgress();
}
// পরে থাকা জিনিসের রঙ/সঙ্গী সাথে সাথে মাঠে বসিয়ে দাও
function applyEquipVisuals(){
  const skin = equippedItem('skin');
  if(P.suitMat){
    P.suitMat.color.setHex(skin ? skin.suit : P.baseSuitColor);
    P.suitDMat.color.setHex(skin ? skin.suitDark : P.baseSuitDarkColor);
  }
  // বর্মের পোশাক পরলে গায়ে বর্মের দৃশ্য দেখা যাবে
  const suit = equippedItem('suit');
  if(P.vest) P.vest.visible = !!(suit && suit.id === 'suit_vest');
  if(P.armorV) P.armorV.visible = !!(suit && suit.id === 'suit_heavy');
  updatePlayerGun();
  refreshPet();
}
async function startPlay(){
  if(!G.student){ show(el.login); hide(el.title); return; }
  if(!G.world){
    toast('এখনো কোনো চ্যাপ্টার যোগ হয়নি — পরে আবার এসো');
    return;
  }
  AU.sfx('gate');
  applyWorldMood();
  fadeBlack(true);
  setTimeout(() => {
    hide(el.title);
    show(el.hud);
    G.mode = 'world';
    G.camYaw = Math.PI + Math.atan2(spawnPos.x - arenaPos(0, Math.max(1,G.monsters.length-1)).x, spawnPos.z - arenaPos(0, Math.max(1,G.monsters.length-1)).z) * 0.4;
    updateWorldHp(); refreshHud(); setObjective(objectiveText());
    const st = childStage();
    if(CH.grp && st !== CH.stage) setChildStage(st, true);
    fadeBlack(false);
    toast('🌿 ' + (G.world.title || 'স্মৃতির জঙ্গল') + ' — স্বাগতম, ' + G.student.name + '!', 3000);
    lastGossipAt = G.time;
    setTimeout(() => subtitle('🎙️ "ওরা তোমাকে চেনে না… কিন্তু তোমার প্রশ্নগুলো চেনে। সাবধানে এগোও।"', 5000), 2600);
  }, 480);
}

function bindScreens(){
  el.btnPlay.addEventListener('click', () => { AU.init(); AU.resume(); AU.sfx('click'); openWorlds(); });
  el.btnMatch.addEventListener('click', startMatchFlow);
  el.btnWorldsClose.addEventListener('click', closeWorlds);
  el.worldsGrid.addEventListener('click', e => {
    const b = e.target.closest('[data-world]');
    if(b) enterWorldFromPicker(b.dataset.world);
  });
  el.btnLogout.addEventListener('click', () => {
    try{ localStorage.removeItem('tuition_logged_student'); }catch(e){}
    G.student = null;
    toast('লগআউট সম্পন্ন');
    showTitle();
  });
  el.btnLoginBack.addEventListener('click', () => { hide(el.login); show(el.title); });
  el.btnLogin.addEventListener('click', doLogin);
  el.liPass.addEventListener('keydown', e => { if(e.key === 'Enter') doLogin(); });

  // দোকান
  el.btnShop.addEventListener('click', openShop);
  el.btnShopClose.addEventListener('click', closeShop);
  el.shopTabs.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if(!b) return;
    shopTab = b.dataset.tab;
    AU.sfx('click');
    renderShop();
  });
  el.shopGrid.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if(!b) return;
    if(b.dataset.act === 'buy') buyItem(b.dataset.id);
    else if(b.dataset.act === 'equip') equipItem(b.dataset.id);
    else if(b.dataset.act === 'unequip') unequipSlot(b.dataset.slot);
  });
  el.btnVCont.addEventListener('click', async () => {
    AU.sfx('click');
    hide(el.victory);
    if(MATCH.isActive()){ exitToAfterMatch(); return; }
    exitBattle();
    await rebuildWorldState();
  });
  el.btnDRetry.addEventListener('click', () => {
    AU.sfx('click');
    if(MATCH.isActive()){
      hide(el.defeat);
      MATCH.exitMatch();
      MATCH.startMatch();
      return;
    }
    const m = G.battle ? G.battle.monster : null;
    hide(el.defeat);
    exitBattle();
    if(m) setTimeout(() => enterBattle(m), 350);
  });
  el.btnDLeave.addEventListener('click', () => {
    AU.sfx('click');
    if(MATCH.isActive()){ exitToAfterMatch(); return; }
    exitBattle();
  });

  // install prompt
  addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    G.deferredInstall = e;
    el.btnInstall.classList.remove('hidden');
  });
  el.btnInstall.addEventListener('click', async () => {
    if(!G.deferredInstall) return;
    G.deferredInstall.prompt();
    await G.deferredInstall.userChoice;
    G.deferredInstall = null;
    el.btnInstall.classList.add('hidden');
  });
}

async function doLogin(){
  const name = el.liName.value.trim();
  const pass = el.liPass.value.trim();
  el.liErr.textContent = '';
  if(!name || !pass){ el.liErr.textContent = 'নাম আর পাসওয়ার্ড দুটোই দরকার'; return; }
  el.btnLogin.setAttribute('disabled', '');
  el.btnLogin.textContent = 'যাচাই হচ্ছে…';
  const res = await api('studentLogin', { name, password: pass, slug: slugify(name) });
  el.btnLogin.removeAttribute('disabled');
  el.btnLogin.textContent = 'অ্যাকাউন্টে প্রবেশ করো';
  if(!res){ el.liErr.textContent = offlineMode ? 'ইন্টারনেট সংযোগ নেই — পরে চেষ্টা করো' : 'সার্ভারে সমস্যা হয়েছে'; return; }
  if(res.status !== 'success'){
    el.liErr.textContent = res.message === 'wrong_password' ? 'ভুল পাসওয়ার্ড — আবার লিখো'
      : res.message === 'not_registered' ? 'এই নামে কোনো অ্যাকাউন্ট নেই — প্রথমে টিউশন অ্যাপে সাইনআপ করো' : 'লগইন ব্যর্থ';
    return;
  }
  G.student = { name: res.name, slug: res.slug, studentCode: res.studentCode };
  setLoggedStudent(G.student);
  await bootstrapStudent();
  toast('স্বাগতম, ' + res.name + '!');
  hide(el.login); showTitle();
}

async function bootstrapStudent(){
  G.progress = await loadProgress();
  G.world = await loadWorldData();
  if(G.world && !G.monsters.length) spawnMonsters();
  refreshHud();
  applyEquipVisuals();
  fetchReviewSummary();
}

// rebuild monster/decor states after a victory (refresh without full reload)
async function rebuildWorldState(){
  // simplest reliable route: reload world visuals
  for(const m of G.monsters){ scene.remove(m.rig.root); if(m.decor) scene.remove(m.decor); }
  G.monsters = [];
  const w = await loadWorldData();
  if(w) G.world = w;
  if(G.world) spawnMonsters();
  applyWorldMood();
  fetchReviewSummary();
}

// ============================== BOOT ==============================
(async function boot(){
  MATCH.initMatch({
    G, el, P, CH, AU, api, toast, subtitle, show, hide, esc, renderMath, lockOptions,
    heightAt, fireProjectile, impactBurst, floater, screenFlash, saveProgress,
    addCurrency, currentSubject, currencyOf, levelFromXp, animatePlayer, spawnPos,
    isWater, riverD, equippedItem,
    buildGunModel, buildBotGun, buildGearModel, updatePlayerGun,
    CONCEAL_SPOTS,
    scene: () => scene, camera: () => camera, gateGroup: () => gateGroup,
  });
  bindScreens();
  bindInput();
  try{
    await initThree();
  }catch(err){
    console.error(err);
    el.ldMsg.textContent = '⚠️ ডিভাইসে WebGL চালু করা যায়নি — নতুন ক্রোম/সাফারি দিয়ে চেষ্টা করো';
    return;
  }
  loop();
  setLoad(94, 'অ্যাকাউন্ট যুক্ত হচ্ছে…');
  const st = getLoggedStudent();
  if(st && st.slug){
    G.student = st;
    await bootstrapStudent();
  }
  setLoad(100, 'প্রস্তুত!');
  setTimeout(showTitle, 350);
})();
