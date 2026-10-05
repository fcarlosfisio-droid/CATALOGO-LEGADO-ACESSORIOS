import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const page=pathname==='/'||pathname==='/catalogo'||pathname==='/catalogo/'||pathname.startsWith('/categorias/');const file=path.resolve(root,'.'+(page?'/index.html':pathname));if(!file.startsWith(root)){res.writeHead(403);return res.end();}const content=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(content);}catch{res.writeHead(404);res.end('Página não encontrada');}}).listen(3000,'127.0.0.1',()=>console.log('Catálogo Legado disponível em http://localhost:3000'));
