const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'data', 'tournaments.json');

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

// Initial default tournament data source
const DEFAULT_GAMES = {
  'riftbound': {
    name: 'Riftbound',
    title: 'Riftbound',
    subtitle: 'Torneo Semanal - Temporada 2026',
    date: 'Octubre 2026',
    iconColor: '#f97316',
    results: generateDefaultRows()
  },
  'pokemon': {
    name: 'Pokémon',
    title: 'Pokémon',
    subtitle: 'Liga Oficial Canelistico - Estándar',
    date: 'Octubre 2026',
    iconColor: '#eab308',
    results: generateDefaultRows()
  },
  'digimon': {
    name: 'Digimon',
    title: 'Digimon',
    subtitle: 'Torneo de Evolución Canelomon',
    date: 'Octubre 2026',
    iconColor: '#38bdf8',
    results: generateDefaultRows()
  },
  'lorcana': {
    name: 'Lorcana',
    title: 'Lorcana',
    subtitle: 'Torneo de Tintas Mágicas - Iluminadores',
    date: 'Octubre 2026',
    iconColor: '#a855f7',
    results: generateDefaultRows()
  }
};

function generateDefaultRows() {
  const rows = [];
  for (let i = 1; i <= 16; i++) {
    rows.push({
      puesto: i.toString(),
      jugador: 'Gusifer',
      deck: 'Viktor',
      puntos: '666'
    });
  }
  return rows;
}

// Load data from file or init defaults
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading data file:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_GAMES));
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing data file:', e);
  }
}

let tournamentsData = loadData();

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

  // POST endpoint to upload/save tournament results
  if (req.method === 'POST' && pathname === '/api/tournament/upload') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { gameKey, title, date, results } = payload;

        if (!gameKey || !title || !date || !Array.isArray(results)) {
          sendJson(400, { success: false, error: 'Datos incompletos o inválidos' });
          return;
        }

        const normalizedKey = gameKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        if (!tournamentsData[normalizedKey]) {
          tournamentsData[normalizedKey] = {
            name: gameKey,
            title: title,
            subtitle: date,
            date: date,
            results: results,
            globalRanking: []
          };
        } else {
          tournamentsData[normalizedKey].title = title;
          tournamentsData[normalizedKey].date = date;
          tournamentsData[normalizedKey].subtitle = date;
          tournamentsData[normalizedKey].results = results;
        }

        saveData(tournamentsData);
        sendJson(200, { success: true, message: `Resultados guardados para ${gameKey}`, data: tournamentsData[normalizedKey] });
      } catch (err) {
        console.error('Error processing upload payload:', err);
        sendJson(500, { success: false, error: 'Error procesando la solicitud' });
      }
    });
    return;
  }

  // POST endpoint to upload/save Ranking Global
  if (req.method === 'POST' && pathname === '/api/tournament/upload-global') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { gameKey, title, date, results } = payload;

        if (!gameKey || !Array.isArray(results)) {
          sendJson(400, { success: false, error: 'Datos incompletos o inválidos' });
          return;
        }

        const normalizedKey = gameKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        if (!tournamentsData[normalizedKey]) {
          tournamentsData[normalizedKey] = {
            name: gameKey,
            title: gameKey,
            subtitle: 'Torneo Oficial',
            date: date || 'Octubre 2026',
            results: generateDefaultRows(),
            globalRanking: results.slice(0, 4)
          };
        } else {
          tournamentsData[normalizedKey].globalRanking = results.slice(0, 4);
        }

        saveData(tournamentsData);
        sendJson(200, { success: true, message: `Ranking Global guardado para ${gameKey}`, data: tournamentsData[normalizedKey] });
      } catch (err) {
        console.error('Error processing global upload payload:', err);
        sendJson(500, { success: false, error: 'Error procesando la solicitud' });
      }
    });
    return;
  }

  // GET API endpoint for tournament data
  if (req.method === 'GET' && pathname.startsWith('/api/tournament/')) {
    const gameKey = pathname.replace('/api/tournament/', '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Refresh latest data
    tournamentsData = loadData();
    const tournament = tournamentsData[gameKey] || DEFAULT_GAMES[gameKey] || {
      name: gameKey.charAt(0).toUpperCase() + gameKey.slice(1),
      title: gameKey.charAt(0).toUpperCase() + gameKey.slice(1),
      subtitle: 'Torneo Canelistico',
      date: 'Octubre 2026',
      results: generateDefaultRows(),
      globalRanking: [
        { puesto: '1', jugador: 'angel', deck: 'Nasus', puntos: '10 Pts' },
        { puesto: '2', jugador: 'Pedro', deck: 'Teemo', puntos: '8 Pts' },
        { puesto: '3', jugador: 'Marco', deck: "Kai'sa", puntos: '5 Pts' },
        { puesto: '4', jugador: 'Sofia', deck: 'Jinx', puntos: '4 Pts' }
      ]
    };

    const defaultGlobal = [
      { puesto: '1', jugador: 'angel', deck: 'Nasus', puntos: '10 Pts' },
      { puesto: '2', jugador: 'Pedro', deck: 'Teemo', puntos: '8 Pts' },
      { puesto: '3', jugador: 'Marco', deck: "Kai'sa", puntos: '5 Pts' },
      { puesto: '4', jugador: 'Sofia', deck: 'Jinx', puntos: '4 Pts' }
    ];

    const currentGlobal = (tournament.globalRanking && Array.isArray(tournament.globalRanking)) ? tournament.globalRanking : [];
    const guaranteed4Global = [];
    for (let i = 0; i < 4; i++) {
      if (currentGlobal[i]) {
        guaranteed4Global.push(currentGlobal[i]);
      } else {
        guaranteed4Global.push(defaultGlobal[i]);
      }
    }

    sendJson(200, {
      game: {
        name: tournament.name || gameKey,
        title: tournament.title || tournament.name || gameKey,
        subtitle: tournament.subtitle || tournament.date || 'Torneo Canelistico',
        date: tournament.date || 'Octubre 2026'
      },
      results: tournament.results || generateDefaultRows(),
      globalRanking: guaranteed4Global
    });
    return;
  }

  // Handle route aliases
  if (pathname === '/' || pathname === '/index.html') {
    pathname = '/index.html';
  } else if (pathname === '/tournament' || pathname.startsWith('/tournament/')) {
    pathname = '/tournament.html';
  } else if (pathname === '/upload' || pathname === '/registro' || pathname === '/admin') {
    pathname = '/upload.html';
  }

  // Serve static files
  let filePath = path.join(PUBLIC_DIR, pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallbackPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(fallbackPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🃏 Canelistico TCG - Servidor de Torneos activo`);
  console.log(`🚀 Accede a la aplicación en: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
