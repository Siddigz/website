// Serves the built site for browser tests and speed measurements, from the
// folder the Vercel adapter prepares for the host (.vercel/output/static).
// Mirrors the host: redirects listed in .vercel/output/config.json are
// followed, clean URLs resolve to index.html, unknown paths return 404.html
// with status 404, and text is sent compressed.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const output = resolve('.vercel/output');
const root = join(output, 'static');
const port = Number(process.argv[2] ?? 4321);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf',
};

// The host's redirect rules: a pattern, a status from 300 to 399 and a Location.
const redirects = JSON.parse(readFileSync(join(output, 'config.json'), 'utf8'))
  .routes.filter((route) => route.src && route.status >= 300 && route.status < 400 && route.headers?.Location)
  .map((route) => ({ pattern: new RegExp(route.src), status: route.status, location: route.headers.Location }));

async function resolveFile(pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const candidates = [join(root, safe), join(root, safe, 'index.html'), join(root, `${safe}.html`)];
  for (const file of candidates) {
    if (!file.startsWith(root)) continue;
    const info = await stat(file).catch(() => null);
    if (info?.isFile()) return file;
  }
  return null;
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  const redirect = redirects.find(({ pattern }) => pattern.test(pathname));
  if (redirect) {
    response.writeHead(redirect.status, { location: redirect.location });
    response.end();
    return;
  }
  const file = await resolveFile(pathname);
  const target = file ?? join(root, '404.html');
  const body = await readFile(target).catch(() => Buffer.from('Not found'));
  const type = types[extname(target)] ?? 'application/octet-stream';
  // Hosts compress text; without it, measured page weight is several times too high.
  const compress = /^(text\/|application\/(json|xml)|image\/svg)/.test(type) && /\bgzip\b/.test(request.headers['accept-encoding'] ?? '');
  // Hosts answer requests for part of a file, which Safari needs before it will play audio.
  const range = !compress && file ? /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? '') : null;
  if (range && (range[1] || range[2])) {
    const end = range[1] ? Math.min(Number(range[2] || Infinity), body.length - 1) : body.length - 1;
    const start = range[1] ? Number(range[1]) : Math.max(0, body.length - Number(range[2]));
    if (start > end) {
      response.writeHead(416, { 'content-range': `bytes */${body.length}` });
      response.end();
      return;
    }
    response.writeHead(206, {
      'content-type': type,
      'accept-ranges': 'bytes',
      'content-range': `bytes ${start}-${end}/${body.length}`,
      'content-length': end - start + 1,
    });
    response.end(body.subarray(start, end + 1));
    return;
  }
  response.writeHead(file ? 200 : 404, {
    'content-type': type,
    ...(compress ? { 'content-encoding': 'gzip', vary: 'Accept-Encoding' } : { 'accept-ranges': 'bytes', 'content-length': body.length }),
  });
  response.end(compress ? gzipSync(body) : body);
}).listen(port, () => console.log(`Serving the built site at http://localhost:${port}`));
