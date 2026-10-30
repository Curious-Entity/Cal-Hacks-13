// Dependency-free local server. The hosted site uses the same handleAPI function.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAPI } from './backend/api.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicRoot = resolve(root, 'public');
const port = Number(process.env.PORT || 8000);
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon' };
async function environment() {
  const env = { ...process.env };
  try {
    const content = await readFile(resolve(root, '.env'), 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || line.trim().startsWith('#') || env[match[1]]) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1,-1);
      else value = value.replace(/\s+#.*$/, '');
      env[match[1]] = value;
    }
  } catch (error) { if (error.code !== 'ENOENT') console.error('Could not read the local .env file.'); }
  return env;
}

const server = createServer(async (req, res) => {
  try {
    const base = `http://127.0.0.1:${port}`;
    const url = new URL(req.url, base);
    // Use the incoming origin for localhost/127.0.0.1 equivalence, but never for upstream requests.
    const requestURL = new URL(req.url, `http://${req.headers.host || `127.0.0.1:${port}`}`);
    if (url.pathname.startsWith('/api/')) {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 3000000) { res.writeHead(413); res.end('Request too large'); return; } chunks.push(chunk); }
      const body = Buffer.concat(chunks);
      const request = new Request(requestURL, { method: req.method, headers: req.headers, ...(req.method === 'GET' || req.method === 'HEAD' ? {} : { body }) });
      const response = await handleAPI(request, await environment());
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const name = decodeURIComponent(url.pathname === '/' ? '/adventure.html' : url.pathname);
    const path = resolve(publicRoot, '.' + name);
    if (!path.startsWith(publicRoot + sep)) { res.writeHead(404); res.end('Not found'); return; }
    const info = await stat(path);
    if (!info.isFile()) throw new Error('Not a file');
    const content = await readFile(path);
    res.writeHead(200, { 'content-type':mime[extname(path)] || 'application/octet-stream', 'cache-control':'no-cache', 'x-content-type-options':'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { if (!res.headersSent) res.writeHead(404); res.end('Not found'); }
});
server.requestTimeout = 150000;
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Stop the old server or choose a different PORT.` : 'The local server could not start.'); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Unwritten is running at http://localhost:${port}\nKeep this terminal open. Press Ctrl+C to stop.\nEdit last-light/.env to connect Cloudflare Workers AI or Gemini; changes are picked up automatically.`));
