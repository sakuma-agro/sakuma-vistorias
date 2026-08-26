/* SAKUMA Vistorias — service worker
   Guarda a casca do app para abrir sem internet. Nunca guarda chamada de API:
   tudo que vai para o Supabase passa direto pela rede.
   Ao publicar uma versão nova, mude o número em VERSAO. */
const VERSAO = "v5";
const CACHE = `sakuma-vistorias-${VERSAO}`;

const CASCA = [
  "./",
  "./index.html",
  "./config.js",
  "./vistorias.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./favicon.ico"
];

self.addEventListener("install", ev => {
  ev.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CASCA).catch(() => c.addAll(["./", "./index.html"])))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", ev => {
  ev.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", ev => {
  const req = ev.request;
  if (req.method !== "GET") return;                          // POST/PATCH do Supabase: rede
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // supabase, fontes: rede
  if (url.pathname.includes("/rest/") || url.pathname.includes("/auth/")) return;

  // config.js: rede primeiro, para uma chave trocada valer na hora
  if (url.pathname.endsWith("/config.js")) {
    ev.respondWith(
      fetch(req, { cache: "no-store" })
        .then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c)); return r; })
        .catch(() => caches.match(req))
    );
    return;
  }

  // navegação: rede primeiro, com a casca guardada como reserva
  if (req.mode === "navigate") {
    ev.respondWith(
      fetch(req)
        .then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put("./index.html", c)); return r; })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // demais arquivos: cache primeiro, atualizando por trás
  ev.respondWith(
    caches.match(req).then(guardado => {
      const rede = fetch(req).then(r => {
        if (r && r.status === 200 && r.type === "basic") {
          const c = r.clone();
          caches.open(CACHE).then(k => k.put(req, c));
        }
        return r;
      }).catch(() => guardado);
      return guardado || rede;
    })
  );
});

self.addEventListener("message", ev => {
  if (ev.data === "atualizar") self.skipWaiting();
});
