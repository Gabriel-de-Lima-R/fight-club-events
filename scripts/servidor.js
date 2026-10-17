// Servidor local simples para abrir o site no navegador, sem instalar nada.
// Uso: node scripts/servidor.js  →  abre http://localhost:8080
// Só aceita conexões deste computador.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTA = Number(process.env.PORT) || 8080;
const RAIZ = path.join(__dirname, '..');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const servidor = http.createServer((req, res) => {
  const caminhoUrl = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const arquivo = path.normalize(path.join(RAIZ, caminhoUrl.endsWith('/') ? caminhoUrl + 'index.html' : caminhoUrl));

  // Impede acessar arquivos fora da pasta do projeto.
  if (!arquivo.startsWith(RAIZ + path.sep)) {
    res.writeHead(403).end('Acesso negado');
    return;
  }

  fs.readFile(arquivo, (erro, conteudo) => {
    if (erro) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Arquivo não encontrado');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(conteudo);
  });
});

servidor.listen(PORTA, '127.0.0.1', () => {
  console.log(`Site rodando em http://localhost:${PORTA}`);
  console.log('Para parar, aperte Ctrl+C.');
});
