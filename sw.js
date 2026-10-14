// Service Worker — স্মৃতির জঙ্গল (standalone game PWA, scope: ./game/)
// v31: টাটকা-ডেলিভারি হার্ডেনিং — নতুন SW ইনস্টলের সময় সব ফাইল HTTP-ক্যাশ এড়িয়ে
// (cache:'reload') নামে, আর রানটাইম রিফ্রেশ revalidate করে। আগে GitHub Pages-এর
// ১০-মিনিট HTTP-ক্যাশ cache.add/fetch-এর ভেতর দিয়ে পুরোনো game.js/match.js কে
// SW-ক্যাশে ঢুকিয়ে দিত — তাই ফিক্স-ডিপ্লয়ের পরও ফোনে পুরোনো কোড চলত।
const CACHE_NAME = 'smritir-jungle-v31';
const PRECACHE = [
  './',
  './index.html',
  './game.js',
  './match.js',
  './net.js',
  './net-config.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './vendor/GLTFLoader.js',
  './vendor/addons/postprocessing/EffectComposer.js',
  './vendor/addons/postprocessing/MaskPass.js',
  './vendor/addons/postprocessing/OutputPass.js',
  './vendor/addons/postprocessing/Pass.js',
  './vendor/addons/postprocessing/RenderPass.js',
  './vendor/addons/postprocessing/ShaderPass.js',
  './vendor/addons/postprocessing/UnrealBloomPass.js',
  './vendor/addons/shaders/CopyShader.js',
  './vendor/addons/shaders/LuminosityHighPassShader.js',
  './vendor/addons/shaders/OutputShader.js',
  './utils/BufferGeometryUtils.js',
];
const MODEL_FILES = ['tree_palmTall','tree_palmDetailedTall','tree_palmBend','tree_default','tree_tall','tree_fat',
  'plant_bushLarge','plant_bush','plant_flatTall','grass','grass_large','grass_leafsLarge',
  'rock_largeA','rock_largeC','rock_tallA','rock_smallA',
  'mushroom_redTall','mushroom_redGroup','log_large','log','flower_redA','flower_yellowA','lily_large','campfire_stones'];
// দোকান/লুটের আসল বন্দুকের মডেল (Kenney Blaster Kit, CC0)
const GUN_FILES = ['guns/blaster-l.glb','guns/blaster-p.glb','guns/blaster-f.glb','guns/Textures/colormap.png'];
// আসল গিয়ার মডেল (poly.pizza, CC0): পিঠের ব্যাকপ্যাক ও ভারী বর্ম
const GEAR_FILES = ['gear/backpack.glb','gear/armor.glb'];

// প্রিক্যাশ-ডাউনলোড HTTP-ক্যাশ বাইপাস করে সার্ভার থেকেই টাটকা নামায়
const fresh = url => new Request(url, { cache: 'reload' });

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(PRECACHE.map(url => cache.add(fresh(url)).catch(err => console.warn('precache skip:', url, err))))
    ).then(() => {
      // three.js + jungle models are big: fetch them in the background without blocking install
      caches.open(CACHE_NAME).then(c => {
        c.add(fresh('./vendor/three.module.js')).catch(err => console.warn('three precache skip', err));
      c.add(fresh('./vendor/supabase.js')).catch(err => console.warn('supabase precache skip', err));
        MODEL_FILES.forEach(n => c.add(fresh('./assets/' + n + '.glb')).catch(() => {}));
        GUN_FILES.forEach(n => c.add(fresh('./assets/' + n)).catch(() => {}));
        GEAR_FILES.forEach(n => c.add(fresh('./assets/' + n)).catch(() => {}));
      });
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Backend (Apps Script) & non-GET: never touch
  if (req.method !== 'GET' || url.hostname.includes('script.google.com') || url.searchParams.has('action')) return;

  // Pages: network first (new deploy shows immediately), cache fallback offline
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' }).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', copy));
        }
        return res;
      }).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Everything else (three.js, KaTeX CDN...): cache first, refresh in background
  event.respondWith(
    caches.match(req).then(cached => {
      const refresh = fetch(req, { cache: 'no-cache' }).then(res => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || refresh;
    })
  );
});
