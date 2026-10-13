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

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT NOT NULL COLLATE NOCASE,
      nombre TEXT NOT NULL,
      correo TEXT NOT NULL,
      tcg TEXT NOT NULL COLLATE NOCASE,
      puntos INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(nickname, tcg)
    );

    CREATE INDEX IF NOT EXISTS idx_global_game_key ON global_rankings(game_key);
    CREATE INDEX IF NOT EXISTS idx_results_game_key ON tournament_results(game_key);
    CREATE INDEX IF NOT EXISTS idx_players_nickname_tcg ON players(nickname, tcg);
  `);

  // Auto-migration: ensure digieggs and digimon columns exist in tournament_results and global_rankings
  try { db.exec("ALTER TABLE tournament_results ADD COLUMN digieggs TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE tournament_results ADD COLUMN digimon TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE global_rankings ADD COLUMN digieggs TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE global_rankings ADD COLUMN digimon TEXT"); } catch (_) {}

  // Auto-migration: update players table constraint to composite UNIQUE(nickname, tcg) if using old schema
  try {
    const playersTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='players'").get();
    if (playersTableInfo && playersTableInfo.sql && playersTableInfo.sql.includes('nickname TEXT NOT NULL UNIQUE')) {
      db.exec(`
        CREATE TABLE players_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nickname TEXT NOT NULL COLLATE NOCASE,
          nombre TEXT NOT NULL,
          correo TEXT NOT NULL,
          tcg TEXT NOT NULL COLLATE NOCASE,
          puntos INTEGER NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(nickname, tcg)
        );
        INSERT OR IGNORE INTO players_new (id, nickname, nombre, correo, tcg, puntos, created_at)
          SELECT id, nickname, nombre, correo, tcg, puntos, created_at FROM players;
        DROP TABLE players;
        ALTER TABLE players_new RENAME TO players;
        DROP INDEX IF EXISTS idx_players_nickname;
        CREATE INDEX IF NOT EXISTS idx_players_nickname_tcg ON players(nickname, tcg);
      `);
      console.log('Migration completed: players table updated to UNIQUE(nickname, tcg)');
    }
  } catch (mErr) {
    console.error('Migration error for players table:', mErr.message);
  }
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

  // Get Global Ranking rows: All players registered for this TCG in players table, ordered by puntos DESC
  const allTcgPlayers = db.prepare(`
    SELECT id, nickname, nombre, puntos, tcg 
    FROM players 
    WHERE LOWER(tcg) = LOWER(?) OR LOWER(tcg) = LOWER(?)
    ORDER BY puntos DESC, id ASC
  `).all(tourney.name, normalizedKey);

  const finalGlobal = allTcgPlayers.map((p, idx) => ({
    puesto: (idx + 1).toString(),
    nickname: p.nickname || p.nombre || '—',
    jugador: p.nickname || p.nombre || '—',
    puntos: `${p.puntos} Pts`
  }));

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
          sideboard: r.sideboard || '',
          digieggs: r.digieggs || '',
          digimon: r.digimon || ''
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
      legend, champion, battlefields, runes, units, spells, gears, sideboard,
      digieggs, digimon
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      dl.sideboard || '',
      dl.digieggs || dl.digiEggs || '',
      dl.digimon || ''
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
      legend, champion, battlefields, runes, units, spells, gears, sideboard,
      digieggs, digimon
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      dl.sideboard || '',
      dl.digieggs || dl.digiEggs || '',
      dl.digimon || ''
    );
  }

  return getTournament(normalizedKey);
}

function addPlayer({ nickname, nombre, correo, tcg, puntos }) {
  const cleanNick = (nickname || '').trim();
  const cleanNombre = (nombre || '').trim();
  const cleanCorreo = (correo || '').trim().toLowerCase();
  const cleanTcg = (tcg || '').trim();
  const numPuntos = Math.min(1000, Math.max(0, parseInt(puntos, 10) || 0));

  // Check if player with same (nickname, tcg) pair already exists (case-insensitive)
  const existing = db.prepare(`
    SELECT id FROM players 
    WHERE LOWER(nickname) = LOWER(?) AND LOWER(tcg) = LOWER(?)
  `).get(cleanNick, cleanTcg);

  if (existing) {
    return { success: false, error: 'El usuario ya existe con este Nickname.' };
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO players (nickname, nombre, correo, tcg, puntos, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);

    const result = stmt.run(cleanNick, cleanNombre, cleanCorreo, cleanTcg, numPuntos);
    return {
      success: true,
      player: {
        id: Number(result.lastInsertRowid),
        nickname: cleanNick,
        nombre: cleanNombre,
        correo: cleanCorreo,
        tcg: cleanTcg,
        puntos: numPuntos
      }
    };
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return { success: false, error: 'El usuario ya existe con este Nickname.' };
    }
    throw err;
  }
}

function getPlayers(tcgFilter) {
  if (tcgFilter && typeof tcgFilter === 'string' && tcgFilter.trim()) {
    const cleanTcg = tcgFilter.trim();
    return db.prepare(`
      SELECT id, nickname, nombre, correo, tcg, puntos, created_at 
      FROM players 
      WHERE LOWER(tcg) = LOWER(?) 
      ORDER BY puntos DESC, id ASC
    `).all(cleanTcg);
  }
  return db.prepare('SELECT id, nickname, nombre, correo, tcg, puntos, created_at FROM players ORDER BY puntos DESC, id ASC').all();
}

// Deletes exactly one player by its primary key (never by nickname)
function deletePlayer(id) {
  const numId = parseInt(id, 10);
  if (!Number.isInteger(numId) || numId <= 0) {
    return { success: false, error: 'Identificador de jugador inválido.' };
  }
  const result = db.prepare('DELETE FROM players WHERE id = ?').run(numId);
  if (result.changes === 0) {
    return { success: false, error: 'El jugador no existe o ya fue eliminado.' };
  }
  return { success: true };
}

// Bulk-updates puntos for a list of { id, puntos } inside a single transaction
function updatePlayersPoints(updates) {
  const stmt = db.prepare('UPDATE players SET puntos = ? WHERE id = ?');
  let updated = 0;
  db.exec('BEGIN');
  try {
    for (const u of updates) {
      const numId = parseInt(u.id, 10);
      const pts = parseInt(u.puntos, 10);
      if (!Number.isInteger(numId) || numId <= 0 || isNaN(pts) || pts < 0 || pts > 1000) {
        throw new Error('Datos de actualización inválidos.');
      }
      updated += Number(stmt.run(pts, numId).changes);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return { success: false, error: err.message };
  }
  return { success: true, updated };
}

// Sets puntos to 0 for all players matching the given TCG
function resetPlayersPoints(tcg) {
  if (!tcg || typeof tcg !== 'string' || !tcg.trim()) {
    return { success: false, error: 'TCG no especificado.' };
  }
  const cleanTcg = tcg.trim();
  const stmt = db.prepare('UPDATE players SET puntos = 0 WHERE LOWER(tcg) = LOWER(?)');
  const result = stmt.run(cleanTcg);
  return { success: true, updated: Number(result.changes) };
}

// Initialize on require
initSchema();
seedInitialData();

module.exports = {
  db,
  getTournament,
  saveGlobalRanking,
  saveTournamentResults,
  addPlayer,
  getPlayers,
  deletePlayer,
  updatePlayersPoints,
  resetPlayersPoints
};
