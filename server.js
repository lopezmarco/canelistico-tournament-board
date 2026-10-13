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

  // POST endpoint to register player into SQLite
  if (req.method === 'POST' && pathname === '/api/player/register') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { nickname, nombre, correo, tcg, puntos } = payload;

        if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0 || nickname.trim().length > 64) {
          sendJson(400, { success: false, error: 'Nickname es requerido y debe tener máximo 64 caracteres.' });
          return;
        }

        if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0 || nombre.trim().length > 64) {
          sendJson(400, { success: false, error: 'Nombre es requerido y debe tener máximo 64 caracteres.' });
          return;
        }

        if (!correo || typeof correo !== 'string' || correo.trim().length === 0 || correo.trim().length > 64) {
          sendJson(400, { success: false, error: 'Correo es requerido y debe tener máximo 64 caracteres.' });
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(correo.trim())) {
          sendJson(400, { success: false, error: 'El formato de correo electrónico no es válido.' });
          return;
        }

        const parsedPuntos = parseInt(puntos, 10);
        if (isNaN(parsedPuntos) || parsedPuntos < 0 || parsedPuntos > 1000) {
          sendJson(400, { success: false, error: 'Puntos debe ser un número entero entre 0 y 1000.' });
          return;
        }

        const result = db.addPlayer({
          nickname,
          nombre,
          correo,
          tcg: tcg || 'Riftbound',
          puntos: parsedPuntos
        });

        if (!result.success) {
          sendJson(409, { success: false, error: result.error });
          return;
        }

        sendJson(201, {
          success: true,
          message: `Jugador ${nickname.trim()} registrado exitosamente.`,
          data: result.player
        });
      } catch (err) {
        console.error('Error registering player:', err);
        sendJson(500, { success: false, error: 'Error procesando el registro del jugador.' });
      }
    });
    return;
  }

  // GET API endpoint for players list from SQLite
  if (req.method === 'GET' && pathname === '/api/players') {
    const tcgFilter = parsedUrl.searchParams.get('tcg');
    const players = db.getPlayers(tcgFilter);
    sendJson(200, { success: true, data: players });
    return;
  }

  // POST endpoint to delete a single player by primary key
  if (req.method === 'POST' && pathname === '/api/player/delete') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { id } = JSON.parse(body || '{}');
        const result = db.deletePlayer(id);
        if (!result.success) {
          sendJson(404, result);
          return;
        }
        sendJson(200, { success: true, message: 'Jugador eliminado.' });
      } catch (err) {
        console.error('Error deleting player:', err);
        sendJson(500, { success: false, error: 'Error eliminando al jugador.' });
      }
    });
    return;
  }

  // POST endpoint to bulk update players' puntos
  if (req.method === 'POST' && pathname === '/api/players/update-points') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { updates } = JSON.parse(body || '{}');
        if (!Array.isArray(updates) || updates.length === 0) {
          sendJson(400, { success: false, error: 'No hay jugadores para actualizar.' });
          return;
        }
        const result = db.updatePlayersPoints(updates);
        if (!result.success) {
          sendJson(400, result);
          return;
        }
        sendJson(200, { success: true, updated: result.updated });
      } catch (err) {
        console.error('Error updating players points:', err);
        sendJson(500, { success: false, error: 'Error actualizando jugadores.' });
      }
    });
    return;
  }

  // POST endpoint to reset all players' puntos to 0 for a specific TCG
  if (req.method === 'POST' && pathname === '/api/players/reset-points') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { tcg } = JSON.parse(body || '{}');
        if (!tcg || typeof tcg !== 'string' || !tcg.trim()) {
          sendJson(400, { success: false, error: 'TCG no especificado.' });
          return;
        }
        const result = db.resetPlayersPoints(tcg);
        if (!result.success) {
          sendJson(400, result);
          return;
        }
        sendJson(200, { success: true, updated: result.updated });
      } catch (err) {
        console.error('Error resetting players points:', err);
        sendJson(500, { success: false, error: 'Error al reiniciar puntajes.' });
      }
    });
    return;
  }

  // GET endpoint to query Riot Games API / card images
  if (req.method === 'GET' && (pathname === '/api/test/riot' || pathname === '/api/card-image')) {
    const https = require('https');
    const apiKey = 'RGAPI-6a366b17-f637-432d-8796-40634894c8df';
    const queryName = (parsedUrl.searchParams.get('name') || '').trim();

    // Helper to perform HTTPS GET
    const httpsGet = (url, headers = {}) => new Promise((resolve) => {
      https.get(url, { headers }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data, headers: res.headers }));
      }).on('error', (err) => resolve({ statusCode: 500, error: err.message }));
    });

    (async () => {
      let riotStatus = 0;
      let riotBody = null;
      let imageUrl = null;
      let source = '';
      let itemDetails = null;

      if (!queryName) {
        sendJson(200, { success: true, imageUrl: null, source: '', details: null });
        return;
      }

      // 1. Try Riot Games official API endpoint
      try {
        const riotRes = await httpsGet(
          `https://na.api.riotgames.com/val/content/v1/contents?name=${encodeURIComponent(queryName)}`,
          { 'X-Riot-Token': apiKey }
        );
        riotStatus = riotRes.statusCode;
        try { riotBody = JSON.parse(riotRes.body); } catch (_) { riotBody = riotRes.body; }

        // If Riot API returned data, inspect keys for image references
        if (riotStatus === 200 && riotBody && typeof riotBody === 'object') {
          const findImage = (obj) => {
            if (!obj) return null;
            if (typeof obj === 'string') {
              if (obj.match(/\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i) || obj.includes('http')) return obj;
            } else if (typeof obj === 'object') {
              for (const [k, v] of Object.entries(obj)) {
                if (k.toLowerCase().includes('icon') || k.toLowerCase().includes('art') || k.toLowerCase().includes('image') || k.toLowerCase().includes('url')) {
                  if (typeof v === 'string' && (v.startsWith('http') || v.match(/\.(png|jpg|jpeg|webp)/i))) return v;
                }
                const found = findImage(v);
                if (found) return found;
              }
            }
            return null;
          };
          imageUrl = findImage(riotBody);
          if (imageUrl) source = 'Riot Games Content API';
        }
      } catch (err) {
        console.warn('Error querying Riot API:', err);
      }

      // 2. Search Riftbound card database dynamically (RIFTBOUND ONLY, no Runeterra, no local image storage)
      if (!imageUrl) {
        const cleanQuery = queryName.replace(/^[\d\sxX\-.:]+/, '').trim();
        const queriesToTry = [queryName];
        if (cleanQuery && cleanQuery.toLowerCase() !== queryName.toLowerCase()) {
          queriesToTry.push(cleanQuery);
        }

        for (const q of queriesToTry) {
          try {
            const riftRes = await httpsGet(
              `https://api.rifthunt.com/cards/search?q=${encodeURIComponent(q)}`,
              { 'User-Agent': 'CanelisticoTCG/1.0' }
            );
            if (riftRes.statusCode === 200 && riftRes.body) {
              let parsed = null;
              try { parsed = JSON.parse(riftRes.body); } catch (_) {}
              if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
                const qLower = q.toLowerCase();
                // Priority 1: Exact match on name or oracle_name
                let match = parsed.data.find(c => 
                  (c.name && c.name.toLowerCase() === qLower) || 
                  (c.oracle_name && c.oracle_name.toLowerCase() === qLower)
                );
                // Priority 2: Name starts with query or contains query normalized
                if (!match) {
                  const normQ = qLower.replace(/[^a-z0-9]/g, '');
                  match = parsed.data.find(c => {
                    const normC = (c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    return normC.startsWith(normQ) || normC.includes(normQ);
                  });
                }
                // Priority 3: First result
                if (!match) match = parsed.data[0];

                const foundImg = match.images?.full || match.images?.thumb;
                if (foundImg) {
                  imageUrl = foundImg;
                  source = `Riftbound: ${match.set_name || 'TCG'} (${match.collector_number || match.riftbound_id || ''})`;
                  itemDetails = {
                    cardCode: match.riftbound_id || match.collector_number,
                    name: match.name,
                    type: `${match.type || 'Card'}${match.domains ? ` • ${match.domains.join('/')}` : ''}`,
                    game: 'Riftbound (Riot Games)',
                    artist: match.artist,
                    remoteUrl: foundImg
                  };
                  break;
                }
              }
            }
          } catch (err) {
            console.warn('Error querying Riftbound card API:', err.message);
          }
        }
      }

      sendJson(200, {
        success: true,
        riotResponse: {
          requestedUrl: `https://api.riotgames.com/riot/val/content/v1/contents?name=${encodeURIComponent(queryName)}`,
          status: riotStatus,
          data: riotBody
        },
        imageUrl: imageUrl,
        source: source,
        details: itemDetails
      });
    })();
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
