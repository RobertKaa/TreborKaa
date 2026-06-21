import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, isAbsolute, join, normalize, relative, resolve } from 'node:path';

const root = resolve('dist/Vexiio/browser');
const portArgumentIndex = process.argv.indexOf('--port');
const requestedPort =
  portArgumentIndex >= 0 ? Number.parseInt(process.argv[portArgumentIndex + 1] ?? '', 10) : 4200;
const port = Number.isFinite(requestedPort) ? requestedPort : 4200;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

if (!existsSync(join(root, 'ngsw-worker.js'))) {
  throw new Error('Build PWA introuvable. Lance "npm run build" avant ce serveur.');
}

createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const requestPath = decodeURIComponent(requestUrl.pathname);
  const normalizedPath = normalize(requestPath).replace(/^([/\\])+/, '');
  const candidatePath = resolve(root, normalizedPath);
  const relativePath = relative(root, candidatePath);
  const isSafePath =
    relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
  const isFile = isSafePath && existsSync(candidatePath) && statSync(candidatePath).isFile();
  const filePath = isFile ? candidatePath : join(root, 'index.html');
  const fileName = filePath.slice(root.length).replaceAll('\\', '/');

  response.statusCode = 200;
  response.setHeader('Content-Type', MIME_TYPES[extname(filePath)] ?? 'application/octet-stream');

  if (fileName === '/ngsw-worker.js') {
    response.setHeader('Service-Worker-Allowed', '/');
  }

  if (fileName === '/index.html' || fileName === '/ngsw.json' || fileName === '/ngsw-worker.js') {
    response.setHeader('Cache-Control', 'no-cache');
  } else {
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }

  createReadStream(filePath).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Vexiio PWA disponible sur http://localhost:${port}`);
});
