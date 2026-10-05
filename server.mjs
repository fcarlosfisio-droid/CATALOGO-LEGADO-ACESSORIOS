import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import { PUBLIC_BASE_URL } from './site-config.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const publicPrefix = new URL(PUBLIC_BASE_URL).pathname.replace(/\/$/, '');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const publicPreview = pathname === publicPrefix || pathname.startsWith(publicPrefix + '/');
    const directory = publicPreview ? path.join(root, 'docs') + path.sep : root;
    const relative = publicPreview ? pathname.slice(publicPrefix.length) : pathname;
    const page = relative === '' || relative === '/' || relative === '/catalogo' || relative === '/catalogo/' || relative.startsWith('/categorias/') || relative.startsWith('/produtos/');
    const filename = page ? (publicPreview ? (relative.replace(/\/$/, '') || '') + '/index.html' : '/index.html') : relative;
    const file = path.resolve(directory, '.' + filename);
    if (!file.startsWith(directory)) { response.writeHead(403); return response.end(); }
    let content;
    try { content = await readFile(file); }
    catch (error) {
      if (!publicPreview || !page) throw error;
      content = await readFile(path.join(directory, '404.html'));
    }
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end('Página não encontrada');
  }
}).listen(3000, '127.0.0.1', () => console.log('Catálogo Legado disponível em http://localhost:3000'));
