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
  const globalPaginationEl = document.getElementById('global-ranking-pagination');
  const globalSearchInput = document.getElementById('global-search');
  const globalCountBadgeEl = document.getElementById('global-ranking-count-badge');
  const totalCountEl = document.getElementById('total-rows-count');
  const searchInput = document.getElementById('player-search');

  // Deck List View Modal Elements
  const decklistViewModalOverlay = document.getElementById('decklist-view-modal-overlay');
  const btnCloseDecklistView = document.getElementById('btn-close-decklist-view');
  const btnCloseDecklistViewBtn = document.getElementById('btn-close-decklist-view-btn');
  const decklistViewTitle = document.getElementById('decklist-view-title');
  const decklistViewSubtitle = document.getElementById('decklist-view-subtitle');
  const viewDecklistCombinedText = document.getElementById('view-decklist-combined-text');

  function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

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
  let globalRankingData = [];

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
      if (data && Array.isArray(data.globalRanking)) {
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

  // ── Ranking Global State (Paginated 4 per page, filtered by Nickname) ──
  const GLOBAL_PAGE_SIZE = 4;
  let globalCurrentPage = 1;
  let globalSearchQuery = '';

  function getFilteredGlobalRanking() {
    if (!globalSearchQuery) return globalRankingData;
    const q = globalSearchQuery.toLowerCase();
    return globalRankingData.filter(item => {
      const name = (item.nickname || item.jugador || '').toLowerCase();
      return name.includes(q);
    });
  }

  function renderGlobalRanking() {
    if (!globalBody) return;
    globalBody.innerHTML = '';

    const filtered = getFilteredGlobalRanking();
    const totalMatching = filtered.length;
    const totalAll = globalRankingData.length;

    if (globalCountBadgeEl) {
      if (globalSearchQuery && totalMatching !== totalAll) {
        globalCountBadgeEl.textContent = `(${totalMatching} de ${totalAll} jugadores)`;
      } else if (totalAll > 0) {
        globalCountBadgeEl.textContent = `(${totalAll} ${totalAll === 1 ? 'jugador' : 'jugadores'})`;
      } else {
        globalCountBadgeEl.textContent = '';
      }
    }

    if (totalAll === 0) {
      globalBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; padding: 24px; color: var(--text-muted);">
            No hay jugadores registrados para este torneo.
          </td>
        </tr>
      `;
      if (globalPaginationEl) globalPaginationEl.innerHTML = '';
      return;
    }

    if (totalMatching === 0) {
      globalBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; padding: 24px; color: var(--text-muted);">
            No se encontraron jugadores que coincidan con "${escapeHtml(globalSearchQuery)}".
          </td>
        </tr>
      `;
      if (globalPaginationEl) globalPaginationEl.innerHTML = '';
      return;
    }

    const totalPages = Math.max(1, Math.ceil(totalMatching / GLOBAL_PAGE_SIZE));
    if (globalCurrentPage > totalPages) globalCurrentPage = totalPages;
    if (globalCurrentPage < 1) globalCurrentPage = 1;

    const start = (globalCurrentPage - 1) * GLOBAL_PAGE_SIZE;
    const end = Math.min(start + GLOBAL_PAGE_SIZE, totalMatching);
    const pageRows = filtered.slice(start, end);

    pageRows.forEach((row, i) => {
      const overallRank = start + i + 1;
      let badgeClass = '';
      if (overallRank === 1) badgeClass = 'top-1';
      else if (overallRank === 2) badgeClass = 'top-2';
      else if (overallRank === 3) badgeClass = 'top-3';

      const displayName = row.nickname || row.jugador || '—';
      const initialChar = (displayName && displayName !== '—') ? displayName.charAt(0).toUpperCase() : '?';
      const puntosStr = row.puntos ? (row.puntos.toString().includes('Pts') ? row.puntos : `${row.puntos} Pts`) : '0 Pts';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="rank-badge ${badgeClass}">#${row.puesto || overallRank}</span></td>
        <td>
          <div class="player-cell">
            <div class="player-avatar">${initialChar}</div>
            <span style="font-weight: 700; color: #ffffff;">${escapeHtml(displayName)}</span>
          </div>
        </td>
        <td>${escapeHtml(puntosStr)}</td>
      `;

      globalBody.appendChild(tr);
    });

    renderGlobalPagination(totalPages, start, end, totalMatching);
  }

  function renderGlobalPagination(totalPages, start, end, total) {
    if (!globalPaginationEl) return;
    if (totalPages <= 1) {
      globalPaginationEl.innerHTML = '';
      return;
    }

    let html = `<span class="page-info">Mostrando ${start + 1}–${end} de ${total}</span>`;
    html += `<button type="button" class="page-btn" data-page="${globalCurrentPage - 1}" ${globalCurrentPage === 1 ? 'disabled' : ''}>&lsaquo;</button>`;
    for (let pg = 1; pg <= totalPages; pg++) {
      html += `<button type="button" class="page-btn ${pg === globalCurrentPage ? 'active' : ''}" data-page="${pg}">${pg}</button>`;
    }
    html += `<button type="button" class="page-btn" data-page="${globalCurrentPage + 1}" ${globalCurrentPage === totalPages ? 'disabled' : ''}>&rsaquo;</button>`;
    globalPaginationEl.innerHTML = html;
  }

  // Global Ranking filter input listener
  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => {
      globalSearchQuery = e.target.value.toLowerCase().trim();
      globalCurrentPage = 1;
      renderGlobalRanking();
    });
  }

  // Global Ranking pagination click listener
  if (globalPaginationEl) {
    globalPaginationEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.page-btn');
      if (!btn || btn.disabled) return;
      const pg = parseInt(btn.dataset.page, 10);
      if (!isNaN(pg)) {
        globalCurrentPage = pg;
        renderGlobalRanking();
      }
    });
  }

  renderGlobalRanking();

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
