const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'canelistico.db');
const JSON_FILE = path.join(DATA_DIR, 'tournaments.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_FILE);

// Initialize schema
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tournaments (
      game_key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      date TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS global_rankings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_key TEXT NOT NULL,
      puesto TEXT NOT NULL,
      jugador TEXT NOT NULL,
      deck TEXT NOT NULL,
      puntos TEXT NOT NULL,
      legend TEXT,
      champion TEXT,
      battlefields TEXT,
      runes TEXT,
      units TEXT,
      spells TEXT,
      gears TEXT,
      sideboard TEXT,
      FOREIGN KEY (game_key) REFERENCES tournaments(game_key) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tournament_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_key TEXT NOT NULL,
      puesto TEXT NOT NULL,
      jugador TEXT NOT NULL,
      deck TEXT NOT NULL,
      puntos TEXT NOT NULL,
      legend TEXT,
      champion TEXT,
      battlefields TEXT,
      runes TEXT,
      units TEXT,
      spells TEXT,
      gears TEXT,
      sideboard TEXT,
      FOREIGN KEY (game_key) REFERENCES tournaments(game_key) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_global_game_key ON global_rankings(game_key);
    CREATE INDEX IF NOT EXISTS idx_results_game_key ON tournament_results(game_key);
  `);
}

const DEFAULT_GAMES = {
  'riftbound': {
    name: 'Riftbound',
    title: 'Riftbound',
    subtitle: 'Torneo Semanal - Temporada 2026',
    date: 'Octubre 2026'
  },
  'pokemon': {
    name: 'Pokémon',
    title: 'Pokémon',
    subtitle: 'Liga Oficial Canelistico - Estándar',
    date: 'Octubre 2026'
  },
  'digimon': {
    name: 'Digimon',
    title: 'Digimon',
    subtitle: 'Torneo de Evolución Canelomon',
    date: 'Octubre 2026'
  },
  'lorcana': {
    name: 'Lorcana',
    title: 'Lorcana',
    subtitle: 'Torneo de Tintas Mágicas - Iluminadores',
    date: 'Octubre 2026'
  }
};

const DEFAULT_GLOBAL_ROWS = [
  { puesto: '1', jugador: 'angel', deck: 'Nasus', puntos: '10 Pts' },
  { puesto: '2', jugador: 'Pedro', deck: 'Teemo', puntos: '8 Pts' },
  { puesto: '3', jugador: 'Marco', deck: "Kai'sa", puntos: '5 Pts' },
  { puesto: '4', jugador: 'Sofia', deck: 'Jinx', puntos: '4 Pts' }
];

function generateDefaultRows() {
  const rows = [];
  for (let i = 1; i <= 16; i++) {
    rows.push({
      puesto: i.toString(),
      jugador: 'Gusifer',
      deck: 'Viktor',
      puntos: '666 Pts'
    });
  }
  return rows;
}

// Migrate data from existing JSON or populate defaults
function seedInitialData() {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM tournaments').get();
  if (countRow && countRow.count > 0) {
    return; // Already seeded
  }

  let sourceData = {};
  if (fs.existsSync(JSON_FILE)) {
    try {
      sourceData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
    } catch (e) {
      console.warn('Could not read existing JSON for seeding, using defaults:', e);
    }
  }

  for (const [key, defaultMeta] of Object.entries(DEFAULT_GAMES)) {
    const existing = sourceData[key] || {};
    const name = existing.name || defaultMeta.name;
    const title = existing.title || defaultMeta.title;
    const subtitle = existing.subtitle || defaultMeta.subtitle;
    const date = existing.date || defaultMeta.date;

    const globalRows = Array.isArray(existing.globalRanking) && existing.globalRanking.length > 0
      ? existing.globalRanking
      : DEFAULT_GLOBAL_ROWS;

    const resultsRows = Array.isArray(existing.results) && existing.results.length > 0
      ? existing.results
      : generateDefaultRows();

    // Insert Tournament metadata
    db.prepare(`
      INSERT OR REPLACE INTO tournaments (game_key, name, title, subtitle, date, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(key, name, title, subtitle, date);

    // Insert Global Ranking rows
    const insertGlobalStmt = db.prepare(`
      INSERT INTO global_rankings (
        game_key, puesto, jugador, deck, puntos,
        legend, champion, battlefields, runes, units, spells, gears, sideboard
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of globalRows.slice(0, 4)) {
      const dl = r.deckList || {};
      insertGlobalStmt.run(
        key,
        r.puesto || '',
        r.jugador || '',
        r.deck || '',
        r.puntos || '',
        dl.legend || '',
        dl.champion || '',
        dl.battlefields || '',
        dl.runes || '',
        dl.units || '',
        dl.spells || '',
        dl.gears || '',
        dl.sideboard || ''
      );
    }

    // Insert Tournament Results rows
    const insertResultStmt = db.prepare(`
      INSERT INTO tournament_results (
        game_key, puesto, jugador, deck, puntos,
        legend, champion, battlefields, runes, units, spells, gears, sideboard
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of resultsRows) {
      const dl = r.deckList || {};
      insertResultStmt.run(
        key,
        r.puesto || '',
        r.jugador || '',
        r.deck || '',
        r.puntos || '',
        dl.legend || '',
        dl.champion || '',
        dl.battlefields || '',
        dl.runes || '',
        dl.units || '',
        dl.spells || '',
        dl.gears || '',
        dl.sideboard || ''
      );
    }
  }

  console.log('✅ SQLite database initialized and seeded successfully.');
}

// Database API methods
function getTournament(gameKey) {
  const normalizedKey = gameKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  let tourney = db.prepare('SELECT * FROM tournaments WHERE game_key = ?').get(normalizedKey);
  if (!tourney) {
    const fallback = DEFAULT_GAMES[normalizedKey] || {
      name: gameKey,
      title: gameKey,
      subtitle: 'Torneo Oficial',
      date: 'Octubre 2026'
    };
    db.prepare(`
      INSERT OR REPLACE INTO tournaments (game_key, name, title, subtitle, date, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(normalizedKey, fallback.name, fallback.title, fallback.subtitle, fallback.date);
    tourney = db.prepare('SELECT * FROM tournaments WHERE game_key = ?').get(normalizedKey);
  }

  // Get Global Ranking rows
  const globalRows = db.prepare('SELECT * FROM global_rankings WHERE game_key = ? ORDER BY id ASC').all(normalizedKey);
  const globalRanking = globalRows.map(r => ({
    puesto: r.puesto,
    jugador: r.jugador,
    deck: r.deck,
    puntos: r.puntos,
    deckList: {
      legend: r.legend || '',
      champion: r.champion || '',
      battlefields: r.battlefields || '',
      runes: r.runes || '',
      units: r.units || '',
      spells: r.spells || '',
      gears: r.gears || '',
      sideboard: r.sideboard || ''
    }
  }));

  // Pad global ranking with defaults if less than 4
  const finalGlobal = [];
  for (let i = 0; i < 4; i++) {
    if (globalRanking[i] && globalRanking[i].jugador) {
      finalGlobal.push(globalRanking[i]);
    } else {
      finalGlobal.push(DEFAULT_GLOBAL_ROWS[i]);
    }
  }

  // Get Tournament Results rows
  const resultsRows = db.prepare('SELECT * FROM tournament_results WHERE game_key = ? ORDER BY id ASC').all(normalizedKey);
  const results = resultsRows.length > 0
    ? resultsRows.map(r => ({
        puesto: r.puesto,
        jugador: r.jugador,
        deck: r.deck,
        puntos: r.puntos,
        deckList: {
          legend: r.legend || '',
          champion: r.champion || '',
          battlefields: r.battlefields || '',
          runes: r.runes || '',
          units: r.units || '',
          spells: r.spells || '',
          gears: r.gears || '',
          sideboard: r.sideboard || ''
        }
      }))
    : generateDefaultRows();

  return {
    game: {
      name: tourney.name,
      title: tourney.title,
      subtitle: tourney.subtitle || tourney.date,
      date: tourney.date
    },
    results: results,
    globalRanking: finalGlobal
  };
}

function saveGlobalRanking(gameKey, results) {
  const normalizedKey = gameKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Ensure tournament exists
  const existing = db.prepare('SELECT * FROM tournaments WHERE game_key = ?').get(normalizedKey);
  if (!existing) {
    db.prepare(`
      INSERT INTO tournaments (game_key, name, title, subtitle, date, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(normalizedKey, gameKey, gameKey, 'Octubre 2026', 'Octubre 2026');
  }

  // Delete old global ranking rows for this game
  db.prepare('DELETE FROM global_rankings WHERE game_key = ?').run(normalizedKey);

  // Insert updated 4 rows
  const insertStmt = db.prepare(`
    INSERT INTO global_rankings (
      game_key, puesto, jugador, deck, puntos,
      legend, champion, battlefields, runes, units, spells, gears, sideboard
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const top4 = (results || []).slice(0, 4);
  for (let i = 0; i < top4.length; i++) {
    const r = top4[i];
    const dl = r.deckList || {};
    insertStmt.run(
      normalizedKey,
      (r.puesto || (i + 1)).toString(),
      r.jugador || '',
      r.deck || '',
      r.puntos || '',
      dl.legend || '',
      dl.champion || '',
      dl.battlefields || '',
      dl.runes || '',
      dl.units || '',
      dl.spells || '',
      dl.gears || '',
      dl.sideboard || ''
    );
  }

  // Update timestamp
  db.prepare("UPDATE tournaments SET updated_at = datetime('now') WHERE game_key = ?").run(normalizedKey);

  return getTournament(normalizedKey);
}

function saveTournamentResults(gameKey, title, date, results) {
  const normalizedKey = gameKey.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const existing = db.prepare('SELECT * FROM tournaments WHERE game_key = ?').get(normalizedKey);

  const finalTitle = title || (existing ? existing.title : gameKey);
  const finalDate = date || (existing ? (existing.date || existing.subtitle) : 'Octubre 2026');

  if (!existing) {
    db.prepare(`
      INSERT INTO tournaments (game_key, name, title, subtitle, date, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(normalizedKey, gameKey, finalTitle, finalDate, finalDate);
  } else {
    db.prepare(`
      UPDATE tournaments 
      SET title = ?, subtitle = ?, date = ?, updated_at = datetime('now')
      WHERE game_key = ?
    `).run(finalTitle, finalDate, finalDate, normalizedKey);
  }

  // Delete old tournament results rows
  db.prepare('DELETE FROM tournament_results WHERE game_key = ?').run(normalizedKey);

  // Insert new rows
  const insertStmt = db.prepare(`
    INSERT INTO tournament_results (
      game_key, puesto, jugador, deck, puntos,
      legend, champion, battlefields, runes, units, spells, gears, sideboard
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const rows = Array.isArray(results) ? results : [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const dl = r.deckList || {};
    insertStmt.run(
      normalizedKey,
      (r.puesto || (i + 1)).toString(),
      r.jugador || '',
      r.deck || '',
      r.puntos || '',
      dl.legend || '',
      dl.champion || '',
      dl.battlefields || '',
      dl.runes || '',
      dl.units || '',
      dl.spells || '',
      dl.gears || '',
      dl.sideboard || ''
    );
  }

  return getTournament(normalizedKey);
}

// Initialize on require
initSchema();
seedInitialData();

module.exports = {
  db,
  getTournament,
  saveGlobalRanking,
  saveTournamentResults
};
