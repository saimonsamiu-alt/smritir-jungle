// ============================================================
// স্মৃতির জঙ্গল — বড় ম্যাচ (battle royale, বট দিয়ে)
// Free Fire-style flow: plane → parachute → loot (MCQ) →
// shrinking ring → last survivor.
//
// বন্দুক-বোমা-ব্যাগ-প্রাচীর সবই মাটিতে পড়ে থাকে; প্রশ্ন আসে
// কেবল লুটের জন্য, আর গুলি-বোমার লড়াই পুরোপুরি রিয়েল-টাইম —
// প্রশ্নের উত্তর দিতে দিতে ম্যাচ চলতেই থাকে, বট গুলিও ছুড়তে
// থাকে। সার্ভার সঠিক উত্তর কখনো পাঠায় না (submitBattleAnswer
// যাচাই করে); নেট না থাকলে ফলের ভেতরের প্রশ্ন-ভান্ডার চলে।
// ============================================================
import * as THREE from 'three';

let ctx = null;
export function initMatch(c){ ctx = c; }

let M = null; // active match state

const BN = '০১২৩৪৫৬৭৮৯';
const bn = n => String(n).replace(/\d/g, d => BN[+d]);

const MAP_LIMIT = 158;   // খেলার গণ্ডি (মানচিত্রের খেলার সীমা)
const DROP_LIMIT = 150;  // প্যারাশুটে ভেসে বাইরে চলে যাওয়া আটকায়
const WATER_Y = -0.45;   // নদীতে হাঁটার মাটি (কোমর-পানি)
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// ---------- offline/API-failure question bank (HSC physics) ----------
const FALLBACK_QUESTIONS = [
  { id:'fb-01', text:'গতিশীল কণার ভরবেগ $p = mv$ — এখানে $m$ দিয়ে কী বোঝায়?',
    options:['ভরবেগ','ভর','বেগ','ত্বরণ'], correctIndex:1 },
  { id:'fb-02', text:'সমবেগ সমীকরণ $v = u + at$ — এখানে $a$ হলো কণার…',
    options:['সরণ','ত্বরণ','কৌণিক বেগ','জড়তা'], correctIndex:1 },
  { id:'fb-03', text:'১ নিউটন সমান কত dyne?',
    options:['$10^3$','$10^4$','$10^5$','$10^6$'], correctIndex:2 },
  { id:'fb-04', text:'অসীম দূরত্বে মহাকর্ষ বিভবের মান কত?',
    options:['শূন্য','অসীম','ঋণাত্মক','একক'], correctIndex:0 },
  { id:'fb-05', text:'কাজের একক (SI) কোনটি?',
    options:['ওয়াট','নিউটন','জুল','প্যাসকেল'], correctIndex:2 },
  { id:'fb-06', text:'ভ্যাকুয়ামের পারমিটিভিটি $\\varepsilon_0$-এর একক কোনটি?',
    options:['$N$','$F/m$','$C$','$V$'], correctIndex:1 },
  { id:'fb-07', text:'$F = G\\dfrac{m_1 m_2}{r^2}$ — এখানে $G$-এর একক কোনটি?',
    options:['$N\\,m^2/kg^2$','$N\\,m/kg^2$','$N/kg^2$','$N\\,m^2/kg$'], correctIndex:0 },
  { id:'fb-08', text:'সরল ছন্দে $T = 2\\pi\\sqrt{m/k}$ — স্প্রিং-ধ্রুবক $k$ বাড়লে দোলকাল $T$…',
    options:['বাড়ে','কমে','অপরিবর্তিত থাকে','শূন্য হয়'], correctIndex:1 },
];

// ---------- loot ----------
const LOOT_KINDS = {
  bag:        { icon:'🎒', label:'ব্যাগ',           need:2, tier:0, color:0x4CD97B },
  gun_basic:  { icon:'🔫', label:'সাধারণ বন্দুক',   need:2, tier:1, color:0xBFC9C4 },
  gun_good:   { icon:'🔫', label:'উন্নত বন্দুক',    need:3, tier:2, color:0xFFC94D },
  gun_sniper: { icon:'🎯', label:'স্নাইপার রাইফেল', need:4, tier:3, color:0xFF8A3C },
  armor:      { icon:'🛡️', label:'আর্মার',          need:2, tier:0, color:0x3EA0EC },
  heal:       { icon:'🩹', label:'হিল-কিট',         need:1, tier:0, color:0x4CD97B },
  bomb:       { icon:'💣', label:'বোমা',            need:2, tier:0, color:0xFF6A55 },
  wall:       { icon:'🧱', label:'গ্লু-প্রাচীর',     need:1, tier:0, color:0x9FD8FF },
  airdrop:    { icon:'🪂', label:'লুটের বাক্স',     need:4, tier:9, color:0xFF5A45 },
};
const LOOT_DISTRIB = [['bag',3],['gun_basic',5],['gun_good',4],['gun_sniper',2],
  ['armor',3],['heal',3],['bomb',4],['wall',3]];

const GUN_TIERS = ['খালি হাত','সাধারণ বন্দুক','উন্নত বন্দুক','স্নাইপার রাইফেল'];
const GUN_DMG   = [12, 26, 40, 62];
const GUN_RANGE = [0, 26, 32, 64];
const GUN_CD    = [0.55, 0.6, 0.5, 1.15];
const MELEE_RANGE = 2.9, MELEE_DMG = 12, MELEE_CD = 0.65;

// ---------- bomb / wall ----------
const MAX_WALLS = 3, WALL_W = 3.4, WALL_HP = 70, WALL_LIFE = 18;
const WALL_RANGE = 3.6, WALL_CD = 0.8;
const BOMB_DMG = 62, BOMB_RADIUS = 9, BOMB_CD = 1.6, BOMB_THROW = 10;

// ---------- ring (জোনের বদলে “বলয়”) ----------
const ZONE_STAGES = [
  { r:158, w:22, s:12 }, { r:112, w:20, s:11 }, { r:80, w:18, s:10 },
  { r:52, w:16, s:9 },   { r:30, w:14, s:8 },   { r:14, w:12, s:7 },
];
const ZONE_DPS = [0.8, 1.6, 2.4, 3.6, 5, 7];
// শেষ বলয় একদম জড়ো হয়ে গেলে কেন্দ্রেও রক্ষা নেই — ম্যাচ যেভাবেই হোক শেষ হবেই
const COLLAPSE_R = 8;
function collapseDps(){
  const z = M.zone;
  if(!z || z.state !== 'final' || z.r >= COLLAPSE_R) return 0;
  return 8 + (COLLAPSE_R - z.r) * 6;
}

// ---------- bots ----------
const BOT_NAMES = ['রাহাত','তানভীর','মেহেদী','সাদিয়া','নুসরাত','আরিফ','সজীব','পায়েল',
  'ফারহান','জুনায়েদ','রাকিব','ইমরান','নাহিদ','অনিক','তাসনিম','শারমিন','সুমাইয়া','মিম','দীপা'];
// ম্যাচে মোট যোদ্ধা = তুমি + বটরা (পরে আসল ছাত্র জোড়া লাগলে বাকি জায়গা বটে ভরে)
const MATCH_TOTAL = BOT_NAMES.length + 1;
const BOT_COLORS = [0xC2503A, 0x3A6EC2, 0x8A5AC2, 0x3AA85A, 0xC29A3A, 0x3AA5A0, 0xA53A7A, 0x7A8A3A,
  0xD06A2A, 0x2A8AC2, 0x8AC23A, 0xC23A5A, 0x5A3AC2, 0x3AC29A, 0xC2C23A, 0x8A6A4A,
  0x9AA5AC, 0x4A9A3A, 0xC24A8A];
const BOT_DROP_SPEED = 8.2, BOT_DRIFT = 6.5;

// বট-বনাম-বট: নিজেরাই শত্রু খুঁজে লড়ে (স্ক্রিপ্ট করা এক-দ্বন্দ্ব নয়)
const BOT_VISION = 22;         // শত্রু-বট কত দূর পর্যন্ত চোখে পড়ে
const BOT_FIGHT_RANGE = 30;    // এই দূরত্বের ভিতরে গুলি ছোড়ে
const BOT_MISS = 0.28;         // গুলি ফসকে যাওয়ার সম্ভাবনা
const BOT_DMG_MIN = 15, BOT_DMG_MAX = 23;
const BOT_DUEL_PACE = 1.5;     // বটে-বটে লড়াইয়ে গুলির ফাঁক বাড়ে — ম্যাচ এক মিনিটে শেষ হয়ে যায় না

// দূরের বট সরল করে আঁকা — ১৯ বটেও কম-দামি ফোন চলে
const LOD_DETAIL = 52, LOD_FAR = 122;

// ---------- মিনিম্যাপ (রাডার) ----------
const MAP_DT = 0.09;    // ম্যাপ আঁকা হয় সেকেন্ডে ~১১ বার — প্রতি ফ্রেমে নয়
const PING_LIFE = 2.6;  // গুলির আওয়াজের লাল বিন্দু কতক্ষণ জ্বলে
const PING_MAX = 14;

// ---------- plane ----------
const PLANE_FROM = new THREE.Vector3(-138, 66, -60);
const PLANE_TO   = new THREE.Vector3(138, 66, 60);
const PLANE_DUR  = 15;

// ---------- airdrop (লুটের বিমান) ----------
const AIR_FIRST = [22, 34];      // ম্যাচ শুরু থেকে প্রথম বিমান কত সেকেন্ডে
const AIR_NEXT  = [58, 80];      // বাক্স না খুললে পরের বিমান কত পরে
const AIR_FALL_SPEED = 9.2;      // বাক্স নামার গতি (প্যারাশুটে ধীরে)
const AIR_BOT_RANGE = 2.6;       // বট এত কাছে থাকলে খুলতে শুরু করে
const AIR_BOT_TAKE  = 7;         // এত সেকেন্ড পাশে থাকলে বাক্স বটের দখলে

// ============================== HELPERS ==============================
const P_pos = () => ctx.P.grp.position;
function v3(x, y, z){ return new THREE.Vector3(x, y, z); }
function rand(a, b){ return a + Math.random() * (b - a); }
function groundY(x, z){ return Math.max(ctx.heightAt(x, z), WATER_Y); }

// ---------- tracers (গুলি দেখতে ভেসে ছুটে যায়) ----------
let tracerGeo = null, tracerAssets = null;
function ensureTracer(){
  if(tracerGeo) return;
  tracerGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6, 1, true);
  tracerGeo.rotateX(Math.PI / 2); // লম্বা দিকটা Z বরাবর
  const haloGeo = new THREE.CylinderGeometry(0.22, 0.22, 1.55, 6, 1, true);
  haloGeo.rotateX(Math.PI / 2);
  tracerAssets = {
    player: {
      core: new THREE.MeshBasicMaterial({ color: 0xffdca0 }),
      halo: new THREE.MeshBasicMaterial({ color: 0xff9a4d, transparent: true, opacity: 0.38,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    },
    bot: {
      core: new THREE.MeshBasicMaterial({ color: 0xffb0a6 }),
      halo: new THREE.MeshBasicMaterial({ color: 0xff4d3d, transparent: true, opacity: 0.34,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    },
    haloGeo,
  };
}
const TRACER_PLAYER = { k:0.013, maxDur:0.45, pair:'player' };
const TRACER_BOT    = { k:0.02,  maxDur:0.85, pair:'bot' };

function spawnShot(from, to, cfg, onArrive){
  if(!M) return;
  ensureTracer();
  const dir = to.clone().sub(from);
  const dist = Math.max(0.6, dir.length());
  dir.normalize();
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(tracerGeo, tracerAssets[cfg.pair].core));
  grp.add(new THREE.Mesh(tracerAssets.haloGeo, tracerAssets[cfg.pair].halo));
  grp.quaternion.setFromUnitVectors(Z_AXIS, dir);
  grp.position.copy(from);
  ctx.scene().add(grp);
  M.shots.push({ grp, from: from.clone(), dir, dist,
    dur: Math.max(0.05, Math.min(cfg.maxDur, dist * cfg.k)), t: 0, arrive: onArrive });
}

function shotsTick(dt){
  for(let i = M.shots.length - 1; i >= 0; i--){
    const s = M.shots[i];
    s.t += dt;
    const k = Math.min(1, s.t / s.dur);
    s.grp.position.copy(s.from).addScaledVector(s.dir, s.dist * k);
    if(k >= 1){
      if(s.arrive) s.arrive();
      ctx.scene().remove(s.grp);
      M.shots.splice(i, 1);
    }
  }
}

// ============================== BUILD ==============================
function buildPlane(){
  const scene = ctx.scene();
  const grp = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x9fb4c7, roughness: 0.55, metalness: 0.15 });
  const accMat  = new THREE.MeshStandardMaterial({ color: 0x2d3a4a, roughness: 0.75 });
  const fus = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 6, 6, 12), bodyMat);
  fus.rotation.z = Math.PI / 2; // লম্বা দিকটা X (নাক +X)
  grp.add(fus);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.24, 11), bodyMat);
  wing.position.y = 0.4; grp.add(wing); // ডানা Z বরাবর ছড়ানো
  const tailW = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 4.6), bodyMat);
  tailW.position.set(-3.6, 0.3, 0); grp.add(tailW);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.7, 1.4), accMat);
  fin.position.set(-3.7, 1.0, 0); grp.add(fin);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x58c7ff, emissive: 0x58c7ff, emissiveIntensity: 1.1, roughness: 0.3 }));
  cockpit.position.set(2.2, 0.45, 0); cockpit.scale.z = 1.4; grp.add(cockpit);
  const dir = PLANE_TO.clone().sub(PLANE_FROM).normalize();
  grp.position.copy(PLANE_FROM);
  grp.rotation.y = Math.atan2(-dir.z, dir.x); // নাক (+X) ঠিক পথে ঘোরানো
  scene.add(grp);
  M.plane = grp;
}

function buildChute(color, size){
  const scene = ctx.scene();
  const grp = new THREE.Group();
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(size, 14, 8, 0, Math.PI*2, 0, Math.PI/2),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide }));
  canopy.position.y = size * 2.1; grp.add(canopy);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  const h = size * 2.0;
  for(let i = 0; i < 4; i++){
    const a = i * Math.PI/2 + Math.PI/4;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h, 4), lineMat);
    line.position.set(Math.cos(a) * size * 0.68, h * 0.55, Math.sin(a) * size * 0.68);
    line.rotation.z = Math.cos(a) * 0.42;
    line.rotation.x = -Math.sin(a) * 0.42;
    grp.add(line);
  }
  grp.visible = false;
  scene.add(grp);
  return grp;
}

// ---------- মাটিতে সত্যিকারের জিনিস (লুট) ----------
let itemMatCache = null;
function itemMat(color, emissive){
  if(!itemMatCache) itemMatCache = {};
  const key = color + '_' + emissive;
  if(!itemMatCache[key]) itemMatCache[key] = new THREE.MeshStandardMaterial({
    color, roughness: 0.55, metalness: 0.15, emissive, emissiveIntensity: 0.3 });
  return itemMatCache[key];
}
const LOOT_GEO = {};
function lootGeos(){
  if(LOOT_GEO.ready) return LOOT_GEO;
  LOOT_GEO.ready = true;
  LOOT_GEO.bag    = new THREE.BoxGeometry(0.72, 0.78, 0.4);
  LOOT_GEO.flap   = new THREE.BoxGeometry(0.74, 0.2, 0.44);
  LOOT_GEO.gun    = new THREE.BoxGeometry(0.13, 0.15, 1.05);
  LOOT_GEO.barrel = new THREE.CylinderGeometry(0.045, 0.045, 0.6, 6);
  LOOT_GEO.armor  = new THREE.BoxGeometry(0.6, 0.72, 0.3);
  LOOT_GEO.crossA = new THREE.BoxGeometry(0.5, 0.14, 0.1);
  LOOT_GEO.crossB = new THREE.BoxGeometry(0.14, 0.5, 0.1);
  LOOT_GEO.bomb   = new THREE.SphereGeometry(0.3, 10, 8);
  LOOT_GEO.fuse   = new THREE.CylinderGeometry(0.04, 0.04, 0.24, 5);
  LOOT_GEO.panel  = new THREE.BoxGeometry(1.7, 1.1, 0.18);
  return LOOT_GEO;
}

function buildItemMesh(kind){
  const k = LOOT_KINDS[kind];
  const G = lootGeos();
  const mat = itemMat(k.color, k.color);
  const grp = new THREE.Group();
  if(kind === 'bag'){
    const bm = ctx.buildGearModel('pack', 0.78);   // আসল ব্যাকপ্যাক মডেল
    if(bm){ bm.position.y = 0.42; bm.rotation.y = 0.8; grp.add(bm); }
    else {
      const b = new THREE.Mesh(G.bag, mat); b.position.y = 0.4; grp.add(b);
      const f = new THREE.Mesh(G.flap, mat); f.position.y = 0.78; grp.add(f);
    }
  } else if(kind === 'gun_basic' || kind === 'gun_good' || kind === 'gun_sniper'){
    const tier = kind === 'gun_basic' ? 1 : (kind === 'gun_good' ? 2 : 3);
    const gm = ctx.buildGunModel(tier, tier === 1 ? 1.9 : (tier === 2 ? 1.5 : 1.3), { raw: true });
    if(gm){
      gm.visible = true;
      gm.position.y = 0.12;              // মাটিতে হালকা বসে শোয়া
      gm.rotation.z = Math.PI / 2;       // পাশ ফিরে শোয়া
      gm.rotation.y = -0.22;
      grp.add(gm);
    } else {
      const g = new THREE.Mesh(G.gun, mat); g.position.y = 0.42; grp.add(g);
      const barrel = new THREE.Mesh(G.barrel, mat);
      barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.46, 0.75); grp.add(barrel);
    }
    grp.rotation.y = 1.1;
  } else if(kind === 'armor'){
    const am = ctx.buildGearModel('armor', 0.62);   // আসল টেক-বর্ম মডেল
    if(am){ am.position.y = 0.32; am.rotation.y = 0.85; grp.add(am); }
    else { const a = new THREE.Mesh(G.armor, mat); a.position.y = 0.5; grp.add(a); }
  } else if(kind === 'heal'){
    const boxMat = itemMat(0xF4F7F5, 0x2E7D4F);
    const b = new THREE.Mesh(G.bag, boxMat); b.position.y = 0.4; grp.add(b);
    const ca = new THREE.Mesh(G.crossA, itemMat(0x4CD97B, 0x4CD97B)); ca.position.set(0, 0.4, 0.22); grp.add(ca);
    const cb = new THREE.Mesh(G.crossB, itemMat(0x4CD97B, 0x4CD97B)); cb.position.set(0, 0.4, 0.22); grp.add(cb);
  } else if(kind === 'bomb'){
    const b = new THREE.Mesh(G.bomb, itemMat(0x3A2E2C, 0xFF6A55)); b.position.y = 0.34; grp.add(b);
    const f = new THREE.Mesh(G.fuse, mat); f.position.y = 0.68; grp.add(f);
  } else if(kind === 'wall'){
    const p = new THREE.Mesh(G.panel, mat);
    p.position.y = 0.62; p.rotation.y = 1.1; grp.add(p);
  }
  return grp;
}

function lootSpot(kind, i){
  const scene = ctx.scene();
  const k = LOOT_KINDS[kind];
  let x = 0, z = 0;
  for(let tries = 0; tries < 70; tries++){
    const a = Math.random() * Math.PI * 2, r = rand(14, 142);
    x = Math.cos(a) * r; z = Math.sin(a) * r;
    if(ctx.isWater(x, z, 0.5)) continue;
    if(M.loot.every(l => Math.hypot(l.x - x, l.z - z) > 11)) break;
  }
  const y = groundY(x, z);
  const grp = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 26, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: k.color, transparent: true, opacity: 0.25,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 13; grp.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 2.1, 26),
    new THREE.MeshBasicMaterial({ color: k.color, transparent: true, opacity: 0.5,
      side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; grp.add(ring);
  const item = buildItemMesh(kind);
  item.traverse(o => { if(o.isMesh) o.castShadow = true; });
  grp.add(item);
  grp.position.set(x, y, z);
  scene.add(grp);
  M.loot.push({ kind, i, x, z, y, grp, beam, ring, item, got: 0, alive: true });
}

function buildLoot(){
  let i = 0;
  for(const [kind, count] of LOOT_DISTRIB)
    for(let n = 0; n < count; n++) lootSpot(kind, i++);
}

function buildZone(){
  const scene = ctx.scene();
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 44, 64, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x39b7ff, transparent: true, opacity: 0.12,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  wall.position.y = 22;
  scene.add(wall);
  M.zone = { wall, idx:0, r:ZONE_STAGES[0].r, cx:0, cz:0, state:'wait',
    t:ZONE_STAGES[0].w, from:null, to:null };
}

function buildBot(i){
  const scene = ctx.scene();
  const root = new THREE.Group();
  const color = BOT_COLORS[i % BOT_COLORS.length];
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.75, 6, 10), bodyMat);
  body.position.y = 1.0; body.castShadow = true; root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd9a878, roughness: 0.7 }));
  head.position.y = 1.72; root.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI*2, 0, Math.PI/2), bodyMat);
  helmet.position.y = 1.74; root.add(helmet);
  // হাতে আসল বন্দুকের মডেল (স্তর ভাগ করে — কেউ পিস্তল, কেউ রাইফেল, কেউ স্নাইপার)
  let gun = ctx.buildBotGun(1 + (i % 3), 1);
  if(!gun){
    gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.68), darkMat);
    gun.position.set(0.3, 1.15, 0.32);
  }
  root.add(gun);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), darkMat);
  legL.position.set(-0.14, 0.28, 0); root.add(legL);
  const legR = legL.clone(); legR.position.x = 0.14; root.add(legR);
  // পিঠে আসল ব্যাকপ্যাক মডেল (নাও থাকলে কিছুই বসবে না — খালি পিঠ)
  const pack = ctx.buildGearModel('pack', 0.5);
  if(pack){ pack.position.set(0, 1.08, 0.34); pack.rotation.y = Math.PI; root.add(pack); }

  // নিজের পছন্দমতো আলাদা অবতরণ-জায়গা (একজনের সাথে আরেকজনের মিল নেই)
  let lx = 0, lz = 0, sep = 30;
  for(let tries = 0; tries < 140; tries++){
    if(tries === 80) sep = 18; // এতজন নামলে জায়গা ভিড় হয়ে যায় — একটু কাছাকাছি নামাও
    const a = Math.random() * Math.PI * 2, r = rand(22, 138);
    lx = Math.cos(a) * r; lz = Math.sin(a) * r;
    if(ctx.isWater(lx, lz, 0.5)) continue;
    if(M.bots.every(o => Math.hypot(o.land.x - lx, o.land.z - lz) > sep)) break;
  }
  root.position.set(lx, groundY(lx, lz), lz);
  root.visible = false; // প্লেন থেকে লাফ দেওয়ার আগে দেখা যাবে না
  scene.add(root);

  const chute = buildChute(color, 1.5);
  M.bots.push({ name: BOT_NAMES[i], grp: root, body, head, helmet, gun, legL, legR, pack, chute,
    color, state:'plane',
    jumpAt: (i / Math.max(1, BOT_NAMES.length - 1)) * 10.5 + rand(0.5, 2.5), // প্লেনের পুরোটা জুড়ে যার যার সময়ে লাফ
    land: { x:lx, z:lz },
    activeAt: 0, landedAt: 0, chuteT: 0,
    hp: 100, alive: true, deadT: 0, target: null, provokedT: 0,
    foe: null, foeT: 0,
    speed: rand(4.2, 5.6), fireT: rand(1.5, 3), fireCD: rand(1.7, 2.6),
    stuckT: 0, giveUpT: 0,
    roamT: 0, roamTo: v3(lx, 0, lz), walkPhase: Math.random()*6 });
}

function buildBots(){ for(let i = 0; i < BOT_NAMES.length; i++) buildBot(i); }

// ---------- লুকানোর জায়গা: কুঁড়েঘর, ভাঙা দেয়াল, ক্রেট-ব্যারেল ----------
// ভবনের দেয়াল গুলি-দৃষ্টি দুটোই আটকায় — ভিতরে ঢুকে বা আড়ালে বসে লুকানো যায়।
const SC = { wall:0xC9B18A, roof:0x8A5A3C, stone:0x6E7278, crate:0xB08A52, barrel:0x4E6A5A };
const _smatC = {}, _sgeoC = {};
function smat(key, color, opts){
  if(!_smatC[key]) _smatC[key] = new THREE.MeshStandardMaterial(
    Object.assign({ color, roughness: 0.85 }, opts || {}));
  return _smatC[key];
}
function sgeo(key, make){
  if(!_sgeoC[key]) _sgeoC[key] = make();
  return _sgeoC[key];
}
const UBOX = new THREE.BoxGeometry(1, 1, 1);
function sBox(grp, mat, x, y, z, w, h, d, ry){
  const m = new THREE.Mesh(UBOX, mat);
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  if(ry) m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  grp.add(m);
  return m;
}

function addBlock(x, z, hw, hd, rot, tall){
  M.blocks.push({ x, z, hw, hd, rot: rot || 0, tall: !!tall });
}
// স্থানীয় (lx, lz) → দুনিয়ার জায়গায় ব্লক বসানো (ভবনের ঘূর্ণন ধরে)
function structBlock(hs, lx, lz, hw, hd, tall, rotAdd){
  const c = Math.cos(hs.rot), s = Math.sin(hs.rot);
  addBlock(hs.x + c*lx + s*lz, hs.z - s*lx + c*lz, hw, hd, hs.rot + (rotAdd || 0), tall);
}

// ২ডি রেখাংশ বনাম ঘোরানো বাক্স — ঢোকার বিন্দু t (0..1), না লাগলে null
function segOBB(from, to, b, pad){
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  const hw = b.hw + (pad || 0), hd = b.hd + (pad || 0);
  const fx = c*(from.x - b.x) - s*(from.z - b.z);
  const fz = s*(from.x - b.x) + c*(from.z - b.z);
  const dx = c*(to.x - from.x) - s*(to.z - from.z);
  const dz = s*(to.x - from.x) + c*(to.z - from.z);
  let t0 = 0, t1 = 1;
  if(Math.abs(dx) < 1e-9){ if(fx < -hw || fx > hw) return null; }
  else {
    let a = (-hw - fx) / dx, e = (hw - fx) / dx;
    if(a > e){ const tt = a; a = e; e = tt; }
    if(a > t0) t0 = a;
    if(e < t1) t1 = e;
  }
  if(Math.abs(dz) < 1e-9){ if(fz < -hd || fz > hd) return null; }
  else {
    let a = (-hd - fz) / dz, e = (hd - fz) / dz;
    if(a > e){ const tt = a; a = e; e = tt; }
    if(a > t0) t0 = a;
    if(e < t1) t1 = e;
  }
  if(t0 > t1) return null;
  return t0;
}

// কেউ দেয়ালে ঢুকে পড়লে আলতো করে বাইরে ঠেলে দাও (দুই পাশেই কাজ করে)
function resolvePos(pos, rad){
  for(const b of M.blocks){
    const c = Math.cos(b.rot), s = Math.sin(b.rot);
    const dx = pos.x - b.x, dz = pos.z - b.z;
    let lx = c*dx - s*dz, lz = s*dx + c*dz;
    const ex = b.hw + rad - Math.abs(lx), ez = b.hd + rad - Math.abs(lz);
    if(ex <= 0 || ez <= 0) continue;
    if(ex < ez) lx += lx >= 0 ? ex : -ex;
    else        lz += lz >= 0 ? ez : -ez;
    pos.x = b.x + c*lx + s*lz;
    pos.z = b.z - s*lx + c*lz;
  }
}

// গুলির পথে প্রথম যা পড়ে — গ্লু-প্রাচীর বা ভবনের দেয়াল
function shotObstacle(from, to){
  let best = null, bt = 2;
  const dx = to.x - from.x, dz = to.z - from.z;
  const L2 = dx*dx + dz*dz;
  for(const w of M.walls){
    let t = L2 ? ((w.x - from.x) * dx + (w.z - from.z) * dz) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = from.x + dx * t, pz = from.z + dz * t;
    if(Math.hypot(w.x - px, w.z - pz) < 1.7 && t < bt){ bt = t; best = { wall: w, t }; }
  }
  for(const b of M.blocks){
    const t = segOBB(from, to, b, 0.06);
    if(t !== null && t > 0.02 && t < bt){ bt = t; best = { block: b, t }; }
  }
  return best;
}

// উঁচু দেয়ালের আড়ালে থাকলে বট দেখতে পায় না
function visionBlocked(from, to){
  for(const b of M.blocks){
    if(!b.tall) continue;
    if(segOBB(from, to, b, 0) !== null) return true;
  }
  return false;
}

// ভবন বসানোর ফাঁকা জায়গা — সমান মাটি, পানির বাইরে, লুট থেকে দূরে
const SPOT_PROBES = [[-3, -3], [3, -3], [-3, 3], [3, 3], [0, 0]];
function findStructSpot(minR, maxR, clear, flat){
  for(let tries = 0; tries < 120; tries++){
    const a = Math.random() * Math.PI * 2, r = rand(minR, maxR);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if(ctx.isWater(x, z, 3)) continue;
    let hMin = 1e9, hMax = -1e9;
    for(const o of SPOT_PROBES){
      const h = ctx.heightAt(x + o[0], z + o[1]);
      if(h < hMin) hMin = h;
      if(h > hMax) hMax = h;
    }
    if(hMax - hMin > flat || hMin < WATER_Y + 0.15) continue;
    if(M.loot.some(l => Math.hypot(l.x - x, l.z - z) < 11)) continue;
    if(M.structs.some(s2 => Math.hypot(s2.x - x, s2.z - z) < s2.clear + clear + 4)) continue;
    return { x, z, y: hMax, clear };
  }
  return null;
}

function newStructGroup(hs){
  const grp = new THREE.Group();
  grp.position.set(hs.x, hs.y, hs.z);
  grp.rotation.y = hs.rot;
  ctx.scene().add(grp);
  hs.grp = grp;
  M.structs.push(hs);
  return grp;
}

// কুঁড়েঘর — চার দেয়াল, সামনে দরজা; ভিতরে ঢুকে লুকানো যায়
function buildHut(hs){
  hs.rot = rand(0, Math.PI * 2);
  const grp = newStructGroup(hs);
  const wallM = smat('wall', SC.wall), roofM = smat('roof', SC.roof);
  sBox(grp, wallM, 0, 0.9, -2.35, 4.9, 3.0, 0.28);       // পিছনের দেয়াল
  sBox(grp, wallM, -2.35, 0.9, 0, 0.28, 3.0, 4.4);        // বাঁ দেয়াল
  sBox(grp, wallM, 2.35, 0.9, 0, 0.28, 3.0, 4.4);         // ডান দেয়াল
  sBox(grp, wallM, -1.725, 0.9, 2.35, 1.25, 3.0, 0.28);   // সামনের বাঁ অংশ
  sBox(grp, wallM, 1.725, 0.9, 2.35, 1.25, 3.0, 0.28);    // সামনের ডান অংশ (মাঝে দরজা)
  structBlock(hs, 0, -2.35, 2.45, 0.14, true);
  structBlock(hs, -2.35, 0, 0.14, 2.2, true);
  structBlock(hs, 2.35, 0, 0.14, 2.2, true);
  structBlock(hs, -1.725, 2.35, 0.63, 0.14, true);
  structBlock(hs, 1.725, 2.35, 0.63, 0.14, true);
  // খড়ের দুই ঢালের চালা
  const rl = sBox(grp, roofM, 0, 2.72, -1.22, 5.6, 0.16, 2.7);
  rl.rotation.x = -0.235;
  const rr = sBox(grp, roofM, 0, 2.72, 1.22, 5.6, 0.16, 2.7);
  rr.rotation.x = 0.235;
  // ভিতরে একটা ক্রেট — দরজার আড়াল
  sBox(grp, smat('crate', SC.crate), 1.1, 0.55, -0.9, 1.05, 1.1, 1.05, 0.3);
  structBlock(hs, 1.1, -0.9, 0.53, 0.53, false);
}

// ভাঙা দেয়ালের কাঠামো — [lx, lz, দৈর্ঘ্য, স্থানীয়-ঘূর্ণন, উচ্চতা]
const RUIN_PATTERNS = [
  [[0, -1.8, 4.6, 0, 2.5], [-1.9, 0.3, 3.4, Math.PI/2, 2.2]],
  [[-1.5, -1.5, 3.6, 0, 2.4], [0.7, -1.5, 2.0, 0, 2.0], [1.7, 0.2, 2.6, Math.PI/2, 2.3]],
  [[0, -1.4, 4.4, 0, 2.6], [0, 1.4, 2.6, 0, 2.1]],
];
function buildRuin(hs){
  hs.rot = rand(0, Math.PI * 2);
  const grp = newStructGroup(hs);
  const stoneM = smat('stone', SC.stone, { roughness: 0.95 });
  const pat = RUIN_PATTERNS[Math.floor(Math.random() * RUIN_PATTERNS.length)];
  for(const [lx, lz, len, rot, h] of pat){
    const w = rot === 0 ? len : 0.32, d = rot === 0 ? 0.32 : len;
    sBox(grp, stoneM, lx, h/2 - 0.55, lz, w, h, d);
    structBlock(hs, lx, lz, w/2, d/2, true, rot);
  }
  // পায়ের কাছে ধসে পড়া পাথরের টুকরো (আড়াল নয়, নিছক দৃশ্য)
  const rubM = smat('rubble', SC.stone);
  for(let i = 0; i < 3; i++){
    sBox(grp, rubM, rand(-2.6, 2.6), 0.22, rand(-2.2, 2.2),
      rand(0.4, 0.8), rand(0.3, 0.5), rand(0.4, 0.8), rand(0, 3));
  }
}

// ক্রেট-ব্যারেলের স্তূপ — নিচু আড়াল (গুলি আটকায়, লম্বা হয়ে দেখা যায় না)
function buildCrates(hs){
  hs.rot = rand(0, Math.PI * 2);
  const grp = newStructGroup(hs);
  const woodM = smat('crate', SC.crate), barM = smat('barrel', SC.barrel);
  const barrelGeo = sgeo('barrel', () => new THREE.CylinderGeometry(0.42, 0.46, 1.15, 10));
  const n = 4 + Math.floor(Math.random() * 3);
  for(let i = 0; i < n; i++){
    const lx = rand(-2.3, 2.3), lz = rand(-2.3, 2.3);
    if(Math.random() < 0.35){
      const m = new THREE.Mesh(barrelGeo, barM);
      m.position.set(lx, 0.55, lz);
      m.castShadow = true; m.receiveShadow = true;
      grp.add(m);
      structBlock(hs, lx, lz, 0.45, 0.45, false);
    } else {
      const s2 = rand(0.85, 1.2);
      sBox(grp, woodM, lx, s2/2 - 0.15, lz, s2, s2, s2, rand(0, 1.6));
      structBlock(hs, lx, lz, s2/2, s2/2, false);
    }
  }
}

function buildStructures(){
  for(let i = 0; i < 4; i++){
    const s2 = findStructSpot(32, 132, 6, 0.5);
    if(s2) buildHut(s2);
  }
  for(let i = 0; i < 5; i++){
    const s2 = findStructSpot(26, 136, 5, 0.75);
    if(s2) buildRuin(s2);
  }
  for(let i = 0; i < 4; i++){
    const s2 = findStructSpot(24, 140, 4, 0.75);
    if(s2) buildCrates(s2);
  }
}

// ============================== START / EXIT ==============================
export async function startMatch(){
  const g = ctx.G;
  if(!ctx.scene() || !g.student){ ctx.toast('আগে লগইন করো'); return; }
  if(!g.progress){ ctx.toast('এখনো প্রস্তুত নয় — একটু পরে চেষ্টা করো'); return; }
  if(M) return;

  // দোকান থেকে কেনা জিনিস ম্যাচের শুরুতে সাথে যাবে
  const eqGun = ctx.equippedItem ? ctx.equippedItem('gun') : null;
  const eqSuit = ctx.equippedItem ? ctx.equippedItem('suit') : null;
  const eqGad = ctx.equippedItem ? ctx.equippedItem('gadget') : null;
  const hpMax = 100 + (eqSuit && eqSuit.bonus ? eqSuit.bonus : 0);

  M = {
    phase:'plane', t:0, plane:null, chute:null, vy:-8.5,
    bots:[], loot:[], walls:[], shots:[], blocks:[], structs:[],
    zone:null, lodT: 0,
    inv:{ bag:false, gun: eqGun ? (eqGun.tier || 0) : 0, armor: !!(eqSuit && eqSuit.armor), heals:0,
      bombs: 1 + (eqGad && eqGad.bombs ? eqGad.bombs : 0),
      walls: 1 + (eqGad && eqGad.walls ? eqGad.walls : 0) },
    hp:hpMax, hpMax, kills:0, asked:0, correct:0,
    gadBonus: eqGad ? ((eqGad.bombs || 0) + (eqGad.walls || 0)) : 0,
    firing:false, fireT:0, bombT:0, wallT:0, meleeT:0, armT:0,
    askedIds:[], usedFb:[], sessionId:null, sessionEnded:false,
    concealed:false, concealT:0, graceUntil:0, zoneHurtT:0,
    prompt:null, panel:null, outside:false, snap:{},
    crouch:false, crouchK:0, crouchTip:false,
    scopeOn:false, scopeK:0, scopeVis:false, scopeT:0, scopeHot:false, scopeTip:false,
    pings:[], mapT:0,
    airs:[], airLeft:2, airT: rand(AIR_FIRST[0], AIR_FIRST[1]),
    streak:0, lastKillT:-99, lowHpOn:false, lowBeepT:0,
  };
  // গত ম্যাচের সতর্কবার্তা/ভিগনেট যেন লিক না করে
  if(ctx.el.lowHp) ctx.el.lowHp.classList.remove('show');
  if(ctx.el.hitDir) ctx.el.hitDir.classList.remove('show');
  if(ctx.el.mhAlert) ctx.el.mhAlert.classList.remove('show');
  if(ctx.el.mhStreak) ctx.el.mhStreak.classList.remove('show');
  // গত ম্যাচের স্কোপ যেন লিক না করে
  if(ctx.el.mhScope){ ctx.el.mhScope.classList.remove('show'); ctx.el.mhScope.classList.remove('hot');
    ctx.el.mhScope.style.opacity = '0'; }
  if(ctx.el.mhZoom) ctx.el.mhZoom.classList.remove('active');
  if(ctx.el.scopeDist) ctx.el.scopeDist.textContent = '';

  // hide story objects for the match (restore on exit)
  const scene = ctx.scene();
  M.snap.monsterVis = g.monsters.map(m => ({
    rig: m.rig && m.rig.root ? m.rig.root.visible : true,
    decor: m.decor ? m.decor.visible : true }));
  g.monsters.forEach(m => {
    if(m.rig && m.rig.root) m.rig.root.visible = false;
    if(m.decor) m.decor.visible = false;
  });
  M.snap.childVis = ctx.CH.grp ? ctx.CH.grp.visible : true;
  if(ctx.CH.grp) ctx.CH.grp.visible = false;
  const gg = ctx.gateGroup && ctx.gateGroup();
  if(gg){ M.snap.gateVis = gg.visible; gg.visible = false; }

  ctx.hide(ctx.el.hud);
  ctx.hide(ctx.el.qPanel);
  ctx.hide(ctx.el.qHead);
  ctx.hide(ctx.el.matchHud);
  ctx.hide(ctx.el.mhPrompt);
  ctx.hide(ctx.el.killFeed);
  ctx.el.killFeed.innerHTML = '';
  if(ctx.el.mhZone){ ctx.el.mhZone.textContent = '🔵 বলয়'; ctx.el.mhZone.classList.remove('danger'); }
  if(ctx.el.mhFire) ctx.el.mhFire.classList.remove('down');
  if(ctx.el.mhCrouch) ctx.el.mhCrouch.classList.remove('active');
  if(ctx.el.mhMap){
    ctx.show(ctx.el.mhMap);   // রাডার প্লেন থেকেই দেখা যায় — কোথায় নামবে বেছে নিতে
    const c2 = ctx.el.mhMap.getContext('2d');
    c2.clearRect(0, 0, ctx.el.mhMap.width, ctx.el.mhMap.height);
  }
  ctx.P.grp.visible = false;

  buildPlane(); buildLoot(); buildStructures(); buildZone(); buildBots();
  ctx.updatePlayerGun();   // ম্যাচে হাতে মাঠের লুট-বন্দুকই দেখাবে

  g.mode = 'match_plane';
  ctx.show(ctx.el.dropBtn);
  ctx.subtitle('🎙️ "' + bn(MATCH_TOTAL) + ' জন যোদ্ধা, একটাই জঙ্গল… শেষ পর্যন্ত টিকে থাকো।"', 4200);
  const kit = [];
  if(eqGun) kit.push('🔫 ' + GUN_TIERS[Math.min(eqGun.tier || 0, GUN_TIERS.length-1)]);
  if(eqSuit && eqSuit.armor) kit.push('🛡️ বর্ম' + (eqSuit.bonus ? ' (+' + bn(eqSuit.bonus) + ' জীবন)' : ''));
  if(eqGad) kit.push('🧨 বোমা ' + bn(M.inv.bombs) + ' • প্রাচীর ' + bn(M.inv.walls));
  ctx.toast(kit.length ? '🎒 সাথে নিয়েছ: ' + kit.join(' • ') : '🪂 প্লেন উড়ছে — লাফ দেওয়ার বাটনে চাপ দাও!', kit.length ? 3600 : 2600);
  if(kit.length) setTimeout(() => { if(M) ctx.toast('🪂 লাফ দেওয়ার বাটনে চাপ দাও!', 2400); }, 3700);

  // server battle session (non-blocking; questions fall back if it fails)
  (async () => {
    try{
      const res = await ctx.api('startBattleSession', {
        slug: g.student.slug, subject: (g.world && g.world.subject) || 'physics',
        monsterRef: 'match', monsterType: 'match' });
      if(M && res && res.status === 'success') M.sessionId = res.sessionId;
    }catch(e){}
  })();
}

export function exitMatch(){
  if(!M) return;
  const g = ctx.G, scene = ctx.scene();
  if(M.plane) scene.remove(M.plane);
  if(M.chute) scene.remove(M.chute);
  for(const s of M.loot) if(s.alive) scene.remove(s.grp);
  for(const b of M.bots){ scene.remove(b.grp); if(b.chute) scene.remove(b.chute); }
  for(const s of M.shots) scene.remove(s.grp);
  for(const w of M.walls){ scene.remove(w.mesh); w.mat.dispose(); }
  if(M.zone) scene.remove(M.zone.wall);
  for(const a of (M.airs || [])){ if(a.plane) scene.remove(a.plane); if(a.grp) scene.remove(a.grp); }
  for(const s2 of M.structs) if(s2.grp) scene.remove(s2.grp);

  g.monsters.forEach((m, i) => {
    const snap = M.snap.monsterVis[i];
    if(m.rig && m.rig.root) m.rig.root.visible = snap ? snap.rig : true;
    if(m.decor && snap) m.decor.visible = snap.decor;
  });
  if(ctx.CH.grp) ctx.CH.grp.visible = M.snap.childVis;
  const gg = ctx.gateGroup && ctx.gateGroup();
  if(gg && M.snap.gateVis !== undefined) gg.visible = M.snap.gateVis;

  ctx.P.grp.visible = true;
  ctx.P.grp.position.copy(ctx.spawnPos);
  ctx.P.grp.position.y = ctx.heightAt(ctx.spawnPos.x, ctx.spawnPos.z);
  if(ctx.P.cannon) ctx.P.cannon.rotation.x = 0;
  if(ctx.el.mhFire) ctx.el.mhFire.classList.remove('down');
  if(ctx.el.mhCrouch) ctx.el.mhCrouch.classList.remove('active');
  g.playerHp = g.playerMaxHp;

  ctx.hide(ctx.el.matchHud); ctx.hide(ctx.el.dropBtn); ctx.hide(ctx.el.mhPrompt);
  if(ctx.el.mhMap) ctx.hide(ctx.el.mhMap);
  ctx.hide(ctx.el.killFeed); ctx.hide(ctx.el.qPanel); ctx.hide(ctx.el.qHead);
  ctx.el.killFeed.innerHTML = '';
  if(ctx.el.lowHp) ctx.el.lowHp.classList.remove('show');
  if(ctx.el.hitDir) ctx.el.hitDir.classList.remove('show');
  if(ctx.el.mhAlert) ctx.el.mhAlert.classList.remove('show');
  if(ctx.el.mhStreak) ctx.el.mhStreak.classList.remove('show');
  if(ctx.el.mhScope){ ctx.el.mhScope.classList.remove('show'); ctx.el.mhScope.classList.remove('hot');
    ctx.el.mhScope.style.opacity = '0'; }
  if(ctx.el.mhZoom) ctx.el.mhZoom.classList.remove('active');
  if(ctx.el.scopeDist) ctx.el.scopeDist.textContent = '';
  if(ctx.el.dStatLabel) ctx.el.dStatLabel.textContent = 'এই যুদ্ধে উত্তর ঠিক';

  const sid = M.sessionId, ended = M.sessionEnded;
  M = null;
  ctx.updatePlayerGun();   // ম্যাচ শেষ — হাতে আবার দোকানের বন্দুক
  if(sid && !ended) ctx.api('endBattleSession', { sessionId: sid, outcome: 'abandoned' });
}

export function isActive(){ return !!M; }
// ম্যাচে এখন হাতে থাকা বন্দুকের স্তর — game.js-এর হাতের মডেল এটা দেখে বদলায়
export function gunTier(){ return M ? M.inv.gun : 0; }

// ============================== PHASES ==============================
export function jumpNow(){
  if(!M || M.phase !== 'plane' || !M.plane) return;
  M.phase = 'drop';
  ctx.hide(ctx.el.dropBtn);
  ctx.G.mode = 'match_drop';
  ctx.P.grp.visible = true;
  ctx.P.grp.position.copy(M.plane.position);
  ctx.P.grp.position.y -= 3;
  ctx.P.facing = Math.atan2(-M.plane.position.z, -M.plane.position.x);
  ctx.P.grp.rotation.y = ctx.P.facing + Math.PI;
  M.chute = buildChute(0xff8a3c, 2.2);
  M.chute.visible = true;
  ctx.AU.sfx('gate');
  ctx.toast('🪂 নামছি! জয়স্টিক বা WASD চেপে জায়গা বেছে নাও', 2600);
}

function land(){
  M.phase = 'live';
  ctx.G.mode = 'match_live';
  if(M.chute){ ctx.scene().remove(M.chute); M.chute = null; }
  ctx.AU.sfx('slam');
  M.graceUntil = ctx.G.time + 4;
  ctx.show(ctx.el.matchHud);
  ctx.show(ctx.el.killFeed);
  updateTopHud(); updateHpHud(); updateInvHud();
  ctx.toast('🪂 নামা শেষ! মাটিতে জিনিস পড়ে আছে — কাছে গিয়ে তুলে নাও', 3200);
}

// ---------- বটদের প্যারাশুটে নামা (কেউ তাড়াহুড়ো করে না) ----------
function startBotDrop(b){
  if(!M.plane) return;
  b.state = 'chute';
  b.chuteT = 0;
  b.grp.visible = true;
  b.grp.position.copy(M.plane.position).add(v3(rand(-5, 5), -2.5, rand(-5, 5)));
  b.grp.rotation.y = rand(0, Math.PI * 2);
  b.chute.visible = true;
  b.chute.position.copy(b.grp.position);
}

function landBot(b){
  b.state = 'landed';
  b.chute.visible = false;
  b.grp.position.y = groundY(b.grp.position.x, b.grp.position.z);
  b.landedAt = ctx.G.time;
  b.activeAt = ctx.G.time + rand(2, 5); // একটু সময় নিয়ে নামে, তারপর খেলায় যোগ দেয়
  if(b.chute){ ctx.scene().remove(b.chute); b.chute = null; }
}

function botsDropTick(dt){
  for(const b of M.bots){
    if(b.state === 'plane'){
      b.grp.visible = false;
      if(M.plane && M.t >= b.jumpAt) startBotDrop(b);
    } else if(b.state === 'chute'){
      b.chuteT += dt;
      b.grp.position.y -= BOT_DROP_SPEED * dt;
      const dx = b.land.x - b.grp.position.x, dz = b.land.z - b.grp.position.z;
      const dl = Math.hypot(dx, dz);
      if(dl > 0.5){
        const step = Math.min(dl, BOT_DRIFT * dt);
        b.grp.position.x += dx / dl * step;
        b.grp.position.z += dz / dl * step;
      }
      if(b.chute){
        b.chute.position.copy(b.grp.position);
        b.chute.position.y += 1.6;
        b.chute.rotation.z = Math.sin(ctx.G.time * 1.7 + b.jumpAt) * 0.07;
        b.chute.rotation.x = Math.cos(ctx.G.time * 1.3 + b.jumpAt) * 0.05;
      }
      const gy = groundY(b.grp.position.x, b.grp.position.z);
      if(b.grp.position.y <= gy + 0.15){
        b.grp.position.y = gy;
        landBot(b);
      }
    } else if(b.state === 'landed'){
      if(ctx.G.time >= b.activeAt || b.provokedT > 0){
        b.provokedT = 0;
        b.state = 'active';
      }
    }
  }
}

// ============================== QUESTIONS ==============================
async function fetchQuestion(){
  const g = ctx.G;
  const chapters = (g.world && g.world.chapters) || [];
  const params = { slug: g.student.slug, monsterType: 'match',
    excludeIds: M.askedIds.filter(id => !String(id).startsWith('fb')).join(',') };
  if(chapters.length) params.topicIds = chapters.map(c => c.id).join(',');
  if(M.sessionId){
    const res = await ctx.api('getQuestionForBattle', params);
    if(res && res.status === 'success' && res.question && res.question.options){
      M.askedIds.push(res.question.id);
      return { src:'server', id:res.question.id, text:res.question.text,
        options:res.question.options, topicId:res.topicId };
    }
  }
  const pool = FALLBACK_QUESTIONS.filter(q => !M.usedFb.includes(q.id));
  const bank = pool.length ? pool : FALLBACK_QUESTIONS;
  if(!pool.length) M.usedFb = [];
  const q = bank[Math.floor(Math.random()*bank.length)];
  M.usedFb.push(q.id);
  return { src:'fb', id:q.id, text:q.text, options:q.options, correctIndex:q.correctIndex };
}

function renderPanelQ(){
  const p = M.panel, q = p.q;
  const kind = LOOT_KINDS[p.ref.kind];
  ctx.el.qHeadTxt.textContent =
    kind.icon + ' ' + kind.label + ' — সঠিক উত্তর ' + bn(p.ref.got) + '/' + bn(kind.need);
  ctx.el.qText.innerHTML = ctx.esc(q.text);
  if(ctx.el.qAngel){ ctx.hide(ctx.el.qAngel); ctx.el.qAngel.innerHTML = ''; }
  ctx.el.qOpts.innerHTML = '';
  (q.options || []).forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'opt';
    btn.innerHTML = '<span class="k">' + 'ABCD'[i] + '</span><span>' + ctx.esc(opt) + '</span>';
    btn.addEventListener('click', () => answerMatch(i, btn));
    ctx.el.qOpts.appendChild(btn);
  });
  ctx.show(ctx.el.qHead);
  ctx.show(ctx.el.qPanel);
  ctx.renderMath(ctx.el.qPanel);
}

async function openPanel(kind, ref){
  if(!M || M.phase !== 'live' || M.panel) return;
  M.panel = { kind, ref, resolving:true, q:null };
  const q = await fetchQuestion();
  if(!M || !M.panel || M.panel.kind !== kind || M.panel.ref !== ref) return;
  if(!q){ M.panel = null; ctx.toast('প্রশ্ন আসেনি — আবার চেষ্টা করো'); return; }
  M.panel.q = q;
  M.panel.resolving = false;
  renderPanelQ();
}

function panelNext(){
  const p = M && M.panel;
  if(!p) return;
  fetchQuestion().then(q => {
    if(!M || !M.panel || M.panel !== p) return;
    p.q = q;
    p.resolving = false;
    renderPanelQ();
  });
}

export function closePanel(){
  if(!M) return;
  M.panel = null;
  M.prompt = null; // বন্ধ করলে promptTick আবার প্রম্পট দেখাবে
  ctx.hide(ctx.el.qPanel);
  ctx.hide(ctx.el.qHead);
}

export async function answerMatch(idx, btn){
  const p = M && M.panel;
  if(!p || p.resolving || !p.q) return;
  if(!p.ref || !p.ref.alive){ closePanel(); return; }
  p.resolving = true;
  ctx.AU.sfx('click');

  let correct, cIdx;
  const q = p.q;
  if(q.src === 'server'){
    const res = await ctx.api('submitBattleAnswer', {
      sessionId: M.sessionId, slug: ctx.G.student.slug,
      topicId: q.topicId || '', questionId: q.id, chosenIndex: idx,
      timeTakenSec: 5, isReview: 'false', monsterType: 'match' });
    if(!res || res.status !== 'success'){
      ctx.toast('সংযোগ সমস্যা — আবার চেষ্টা করো');
      p.resolving = false;
      return;
    }
    correct = !!res.correct; cIdx = res.correctIndex;
  } else {
    cIdx = q.correctIndex; correct = idx === cIdx;
  }

  ctx.lockOptions(btn, cIdx, idx);
  M.asked++;
  if(correct) M.correct++;
  lootAnswer(p, correct);
}

function lootAnswer(p, correct){
  const spot = p.ref, kind = LOOT_KINDS[spot.kind];
  if(correct){
    ctx.AU.sfx('right');
    spot.got++;
    ctx.el.qHeadTxt.textContent =
      kind.icon + ' ' + kind.label + ' — সঠিক উত্তর ' + bn(spot.got) + '/' + bn(kind.need);
    if(spot.got >= kind.need){
      setTimeout(() => { if(M && M.panel === p) grantLoot(spot); }, 650);
    } else {
      setTimeout(() => { if(M && M.panel === p) panelNext(); }, 900);
    }
  } else {
    ctx.AU.sfx('wrong');
    ctx.toast('ভুল হয়েছে — পরের প্রশ্ন!', 1500);
    setTimeout(() => { if(M && M.panel === p) panelNext(); }, 1000);
  }
}

function slotCap(){ return (M.inv.bag ? 4 : 2) + (M.gadBonus || 0); }
function healCap(){ return M.inv.bag ? 3 : 1; }

function grantLoot(spot){
  const kind = LOOT_KINDS[spot.kind];
  if(spot.kind === 'airdrop'){
    // বিমানের বাক্স — একসাথেই সেরা লুট
    spot.alive = false;
    ctx.scene().remove(spot.grp);
    if(spot.air) spot.air.done = true;
    const inv = M.inv;
    inv.gun = Math.max(inv.gun, 3);
    inv.armor = true;
    inv.heals = Math.min(inv.heals + 2, healCap());
    inv.bombs = Math.min(inv.bombs + 2, slotCap());
    inv.walls = Math.min(inv.walls + 2, slotCap());
    ctx.AU.sfx('coin');
    ctx.floater(v3(spot.x, spot.y + 1.8, spot.z), '🪂 সেরা লুট!', '#FFC46B');
    ctx.toast('🪂 বাক্স খুলল — স্নাইপার-বর্ম-হিল-কিট সব পেলে!', 2800);
    updateInvHud();
    ctx.updatePlayerGun();
    closePanel();
    return;
  }
  spot.alive = false;
  ctx.scene().remove(spot.grp);
  const inv = M.inv;
  if(spot.kind === 'bag') inv.bag = true;
  else if(spot.kind === 'armor') inv.armor = true;
  else if(spot.kind === 'heal') inv.heals = Math.min(inv.heals + 1, healCap());
  else if(spot.kind === 'bomb') inv.bombs = Math.min(inv.bombs + 2, slotCap());
  else if(spot.kind === 'wall') inv.walls = Math.min(inv.walls + 2, slotCap());
  else inv.gun = Math.max(inv.gun, kind.tier);
  ctx.AU.sfx('coin');
  const at = v3(spot.x, spot.y + 1.8, spot.z);
  ctx.floater(at, kind.icon + ' ' + kind.label, '#7DFF9E');
  ctx.toast(kind.icon + ' ' + kind.label + ' এখন তোমার!', 1900);
  closePanel();
  updateInvHud();
  ctx.updatePlayerGun();   // হাতের বন্দুকের মডেল বদলাও
}

// ============================== PROMPT ==============================
function canPick(spot){
  if(spot.kind === 'airdrop') return null; // লুটের বাক্স সবসময় খোলা যায়
  const inv = M.inv;
  if(spot.kind === 'bag')   return inv.bag   ? 'ব্যাগ তো আছেই!' : null;
  if(spot.kind === 'armor') return inv.armor ? 'আর্মার তো পরাই আছে!' : null;
  if(spot.kind === 'heal')  return inv.heals >= healCap() ? 'হিল-কিটের জায়গা নেই' : null;
  if(spot.kind === 'bomb')  return inv.bombs >= slotCap() ? 'বোমার জায়গা নেই' : null;
  if(spot.kind === 'wall')  return inv.walls >= slotCap() ? 'প্রাচীরের জায়গা নেই' : null;
  if(LOOT_KINDS[spot.kind].tier <= inv.gun) return 'এর চেয়ে ভালোটা হাতেই আছে!';
  return null;
}

function promptTick(){
  const p = P_pos();
  let best = null, bd = 3.0;
  for(const s of M.loot){
    if(!s.alive) continue;
    const d = Math.hypot(s.x - p.x, s.z - p.z);
    if(d < bd){ bd = d; best = s; }
  }
  const next = best ? { type:'loot', spot:best } : null;
  const prev = M.prompt;
  M.prompt = next;
  if(M.panel || !next){ ctx.hide(ctx.el.mhPrompt); return; }
  if(prev && prev.type === 'loot' && prev.spot === next.spot) return;
  const el = ctx.el.mhPrompt;
  const k = LOOT_KINDS[next.spot.kind];
  const deny = canPick(next.spot);
  if(next.spot.kind === 'airdrop'){
    el.textContent = '🪂 ' + k.label + ' খোলো — ' + bn(k.need) + 'টি কঠিন প্রশ্ন';
    el.classList.remove('ghost');
  } else {
    el.textContent = deny ? '✕ ' + k.label + ' (' + deny + ')'
      : k.icon + ' ' + k.label + ' তুলো (' + bn(k.need) + 'টি প্রশ্ন)';
    el.classList.toggle('ghost', !!deny);
  }
  ctx.show(el);
}

export function usePrompt(){
  if(!M || M.phase !== 'live' || !M.prompt || M.panel) return;
  const p = M.prompt;
  const deny = canPick(p.spot);
  if(deny){ ctx.toast(deny); return; }
  openPanel('loot', p.spot);
}

// ============================== HUD ==============================
function updateTopHud(){
  const alive = M.bots.filter(b => b.alive).length + 1;
  ctx.el.mhAlive.textContent = '👥 ' + bn(alive);
  ctx.el.mhKills.textContent = '💀 ' + bn(M.kills);
}
function updateHpHud(){
  ctx.el.mhHpFill.style.width = Math.max(0, M.hp / M.hpMax * 100) + '%';
  ctx.el.mhHpNum.textContent = bn(Math.max(0, Math.round(M.hp))) + '/' + bn(M.hpMax);
}
function useHeal(){
  if(!M || M.phase !== 'live') return;
  if(M.inv.heals <= 0) return;
  if(M.hp >= M.hpMax){ ctx.toast('HP তো ভরা আছে'); return; }
  M.inv.heals--;
  M.hp = Math.min(M.hpMax, M.hp + 35);
  ctx.AU.sfx('coin');
  ctx.screenFlash('heal');
  const at = P_pos().clone(); at.y += 1.9;
  ctx.floater(at, '+' + bn(35), '#4CD97B');
  updateHpHud(); updateInvHud();
}
function updateInvHud(){
  const inv = M.inv;
  const chips = [];
  chips.push('<span class="chip">🔫 ' + GUN_TIERS[inv.gun] + '</span>');
  if(inv.bag) chips.push('<span class="chip">🎒 ব্যাগ</span>');
  if(inv.armor) chips.push('<span class="chip">🛡️ আর্মার</span>');
  if(inv.heals > 0) chips.push('<span class="chip use">🩹 ' + bn(inv.heals) + 'টি — চাপ দাও</span>');
  if(inv.bombs > 0) chips.push('<span class="chip">💣 ' + bn(inv.bombs) + 'টি</span>');
  if(inv.walls > 0) chips.push('<span class="chip">🧱 ' + bn(inv.walls) + 'টি</span>');
  const box = ctx.el.mhInv;
  box.innerHTML = chips.join('');
  const healChip = box.querySelector('.chip.use');
  if(healChip) healChip.addEventListener('click', useHeal);
  if(ctx.el.mhWallN) ctx.el.mhWallN.textContent = bn(inv.walls);
  if(ctx.el.mhBombN) ctx.el.mhBombN.textContent = bn(inv.bombs);
  if(ctx.el.mhWall) ctx.el.mhWall.style.opacity = inv.walls ? '' : '0.55';
  if(ctx.el.mhBomb) ctx.el.mhBomb.style.opacity = inv.bombs ? '' : '0.55';
  if(ctx.el.mhZoom) ctx.el.mhZoom.classList.toggle('empty', inv.gun < 1);
}

function addFeed(text){
  const feed = ctx.el.killFeed;
  const d = document.createElement('div');
  d.className = 'feed-item';
  d.textContent = text;
  feed.prepend(d);
  while(feed.children.length > 5) feed.lastChild.remove();
  setTimeout(() => d.classList.add('fade'), 3600);
  setTimeout(() => d.remove(), 4600);
}

// উপরের সতর্কবার্তা-ফালকা (বলয় ছোট হওয়া, শেষ বলয়)
function banner(text, cls, ms){
  const b = ctx.el.mhAlert;
  if(!b) return;
  b.textContent = text;
  b.className = cls || '';
  b.classList.add('show');
  clearTimeout(banner._t);
  banner._t = setTimeout(() => b.classList.remove('show'), ms || 2600);
}
// কিল-স্ট্রিকের সোনালি ফালকা
function streakBanner(text, ms){
  const s = ctx.el.mhStreak;
  if(!s) return;
  s.textContent = text;
  s.classList.add('show');
  clearTimeout(streakBanner._t);
  streakBanner._t = setTimeout(() => s.classList.remove('show'), ms || 2800);
}
// কোন দিক থেকে গুলি এল — তীর ঘোরানো + দূরত্ব
function hitDirShow(srcPos){
  const hd = ctx.el.hitDir;
  if(!hd) return;
  const p = P_pos();
  const dx = srcPos.x - p.x, dz = srcPos.z - p.z;
  const deg = ((((ctx.G.camYaw + Math.PI) - Math.atan2(dx, dz)) * 180 / Math.PI + 540) % 360) - 180;
  if(ctx.el.hdArrow) ctx.el.hdArrow.style.transform = 'rotate(' + deg.toFixed(1) + 'deg)';
  if(ctx.el.hdDist) ctx.el.hdDist.textContent = bn(Math.round(Math.hypot(dx, dz))) + ' মিটার';
  hd.classList.add('show');
  clearTimeout(hitDirShow._t);
  hitDirShow._t = setTimeout(() => hd.classList.remove('show'), 1700);
}

// ============================== COMbat (রিয়েল-টাইম) ==============================
function facePlayerTo(pos){
  const p = P_pos();
  ctx.P.facing = Math.atan2(pos.x - p.x, pos.z - p.z);
  ctx.P.grp.rotation.y = ctx.P.facing + Math.PI;
}

function hitBot(b, dmg, crit){
  if(!b.alive) return;
  b.hp -= dmg;
  b.provokedT = 4; // গুলি খেয়ে বট সাড়া দেয়
  const at = b.grp.position.clone(); at.y += 1.4;
  ctx.floater(at, (crit ? 'ক্রিট! -' : '-') + bn(dmg), crit ? '#FFC46B' : '#FF8A3C');
  ctx.G.hitStop = Math.max(ctx.G.hitStop || 0, 0.045);
  if(b.hp <= 0) killBot(b, 'তুমি');
}

export function setFiring(on){
  if(M) M.firing = !!on;
}

function combatTick(dt){
  M.fireT -= dt; M.bombT -= dt; M.wallT -= dt; M.meleeT -= dt;
  const gun = M.inv.gun;
  const wantArm = (M.firing && gun > 0) ? 1 : 0;
  M.armT += (wantArm - M.armT) * Math.min(1, dt * 10);
  if(ctx.P.cannon) ctx.P.cannon.rotation.x = 1.45 * M.armT;
  if(!M.firing || dt <= 0) return;

  const p = P_pos();
  let best = null, bd = 1e9;
  for(const b of M.bots){
    if(!b.alive || (b.state !== 'active' && b.state !== 'landed')) continue;
    const d = Math.hypot(b.grp.position.x - p.x, b.grp.position.z - p.z);
    if(d < bd){ bd = d; best = b; }
  }
  if(!best) return;

  if(gun === 0){
    if(bd < MELEE_RANGE && M.meleeT <= 0){
      M.meleeT = MELEE_CD;
      facePlayerTo(best.grp.position);
      ctx.AU.sfx('slam');
      hitBot(best, MELEE_DMG, false);
    }
    return;
  }
  if(bd > GUN_RANGE[gun] || M.fireT > 0) return;
  M.fireT = GUN_CD[gun];
  facePlayerTo(best.grp.position);
  const from = p.clone(); from.y += 1.5 - 0.45 * M.crouchK;
  const to = best.grp.position.clone();
  to.y += 1.15 + rand(-0.15, 0.15);
  to.x += rand(-0.5, 0.5); to.z += rand(-0.5, 0.5);
  ctx.AU.sfx('zap');
  const tier = gun;
  const ob = shotObstacle(from, to);
  if(ob){
    const hit = from.clone().lerp(to, ob.t);
    spawnShot(from, hit, TRACER_PLAYER, () => ctx.impactBurst(hit));
    return;
  }
  spawnShot(from, to, TRACER_PLAYER, () => {
    if(!M || !best.alive) return;
    const crit = Math.random() < 0.16;
    const dmg = Math.max(1, Math.round(GUN_DMG[tier] * rand(0.92, 1.08) * (crit ? 1.5 : 1)));
    hitBot(best, dmg, crit);
  });
}

// ---------- বোমা ----------
export function throwBomb(){
  if(!M || M.phase !== 'live' || M.bombT > 0) return;
  if(M.inv.bombs <= 0){ ctx.toast('💣 বোমা নেই — লুট থেকে তুলো', 1600); return; }
  M.inv.bombs--;
  M.bombT = BOMB_CD;
  const p = P_pos();
  const from = p.clone(); from.y += 1.6;
  const sin = Math.sin(ctx.P.facing), cos = Math.cos(ctx.P.facing);
  const to = v3(p.x + sin * BOMB_THROW, 0, p.z + cos * BOMB_THROW);
  to.y = groundY(to.x, to.z) + 0.4;
  ctx.AU.sfx('click');
  ctx.fireProjectile(from, to, () => explodeBomb(to));
  updateInvHud();
}

function explodeBomb(at){
  if(!M) return;
  ctx.G.shake = Math.max(ctx.G.shake || 0, 0.5);
  for(const b of M.bots){
    if(!b.alive || (b.state !== 'active' && b.state !== 'landed')) continue;
    const d = Math.hypot(b.grp.position.x - at.x, b.grp.position.z - at.z);
    if(d < BOMB_RADIUS){
      const dmg = Math.max(8, Math.round(BOMB_DMG * (1 - (d / BOMB_RADIUS) * 0.6)));
      hitBot(b, dmg, false);
    }
  }
}

// ---------- গ্লু-প্রাচীর ----------
const WALL_GEO = new THREE.BoxGeometry(WALL_W, 2.3, 0.26);

export function placeWall(){
  if(!M || M.phase !== 'live' || M.wallT > 0) return;
  if(M.walls.length >= MAX_WALLS){ ctx.toast('🧱 একসাথে সর্বোচ্চ ' + bn(MAX_WALLS) + 'টি প্রাচীর', 1600); return; }
  if(M.inv.walls <= 0){ ctx.toast('🧱 গ্লু-প্রাচীর নেই — লুট থেকে তুলো', 1600); return; }
  M.inv.walls--;
  M.wallT = WALL_CD;
  const p = P_pos();
  const sin = Math.sin(ctx.P.facing), cos = Math.cos(ctx.P.facing);
  const cx = p.x + sin * WALL_RANGE, cz = p.z + cos * WALL_RANGE;
  const cy = groundY(cx, cz);
  const mat = new THREE.MeshStandardMaterial({ color: 0x9FD8FF, transparent: true, opacity: 0.5,
    roughness: 0.35, metalness: 0.05, emissive: 0x2b6cb0, emissiveIntensity: 0.5,
    side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(WALL_GEO, mat);
  mesh.position.set(cx, cy + 1.15, cz);
  mesh.rotation.y = ctx.P.facing;
  ctx.scene().add(mesh);
  M.walls.push({ mesh, mat, x:cx, z:cz, hp:WALL_HP, life:WALL_LIFE });
  ctx.AU.sfx('click');
  ctx.floater(v3(cx, cy + 2.7, cz), '🧱 প্রাচীর', '#9FD8FF');
  updateInvHud();
}

function breakWall(w){
  const idx = M ? M.walls.indexOf(w) : -1;
  if(idx < 0) return;
  M.walls.splice(idx, 1);
  ctx.scene().remove(w.mesh);
  w.mat.dispose();
  ctx.impactBurst(v3(w.x, groundY(w.x, w.z) + 1.2, w.z));
}

function damageWall(w, dmg){
  if(!M || M.walls.indexOf(w) < 0) return;
  w.hp -= dmg;
  w.mat.opacity = Math.min(0.5, 0.2 + 0.3 * (w.hp / WALL_HP));
  if(w.hp <= 0) breakWall(w);
}

function wallTick(dt){
  for(let i = M.walls.length - 1; i >= 0; i--){
    const w = M.walls[i];
    w.life -= dt;
    if(w.life <= 3){
      w.mat.opacity = Math.max(0.08, 0.5 * (w.life / 3) * (0.65 + 0.35 * Math.sin(ctx.G.time * 9)));
    }
    if(w.life <= 0) breakWall(w);
  }
}

// ============================== BOTS ==============================
function faceTo(b, pos){
  b.grp.rotation.y = Math.atan2(pos.x - b.grp.position.x, pos.z - b.grp.position.z);
}
function moveTo(b, pos, dt, speed){
  const dx = pos.x - b.grp.position.x, dz = pos.z - b.grp.position.z;
  const len = Math.hypot(dx, dz);
  if(len < 0.4) return true;
  const px = b.grp.position.x, pz = b.grp.position.z;
  b.grp.position.x += dx/len * speed * dt;
  b.grp.position.z += dz/len * speed * dt;
  resolvePos(b.grp.position, 0.45);
  const step = Math.hypot(b.grp.position.x - px, b.grp.position.z - pz);
  b.stuckT = step < 0.3 * speed * dt ? b.stuckT + dt : 0;
  faceTo(b, pos);
  b.walkPhase += dt * 9;
  const sw = Math.sin(b.walkPhase) * 0.5;
  b.legL.rotation.x = sw; b.legR.rotation.x = -sw;
  b.body.position.y = 1.0 + Math.abs(Math.sin(b.walkPhase)) * 0.07;
  return false;
}

// বটের গুলি — target হয় 'player', নয়তো অন্য বট
function botShoot(b, target){
  if(!M || !b.alive || M.phase !== 'live') return;
  addPing(b.grp.position.x, b.grp.position.z); // রাডারে গুলির আওয়াজ
  const foe = target === 'player' ? null : target;
  const from = b.grp.position.clone(); from.y += 1.4;
  const to = (foe ? foe.grp.position : P_pos()).clone();
  to.y += 1.1 + (Math.random()-0.5)*0.7;
  to.x += (Math.random()-0.5)*1.4;
  to.z += (Math.random()-0.5)*1.4;
  if(b.grp.position.distanceTo(P_pos()) < 45) ctx.AU.sfx('zap'); // দূরের লড়াইয়ের শব্দ কানে আসে না
  const ob = shotObstacle(from, to);
  if(ob){
    const hit = from.clone().lerp(to, ob.t);
    spawnShot(from, hit, TRACER_BOT, () => {
      if(ob.wall) damageWall(ob.wall, 14);
      else ctx.impactBurst(hit);
    });
    return;
  }
  if(!foe){
    // নিচু হয়ে থাকলে অনেক গুলি মাথার উপর দিয়ে চলে যায়
    if(M.crouchK > 0.5 && Math.random() < 0.35 * M.crouchK){
      const air = to.clone(); air.y += rand(1.5, 2.6);
      spawnShot(from, air, TRACER_BOT, null);
      return;
    }
    const raw = rand(7, 11);
    spawnShot(from, to, TRACER_BOT, () => playerHit(raw, b));
    return;
  }
  // বট-বনাম-বট: খেয়ালি গুলি ফসকে যায়
  if(Math.random() < BOT_MISS){
    const air = to.clone(); air.y += rand(0.9, 2.2);
    spawnShot(from, air, TRACER_BOT, null);
    return;
  }
  const raw = rand(BOT_DMG_MIN, BOT_DMG_MAX), shooter = b.name;
  spawnShot(from, to, TRACER_BOT, () => {
    if(!M || M.phase !== 'live' || !foe.alive) return;
    foe.hp -= raw;
    const at = foe.grp.position.clone(); at.y += 1.3;
    ctx.impactBurst(at);
    if(foe.hp <= 0) killBot(foe, shooter);
  });
}

function playerHit(raw, src){
  if(!M || M.phase !== 'live') return;
  const dmg = Math.max(1, Math.round(raw * (M.inv.armor ? 0.7 : 1)));
  M.hp -= dmg;
  ctx.AU.sfx('hurt');
  ctx.screenFlash('dmg');
  ctx.G.shake = Math.max(ctx.G.shake || 0, 0.45);
  const at = P_pos().clone(); at.y += 1.9;
  ctx.floater(at, '-' + bn(dmg), '#FF6A55');
  if(src && src.grp) hitDirShow(src.grp.position);
  updateHpHud();
  if(M.hp <= 0) endMatch(false);
}

function killBot(b, killer){
  if(!b.alive) return;
  b.alive = false;
  b.deadT = 0;
  if(b.chute){ ctx.scene().remove(b.chute); b.chute = null; }
  ctx.AU.sfx('boom');
  const at = b.grp.position.clone(); at.y += 1.2;
  ctx.impactBurst(at);
  if(killer === 'তুমি'){
    M.kills++;
    ctx.AU.sfx('coin');
    ctx.toast('🎯 ' + b.name + ' টিকে থাকতে পারল না!', 1800);
    addFeed('🎯 তুমি ' + b.name + '-কে হারিয়ে দিলে');
    // টানা জয় — ফ্রি-ফায়ারের 'RAMBO' ধাঁচের স্ট্রিক-ফালকা
    const now = ctx.G.time;
    M.streak = (now - (M.lastKillT || -99) < 26) ? (M.streak || 0) + 1 : 1;
    M.lastKillT = now;
    const msg = {3:'🔥 টানা ৩ জয়!', 5:'⚡ থামানো যাচ্ছে না — টানা ৫!', 7:'👑 অপ্রতিরোধ্য — টানা ৭!', 10:'🌟 কিংবদন্তি — টানা ১০!'}[M.streak];
    if(msg){ streakBanner(msg); ctx.AU.sfx('streak'); }
  } else if(killer === 'বলয়'){
    addFeed('🔵 বলয়ের চাপে ' + b.name + ' বিদায় নিল');
  } else {
    addFeed('⚔ ' + killer + ' ' + b.name + '-কে হারিয়ে দিল');
  }
  if(M.prompt && M.prompt.spot && !M.prompt.spot.alive) M.prompt = null;
  updateTopHud();
  if(!M.bots.some(x => x.alive) && M.phase === 'live'){
    setTimeout(() => { if(M && M.phase === 'live') endMatch(true); }, 900);
  }
}

function botsTick(dt){
  const p = P_pos();
  const z = M.zone;
  const inGrace = ctx.G.time < M.graceUntil;
  for(const b of M.bots){
    if(!b.alive){
      b.deadT += dt;
      b.grp.rotation.x = Math.min(1.4, b.deadT * 3.5);
      if(b.deadT > 0.6) b.grp.position.y -= dt * 0.5;
      if(b.deadT > 1.8) b.grp.visible = false;
      continue;
    }
    if(b.state !== 'active') continue;

    // শেষ বলয়ে চূড়ান্ত চাপ — ভিতরে থাকলেও রক্ষা নেই
    const cd_ = collapseDps();
    if(cd_ > 0){
      b.hp -= cd_ * dt;
      if(b.hp <= 0){ killBot(b, 'বলয়'); continue; }
    }

    // বলয়ের বাইরে → ভিতরে ছোটে + ধীরে ধীরে কষ্ট পায়
    const dz = Math.hypot(b.grp.position.x - z.cx, b.grp.position.z - z.cz);
    if(dz > z.r){
      b.hp -= ZONE_DPS[Math.min(z.idx, ZONE_DPS.length-1)] * dt * 2;
      if(b.hp <= 0){ killBot(b, 'বলয়'); continue; }
      moveTo(b, v3(z.cx, 0, z.cz), dt, b.speed * 1.15);
      if(b.stuckT > 1.2){ b.stuckT = 0; b.grp.position.x += rand(-2.5, 2.5); b.grp.position.z += rand(-2.5, 2.5); }
    } else {
      if(b.provokedT > 0){ b.provokedT -= dt; b.target = 'player'; b.giveUpT = 0; }
      if(b.giveUpT > 0) b.giveUpT -= dt;
      const dp = b.grp.position.distanceTo(p);
      const detect = inGrace ? 0 : Math.min(M.concealed ? 11 : 26, M.crouch ? 15 : 26);
      const seen = dp < detect && !visionBlocked(b.grp.position, p);
      if(seen && b.giveUpT <= 0) b.target = 'player';
      else if(b.target === 'player' && dp > 34) b.target = null;

      if(b.target === 'player'){
        faceTo(b, p);
        if(dp > 13) moveTo(b, p, dt, b.speed);
        else if(dp < 7.5){
          const away = b.grp.position.clone().sub(p).setY(0).normalize();
          moveTo(b, b.grp.position.clone().addScaledVector(away, 4), dt, b.speed);
        }
        if(b.stuckT > 1.4){ b.target = null; b.giveUpT = 2.5; b.stuckT = 0; }
        b.fireT -= dt;
        if(b.fireT <= 0 && dp < 30 && seen){
          botShoot(b, 'player');
          b.fireT = b.fireCD * rand(0.85, 1.15);
        }
      } else if(botFoeTick(b, dt)){
        // শত্রু-বটের সাথে লড়ছে
      } else {
        b.roamT -= dt;
        if(b.roamT <= 0){
          const others = M.bots.filter(o => o !== b && o.alive && o.state === 'active');
          const pIn = Math.hypot(p.x - z.cx, p.z - z.cz) < z.r * 0.9;
          // শেষ পর্যায়ে (শেষ বলয়, বা মাত্র ৩ জন বাকি) বট আর ঘুরে বেড়ায় না — তোমাকে খুঁজতে বেরোয়
          const endgame = z.state === 'final' || (others.length + 1) <= 3;
          if(endgame && pIn && Math.random() < 0.6){
            // শেষ যোদ্ধারা তোমার কাছেই আসে — বলয়ের ভিতরে লুকিয়ে বাঁচা যায় না
            b.roamTo = v3(p.x + rand(-6, 6), 0, p.z + rand(-6, 6));
          } else if(others.length && Math.random() < 0.3){
            // শিকার-খোঁজা: মাঝেমধ্যে খেলোয়াড় নয়, অন্য বটের দিকেই হাঁটে
            const o = others[Math.floor(Math.random() * others.length)];
            const a = Math.random() * Math.PI * 2, rr = rand(6, 14);
            b.roamTo = v3(o.grp.position.x + Math.cos(a) * rr, 0, o.grp.position.z + Math.sin(a) * rr);
          } else {
            const a = Math.random() * Math.PI * 2;
            // শেষ বলয়ে সবাই কেন্দ্রে জড়ো হয় — লড়াই অনিবার্য
            const rr = z.state === 'final' ? Math.random() * z.r * 0.25 : Math.random() * z.r * 0.8;
            b.roamTo = v3(z.cx + Math.cos(a) * rr, 0, z.cz + Math.sin(a) * rr);
          }
          b.roamT = rand(5, 11);
        }
        moveTo(b, b.roamTo, dt, b.speed * 0.7);
        if(b.stuckT > 1.0){ b.stuckT = 0; b.roamT = 0; }
      }
    }
    b.grp.position.y = groundY(b.grp.position.x, b.grp.position.z);
  }
}

// ---------- বট বনাম বট — নিজেরাই শত্রু খুঁজে লড়ে ----------
function botFoeTick(b, dt){
  if(b.foe && (!b.foe.alive || (b.foe.state !== 'active' && b.foe.state !== 'landed'))) b.foe = null;
  if(b.foe){
    const f = b.foe;
    const d = b.grp.position.distanceTo(f.grp.position);
    if(d > BOT_VISION * 1.6 || visionBlocked(b.grp.position, f.grp.position)){
      // আড়ালে চলে গেছে — একটু খোঁজে, না পেলে ছেড়ে দেয়
      b.foeT += dt;
      if(b.foeT > 2.6){ b.foe = null; b.foeT = 0; return false; }
    } else b.foeT = 0;
    faceTo(b, f.grp.position);
    if(d > 12) moveTo(b, f.grp.position, dt, b.speed);
    else if(d < 6){
      const away = b.grp.position.clone().sub(f.grp.position).setY(0).normalize();
      moveTo(b, b.grp.position.clone().addScaledVector(away, 3.5), dt, b.speed * 0.8);
    }
    b.fireT -= dt;
    if(b.fireT <= 0 && d < BOT_FIGHT_RANGE && b.foeT <= 0){
      botShoot(b, f);
      b.fireT = b.fireCD * rand(0.8, 1.15) * BOT_DUEL_PACE * (M.zone.r < 34 ? 0.6 : 1); // শেষ ছোট বলয়ে দ্রুত লড়াই
    }
    return true;
  }
  let best = null, bd = BOT_VISION;
  for(const o of M.bots){
    if(o === b || !o.alive || (o.state !== 'active' && o.state !== 'landed')) continue;
    const d = Math.hypot(o.grp.position.x - b.grp.position.x, o.grp.position.z - b.grp.position.z);
    if(d < bd && !visionBlocked(b.grp.position, o.grp.position)){ bd = d; best = o; }
  }
  if(best){ b.foe = best; b.foeT = 0; return true; }
  return false;
}

// ---------- দূরের বট সরল করে আঁকা (১৯ বটেও কম-দামি ফোনে চলে) ----------
function lodTick(dt){
  M.lodT -= dt;
  if(M.lodT > 0) return;
  M.lodT = 0.45;
  const p = P_pos();
  for(const b of M.bots){
    if(!b.alive) continue; // মৃত বটের দৃশ্য ওদের নিজের নিয়ন্ত্রণে
    if(b.state !== 'active' && b.state !== 'landed') continue;
    const d = b.grp.position.distanceTo(p);
    b.grp.visible = d < LOD_FAR;
    const detail = d < LOD_DETAIL;
    b.helmet.visible = detail;
    b.gun.visible = detail;
    b.legL.visible = detail;
    b.legR.visible = detail;
    if(b.pack) b.pack.visible = detail;
  }
}

// ============================== MINIMAP ==============================
function addPing(x, z){
  if(!M) return;
  M.pings.push({ x, z, t: 0 });
  if(M.pings.length > PING_MAX) M.pings.shift();
}

function minimapTick(dt){
  const cv = ctx.el.mhMap;
  if(!cv) return;
  for(let i = M.pings.length - 1; i >= 0; i--){
    M.pings[i].t += dt;
    if(M.pings[i].t >= PING_LIFE) M.pings.splice(i, 1);
  }
  M.mapT -= dt;
  if(M.mapT > 0) return;
  M.mapT = MAP_DT;
  drawMinimap(cv);
}

function drawMinimap(cv){
  const c = cv.getContext('2d');
  const S = cv.width, H = S / 2;
  const R = H - 7;              // খেলার গণ্ডির বৃত্ত
  const k = R / MAP_LIMIT;
  const X = x => H + x * k, Z = z => H + z * k;
  c.clearRect(0, 0, S, S);
  c.save();
  c.beginPath(); c.arc(H, H, R + 5, 0, Math.PI * 2); c.clip();
  c.fillStyle = 'rgba(10,20,16,.72)'; c.fillRect(0, 0, S, S);

  // ঘর/আড়াল — ফিকে ছায়া
  c.fillStyle = 'rgba(200,214,205,.38)';
  for(const s2 of M.structs) c.fillRect(X(s2.x) - 3, Z(s2.z) - 3, 6, 6);

  // মাটিতে পড়ে থাকা লুট — সোনালি বিন্দু (লুটের বাক্স বড় লাল বিন্দু)
  for(const l of M.loot){
    if(!l.alive) continue;
    if(l.air){
      c.fillStyle = 'rgba(255,86,64,.95)';
      c.beginPath(); c.arc(X(l.x), Z(l.z), 3.8, 0, Math.PI * 2); c.fill();
    } else {
      c.fillStyle = 'rgba(255,201,77,.65)';
      c.beginPath(); c.arc(X(l.x), Z(l.z), 2.4, 0, Math.PI * 2); c.fill();
    }
  }

  // বলয় — এখনকার নীল; ছোট হওয়ার সময় গন্তব্যও ফিকে সাদা
  const z = M.zone;
  if(z){
    if(z.state === 'shrink' && z.to){
      c.setLineDash([6, 5]);
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.6;
      c.beginPath(); c.arc(X(z.to.cx), Z(z.to.cz), Math.max(2, z.to.r * k), 0, Math.PI * 2); c.stroke();
      c.setLineDash([]);
    }
    c.strokeStyle = 'rgba(95,199,255,.95)'; c.lineWidth = 2.6;
    c.beginPath(); c.arc(X(z.cx), Z(z.cz), Math.max(2, z.r * k), 0, Math.PI * 2); c.stroke();
  }

  // লুটের বিমান ও তার বাক্স — লাল, জ্বলছে-নিভছে
  for(const a of (M.airs || [])){
    if(a.done) continue;
    const bl = 0.55 + 0.45 * Math.sin(ctx.G.time * 6);
    if(a.plane){
      c.save();
      c.translate(X(a.plane.position.x), Z(a.plane.position.z));
      c.rotate(Math.PI - Math.atan2(a.to.x - a.from.x, a.to.z - a.from.z));
      c.fillStyle = 'rgba(255,86,64,.9)';
      c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 6); c.lineTo(0, 3); c.lineTo(-6, 6);
      c.closePath(); c.fill();
      c.restore();
    }
    if(a.state !== 'fly'){
      c.strokeStyle = 'rgba(255,86,64,' + (0.35 + 0.5 * bl).toFixed(2) + ')';
      c.lineWidth = 1.6;
      c.beginPath(); c.arc(X(a.x), Z(a.z), 7 + 4 * bl, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(255,86,64,' + (0.6 + 0.4 * bl).toFixed(2) + ')';
      c.beginPath();
      c.moveTo(X(a.x), Z(a.z) - 5.5); c.lineTo(X(a.x) + 5.5, Z(a.z));
      c.lineTo(X(a.x), Z(a.z) + 5.5); c.lineTo(X(a.x) - 5.5, Z(a.z));
      c.closePath(); c.fill();
    }
  }

  // গুলির আওয়াজ — লাল বিন্দু, ধীরে মিলিয়ে যায়
  for(const p of M.pings){
    const f = 1 - p.t / PING_LIFE;
    c.fillStyle = 'rgba(255,92,72,' + (0.8 * f).toFixed(3) + ')';
    c.beginPath(); c.arc(X(p.x), Z(p.z), 4.6 * (0.65 + 0.35 * f), 0, Math.PI * 2); c.fill();
  }

  // উত্তর দিকের চিহ্ন
  c.fillStyle = 'rgba(255,255,255,.55)';
  c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'top';
  c.fillText('উ', H, 7);

  // নিজের তীর — যেদিকে মুখ, সেদিকেই ফেরানো
  const pl = (M.phase === 'plane' && M.plane) ? M.plane.position : P_pos();
  const pf = (M.phase === 'plane')
    ? Math.atan2(PLANE_TO.x - PLANE_FROM.x, PLANE_TO.z - PLANE_FROM.z)
    : (ctx.P.facing || 0);
  c.save();
  c.translate(X(pl.x), Z(pl.z));
  c.rotate(Math.PI - pf);
  c.beginPath();
  c.moveTo(0, -10); c.lineTo(7, 7.5); c.lineTo(0, 3.6); c.lineTo(-7, 7.5);
  c.closePath();
  c.fillStyle = '#EAF6FF'; c.fill();
  c.lineWidth = 1.4; c.strokeStyle = 'rgba(16,34,52,.85)'; c.stroke();
  c.restore();
  c.restore();
}

// ============================== ZONE ==============================
function zoneTick(dt){
  const z = M.zone;
  z.wall.material.opacity = 0.1 + Math.sin(ctx.G.time * 2.2) * 0.035;
  z.wall.scale.set(z.r, 1, z.r);
  z.wall.position.set(z.cx, 22, z.cz);

  if(z.state === 'wait'){
    z.t -= dt;
    const bt = Math.ceil(z.t);
    if(bt <= 8 && !z.warn8){ z.warn8 = true; banner('⚠️ বলয় ' + bn(bt) + ' সেকেন্ডে ছোট হবে', 'blink', 1700); ctx.AU.sfx('siren'); }
    if(bt <= 3 && !z.warn3){ z.warn3 = true; banner('⚠️ বলয় ছোট হবে — ' + bn(Math.max(1, bt)), 'blink', 1500); }
    if(z.t <= 0){
      if(z.idx + 1 >= ZONE_STAGES.length){
        z.state = 'final';
        ctx.toast('☠️ শেষ বলয়! এটা আর থামবে না — শেষ পর্যন্ত টিকে থাকো', 3200);
        banner('☠️ শেষ বলয় — আর থামবে না!', 'blink', 4200);
        ctx.AU.sfx('gate'); ctx.AU.sfx('siren');
      }
      else {
        const nx = ZONE_STAGES[z.idx + 1];
        z.from = { r: z.r, cx: z.cx, cz: z.cz };
        const a = Math.random()*Math.PI*2, off = Math.random() * (z.r - nx.r) * 0.5;
        z.to = { r: nx.r, cx: z.cx + Math.cos(a)*off, cz: z.cz + Math.sin(a)*off };
        z.state = 'shrink';
        z.t = ZONE_STAGES[z.idx].s;
        z.warn8 = z.warn3 = false;
        ctx.toast('🔵 বলয় ছোট হচ্ছে — নীল দেয়ালের ভিতরে থেকো!', 2600);
        banner('🔵 বলয় ছোট হচ্ছে — ভিতরে এসো!', 'blink', 3400);
        ctx.AU.sfx('gate'); ctx.AU.sfx('siren');
      }
    }
  } else if(z.state === 'shrink'){
    z.t -= dt;
    const k = Math.min(1, 1 - z.t / ZONE_STAGES[z.idx].s);
    z.r  = z.from.r  + (z.to.r  - z.from.r ) * k;
    z.cx = z.from.cx + (z.to.cx - z.from.cx) * k;
    z.cz = z.from.cz + (z.to.cz - z.from.cz) * k;
    if(z.t <= 0){ z.idx++; z.state = 'wait'; z.t = ZONE_STAGES[z.idx].w; }
  } else {
    // শেষ বলয় থেমে থাকে না — ধীরে ধীরে মিলিয়ে যায়, তাই শেষ পর্যন্ত লুকিয়ে থাকা অসম্ভব
    z.r = Math.max(0.6, z.r - 0.32 * dt);
  }

  // খেলোয়াড় বলয়ের বাইরে → ক্ষয়
  const p = P_pos();
  M.outside = Math.hypot(p.x - z.cx, p.z - z.cz) > z.r;
  if(M.outside){
    M.hp -= ZONE_DPS[Math.min(z.idx, ZONE_DPS.length-1)] * dt;
    M.zoneHurtT -= dt;
    if(M.zoneHurtT <= 0){
      M.zoneHurtT = 2;
      ctx.AU.sfx('hurt');
      const at = p.clone(); at.y += 1.9;
      ctx.floater(at, 'বলয়ের বাইরে!', '#5FC7FF');
    }
    updateHpHud();
    if(M.hp <= 0){ endMatch(false); return; }
  }

  // শেষ বলয়ের চূড়ান্ত চাপ — সবার উপর, ভিতরে-বাইরে নির্বিশেষে
  const cdp = collapseDps();
  if(cdp > 0){
    M.hp -= cdp * dt;
    updateHpHud();
    if(M.hp <= 0){ endMatch(false); return; }
  }

  const chip = ctx.el.mhZone;
  chip.classList.toggle('danger', M.outside);
  if(z.state === 'wait') chip.textContent = '🔵 বলয়: ' + bn(Math.max(0, Math.ceil(z.t))) + 's';
  else if(z.state === 'shrink') chip.textContent = '🔵 বলয় ছোট হচ্ছে!';
  else chip.textContent = '☠️ শেষ বলয় সংকুচিত হচ্ছে';
}

// ============================== LOOT VISUALS ==============================
function lootTick(dt){
  for(const s of M.loot){
    if(!s.alive) continue;
    if(s.air) continue; // বাক্সের ধোঁয়া-আলো airdropTick নিজেই চালায়
    s.item.rotation.y += dt * 1.4;
    s.item.position.y = Math.sin(ctx.G.time * 1.8 + s.i) * 0.09;
    s.beam.material.opacity = 0.22 + Math.sin(ctx.G.time * 2.4 + s.i) * 0.07;
    const sc = 1 + Math.sin(ctx.G.time * 2.2 + s.i) * 0.06;
    s.ring.scale.set(sc, sc, 1);
  }
}

// ============================== AIRDROP (লুটের বিমান) ==============================
let puffGeo = null, airId = 0;

function buildCargoPlane(){
  const grp = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x77805E, roughness: 0.6, metalness: 0.12 });
  const accMat  = new THREE.MeshStandardMaterial({ color: 0x3A4030, roughness: 0.8 });
  const fus = new THREE.Mesh(new THREE.CapsuleGeometry(1.0, 5.6, 6, 12), bodyMat);
  fus.rotation.z = Math.PI / 2; grp.add(fus);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 10.5), bodyMat);
  wing.position.y = 0.35; grp.add(wing);
  const tailW = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 4.2), bodyMat);
  tailW.position.set(-3.3, 0.28, 0); grp.add(tailW);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.5, 1.3), accMat);
  fin.position.set(-3.4, 0.95, 0); grp.add(fin);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xFF5A45 }));
  light.position.set(1.9, -0.75, 0); grp.add(light);
  ctx.scene().add(grp);
  return grp;
}

function spawnAirdrop(){
  const z = M.zone;
  let x = z.cx, zz = z.cz;
  for(let tries = 0; tries < 60; tries++){
    const ang = Math.random() * Math.PI * 2, r = Math.random() * z.r * 0.62;
    x = z.cx + Math.cos(ang) * r; zz = z.cz + Math.sin(ang) * r;
    if(Math.hypot(x, zz) > MAP_LIMIT - 10) continue;
    if(ctx.isWater(x, zz, 0.9)) continue;
    if(M.structs.some(s2 => Math.hypot(s2.x - x, s2.z - zz) < 6)) continue;
    break;
  }
  const az = Math.random() * Math.PI * 2;
  const ux = Math.cos(az), uz = Math.sin(az);
  const from = v3(x - ux * 175, 58, zz - uz * 175);
  const to   = v3(x + ux * 175, 58, zz + uz * 175);
  const plane = buildCargoPlane();
  plane.position.copy(from);
  plane.rotation.y = Math.atan2(-uz, ux);
  M.airs.push({ id: ++airId, state:'fly', plane, from, to, dur: 14, t: 0,
    x, z: zz, grp:null, chute:null, crate:null, smoke:[], beam:null, ring:null,
    spot:null, botT:0, done:false });
  M.airLeft--;
  M.airT = M.airLeft > 0 ? rand(AIR_NEXT[0], AIR_NEXT[1]) : 0;
  addFeed('🛩️ লুটের বিমান এল!');
  ctx.subtitle('🎙️ "লুটের বিমান আসছে — মিনিম্যাপের লাল চিহ্ন দেখে দৌড়াও!"', 3400);
  ctx.AU.sfx('gate');
}

function dropCrate(a){
  a.state = 'fall';
  const grp = new THREE.Group();
  grp.position.set(a.x, 60, a.z);
  const boxMat = new THREE.MeshStandardMaterial({ color: 0xA8452F, roughness: 0.7 });
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x2C2F33, roughness: 0.8 });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.05, 1.45), boxMat);
  crate.castShadow = true; grp.add(crate);
  const strapA = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.12, 0.26), strapMat);
  grp.add(strapA);
  const strapB = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.12, 1.5), strapMat);
  grp.add(strapB);
  const chute = buildChute(0xF2604A, 1.05);
  chute.visible = true;
  grp.add(chute);
  ctx.scene().add(grp);
  a.grp = grp; a.chute = chute; a.crate = crate;
}

function landCrate(a){
  a.state = 'landed';
  a.chute.visible = false;
  a.grp.rotation.z = 0; a.grp.rotation.x = 0;
  const gy = groundY(a.x, a.z);
  a.y = gy;
  const col = 0xFF5A45;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 30, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 15; a.grp.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.4, 26),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5,
      side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12; a.grp.add(ring);
  if(!puffGeo) puffGeo = new THREE.SphereGeometry(0.55, 7, 6);
  for(let i = 0; i < 6; i++){
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(puffGeo, mat);
    a.smoke.push({ m, ph: i / 6 });
    a.grp.add(m);
  }
  a.beam = beam; a.ring = ring;
  const spot = { kind:'airdrop', i: 900 + a.id, x: a.x, z: a.z, y: gy, grp: a.grp,
    beam, ring, item: a.crate, got: 0, alive: true, air: a };
  a.spot = spot;
  M.loot.push(spot);
  addFeed('🪂 লুটের বাক্স পড়েছে — লাল ধোঁয়া দেখে খুঁজে নাও!');
  ctx.toast('🪂 লুটের বাক্স! মিনিম্যাপে লাল চিহ্ন — ৪টি কঠিন প্রশ্নের পুরস্কার সেরা লুট', 3400);
  // কাছের বটেরা বাক্সের দিকে ছুটে আসে — দখলের লড়াই শুরু
  for(const b of M.bots){
    if(!b.alive || (b.state !== 'active' && b.state !== 'landed')) continue;
    const d = Math.hypot(b.grp.position.x - a.x, b.grp.position.z - a.z);
    if(d < 72 && Math.random() < 0.7){
      b.roamTo = v3(a.x + rand(-5.5, 5.5), 0, a.z + rand(-5.5, 5.5));
      b.roamT = rand(8, 13);
    }
  }
}

function botTakeCrate(a, b){
  if(a.spot && a.spot.alive) a.spot.alive = false;
  ctx.scene().remove(a.grp);
  a.done = true;
  b.hp = Math.min(120, b.hp + 45);
  b.provokedT = 3;
  const at = b.grp.position.clone(); at.y += 1.9;
  ctx.floater(at, '+45', '#FFC46B');
  addFeed('😈 ' + b.name + ' লুটের বাক্স নিয়ে নিল!');
  ctx.toast('😈 ' + b.name + ' বাক্সটা লুটে নিল — পরের বিমানে আগে পৌঁছো!', 3000);
}

function airdropTick(dt){
  if(M.airLeft > 0 && M.airT > 0){
    M.airT -= dt;
    if(M.airT <= 0) spawnAirdrop();
  }
  for(const a of M.airs){
    if(a.done) continue;
    if(a.plane){
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.plane.position.set(a.from.x + (a.to.x - a.from.x) * k,
        58 + Math.sin(k * Math.PI) * 2,
        a.from.z + (a.to.z - a.from.z) * k);
      a.plane.rotation.z = Math.sin(a.t * 0.9) * 0.08;
      if(a.state === 'fly' && k >= 0.5) dropCrate(a);
      if(k >= 1){ ctx.scene().remove(a.plane); a.plane = null; }
    }
    if(a.grp && a.state === 'fall'){
      a.grp.position.y -= AIR_FALL_SPEED * dt;
      a.grp.rotation.z = Math.sin(ctx.G.time * 1.6) * 0.07;
      a.grp.rotation.x = Math.cos(ctx.G.time * 1.3) * 0.05;
      const gy = groundY(a.x, a.z);
      if(a.grp.position.y <= gy + 0.06){ a.grp.position.y = gy; landCrate(a); }
    } else if(a.state === 'landed'){
      a.beam.material.opacity = 0.2 + Math.sin(ctx.G.time * 2.4) * 0.07;
      const sc = 1 + Math.sin(ctx.G.time * 2.2) * 0.06;
      a.ring.scale.set(sc, sc, 1);
      for(const p of a.smoke){
        const t = (ctx.G.time * 1.25 + p.ph * 9) % 9;
        p.m.position.set(Math.sin(ctx.G.time * 0.7 + p.ph * 7) * t * 0.12, 0.5 + t,
          Math.cos(ctx.G.time * 0.6 + p.ph * 5) * t * 0.12);
        const w = 1 + t * 0.22;
        p.m.scale.set(w, w * 1.15, w);
        p.m.material.opacity = 0.45 * Math.max(0.05, 1 - t / 9);
      }
      // বট পাশে দাঁড়িয়ে থাকলে বাক্স হাতছাড়া — লড়াই না করে লুট নেওয়া যায় না
      let near = null;
      for(const b of M.bots){
        if(!b.alive || (b.state !== 'active' && b.state !== 'landed')) continue;
        const d = Math.hypot(b.grp.position.x - a.x, b.grp.position.z - a.z);
        if(d < AIR_BOT_RANGE){ near = b; break; }
      }
      if(near){
        near.roamTo = v3(a.x + rand(-2, 2), 0, a.z + rand(-2, 2));
        near.roamT = Math.max(near.roamT, 3);
        a.botT += dt;
        if(a.botT >= AIR_BOT_TAKE) botTakeCrate(a, near);
      } else a.botT = Math.max(0, a.botT - dt * 0.8);
    }
  }
}

// ============================== MAIN TICK ==============================
function planeTick(dt){
  M.t += dt;
  const k = Math.min(1, M.t / PLANE_DUR);
  if(M.plane){
    M.plane.position.set(
      PLANE_FROM.x + (PLANE_TO.x - PLANE_FROM.x) * k,
      PLANE_FROM.y + Math.sin(k * Math.PI) * 2,
      PLANE_FROM.z + (PLANE_TO.z - PLANE_FROM.z) * k);
    M.plane.rotation.z = Math.sin(M.t * 0.9) * 0.08;
  }
  if(M.phase === 'plane' && k >= 1) jumpNow();
  if(k >= 1 && M.plane){ ctx.scene().remove(M.plane); M.plane = null; }
}

export function tick(dt){
  if(!M) return;
  if(M.phase === 'over'){ shotsTick(dt); return; }
  if(M.phase === 'plane' || M.phase === 'drop'){
    planeTick(dt);
    botsDropTick(dt);
    minimapTick(dt);
    return;
  }
  if(M.phase !== 'live' || dt <= 0) return;
  botsDropTick(dt); // দেরিতে নামা বটেরাও নামা শেষ করছে
  zoneTick(dt); if(!M || M.phase !== 'live') return;
  botsTick(dt); if(!M || M.phase !== 'live') return;
  airdropTick(dt);
  lodTick(dt);
  combatTick(dt);
  shotsTick(dt);
  wallTick(dt);
  lootTick(dt);
  promptTick();
  minimapTick(dt);
  lowHpTick(dt);
  compassTick(dt);
  scopeTick(dt);
}

// কম HP — লাল কিনারা স্পন্দন + হৃদস্পন্দনের শব্দ (ফ্রি-ফায়ার-ধাঁচ)
function lowHpTick(dt){
  const low = M.hp > 0 && M.hp / M.hpMax <= 0.35;
  if(low !== M.lowHpOn){
    M.lowHpOn = low;
    if(ctx.el.lowHp) ctx.el.lowHp.classList.toggle('show', low);
    M.lowBeepT = low ? 0.35 : 0;
  }
  if(low){
    M.lowBeepT -= dt;
    if(M.lowBeepT <= 0){ M.lowBeepT = 1.05; ctx.AU.sfx('heart'); }
  }
}

/* ---------- কম্পাস (ফ্রি-ফায়ার-ধাঁচের দিক-পট্টি) ---------- */
const COMP_CELL = 45, COMP_COPY = 360;
let compT = 0;
function compassTick(dt){
  compT -= dt;
  if(compT > 0) return;
  compT = 0.05;
  const mv = ctx.el.mhCompassMove;
  if(!mv) return;
  let f = -((ctx.G.camYaw + Math.PI) * 180 / Math.PI) % 360;
  if(f < 0) f += 360;
  mv.style.transform = 'translate3d(' + (-(COMP_COPY + f + COMP_CELL/2)).toFixed(1) + 'px,0,0)';
  if(ctx.el.mhCompassNum) ctx.el.mhCompassNum.textContent = bn(Math.round(f)) + '°';
}

/* ---------- স্কোপ (দূরের নিশানা) ---------- */
export function toggleScope(){
  if(!M || M.phase !== 'live') return;
  if(M.inv.gun < 1){ ctx.toast('🔭 স্কোপ বসাতে আগে একটা বন্দুক তোলো', 2400); return; }
  M.scopeOn = !M.scopeOn;
  ctx.AU.sfx(M.scopeOn ? 'scopeIn' : 'scopeOut');
  if(ctx.el.mhZoom) ctx.el.mhZoom.classList.toggle('active', M.scopeOn);
  if(M.scopeOn && !M.scopeTip){
    M.scopeTip = true;
    ctx.toast('🔭 স্কোপ — দূরের শত্রুকে দেখে গুলি করো; নিশানা লাল হলে ঠিক পেয়েছ', 3200);
  }
}
export function zoomK(){ return M ? M.scopeK : 0; }

const SCOPE_CONE = 0.16;
const SCOPE_MAXD = 130;
function scopeTick(dt){
  const target = M.scopeOn ? 1 : 0;
  const diff = target - M.scopeK;
  if(Math.abs(diff) > 0.002) M.scopeK += diff * Math.min(1, dt * 6.5);
  else M.scopeK = target;
  const el = ctx.el;
  if(el.mhScope){
    const vis = M.scopeK > 0.02;
    if(vis !== M.scopeVis){ M.scopeVis = vis; el.mhScope.classList.toggle('show', vis); }
    if(vis) el.mhScope.style.opacity = M.scopeK < 0.995 ? M.scopeK.toFixed(3) : '1';
  }
  if(M.scopeK > 0.5){
    M.scopeT -= dt;
    if(M.scopeT <= 0){ M.scopeT = 0.12; scopeAimTick(el); }
  } else if(M.scopeHot){
    M.scopeHot = false;
    if(el.mhScope) el.mhScope.classList.remove('hot');
    if(el.scopeDist) el.scopeDist.textContent = '';
  }
}
function scopeAimTick(el){
  const P = ctx.P.grp.position;
  const fx = -Math.sin(ctx.G.camYaw), fz = -Math.cos(ctx.G.camYaw);
  let hot = false, bestD = Infinity;
  for(const b of M.bots){
    if(!b.alive) continue;
    const dx = b.grp.position.x - P.x, dz = b.grp.position.z - P.z;
    const dist = Math.hypot(dx, dz);
    if(dist < 0.5 || dist > SCOPE_MAXD) continue;
    const dot = (dx * fx + dz * fz) / dist;
    if(dot < Math.cos(SCOPE_CONE)) continue;
    if(dist < bestD){ bestD = dist; hot = true; }
  }
  if(hot !== M.scopeHot){
    M.scopeHot = hot;
    if(el.mhScope) el.mhScope.classList.toggle('hot', hot);
  }
  if(el.scopeDist){
    const txt = hot ? bn(Math.round(bestD)) + ' মি.' : '';
    if(el.scopeDist.textContent !== txt) el.scopeDist.textContent = txt;
  }
}

export function tickPlayer(dt){
  if(!M) return;
  const g = ctx.G, P = ctx.P;

  if(M.phase === 'drop'){
    let mx = 0, mz = 0;
    if(g.keys['a'] || g.keys['arrowleft'])  mx -= 1;
    if(g.keys['d'] || g.keys['arrowright']) mx += 1;
    if(g.keys['w'] || g.keys['arrowup'])    mz -= 1;
    if(g.keys['s'] || g.keys['arrowdown'])  mz += 1;
    mx += g.joyVec.x; mz += g.joyVec.y;
    const sin = Math.sin(g.camYaw), cos = Math.cos(g.camYaw);
    P.grp.position.x += (mx*cos - mz*sin) * 10 * dt;
    P.grp.position.z += (mx*sin + mz*cos) * 10 * dt;
    P.grp.position.y += M.vy * dt;
    const d = Math.hypot(P.grp.position.x, P.grp.position.z);
    if(d > DROP_LIMIT){ P.grp.position.x *= DROP_LIMIT/d; P.grp.position.z *= DROP_LIMIT/d; }
    if(M.chute){
      M.chute.position.copy(P.grp.position);
      M.chute.position.y += 1.7;
      M.chute.rotation.z = Math.sin(g.time * 1.8) * 0.07;
      M.chute.rotation.x = Math.cos(g.time * 1.4) * 0.05;
    }
    const gy = groundY(P.grp.position.x, P.grp.position.z);
    if(P.grp.position.y <= gy + 0.2){
      P.grp.position.y = gy;
      land();
    }
    return;
  }

  if(M.phase !== 'live') return;
  M.crouchK += ((M.crouch ? 1 : 0) - M.crouchK) * Math.min(1, dt * 9);

  let mx = 0, mz = 0;
  if(g.keys['a'] || g.keys['arrowleft'])  mx -= 1;
  if(g.keys['d'] || g.keys['arrowright']) mx += 1;
  if(g.keys['w'] || g.keys['arrowup'])    mz -= 1;
  if(g.keys['s'] || g.keys['arrowdown'])  mz += 1;
  mx += g.joyVec.x; mz += g.joyVec.y;
  const len = Math.hypot(mx, mz);
  const moving = len > 0.12;
  if(moving){
    mx /= Math.max(1, len); mz /= Math.max(1, len);
    const sin = Math.sin(g.camYaw), cos = Math.cos(g.camYaw);
    const wx = mx*cos - mz*sin, wz = mx*sin + mz*cos;
    P.grp.position.x += wx * P.speed * (1 - 0.48 * M.crouchK) * (1 - 0.45 * M.scopeK) * dt;
    P.grp.position.z += wz * P.speed * (1 - 0.48 * M.crouchK) * (1 - 0.45 * M.scopeK) * dt;
    P.facing = Math.atan2(wx, wz);
    P.grp.rotation.y = P.facing + Math.PI;
    if(Math.floor(P.walkPhase) !== Math.floor(P.walkPhase + dt*9)) ctx.AU.sfx('step');
  }
  const d = Math.hypot(P.grp.position.x, P.grp.position.z);
  if(d > MAP_LIMIT){ P.grp.position.x *= MAP_LIMIT/d; P.grp.position.z *= MAP_LIMIT/d; }
  resolvePos(P.grp.position, 0.55);
  P.grp.position.y = groundY(P.grp.position.x, P.grp.position.z);
  ctx.animatePlayer(dt, moving);
  if(M.crouchK > 0.01){
    ctx.P.body.position.y -= 0.34 * M.crouchK;
    ctx.P.legL.rotation.x += 0.85 * M.crouchK;
    ctx.P.legR.rotation.x += 0.85 * M.crouchK;
  }

  M.concealT -= dt;
  if(M.concealT <= 0){
    M.concealT = 0.4;
    M.concealed = (ctx.CONCEAL_SPOTS || []).some(s =>
      Math.hypot(s.x - P.grp.position.x, s.z - P.grp.position.z) < 3.2);
  }
}

// plane camera only; drop/live fall through to the normal third-person cam
export function camUpdate(dt){
  if(!M || ctx.G.mode !== 'match_plane' || !M.plane) return false;
  const cam = ctx.camera();
  const fwd = PLANE_TO.clone().sub(PLANE_FROM).normalize();
  const behind = M.plane.position.clone().addScaledVector(fwd, -26);
  behind.y += 10;
  cam.position.lerp(behind, Math.min(1, dt * 3));
  cam.lookAt(M.plane.position.x + fwd.x * 30, 6, M.plane.position.z + fwd.z * 30);
  return true;
}

// ============================== INPUT HOOKS ==============================
export function answering(){
  return !!(M && M.panel && M.panel.q && !M.panel.resolving && ctx.G.mode === 'match_live');
}
export function answerKey(i){
  const btn = ctx.el.qOpts.children[i];
  if(btn) answerMatch(i, btn);
}
export function moveEnabled(){
  return !!(M && (M.phase === 'drop' || M.phase === 'live'));
}

export function toggleCrouch(){
  if(!M || M.phase !== 'live') return;
  M.crouch = !M.crouch;
  ctx.AU.sfx('click');
  if(ctx.el.mhCrouch) ctx.el.mhCrouch.classList.toggle('active', M.crouch);
  if(M.crouch && !M.crouchTip){
    M.crouchTip = true;
    ctx.toast('🧎 নিচু হয়েছ — দূর থেকে বট টের পাবে না, গুলিও প্রায়ই মাথার উপর দিয়ে যাবে', 3200);
  }
}

// ============================== MATCH END ==============================
async function endMatch(won){
  if(!M || M.phase === 'over') return;
  M.phase = 'over';
  M.firing = false;
  M.scopeOn = false; M.scopeK = 0; M.scopeHot = false;
  if(ctx.el.mhFire) ctx.el.mhFire.classList.remove('down');
  if(ctx.el.mhZoom) ctx.el.mhZoom.classList.remove('active');
  if(ctx.el.mhScope){ ctx.el.mhScope.classList.remove('show'); ctx.el.mhScope.classList.remove('hot'); }
  if(ctx.el.scopeDist) ctx.el.scopeDist.textContent = '';
  const g = ctx.G;
  closePanel();
  ctx.hide(ctx.el.mhPrompt);
  if(ctx.el.mhMap) ctx.hide(ctx.el.mhMap);
  if(ctx.el.lowHp) ctx.el.lowHp.classList.remove('show');
  if(ctx.el.hitDir) ctx.el.hitDir.classList.remove('show');
  M.lowHpOn = false;

  const aliveBots = M.bots.filter(b => b.alive).length;
  const rank = won ? 1 : aliveBots + 1;
  const xpGain = won ? 120 + M.kills * 15 : 30 + M.kills * 10;
  const coinGain = won ? 60 + M.kills * 8 : 20 + M.kills * 5;
  const ck = ctx.currentSubject(), cur = ctx.currencyOf(ck);

  g.progress.gameXP += xpGain;
  g.progress.coins += coinGain;
  ctx.addCurrency(ck, coinGain);
  const ms = g.progress.matchStats || { matches:0, wins:0, kills:0, bestRank:99 };
  ms.matches++; if(won) ms.wins++;
  ms.kills += M.kills;
  ms.bestRank = Math.min(ms.bestRank, rank);
  g.progress.matchStats = ms;
  await ctx.saveProgress();

  if(M.sessionId){
    M.sessionEnded = true;
    ctx.api('endBattleSession', { sessionId: M.sessionId, outcome: won ? 'won' : 'lost' });
  }

  const acc = M.asked ? Math.round(M.correct / M.asked * 100) : 0;
  if(won){
    ctx.AU.sfx('victory');
    ctx.el.vTitle.textContent = '🏆 #' + bn(rank) + '/' + bn(MATCH_TOTAL) + ' — শেষ পর্যন্ত টিকে আছ!';
    ctx.el.vSub.textContent = 'বড় ম্যাচ জয়! ' + bn(M.kills) + ' জনকে হারিয়ে জঙ্গলের রাজা তুমি।';
    ctx.el.vXp.textContent = '+' + bn(xpGain);
    ctx.el.vCoins.textContent = '+' + bn(coinGain) + ' ' + cur.icon;
    ctx.el.vAcc.textContent = bn(acc) + '%';
    ctx.el.vTotalXp.textContent = bn(g.progress.gameXP) + ' XP';
    ctx.el.vLevel.textContent = 'লেভেল ' + bn(ctx.levelFromXp(g.progress.gameXP));
    ctx.show(ctx.el.victory);
  } else {
    ctx.AU.sfx('defeat');
    if(ctx.el.dStatLabel) ctx.el.dStatLabel.textContent = 'ম্যাচ সারসংক্ষেপ';
    ctx.el.dSub.textContent = 'র‍্যাঙ্ক #' + bn(rank) + '/' + bn(MATCH_TOTAL) + ' — লড়াই দারুণ ছিল, পরেরবার আরও ভালো হবে! আবার লড়ো।';
    ctx.el.dStat.textContent = 'পরাজিত ' + bn(M.kills) + ' · সঠিক ' + bn(M.correct) + '/' + bn(M.asked) +
      ' (' + bn(acc) + '%) · শেষে টিকে ছিল ' + bn(aliveBots) + ' জন';
    ctx.show(ctx.el.defeat);
  }
  g.mode = 'cinematic';
}
