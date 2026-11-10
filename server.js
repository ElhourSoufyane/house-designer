// Tiny static file server for testing the game.
// Run:  ELECTRON_RUN_AS_NODE=1 Devin.exe server.js   →   http://localhost:8000
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname, PORT = 8000;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
               '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
                       'Cache-Control': 'no-store' });   /* always serve the newest files */
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('Home Planner → http://localhost:' + PORT));
