// ============================================================
//  স্মৃতির জঙ্গল — নেট-স্তর (বন্ধুদের সাথে এক ম্যাচ)
// ------------------------------------------------------------
//  দুটি ট্রান্সপোর্ট:
//    • cloud : Supabase Realtime Broadcast (net-config.js-এ চাবি থাকলে)
//    • local : BroadcastChannel — একই ব্রাউজারের দুই ট্যাব (?net=local)
//
//  গোপন-কথা: ঘর-আইডি ছাড়া কারও ঠিকানা জানা যায় না; বট সবসময়
//  নিজের ডিভাইসেই চলে, তাই কেউ টের পায় না অন্যরা বট না আসল।
// ============================================================

const BN = '০১২৩৪৫৬৭৮৯';
const bn = n => String(n).replace(/\d/g, d => BN[+d]);

const now = () => Date.now();

const ROOM_KEY = 'sj_net_room';
const PING_EVERY = 3000;      // প্রাণ-স্পন্দন
const STALE_MS = 9000;        // এত সময় কিছু না পেলে তালিকা থেকে বাদ
const COUNTDOWN_MS = 3200;    // "শুরু হচ্ছে" ঘোষণা
const LATE_JOIN_MS = 12000;   // এতক্ষণ পরেও ম্যাচ চলছে ধরা হবে

// ---------- ছোট নামের তালিকা (ছাত্র-আইডি না থাকলে) ----------
const ANIMAL = [
  'বাঘ', 'সিংহ', 'হরিণ', 'চিতা', 'ময়ূর', 'তিমি', 'বাজ', 'কোয়েল',
  'শিয়াল', 'ভালুক', 'প্যাঁচা', 'ঘুড়ি', 'হাতি', 'মাছরাঙা', 'চিতাবাঘ',
  'গণ্ডার', 'সমুদ্র', 'পাহাড়', 'নদী', 'মেঘ', 'তারামাছ', 'ধূমকেতু',
  'বনফুল', 'জোনাকি', 'রোদ', 'ঝড়', 'তুফান', 'বজ্র', 'অরণ্য', 'কুয়াশা',
];
function fallbackName(){
  return ANIMAL[Math.floor(Math.random() * ANIMAL.length)] + ' ' +
         bn(10 + Math.floor(Math.random() * 90));
}

// ---------- যোগ্যতা যাচাই ----------
let offForced = null;
function readParam(name){
  if(offForced === null){
    try { offForced = new URLSearchParams(location.search); }
    catch (e) { offForced = new URLSearchParams(''); }
  }
  return offForced.get(name);
}
function cfg(){
  const c = (typeof window !== 'undefined' && window.NET_CONFIG) || null;
  if(!c) return null;
  if(typeof c.url !== 'string' || typeof c.key !== 'string') return null;
  if(!c.url.trim() || !c.key.trim()) return null;
  return { url: c.url.trim(), key: c.key.trim() };
}
function isLocalMode(){
  return (readParam('net') || '').toLowerCase() === 'local';
}
export function enabled(){
  const net = (readParam('net') || '').toLowerCase();
  if(net === 'off') return false;
  if(net === 'local') return typeof BroadcastChannel !== 'undefined';
  return !!cfg() && typeof WebSocket !== 'undefined';
}
export function isCloud(){ return !isLocalMode() && !!cfg(); }

function sanRoom(s){
  return String(s || '').toLowerCase()
    .replace(/[^a-z0-9_-]/g, '').slice(0, 16);
}
function esc(s){
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function cutName(s, n){
  const t = String(s === null || s === undefined ? '' : s).trim();
  return t.length > n ? t.slice(0, n) : t;
}

// ---------- ব্যক্তিগত পরিচয় (ছাত্র-অ্যাকাউন্ট থেকে) ----------
export let SID = '';
export let NAME = '';
export let LVL = 1;
let idReady = false;

function initId(){
  if(idReady) return;
  idReady = true;
  let st = null;
  try {
    st = JSON.parse(localStorage.getItem('tuition_logged_student') || 'null');
  } catch (e) { st = null; }
  let sid = '', name = '', lv = 1;
  if(st && typeof st === 'object'){
    sid = String(st.studentCode || st.code || st.slug || st.id || '');
    name = String(st.name || st.studentName || st.displayName || '');
    lv = Number(st.level) || 1;
  }
  if(!sid){
    try { sid = localStorage.getItem('sj_net_sid') || ''; } catch (e) {}
    if(!sid){
      sid = 'p' + Math.random().toString(36).slice(2, 8) + now().toString(36).slice(-3);
    }
  }
  try { localStorage.setItem('sj_net_sid', sid); } catch (e) {}
  if(!name) name = fallbackName();
  // টেস্ট-সুবিধা: ?netname=X&netsid=Y
  const pn = readParam('netname'), ps = readParam('netsid');
  if(pn) name = pn;
  if(ps) sid = ps;
  SID = String(sid).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || 'p';
  NAME = cutName(name, 14);
  LVL = Math.max(1, Math.min(99, Math.round(lv)));
}
export function setIdentity(o){
  initId();
  if(o && typeof o === 'object'){
    if(o.sid) SID = String(o.sid).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || SID;
    if(o.name) NAME = cutName(o.name, 14);
    if(o.lv) LVL = Math.max(1, Math.min(99, Math.round(Number(o.lv) || LVL)));
  }
}
export function mySid(){ initId(); return SID; }
export function myName(){ initId(); return NAME || 'যোদ্ধা'; }

// ---------- পুরো অবস্থা ----------
const S = {
  ui: null,        // লবির DOM রেফারেন্স
  client: null,    // supabase client (ক্লাউড-মোডে)
  ch: null,        // channel
  ts: null,        // transport { send(payload), close() }
  localBc: null,   // BroadcastChannel (লোকাল-মোডে)
  gen: 0,          // পুরনো সংযোগ এড়াতে প্রজন্ম-গণনা
  active: false,
  stage: 'idle',   // idle | lobby | match
  room: 'jungle',
  remotes: new Map(),
  cdUntil: 0,
  matchT: 0,       // ম্যাচ শুরুর সময় (হোস্ট-ঘড়ির)
  pulse: 0,        // pulse interval id
  connecting: false, // সংযোগ-প্রক্রিয়া চলছে কি না
  lastErr: '',     // শেষ সংযোগ-ব্যর্থতার বার্তা
  nextTry: 0,      // পরের পুনঃচেষ্টার সময়
  lastSent: 0,
  lastPing: 0,
  lastRx: 0,
  lastSt: -1,
  lastRy: 99,
  cdLast: -1,
  cb: {},          // onStart / onCancel / onCountdown / onPlayers
  handler: null,   // match.js-এর হাতল
};

// ---------- লবির DOM ----------
function buildLobbyUI(){
  if(S.ui) return S.ui;
  const d = document.createElement('div');
  d.id = 'net-lobby';
  d.className = 'hidden';
  d.innerHTML =
    '<div class="nl-card">' +
      '<div class="nl-title">⚔️ <span>বন্ধুদের সাথে এক ম্যাচ</span></div>' +
      '<div class="nl-roomrow">' +
        '<span class="nl-lbl">ঘর</span>' +
        '<input id="nl-room" maxlength="16" autocomplete="off" spellcheck="false" />' +
        '<button class="btn small ghost" id="nl-copy">📋 কপি</button>' +
      '</div>' +
      '<div class="nl-status" id="nl-status">সংযোগ হচ্ছে…</div>' +
      '<div class="nl-players" id="nl-players"></div>' +
      '<div class="nl-hint" id="nl-hint">' +
        'বন্ধুকে ডাকো — সে গেমে ঢুকে <b>একই ঘর-কোড</b> বসিয়ে “আরও একজনের জন্য অপেক্ষা” দেখবে। ' +
        '<b>প্রতিটি ঘরে বাকি খেলোয়াড় আসবে বট হিসেবে</b>, তাই জঙ্গল সবসময় ভরাট থাকে।' +
      '</div>' +
      '<div class="nl-btns">' +
        '<button class="btn" id="nl-start" disabled>▶️ ম্যাচ শুরু করো</button>' +
        '<button class="btn small ghost" id="nl-solo">🎮 একলা খেলো</button>' +
        '<button class="btn small ghost" id="nl-cancel">ফিরে যাও</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(d);

  const q = s => d.querySelector(s);
  const ui = {
    root: d,
    room: q('#nl-room'),
    copy: q('#nl-copy'),
    status: q('#nl-status'),
    players: q('#nl-players'),
    hint: q('#nl-hint'),
    start: q('#nl-start'),
    solo: q('#nl-solo'),
    cancel: q('#nl-cancel'),
    bound: false,
  };
  S.ui = ui;
  return ui;
}

function refreshRoomUI(){
  const ui = S.ui;
  if(!ui) return;
  ui.room.value = S.room;
  let txt;
  if(!S.active){
    txt = '<span class="nl-warn">ঘরে বসা হয়নি — “ঘর বদলাও” চাপলে আবার চেষ্টা হবে।</span>';
  } else if(S.stage === 'match'){
    txt = '<span class="nl-warn">🎒 ম্যাচ চলছে — অন্য কেউ এলেই জানিয়ে দেওয়া হবে।</span>';
  } else if(S.cdUntil){
    txt = '⏳ শুরু হচ্ছে…';
  } else if(!S.ts){
    txt = S.connecting
      ? '📡 সংযোগ হচ্ছে…'
      : '<span class="nl-warn">📡 ' + esc(S.lastErr || 'সংযোগ বিচ্ছিন্ন — আবার চেষ্টা চলছে…') + '</span>';
  } else {
    const others = listOthers().length;
    txt = '✅ <span class="nl-ok">' + (S.room === 'jungle' ? 'ডিফল্ট ঘর' : 'ঘর') + ' <b>' + esc(S.room) +
      '</b></span> · তোমার সাথে ' + bn(others) + ' জন — আরও ' +
      (others > 0 ? 'খেলোয়াড়' : 'কেউ এখনো আসেনি, অপেক্ষা');
    if(others > 0) txt += ' আসুক অথবা “একলা খেলো” চাপো';
    txt += '।';
  }
  ui.status.innerHTML = txt;
  const host = hostSid();
  const iAmHost = (host === mySid());
  ui.start.disabled = !S.active || S.stage !== 'lobby' || !!S.cdUntil || !iAmHost;
  refreshPlayersUI();
}

let lastPlayersKey = '';
function refreshPlayersUI(){
  const ui = S.ui;
  if(!ui || !S.active || S.stage !== 'lobby') return;
  const host = hostSid();
  const me = mySid();
  const ids = [];
  const rows = [];
  const push = (sid, name, lv, mine) => {
    const isHost = sid === host;
    const tag = mine ? ' (তুমি)' : '';
    const crown = isHost ? '👑 ' : '';
    rows.push({ k: sid, html: '<div class="nl-chip' + (mine ? ' me' : '') + '">' +
      crown + esc(name) + ' · স্তর ' + bn(lv) + tag + '</div>' });
    ids.push(sid);
  };
  push(me, myName(), LVL, true);
  const others = listOthers();
  others.sort((a, b) => (a.sid < b.sid ? -1 : 1));
  for(const r of others) push(r.sid, r.name, r.lvl, false);
  const key = ids.join('|');
  if(key !== lastPlayersKey){
    lastPlayersKey = key;
    ui.players.innerHTML = rows.map(r => r.html).join('');
  }
  if(others.length === 0){
    ui.hint.innerHTML = '🔗 <b>ইন্টারনেটে সেরা নয়?</b> একই ফোনে বা কম্পিউটারে দুই ট্যাব খুলে ঠিকানা-বারে <b>?net=local</b> যোগ করলে অফলাইনেই দুইজন খেলতে পারবে।';
  }
}

function statusBad(msg){
  const ui = S.ui;
  if(!ui) return;
  ui.status.innerHTML = '<span class="nl-warn">' + esc(msg) + '</span>';
}

// ---------- কমন বার্তা ----------
function buildMsg(extra){
  initId();
  return Object.assign({ sid: SID, name: NAME, lv: LVL }, extra);
}
function sendMsg(obj){
  if(!S.ts || !S.active) return false;
  try { S.ts.send(obj); return true; } catch (e) { return false; }
}

// ---------- অন্যেরা ----------
function isFresh(r){ return (now() - r.last) < STALE_MS; }
function listOthers(){
  const out = [];
  for(const r of S.remotes.values()){
    if(!isFresh(r) || r.gone) continue;
    out.push({ sid: r.sid, name: r.name, lvl: r.lvl });
  }
  return out;
}
function hostSid(){
  const me = mySid();
  let h = me;
  for(const r of S.remotes.values()){
    if(!isFresh(r) || r.gone) continue;
    if(r.sid < h) h = r.sid;
  }
  return h;
}
function rosterSnap(){
  const out = [[mySid(), myName(), LVL]];
  for(const x of listOthers()) out.push([x.sid, x.name, x.lvl]);
  return out;
}
function getRemote(sid){
  let r = S.remotes.get(sid);
  if(!r){
    r = {
      sid, name: 'যোদ্ধা', lvl: 1, st: 0, gone: false,
      x: 0, y: 0, z: 0, ry: 0, tx: 0, ty: 0, tz: 0, try_: 0,
      has: false, last: 0, listT: 0,
    };
    S.remotes.set(sid, r);
  }
  return r;
}
function pruneRemotes(){
  for(const r of Array.from(S.remotes.values())){
    if(isFresh(r)) continue;
    S.remotes.delete(r.sid);
    if(S.handler && S.handler.onLeave && r.alive !== false) S.handler.onLeave(r.sid);
  }
  if(S.ui) refreshRoomUI();
}

// ---------- শুরু/ফেরত (কাউন্টডাউন) ----------
function beginMatch(){
  if(!S.active || S.stage !== 'lobby') return;
  if(hostSid() !== mySid()){ S.cdUntil = 0; refreshRoomUI(); return; }
  S.cdUntil = 0;
  S.cdLast = -1;
  S.matchT = now();
  const r = rosterSnap();
  sendMsg(buildMsg({ t: 'start', t0: S.matchT, roster: r }));
  const h = S.handler;
  detachMatch();
  if(!h){ statusBad('সংযোগ বন্ধ হয়ে গেছে — “ফিরে যাও” চেপে আবার চেষ্টা করো।'); return; }
  S.handler = h;
  S.stage = 'match';
  if(h.onStart) h.onStart(r);
}
function startCountdown(){
  if(!S.active || S.stage !== 'lobby' || S.cdUntil) return;
  if(hostSid() !== mySid()) return;
  if(listOthers().length === 0){ beginMatch(); return; }
  S.cdUntil = now() + COUNTDOWN_MS;
  refreshRoomUI();
  if(S.cb.onCountdown) S.cb.onCountdown(Math.ceil(COUNTDOWN_MS / 1000));
}
function tickCountdown(){
  if(!S.cdUntil) return;
  if(hostSid() !== mySid()){ S.cdUntil = 0; refreshRoomUI(); return; }
  const left = S.cdUntil - now();
  const sec = Math.max(0, Math.ceil(left / 1000));
  if(sec !== S.cdLast){
    S.cdLast = sec;
    if(S.cb.onCountdown) S.cb.onCountdown(sec);
  }
  if(left <= 0) beginMatch();
}

// ---------- আকাশ-ট্রান্সপোর্ট (Supabase Realtime) ----------
let sbLoading = null;
function loadSupabase(){
  if(window.supabase && window.supabase.createClient) return Promise.resolve(true);
  if(sbLoading) return sbLoading;
  sbLoading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = './vendor/supabase.js';
    s.onload = () => {
      if(window.supabase && window.supabase.createClient) res(true);
      else rej(new Error('supabase sdk loaded but missing'));
    };
    s.onerror = () => { sbLoading = null; rej(new Error('supabase sdk failed to load')); };
    document.head.appendChild(s);
  });
  return sbLoading;
}
async function openCloud(){
  const c = cfg();
  if(!c) throw new Error('net-config.js-এ চাবি বসানো নেই');
  await loadSupabase();
  if(!S.client){
    S.client = window.supabase.createClient(c.url, c.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  const myGen = S.gen;
  const ch = S.client.channel('sj-room-' + S.room, {
    config: { broadcast: { self: false, ack: false } },
  });
  S.ch = ch;
  const promise = new Promise((res, rej) => {
    let done = false;
    const to = setTimeout(() => {
      if(done) return;
      done = true;
      rej(new Error('সংযোগের সময় শেষ'));
    }, 9000);
    ch.on('broadcast', { event: 'm' }, e => {
      if(S.active && myGen === S.gen) onMsg(e && e.payload ? e.payload : null);
    });
    ch.subscribe(st => {
      if(done || myGen !== S.gen) return;
      if(st === 'SUBSCRIBED' || st === 'joined'){
        done = true; clearTimeout(to); res();
      } else if(st === 'CHANNEL_ERROR' || st === 'TIMED_OUT'){
        done = true; clearTimeout(to);
        rej(new Error('সংযোগ করা গেল না'));
      }
    });
  });
  return {
    send(obj){
      try { ch.send({ type: 'broadcast', event: 'm', payload: obj }); } catch (e) {}
    },
    close(){
      try { S.client.removeChannel(ch); } catch (e) {}
      if(S.ch === ch) S.ch = null;
    },
    promise,
  };
}

// ---------- ট্যাব-ট্রান্সপোর্ট (একই ব্রাউজার) ----------
function openLocal(){
  const bc = new BroadcastChannel('sj-room-' + S.room);
  S.localBc = bc;
  bc.onmessage = e => { if(S.active) onMsg(e && e.data ? e.data : null); };
  return {
    send(obj){ try { bc.postMessage(obj); } catch (e) {} },
    close(){
      try { bc.close(); } catch (e) {}
      if(S.localBc === bc) S.localBc = null;
    },
    promise: Promise.resolve(),
  };
}

// এখনকার সব transports বন্ধ করে নতুন করে জোড়া লাগা
// (ক্লাউড-পথ async — সাবস্ক্রিপশন শেষ হলেই হাতল হাতে আসে)
async function connectRoom(){
  S.gen++;
  if(S.ts){ try { S.ts.close(); } catch (e) {} S.ts = null; }
  const gen = S.gen;
  S.connecting = true;
  const fail = err => {
    S.connecting = false;
    if(gen !== S.gen) return false;
    S.ts = null;
    const msg = (err && err.message) || String(err);
    S.lastErr = msg;
    S.nextTry = now() + 3000;
    statusBad('📡 ' + (isLocalMode() ? 'ট্যাব-সংযোগ ব্যর্থ: ' : 'ইন্টারনেট-সংযোগ ব্যর্থ: ') + msg);
    return false;
  };
  let built;
  try {
    built = await (isLocalMode() ? openLocal() : openCloud());
  } catch (err) {
    return fail(err);
  }
  if(gen !== S.gen){ S.connecting = false; try { built.close(); } catch (e) {} return false; }
  const t = {
    send(obj){ built.send(obj); },
    close(){ built.close(); },
  };
  S.ts = t;
  S.lastRx = now();
  return built.promise.then(
    () => {
      S.connecting = false;
      if(gen !== S.gen || !S.active) return false;
      S.lastErr = '';
      sendMsg(buildMsg({ t: 'hi', st: 0 }));
      refreshRoomUI();
      return true;
    },
    fail
  );
}

// ---------- হোস্ট-নিয়ন্ত্রণ ----------
// শুধু কাউন্টডাউন বাতিলের কাজ — ম্যাচ শুরু হয় কেবল হোস্টের "শুরু করো" চাপলে।
// (আগে বন্ধু এলেই নিজে থেকে শুরু হয়ে যেত — ৪ বন্ধুর ম্যাচে বাকিরা বাদ পড়ত)
function followMatchGone(){
  if(!S.active || S.stage !== 'lobby') return;
  if(S.cdUntil && (listOthers().length === 0 || hostSid() !== mySid())){
    S.cdUntil = 0;
    refreshRoomUI();
  }
}

// ---------- হার্টবিট ----------
function pulse(){
  if(!S.active) return;
  const t = now();
  if(t - S.lastPing >= PING_EVERY){
    S.lastPing = t;
    sendMsg(buildMsg({ t: 'ping', st: S.stage === 'match' ? 1 : 0 }));
  }
  if(t - S.lastRx > 12000) S.lastRx = t;
  if(S.active && !S.ts && !S.connecting && t >= S.nextTry) connectRoom();
  pruneRemotes();
  if(S.stage === 'lobby'){
    if(S.ui) refreshRoomUI();
    tickCountdown();
  }
}
function ensurePulse(){
  if(S.pulse) return;
  S.pulse = setInterval(() => { try { pulse(); } catch (e) {} }, 400);
}
function stopPulse(){
  if(S.pulse){ clearInterval(S.pulse); S.pulse = 0; }
}

// ---------- বার্তা-পাচার ----------
function onMsg(m){
  if(!m || typeof m !== 'object') return;
  if(!S.active) return;
  const who = String(m.sid || '');
  if(!who || who === mySid()) return;
  S.lastRx = now();

  switch(m.t){
    case 'hi': {
      const r = getRemote(who);
      r.name = cutName(m.name, 14) || r.name;
      r.lvl = Number(m.lv) || r.lvl;
      r.st = Number(m.st) || 0;
      r.last = now();
      r.gone = false;
      // নতুন কাউকে দেখলেই আমরা নিজের হদিস দিই
      sendMsg(buildMsg({ t: 'ping', st: S.stage === 'match' ? 1 : 0 }));
      if(S.stage === 'lobby'){
        if(S.cdUntil) S.cdUntil = 0;
        if(S.cb.onPlayers) S.cb.onPlayers(listOthers().length + 1);
        followMatchGone();
      }
      refreshRoomUI();
      break;
    }
    case 'ping': {
      const r = getRemote(who);
      r.name = cutName(m.name, 14) || r.name;
      r.lvl = Number(m.lv) || r.lvl;
      r.st = Number(m.st) || 0;
      r.last = now();
      r.gone = false;
      if(S.stage === 'match' && r.st === 0 && S.matchT && (now() - S.matchT) < LATE_JOIN_MS){
        sendMsg(buildMsg({ t: 'full', to: who }));
      }
      refreshRoomUI();
      break;
    }
    case 'start': {
      const t0 = Number(m.t0) || now();
      if(!S.matchT || S.cdUntil){
        S.matchT = t0;
        S.cdUntil = 0;
      }
      if(S.stage === 'lobby'){
        const roster = Array.isArray(m.roster) ? m.roster.filter(x =>
          Array.isArray(x) && String(x[0]) && String(x[0]) !== mySid()).map(x => [String(x[0]), cutName(x[1], 14) || 'যোদ্ধা']) : [];
        const h = S.handler;
        detachMatch();
        if(!h) return;
        S.handler = h;
        S.stage = 'match';
        if(h.onStart) h.onStart(roster);
      }
      break;
    }
    case 'pos': {
      const r = getRemote(who);
      const x = Number(m.x), y = Number(m.y), z = Number(m.z);
      if(!isFinite(x) || !isFinite(y) || !isFinite(z)) break;
      const ry = Number(m.ry) || 0;
      if(!r.has){
        r.has = true;
        r.tx = x; r.ty = y; r.tz = z; r.try_ = ry;
      }
      r.x = x; r.y = y; r.z = z; r.ry = ry;
      r.st = Number(m.st) || 0;
      r.last = now();
      if(m.st === 2 && r.alive === undefined) r.alive = true;
      if(S.handler && S.handler.onPos) S.handler.onPos(r);
      break;
    }
    case 'hit': {
      if(S.handler && S.handler.onHit){
        S.handler.onHit({
          sid: who, name: getRemote(who).name,
          dmg: Number(m.dmg) || 0, crit: !!m.crit,
          kName: cutName(m.kName, 20) || '', sx: Number(m.sx) || 0, sz: Number(m.sz) || 0,
        });
      }
      break;
    }
    case 'die': {
      if(S.handler && S.handler.onDie){
        S.handler.onDie({
          sid: who, bySid: String(m.bySid || ''), byName: cutName(m.byName, 20) || '',
        });
      }
      break;
    }
    case 'full': {
      if(String(m.to) === mySid() && S.stage === 'lobby'){
        statusBad('🚪 ওই ঘরে একটা ম্যাচ এখন চলছে — একটু পরে আবার চেষ্টা করো, নয়তো অন্য ঘর-কোড নাও।');
      }
      break;
    }
    case 'bye': {
      const r = S.remotes.get(who);
      if(r){
        r.gone = true;
        if(S.handler && S.handler.onLeave && r.alive !== false) S.handler.onLeave(who);
        S.remotes.delete(who);
      }
      if(S.stage === 'lobby'){
        if(S.cdUntil && hostSid() !== mySid()) S.cdUntil = 0;
        followMatchGone();
      }
      refreshRoomUI();
      break;
    }
  }
}

// ---------- বাইরের জন্য ----------
export function openLobby(o){
  o = o || {};
  initId();
  S.cb = {
    onStart: typeof o.onStart === 'function' ? o.onStart : null,
    onCancel: typeof o.onCancel === 'function' ? o.onCancel : null,
    onCountdown: typeof o.onCountdown === 'function' ? o.onCountdown : null,
    onPlayers: typeof o.onPlayers === 'function' ? o.onPlayers : null,
  };

  let room = '';
  try { room = localStorage.getItem(ROOM_KEY) || ''; } catch (e) {}
  const urlRoom = readParam('room');
  if(urlRoom) room = urlRoom;
  room = sanRoom(room) || 'jungle';
  S.room = room;

  const ui = buildLobbyUI();
  ui.root.classList.remove('hidden');
  ui.room.value = room;
  ui.hint.classList.remove('hidden');
  ui.players.innerHTML = '';
  statusBad('সংযোগ হচ্ছে…');

  if(!ui.bound){
    ui.bound = true;
    const applyRoom = () => {
      const next = sanRoom(ui.room.value) || 'jungle';
      if(next === S.room) return;
      S.room = next;
      try { localStorage.setItem(ROOM_KEY, next); } catch (e) {}
      S.remotes.clear();
      lastPlayersKey = '';
      refreshRoomUI();
      statusBad('ঘর বদলানো হচ্ছে…');
      connectRoom();
    };
    ui.room.addEventListener('change', applyRoom);
    ui.room.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); applyRoom(); } });
    ui.copy.addEventListener('click', async () => {
      const txt = S.room;
      try {
        if(navigator.clipboard && navigator.clipboard.writeText){
          await navigator.clipboard.writeText(txt);
        } else {
          const ta = document.createElement('textarea');
          ta.value = txt;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        ui.copy.textContent = '✅ কপি হয়েছে';
        setTimeout(() => { ui.copy.textContent = '📋 কপি'; }, 1400);
      } catch (e) {
        ui.room.select();
      }
    });
    ui.start.addEventListener('click', () => {
      if(ui.start.disabled) return;
      startCountdown();
    });
    ui.solo.addEventListener('click', () => {
      if(S.stage !== 'lobby') return;
      S.cdUntil = 0;
      leaveRoom();
      if(S.cb.onStart) S.cb.onStart([]);
    });
    ui.cancel.addEventListener('click', () => {
      const cb = S.cb.onCancel;
      leaveRoom();
      if(cb) cb();
    });
  }

  S.active = true;
  S.stage = 'lobby';
  S.matchT = 0;
  S.cdUntil = 0;
  S.cdLast = -1;
  S.lastPing = 0;
  S.lastRx = now();
  S.lastSt = -1;
  ensurePulse();
  connectRoom().then(ok => { if(ok) refreshRoomUI(); });
  refreshRoomUI();
  return true;
}

export function closeLobby(){
  if(!S.ui) return;
  S.ui.root.classList.add('hidden');
  lastPlayersKey = '';
}

export function lobbyOpen(){
  return !!(S.ui && !S.ui.root.classList.contains('hidden'));
}

export function leaveRoom(){
  if(S.active){
    try { sendMsg(buildMsg({ t: 'bye' })); } catch (e) {}
  }
  S.active = false;
  S.gen++;
  stopPulse();
  if(S.ts){ try { S.ts.close(); } catch (e) {} S.ts = null; }
  if(S.localBc){ try { S.localBc.close(); } catch (e) {} S.localBc = null; }
  S.remotes.clear();
  S.cdUntil = 0;
  S.cdLast = -1;
  S.matchT = 0;
  S.stage = 'idle';
  closeLobby();
  lastPlayersKey = '';
}

export function attachMatch(h){
  S.handler = h || null;
  if(S.active){
    S.stage = 'match';
    if(!S.matchT) S.matchT = now();
  }
}
export function detachMatch(){
  S.handler = null;
  if(S.stage === 'match') S.stage = 'idle';
}
export function matchEnded(){
  if(!S.active) return;
  S.matchT = 0;
  S.cdUntil = 0;
  S.handler = null;
  S.stage = 'idle';
}
export function inMatch(){ return S.stage === 'match'; }

// স্থান-হালনাগাদ (ম্যাচ চলাকালে প্রতি টিক-এ ডাকা হয়)
export function pushLocal(x, y, z, ry, st){
  if(!S.active || !S.ts) return;
  const t = now();
  const dx = x - (S.lastX || 0), dy = y - (S.lastY || 0), dz = z - (S.lastZ || 0);
  const moved = (dx * dx + dy * dy + dz * dz) > 0.0016;
  const stCh = st !== S.lastSt;
  const bigTurn = Math.abs((ry || 0) - S.lastRy) > 0.12;
  const gap = moved ? 170 : 850;
  if(!stCh && !(moved && t - S.lastSent >= gap) && !(bigTurn && t - S.lastSent >= 260)) return;
  S.lastSent = t;
  S.lastX = x; S.lastY = y; S.lastZ = z;
  S.lastRy = ry || 0;
  S.lastSt = st;
  sendMsg(buildMsg({ t: 'pos', x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), ry: +(ry || 0).toFixed(2), st }));
}

export function sendHit(to, dmg, crit, pos){
  sendMsg(buildMsg({
    t: 'hit', to: String(to), dmg: Math.max(1, Math.round(dmg)), crit: !!crit,
    kName: cutName(myName(), 20),
    sx: +(pos && pos.x ? pos.x : 0).toFixed(1),
    sz: +(pos && pos.z ? pos.z : 0).toFixed(1),
  }));
}
export function sendDie(victimSid, bySid, byName){
  sendMsg(buildMsg({
    t: 'die', sid: String(victimSid || mySid()),
    bySid: String(bySid || ''), byName: cutName(byName || '', 20),
  }));
}
