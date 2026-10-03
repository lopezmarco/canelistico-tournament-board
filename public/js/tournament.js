document.addEventListener('DOMContentLoaded', async () => {
  // 1. Get the game name from URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const rawGameParam = urlParams.get('game');
  
  // Default to Digimon if not specified, otherwise use exact requested name
  const gameName = rawGameParam ? decodeURIComponent(rawGameParam) : 'Digimon';
  const normalizedKey = gameName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // DOM Elements
  const titleElement = document.getElementById('table-game-title');
  const subtitleElement = document.getElementById('table-game-subtitle');
  const iconElement = document.getElementById('current-game-icon');
  const pageTitle = document.querySelector('title');
  const tableBody = document.getElementById('table-body');
  const globalBody = document.getElementById('global-ranking-body');
  const totalCountEl = document.getElementById('total-rows-count');
  const searchInput = document.getElementById('player-search');

  // Deck List View Modal Elements
  const decklistViewModalOverlay = document.getElementById('decklist-view-modal-overlay');
  const btnCloseDecklistView = document.getElementById('btn-close-decklist-view');
  const btnCloseDecklistViewBtn = document.getElementById('btn-close-decklist-view-btn');
  const decklistViewTitle = document.getElementById('decklist-view-title');
  const decklistViewSubtitle = document.getElementById('decklist-view-subtitle');
  const viewDecklistCombinedText = document.getElementById('view-decklist-combined-text');

  function formatDecklistText(deckData) {
    if (!deckData || typeof deckData !== 'object') {
      return 'Sin información de Deck List registrada.';
    }

    const sections = [
      { title: 'LEGEND', value: deckData.legend },
      { title: 'CHAMPION', value: deckData.champion },
      { title: 'BATTLEFIELDS', value: deckData.battlefields },
      { title: 'RUNES', value: deckData.runes },
      { title: 'UNITS', value: deckData.units },
      { title: 'SPELLS', value: deckData.spells },
      { title: 'GEARS', value: deckData.gears },
      { title: 'SIDEBOARD', value: deckData.sideboard }
    ];

    const formatted = sections.map(s => {
      const val = (s.value || '').trim();
      return `${s.title}:\n${val ? val : '—'}`;
    });

    return formatted.join('\n\n');
  }

  function openDecklistView(row, displayRank) {
    if (!decklistViewModalOverlay) return;

    const rank = row.puesto || displayRank || '—';
    const player = row.jugador || 'Jugador';
    const deckName = row.deck || 'Deck';
    const deckData = row.deckList || {};

    decklistViewTitle.textContent = `Deck List • Puesto #${rank}`;
    decklistViewSubtitle.textContent = `${player} — ${deckName}`;

    if (viewDecklistCombinedText) {
      viewDecklistCombinedText.value = formatDecklistText(deckData);
    }

    decklistViewModalOverlay.classList.add('active');
  }

  function closeDecklistView() {
    if (decklistViewModalOverlay) {
      decklistViewModalOverlay.classList.remove('active');
    }
  }

  if (btnCloseDecklistView) {
    btnCloseDecklistView.addEventListener('click', closeDecklistView);
  }
  if (btnCloseDecklistViewBtn) {
    btnCloseDecklistViewBtn.addEventListener('click', closeDecklistView);
  }
  if (decklistViewModalOverlay) {
    decklistViewModalOverlay.addEventListener('click', (e) => {
      if (e.target === decklistViewModalOverlay) {
        closeDecklistView();
      }
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && decklistViewModalOverlay && decklistViewModalOverlay.classList.contains('active')) {
      closeDecklistView();
    }
  });

  // Map icon based on game name
  if (normalizedKey.includes('riftbound')) {
    iconElement.src = 'images/riftbound.webp';
  } else if (normalizedKey.includes('pokemon')) {
    iconElement.src = 'images/pokemon.webp';
  } else if (normalizedKey.includes('digimon')) {
    iconElement.src = 'images/digimon.png';
  } else if (normalizedKey.includes('lorcana')) {
    iconElement.src = 'images/lorcana.png';
  } else {
    iconElement.src = 'images/canelistico-logo.png';
  }

  // Baseline Default values
  const DEFAULT_GLOBAL = [
    { puesto: '1', jugador: 'angel', deck: 'Nasus', puntos: '10 Pts' },
    { puesto: '2', jugador: 'Pedro', deck: 'Teemo', puntos: '8 Pts' },
    { puesto: '3', jugador: 'Marco', deck: "Kai'sa", puntos: '5 Pts' },
    { puesto: '4', jugador: 'Sofia', deck: 'Jinx', puntos: '4 Pts' }
  ];

  let currentTitle = gameName;
  let currentSubtitle = 'Torneo Semanal - Clasificación General';
  let tournamentData = generateDefaultRows();
  let globalRankingData = [...DEFAULT_GLOBAL];

  // 2. Fetch loaded tournament results (from API or localStorage cache)
  try {
    const apiRes = await fetch(`/api/tournament/${encodeURIComponent(normalizedKey)}`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && data.results && data.results.length > 0) {
        tournamentData = data.results;
        currentTitle = data.game.title || gameName;
        currentSubtitle = data.game.subtitle || data.game.date || 'Octubre 2026';
      }
      if (data && Array.isArray(data.globalRanking) && data.globalRanking.length > 0) {
        globalRankingData = data.globalRanking;
      }
    }
  } catch (e) {
    console.warn('API lookup failed, checking localStorage fallback...', e);
  }

  // Check localStorage overrides
  try {
    const cached = localStorage.getItem(`canelistico_${normalizedKey}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.results && parsed.results.length > 0) {
        tournamentData = parsed.results;
        if (parsed.title) currentTitle = parsed.title;
        if (parsed.date) currentSubtitle = parsed.date;
      }
    }
  } catch (err) {}

  try {
    const cachedGlobal = localStorage.getItem(`canelistico_global_${normalizedKey}`);
    if (cachedGlobal) {
      const parsedG = JSON.parse(cachedGlobal);
      if (parsedG && Array.isArray(parsedG.results) && parsedG.results.length > 0) {
        globalRankingData = parsedG.results;
      }
    }
  } catch (err) {}

  // Apply title and subtitle for the tournament table
  if (titleElement) {
    titleElement.textContent = currentTitle;
  }
  if (subtitleElement) {
    subtitleElement.textContent = currentSubtitle;
  }
  if (pageTitle) {
    pageTitle.textContent = `${currentTitle} - Resultados de Torneo | Canelistico`;
  }

  // Render Ranking Global — MUST ALWAYS SHOW EXACTLY 4 ROWS
  function renderGlobalRanking(data) {
    if (!globalBody) return;
    globalBody.innerHTML = '';
    const rankClasses = ['top-1', 'top-2', 'top-3', ''];

    // Construct exactly 4 rows: use uploaded rows first, fill missing with defaults
    const rowsToRender = [];
    for (let i = 0; i < 4; i++) {
      if (data && data[i] && data[i].jugador) {
        rowsToRender.push(data[i]);
      } else {
        rowsToRender.push(DEFAULT_GLOBAL[i]);
      }
    }

    rowsToRender.forEach((row, i) => {
      const tr = document.createElement('tr');
      const badgeClass = rankClasses[i] || '';
      const initialChar = row.jugador ? row.jugador.charAt(0).toUpperCase() : '?';
      const hasDecklist = row.deckList && Object.values(row.deckList).some(v => v && v.trim().length > 0);

      tr.innerHTML = `
        <td><span class="rank-badge ${badgeClass}">#${row.puesto || (i + 1)}</span></td>
        <td>
          <div class="player-cell">
            <div class="player-avatar">${initialChar}</div>
            <span>${row.jugador}</span>
          </div>
        </td>
        <td>
          <a href="javascript:void(0)" class="deck-tag deck-link ${hasDecklist ? 'has-decklist' : ''}" title="Ver Deck List de ${row.jugador}">
            ${row.deck}
          </a>
        </td>
        <td>${row.puntos}</td>
      `;

      tr.querySelector('.deck-link').addEventListener('click', () => {
        openDecklistView(row, i + 1);
      });

      globalBody.appendChild(tr);
    });
  }

  renderGlobalRanking(globalRankingData);

  function generateDefaultRows() {
    const rows = [];
    for (let i = 1; i <= 16; i++) {
      rows.push({
        puesto: i.toString(),
        jugador: "Gusifer",
        deck: "Viktor",
        puntos: "666 Pts"
      });
    }
    return rows;
  }

  // 3. Render Tournament table rows
  function renderRows(data) {
    tableBody.innerHTML = '';

    if (data.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 32px; color: var(--text-muted);">
            No se encontraron jugadores que coincidan con la búsqueda.
          </td>
        </tr>
      `;
      if (totalCountEl) totalCountEl.textContent = 0;
      return;
    }

    data.forEach((row, index) => {
      const tr = document.createElement('tr');

      // Rank styling
      const displayRank = index + 1;
      let rankBadgeClass = '';
      if (displayRank === 1) rankBadgeClass = 'top-1';
      else if (displayRank === 2) rankBadgeClass = 'top-2';
      else if (displayRank === 3) rankBadgeClass = 'top-3';

      const initialChar = row.jugador ? row.jugador.charAt(0).toUpperCase() : '?';
      const hasDecklist = row.deckList && Object.values(row.deckList).some(v => v && v.trim().length > 0);

      tr.innerHTML = `
        <td>
          <span class="rank-badge ${rankBadgeClass}">
            #${row.puesto || displayRank}
          </span>
        </td>
        <td>
          <div class="player-cell">
            <div class="player-avatar">${initialChar}</div>
            <span>${row.jugador}</span>
          </div>
        </td>
        <td>
          <a href="javascript:void(0)" class="deck-tag deck-link ${hasDecklist ? 'has-decklist' : ''}" title="Ver Deck List de ${row.jugador}">
            ${row.deck}
          </a>
        </td>
        <td>
          ${row.puntos}
        </td>
      `;

      tr.querySelector('.deck-link').addEventListener('click', () => {
        openDecklistView(row, displayRank);
      });

      tableBody.appendChild(tr);
    });

    if (totalCountEl) {
      totalCountEl.textContent = data.length;
    }
  }

  renderRows(tournamentData);

  // 4. Search & Filter
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const filtered = tournamentData.filter(item => 
        (item.jugador && item.jugador.toLowerCase().includes(query)) ||
        (item.deck && item.deck.toLowerCase().includes(query)) ||
        (item.puesto && item.puesto.toLowerCase().includes(query)) ||
        (item.puntos && item.puntos.toLowerCase().includes(query))
      );
      renderRows(filtered);
    });
  }
});
