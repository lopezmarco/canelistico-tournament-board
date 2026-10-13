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
  const decklistInteractiveContainer = document.getElementById('decklist-interactive-container');
  const decklistCardPreviewImg = document.getElementById('decklist-card-preview-img');
  const decklistCardLoading = document.getElementById('decklist-card-loading');
  const decklistCardTitleBadge = document.getElementById('decklist-card-title-badge');
  const decklistCardInfoText = document.getElementById('decklist-card-info-text');
  const decklistCardRulesText = document.getElementById('decklist-card-rules-text');
  const decklistCardFlavorText = document.getElementById('decklist-card-flavor-text');

  // Solid black placeholder image
  const BLACK_IMAGE = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 420'%3E%3Crect width='300' height='420' fill='%23000000'/%3E%3C/svg%3E";

  // Automatically rotate horizontal cards (e.g. battlefields) to vertical
  if (decklistCardPreviewImg) {
    decklistCardPreviewImg.addEventListener('load', () => {
      if (decklistCardPreviewImg.naturalWidth > decklistCardPreviewImg.naturalHeight) {
        decklistCardPreviewImg.classList.add('is-rotated');
      } else {
        decklistCardPreviewImg.classList.remove('is-rotated');
      }
    });
  }

  let activeCardLookupController = null;

  function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const DECKLIST_SECTIONS = [
    { key: 'legend', title: 'LEGEND' },
    { key: 'champion', title: 'CHAMPION' },
    { key: 'battlefields', title: 'BATTLEFIELDS' },
    { key: 'runes', title: 'RUNES' },
    { key: 'units', title: 'UNITS' },
    { key: 'spells', title: 'SPELLS' },
    { key: 'gears', title: 'GEARS' },
    { key: 'sideboard', title: 'SIDEBOARD' }
  ];

  const DIGIMON_SECTIONS = [
    { key: 'digieggs', title: 'DIGI-EGGS' },
    { key: 'digimon', title: 'DIGIMON' }
  ];

  function isDigimonDecklist(deckData) {
    if (!deckData || typeof deckData !== 'object') return false;
    if (normalizedKey.includes('digimon')) return true;
    if ((deckData.digieggs && deckData.digieggs.trim().length > 0) || (deckData.digimon && deckData.digimon.trim().length > 0)) {
      return true;
    }
    return false;
  }

  function getDecklistSections(deckData) {
    return isDigimonDecklist(deckData) ? DIGIMON_SECTIONS : DECKLIST_SECTIONS;
  }

  // If any section is empty, mark full deck list as empty
  function isDecklistComplete(deckData) {
    if (!deckData || typeof deckData !== 'object') return false;
    const sections = getDecklistSections(deckData);
    for (const sec of sections) {
      const val = deckData[sec.key];
      if (!val || typeof val !== 'string' || val.trim().length === 0) {
        return false;
      }
    }
    return true;
  }

  function formatDecklistText(deckData) {
    if (!isDecklistComplete(deckData)) {
      return 'Sin información de Deck List registrada.';
    }

    const sections = getDecklistSections(deckData);
    const formatted = sections.map(s => {
      const val = (deckData[s.key] || '').trim();
      return `${s.title}:\n${val}`;
    });

    return formatted.join('\n\n');
  }

  async function fetchDigimonCardDirect(query, signal) {
    const rawTrimmed = (query || '').trim();
    const tokens = rawTrimmed.split(/\s+/);
    let cardName = rawTrimmed;
    let expansionFilter = '';

    if (tokens.length >= 2) {
      expansionFilter = tokens[tokens.length - 1].toUpperCase();
      cardName = tokens.slice(0, tokens.length - 1).join(' ').trim();
    }

    const cleanCardName = cardName.replace(/^[\d\sxX\-.:]+/, '').trim() || cardName;
    const namesToTry = Array.from(new Set([cleanCardName, cardName].filter(Boolean)));

    for (const nParam of namesToTry) {
      try {
        const res = await fetch(`https://digimoncard.io/api-public/search?n=${encodeURIComponent(nParam)}`, { signal });
        if (!res.ok) continue;
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          let match = null;
          if (expansionFilter) {
            const normExp = expansionFilter.replace(/[^A-Z0-9]/g, '');
            match = list.find(c => {
              const cardNum = (c.cardnumber || c.id || c.card_number || '').toUpperCase();
              const normCardNum = cardNum.replace(/[^A-Z0-9]/g, '');
              return cardNum.startsWith(expansionFilter) ||
                     normCardNum.startsWith(normExp) ||
                     cardNum.replace(/-/g, '').startsWith(normExp) ||
                     cardNum === expansionFilter;
            });
          }

          if (!match) {
            match = list.find(c => c.series === 'Digimon Card Game') || list[0];
          }

          const img = match.image_url || match.imageUrl || (match.id ? `https://images.digimoncard.io/images/cards/${encodeURIComponent(match.id)}.jpg` : null);
          const effects = [];
          if (match.main_effect && match.main_effect.trim()) effects.push(match.main_effect.trim());
          if (match.source_effect && match.source_effect.trim()) effects.push(`[Inherited Effect]\n${match.source_effect.trim()}`);
          if (match.alt_effect && match.alt_effect.trim()) effects.push(match.alt_effect.trim());

          const typeParts = [match.type, match.color, match.level ? `Lv.${match.level}` : '', match.dp ? `${match.dp} DP` : ''].filter(Boolean);

          return {
            imageUrl: img,
            rulesText: effects.join('\n\n'),
            flavorText: match.digi_type ? `Type: ${match.digi_type}${match.attribute ? ` • Attribute: ${match.attribute}` : ''}` : '',
            details: {
              name: match.name,
              cardCode: match.cardnumber || match.id,
              type: typeParts.join(' • '),
              game: 'Digimon Card Game'
            }
          };
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err;
      }
    }
    return null;
  }

  async function handleDeckRowClick(rowText, linkEl) {
    if (activeCardLookupController) {
      activeCardLookupController.abort();
    }
    activeCardLookupController = new AbortController();
    const signal = activeCardLookupController.signal;

    // Highlight clicked row link
    document.querySelectorAll('.deck-row-link.active-card-row, .deck-word-link.active-card-word').forEach(el => {
      el.classList.remove('active-card-row', 'active-card-word');
    });
    if (linkEl) {
      linkEl.classList.add('active-card-row', 'active-card-word');
    }

    const cardName = (rowText || '').trim();

    if (!cardName) {
      if (decklistCardPreviewImg) decklistCardPreviewImg.src = BLACK_IMAGE;
      if (decklistCardInfoText) decklistCardInfoText.textContent = 'Empty row';
      return;
    }

    const isDigimon = normalizedKey.includes('digimon');
    const gameLabel = isDigimon ? 'Digimon' : 'Riftbound';

    if (decklistCardTitleBadge) decklistCardTitleBadge.textContent = cardName.toUpperCase();
    if (decklistCardLoading) decklistCardLoading.style.display = 'flex';
    if (decklistCardInfoText) decklistCardInfoText.textContent = `Searching for "${cardName}" in ${gameLabel}...`;

    try {
      // 1. Query server endpoint for card image
      let res = await fetch(`/api/card-image?name=${encodeURIComponent(cardName)}&game=${encodeURIComponent(isDigimon ? 'digimon' : 'riftbound')}`, { signal });
      let data = res.ok ? await res.json() : null;

      // 2. Direct fallback to Digimon API if needed
      if (isDigimon && (!data || !data.imageUrl)) {
        try {
          const directData = await fetchDigimonCardDirect(cardName, signal);
          if (directData && directData.imageUrl) {
            data = directData;
          }
        } catch (directErr) {
          if (directErr.name === 'AbortError') return;
        }
      }

      if (data && data.imageUrl) {
        if (decklistCardPreviewImg) {
          decklistCardPreviewImg.src = data.imageUrl;
          decklistCardPreviewImg.onerror = () => {
            decklistCardPreviewImg.src = BLACK_IMAGE;
          };
        }
        if (decklistCardInfoText) {
          decklistCardInfoText.textContent = data.details?.name 
            ? `${data.details.name}${data.details.cardCode ? ` (${data.details.cardCode})` : ''}${data.details.type ? ` • ${data.details.type}` : ''}` 
            : `Card: ${cardName}`;
        }
        // Card rules plain text
        const rawRules = data.rulesText || data.details?.rulesText || '';
        if (decklistCardRulesText) {
          if (rawRules) {
            const cleanRules = rawRules
              .replace(/:rb_might:/gi, 'Might')
              .replace(/:rb_energy:/gi, 'Energy')
              .replace(/:rb_power:/gi, 'Power');
            decklistCardRulesText.textContent = cleanRules;
            decklistCardRulesText.style.display = 'block';
            decklistCardRulesText.scrollTop = 0;
          } else {
            decklistCardRulesText.textContent = '';
            decklistCardRulesText.style.display = 'none';
          }
        }
        // Card flavor plain text
        const rawFlavor = data.flavorText || data.details?.flavorText || '';
        if (decklistCardFlavorText) {
          if (rawFlavor) {
            decklistCardFlavorText.textContent = rawFlavor.startsWith('"') ? rawFlavor : `"${rawFlavor}"`;
            decklistCardFlavorText.style.display = 'block';
            decklistCardFlavorText.scrollTop = 0;
          } else {
            decklistCardFlavorText.textContent = '';
            decklistCardFlavorText.style.display = 'none';
          }
        }
      } else {
        // If no card is found, show solid black image
        if (decklistCardPreviewImg) decklistCardPreviewImg.src = BLACK_IMAGE;
        if (decklistCardInfoText) decklistCardInfoText.textContent = `No card found for "${cardName}"`;
        if (decklistCardRulesText) {
          decklistCardRulesText.textContent = '';
          decklistCardRulesText.style.display = 'none';
        }
        if (decklistCardFlavorText) {
          decklistCardFlavorText.textContent = '';
          decklistCardFlavorText.style.display = 'none';
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn(`Error fetching ${gameLabel} card:`, err);
      if (decklistCardPreviewImg) decklistCardPreviewImg.src = BLACK_IMAGE;
      if (decklistCardInfoText) decklistCardInfoText.textContent = 'No card found';
      if (decklistCardRulesText) {
        decklistCardRulesText.textContent = '';
        decklistCardRulesText.style.display = 'none';
      }
      if (decklistCardFlavorText) {
        decklistCardFlavorText.textContent = '';
        decklistCardFlavorText.style.display = 'none';
      }
    } finally {
      if (decklistCardLoading) decklistCardLoading.style.display = 'none';
    }
  }

  function renderInteractiveDecklist(container, deckData) {
    if (!container) return;
    container.innerHTML = '';

    // If any section is empty, mark full deck list as empty and show same message
    if (!isDecklistComplete(deckData)) {
      container.innerHTML = '<div class="decklist-row-line decklist-empty-line">Sin información de Deck List registrada.</div>';
      return;
    }

    const sections = getDecklistSections(deckData);
    sections.forEach(sec => {
      const secVal = (deckData[sec.key] || '').trim();
      const secBlock = document.createElement('div');
      secBlock.className = 'decklist-section-block';

      const secTitle = document.createElement('div');
      secTitle.className = 'decklist-section-title';
      secTitle.textContent = `${sec.title}:`;
      secBlock.appendChild(secTitle);

      const lines = secVal.split(/\r?\n/);
      lines.forEach(rawLine => {
        const line = rawLine.trim();
        if (!line) return;

        const rowEl = document.createElement('div');
        rowEl.className = 'decklist-row-line';

        const isDigi = isDigimonDecklist(deckData);
        const link = document.createElement('a');
        link.href = 'javascript:void(0)';
        link.className = 'deck-row-link deck-word-link';
        link.textContent = line;
        link.title = isDigi ? `Search Digimon card: ${line}` : `Search Riftbound card: ${line}`;
        link.setAttribute('data-card-name', line);

        link.addEventListener('click', (e) => {
          e.preventDefault();
          handleDeckRowClick(line, link);
        });

        rowEl.appendChild(link);
        secBlock.appendChild(rowEl);
      });

      container.appendChild(secBlock);
    });
  }

  function openDecklistView(row, displayRank) {
    if (!decklistViewModalOverlay) return;

    const rank = row.puesto || displayRank || '—';
    const player = row.jugador || 'Jugador';
    const deckName = row.deck || 'Deck';
    const deckData = row.deckList || {};

    decklistViewTitle.textContent = `Deck List • Puesto #${rank}`;
    decklistViewSubtitle.textContent = `${player} — ${deckName}`;

    // Reset preview image to black image
    if (decklistCardPreviewImg) {
      decklistCardPreviewImg.classList.remove('is-rotated');
      decklistCardPreviewImg.src = BLACK_IMAGE;
    }
    if (decklistCardTitleBadge) {
      decklistCardTitleBadge.textContent = 'SELECTED CARD';
    }
    if (decklistCardInfoText) {
      decklistCardInfoText.textContent = 'Click any row to view the card';
    }
    if (decklistCardRulesText) {
      decklistCardRulesText.textContent = '';
      decklistCardRulesText.style.display = 'none';
    }
    if (decklistCardFlavorText) {
      decklistCardFlavorText.textContent = '';
      decklistCardFlavorText.style.display = 'none';
    }
    if (decklistCardLoading) {
      decklistCardLoading.style.display = 'none';
    }

    if (viewDecklistCombinedText) {
      viewDecklistCombinedText.value = formatDecklistText(deckData);
    }

    if (decklistInteractiveContainer) {
      renderInteractiveDecklist(decklistInteractiveContainer, deckData);
    }

    decklistViewModalOverlay.classList.add('active');
  }

  function closeDecklistView() {
    if (activeCardLookupController) {
      activeCardLookupController.abort();
    }
    if (decklistViewModalOverlay) {
      decklistViewModalOverlay.classList.remove('active');
    }
    document.querySelectorAll('.deck-word-link.active-card-word').forEach(el => el.classList.remove('active-card-word'));
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
      const hasDecklist = isDecklistComplete(row.deckList);

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
