/* Recomp Painel — service worker
 *
 * Regra de ouro deste arquivo: o app publicado no GitHub sempre vence o cache.
 * O cache existe só para o app abrir sem internet (academia com sinal ruim),
 * nunca para servir uma versão velha quando a rede está disponível.
 *
 * >>> AO PUBLICAR UMA NOVA VERSÃO, ATUALIZE A LINHA ABAIXO. <<<
 * Sem isso o navegador não descarta o pacote anterior.
 */
const VERSAO = 'v23';

const CACHE = 'recomp-' + VERSAO;

/* Arquivos guardados na instalação, para o app abrir offline. */
const CASCA = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      // addAll falha inteiro se um item falhar; item a item é mais tolerante.
      .then((cache) => Promise.allSettled(CASCA.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((n) => n.startsWith('recomp-') && n !== CACHE)
             .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;

  /* Só GET. POST/PATCH nunca passam por aqui. */
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* Supabase e qualquer outro domínio seguem direto para a rede, sem
     interceptação. O service worker não toca em sincronização de dados. */
  if (url.origin !== self.location.origin) return;

  const ehPagina = req.mode === 'navigate' || url.pathname.endsWith('.html');

  if (ehPagina) {
    /* Rede primeiro: o aluno sempre recebe a versão publicada.
       Cache só entra em cena quando a rede falha de verdade. */
    evento.respondWith(
      fetch(req)
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copia));
          return resposta;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  /* Ícones e manifest: cache primeiro, com atualização silenciosa em segundo
     plano. São arquivos estáveis; buscar a cada abertura seria desperdício. */
  evento.respondWith(
    caches.match(req).then((emCache) => {
      const daRede = fetch(req)
        .then((resposta) => {
          if (resposta && resposta.status === 200) {
            const copia = resposta.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copia));
          }
          return resposta;
        })
        .catch(() => emCache);
      return emCache || daRede;
    })
  );
});
