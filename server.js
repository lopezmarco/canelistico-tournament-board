const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Helper for JSON responses
  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(data));
  };

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // POST endpoint to upload/save tournament results into SQLite
  if (req.method === 'POST' && pathname === '/api/tournament/upload') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { gameKey, title, date, results } = payload;

        if (!gameKey || !Array.isArray(results) || results.length === 0) {
          sendJson(400, { success: false, error: 'Datos incompletos o inválidos' });
          return;
        }

        const updatedData = db.saveTournamentResults(gameKey, title, date, results);
        sendJson(200, {
          success: true,
          message: `Resultados guardados en SQLite para ${gameKey}`,
          data: updatedData
        });
      } catch (err) {
        console.error('Error processing upload payload:', err);
        sendJson(500, { success: false, error: 'Error procesando la solicitud' });
      }
    });
    return;
  }

  // POST endpoint to upload/save Ranking Global into SQLite
  if (req.method === 'POST' && pathname === '/api/tournament/upload-global') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { gameKey, results } = payload;

        if (!gameKey || !Array.isArray(results)) {
          sendJson(400, { success: false, error: 'Datos incompletos o inválidos' });
          return;
        }

        const updatedData = db.saveGlobalRanking(gameKey, results);
        sendJson(200, {
          success: true,
          message: `Ranking Global guardado en SQLite para ${gameKey}`,
          data: updatedData
        });
      } catch (err) {
        console.error('Error processing global upload payload:', err);
        sendJson(500, { success: false, error: 'Error procesando la solicitud' });
      }
    });
    return;
  }

  // GET API endpoint for tournament data from SQLite
  if (req.method === 'GET' && pathname.startsWith('/api/tournament/')) {
    const gameKey = pathname.replace('/api/tournament/', '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const tournamentData = db.getTournament(gameKey);
    sendJson(200, tournamentData);
    return;
  }

  // Default route - serve index.html
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  // Sanitize path to prevent directory traversal
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  // If path is a directory, look for index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  const extname = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        const notFoundPath = path.join(PUBLIC_DIR, 'index.html');
        fs.readFile(notFoundPath, (err, notFoundContent) => {
          if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 - Página no encontrada');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(notFoundContent);
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Error del servidor: ${error.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log('====================================================');
  console.log('🃏 Canelistico TCG - Servidor con SQLite activo');
  console.log(`📁 Base de datos persistente: data/canelistico.db`);
  console.log(`🚀 Accede a la aplicación en: http://localhost:${PORT}`);
  console.log('====================================================');
});
