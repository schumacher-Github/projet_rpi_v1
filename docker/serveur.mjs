// Serveur de production de l'application RPI-PAD.
//
// La compilation produit dans dist/server/server.js un gestionnaire de rendu
// côté serveur qui expose une méthode fetch() au format Web, mais qui n'ouvre
// aucun port : c'est le rôle de ce fichier. Il sert d'abord les fichiers
// compilés de dist/client, puis confie tout le reste au rendu côté serveur.
//
// Démarrage : node serveur.mjs   (PORT et HOST par variables d'environnement)
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, normalize, extname, sep } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import entree from './dist/server/server.js';

const RACINE_CLIENT = fileURLToPath(new URL('./dist/client/', import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const HOTE = process.env.HOST ?? '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// Résout un chemin d'URL vers un fichier de dist/client, en refusant toute
// tentative de remontée hors de ce dossier.
async function fichierStatique(cheminUrl) {
  let relatif;
  try {
    relatif = decodeURIComponent(cheminUrl);
  } catch {
    return null;
  }
  relatif = normalize(relatif).replace(/^[/\\]+/, '');
  if (!relatif || relatif.endsWith(sep) || relatif.endsWith('/')) return null;

  const complet = join(RACINE_CLIENT, relatif);
  if (!complet.startsWith(RACINE_CLIENT)) return null;

  try {
    const infos = await stat(complet);
    return infos.isFile() ? { complet, taille: infos.size } : null;
  } catch {
    return null;
  }
}

// Convertit une requête Node en requête Web, corps compris (les fonctions
// serveur de TanStack Start passent par des requêtes POST).
function versRequeteWeb(req) {
  const hote = req.headers.host ?? `localhost:${PORT}`;
  const entetes = new Headers();
  for (const [cle, valeur] of Object.entries(req.headers)) {
    if (valeur === undefined) continue;
    if (Array.isArray(valeur)) for (const v of valeur) entetes.append(cle, v);
    else entetes.set(cle, valeur);
  }
  const avecCorps = req.method !== 'GET' && req.method !== 'HEAD';
  return new Request(`http://${hote}${req.url}`, {
    method: req.method,
    headers: entetes,
    body: avecCorps ? Readable.toWeb(req) : undefined,
    duplex: avecCorps ? 'half' : undefined,
  });
}

const serveur = createServer(async (req, rep) => {
  try {
    const cheminUrl = (req.url ?? '/').split('?')[0];

    const statique = await fichierStatique(cheminUrl);
    if (statique) {
      // Les fichiers de /assets/ portent une empreinte dans leur nom : ils
      // peuvent être mis en cache indéfiniment.
      const empreinte = cheminUrl.startsWith('/assets/');
      rep.writeHead(200, {
        'content-type': TYPES[extname(statique.complet).toLowerCase()] ?? 'application/octet-stream',
        'content-length': statique.taille,
        'cache-control': empreinte
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=3600',
      });
      if (req.method === 'HEAD') return rep.end();
      return createReadStream(statique.complet).pipe(rep);
    }

    const reponse = await entree.fetch(versRequeteWeb(req), process.env, {});

    const entetes = {};
    for (const [cle, valeur] of reponse.headers) {
      if (cle.toLowerCase() === 'set-cookie') continue;
      entetes[cle] = valeur;
    }
    const cookies =
      typeof reponse.headers.getSetCookie === 'function' ? reponse.headers.getSetCookie() : [];
    if (cookies.length > 0) entetes['set-cookie'] = cookies;

    rep.writeHead(reponse.status, entetes);
    if (!reponse.body || req.method === 'HEAD') return rep.end();
    Readable.fromWeb(reponse.body).pipe(rep);
  } catch (erreur) {
    console.error('[serveur] requête en échec :', erreur);
    if (!rep.headersSent) rep.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    rep.end('Erreur interne du serveur.');
  }
});

serveur.listen(PORT, HOTE, () => {
  console.log(`[serveur] RPI-PAD à l'écoute sur http://${HOTE}:${PORT}`);
});

// Arrêt propre à la demande de Docker.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`[serveur] ${signal} reçu, arrêt en cours…`);
    serveur.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
