document.addEventListener('DOMContentLoaded', () => {
  const tournamentSelect = document.getElementById('tournament-select');

  // Form 1 Elements (Ranking Global)
  const globalRowsBody = document.getElementById('global-rows-body');
  const globalValidationBox = document.getElementById('global-validation-box');
  const globalValidationMessage = document.getElementById('global-validation-message');
  const btnUpdateGlobal = document.getElementById('btn-update-global');

  // Form 2 Elements (Resultados de ultimo torneo)
  const tournamentNameInput = document.getElementById('tournament-name-input');
  const tournamentDateInput = document.getElementById('tournament-date-input');
  const tournamentRowsBody = document.getElementById('tournament-rows-body');
  const btnAddTournamentRow = document.getElementById('btn-add-tournament-row');
  const tournamentValidationBox = document.getElementById('tournament-validation-box');
  const tournamentValidationMessage = document.getElementById('tournament-validation-message');
  const btnUpdateTournament = document.getElementById('btn-update-tournament');

  // Deck List Modal Elements
  const decklistModalOverlay = document.getElementById('decklist-modal-overlay');
  const btnCloseDecklistModal = document.getElementById('btn-close-decklist-modal');
  const btnDecklistSubmit = document.getElementById('btn-decklist-submit');
  const decklistModalTitle = document.getElementById('decklist-modal-title');
  const decklistModalSubtitle = document.getElementById('decklist-modal-subtitle');

  // Modal Inputs
  const inputLegend = document.getElementById('decklist-legend');
  const inputChampion = document.getElementById('decklist-champion');
  const inputBattlefields = document.getElementById('decklist-battlefields');
  const inputRunes = document.getElementById('decklist-runes');
  const inputUnits = document.getElementById('decklist-units');
  const inputSpells = document.getElementById('decklist-spells');
  const inputGears = document.getElementById('decklist-gears');
  const inputSideboard = document.getElementById('decklist-sideboard');

  // State to track decklists per section and row index
  let globalDecklists = {};
  let tournamentDecklists = [];
  let currentModalTarget = null; // { section: 'global' | 'tournament', index: number }

  const DEFAULT_GLOBAL = [
    { puesto: '1', jugador: 'angel', deck: 'Nasus', puntos: '10' },
    { puesto: '2', jugador: 'Pedro', deck: 'Teemo', puntos: '8' },
    { puesto: '3', jugador: 'Marco', deck: "Kai'sa", puntos: '5' },
    { puesto: '4', jugador: 'Sofia', deck: 'Jinx', puntos: '4' }
  ];

  function extractNumber(val, defaultVal = '1') {
    if (val === null || val === undefined) return defaultVal;
    const match = val.toString().match(/\d+/);
    return match ? match[0] : defaultVal;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Real-time input listeners to dismiss validation box on edit
  if (tournamentNameInput) {
    tournamentNameInput.addEventListener('input', () => {
      tournamentValidationBox.style.display = 'none';
    });
  }
  if (tournamentDateInput) {
    tournamentDateInput.addEventListener('input', () => {
      tournamentValidationBox.style.display = 'none';
    });
  }

  // ============================================================
  // DECK LIST MODAL MANAGEMENT
  // ============================================================
  function openDecklistModal(section, index, playerName = '') {
    currentModalTarget = { section, index };

    const rankNumber = index + 1;
    decklistModalTitle.textContent = `Deck List • Puesto #${rankNumber}`;
    decklistModalSubtitle.textContent = playerName ? `Jugador: ${playerName}` : 'Registro de baraja del jugador';

    // Retrieve saved decklist data if exists
    let data = {};
    if (section === 'global') {
      data = globalDecklists[index] || {};
    } else {
      data = tournamentDecklists[index] || {};
    }

    inputLegend.value = data.legend || '';
    inputChampion.value = data.champion || '';
    inputBattlefields.value = data.battlefields || '';
    inputRunes.value = data.runes || '';
    inputUnits.value = data.units || '';
    inputSpells.value = data.spells || '';
    inputGears.value = data.gears || '';
    inputSideboard.value = data.sideboard || '';

    decklistModalOverlay.classList.add('active');
    inputLegend.focus();
  }

  function closeDecklistModal() {
    decklistModalOverlay.classList.remove('active');
    currentModalTarget = null;
  }

  // "Enviar" button only closes the modal and saves the in-memory decklist for that row
  btnDecklistSubmit.addEventListener('click', () => {
    if (currentModalTarget) {
      const { section, index } = currentModalTarget;
      const decklistData = {
        legend: inputLegend.value.trim(),
        champion: inputChampion.value.trim(),
        battlefields: inputBattlefields.value,
        runes: inputRunes.value,
        units: inputUnits.value,
        spells: inputSpells.value,
        gears: inputGears.value,
        sideboard: inputSideboard.value
      };

      const hasAnyContent = Object.values(decklistData).some(v => v && v.trim().length > 0);

      if (section === 'global') {
        globalDecklists[index] = decklistData;
        const btn = globalRowsBody.querySelector(`.btn-decklist[data-index="${index}"]`);
        if (btn) btn.classList.toggle('has-data', hasAnyContent);
      } else {
        tournamentDecklists[index] = decklistData;
        const rows = tournamentRowsBody.querySelectorAll('.tournament-data-row');
        if (rows[index]) {
          const btn = rows[index].querySelector('.btn-decklist');
          if (btn) btn.classList.toggle('has-data', hasAnyContent);
        }
      }
    }

    closeDecklistModal();
  });

  btnCloseDecklistModal.addEventListener('click', closeDecklistModal);

  decklistModalOverlay.addEventListener('click', (e) => {
    if (e.target === decklistModalOverlay) {
      closeDecklistModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && decklistModalOverlay.classList.contains('active')) {
      closeDecklistModal();
    }
  });

  // ============================================================
  // FORM 1: RANKING GLOBAL (4 FIXED ROWS, AUTO-INCREMENTAL PUESTO)
  // ============================================================
  function renderGlobalRows(rowsData) {
    globalRowsBody.innerHTML = '';
    globalDecklists = {};

    for (let i = 0; i < 4; i++) {
      const data = rowsData[i] || DEFAULT_GLOBAL[i] || { puesto: (i + 1).toString(), jugador: '', deck: '', puntos: '10' };
      const tr = document.createElement('tr');

      const rankNumber = (i + 1).toString(); // Auto-incremental, starting at 1
      const puntosNum = extractNumber(data.puntos, '10');

      if (data.deckList) {
        globalDecklists[i] = data.deckList;
      }
      const hasDecklist = globalDecklists[i] && Object.values(globalDecklists[i]).some(v => v && v.trim().length > 0);

      tr.innerHTML = `
        <td>
          <input type="text" 
                 class="row-input input-puesto readonly-puesto global-field-puesto" 
                 value="${rankNumber}"
                 readonly
                 tabindex="-1"
                 data-index="${i}" 
                 title="Puesto ${rankNumber} (no editable)">
        </td>
        <td>
          <input type="text" 
                 class="row-input input-jugador global-field-jugador" 
                 minlength="1" 
                 maxlength="30" 
                 required 
                 placeholder="Nombre del jugador" 
                 data-index="${i}" 
                 value="${escapeHtml(data.jugador || '')}"
                 title="Jugador (1 a 30 caracteres)">
        </td>
        <td>
          <input type="text" 
                 class="row-input input-deck global-field-deck" 
                 minlength="1" 
                 maxlength="40" 
                 required 
                 placeholder="Nombre del deck / mazo" 
                 data-index="${i}" 
                 value="${escapeHtml(data.deck || '')}"
                 title="Deck (1 a 40 caracteres)">
        </td>
        <td>
          <input type="number" 
                 class="row-input input-puntos global-field-puntos" 
                 min="1" 
                 max="1000" 
                 step="1" 
                 required 
                 placeholder="Puntos" 
                 data-index="${i}" 
                 value="${escapeHtml(puntosNum)}"
                 title="Puntos (entero entre 1 y 1000)">
        </td>
        <td style="text-align: center;">
          <button type="button" 
                  class="btn-decklist ${hasDecklist ? 'has-data' : ''}" 
                  data-section="global" 
                  data-index="${i}" 
                  title="Cargar Deck List para el puesto #${rankNumber}">
            Cargar
          </button>
        </td>
      `;

      tr.querySelector('.btn-decklist').addEventListener('click', () => {
        const playerName = tr.querySelector('.global-field-jugador').value.trim();
        openDecklistModal('global', i, playerName);
      });

      globalRowsBody.appendChild(tr);
    }

    globalRowsBody.querySelectorAll('.row-input:not(.readonly-puesto)').forEach(input => {
      input.addEventListener('input', () => {
        globalValidationBox.style.display = 'none';
      });
    });
  }

  function validateGlobalRows() {
    for (let i = 0; i < 4; i++) {
      const jugadorInput = globalRowsBody.querySelector(`.global-field-jugador[data-index="${i}"]`);
      const deckInput = globalRowsBody.querySelector(`.global-field-deck[data-index="${i}"]`);
      const puntosInput = globalRowsBody.querySelector(`.global-field-puntos[data-index="${i}"]`);

      const jugadorVal = jugadorInput.value.trim();
      if (jugadorVal.length < 1 || jugadorVal.length > 30) {
        jugadorInput.focus();
        return { valid: false, error: `Ranking Global - Fila ${i + 1}: El nombre del jugador debe tener entre 1 y 30 caracteres.` };
      }

      const deckVal = deckInput.value.trim();
      if (deckVal.length < 1 || deckVal.length > 40) {
        deckInput.focus();
        return { valid: false, error: `Ranking Global - Fila ${i + 1}: El nombre del deck debe tener entre 1 y 40 caracteres.` };
      }

      const puntosVal = parseInt(puntosInput.value, 10);
      if (isNaN(puntosVal) || puntosVal < 1 || puntosVal > 1000) {
        puntosInput.focus();
        return { valid: false, error: `Ranking Global - Fila ${i + 1}: Los puntos deben ser un número entero entre 1 y 1000.` };
      }
    }

    return { valid: true };
  }

  btnUpdateGlobal.addEventListener('click', async () => {
    const val = validateGlobalRows();
    if (!val.valid) {
      showBoxError(globalValidationBox, globalValidationMessage, val.error);
      return;
    }

    const selectedGame = tournamentSelect.value;
    const normalizedKey = selectedGame.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    btnUpdateGlobal.disabled = true;
    btnUpdateGlobal.innerHTML = spinnerHtml('Actualizando...');

    const rows = [];
    for (let i = 0; i < 4; i++) {
      const puestoVal = (i + 1).toString();
      const jugadorVal = globalRowsBody.querySelector(`.global-field-jugador[data-index="${i}"]`).value.trim();
      const deckVal = globalRowsBody.querySelector(`.global-field-deck[data-index="${i}"]`).value.trim();
      const puntosVal = globalRowsBody.querySelector(`.global-field-puntos[data-index="${i}"]`).value.trim();

      const rowObj = {
        puesto: puestoVal,
        jugador: jugadorVal,
        deck: deckVal,
        puntos: `${puntosVal} Pts`
      };

      if (globalDecklists[i]) {
        rowObj.deckList = globalDecklists[i];
      }

      rows.push(rowObj);
    }

    const payload = { gameKey: selectedGame, results: rows };

    try {
      await fetch('/api/tournament/upload-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      localStorage.setItem(`canelistico_global_${normalizedKey}`, JSON.stringify(payload));
      showBoxSuccess(globalValidationBox, globalValidationMessage, selectedGame, 'Ranking Global');
    } catch (err) {
      console.error(err);
      localStorage.setItem(`canelistico_global_${normalizedKey}`, JSON.stringify(payload));
      showBoxSuccess(globalValidationBox, globalValidationMessage, selectedGame + ' (local)', 'Ranking Global');
    } finally {
      btnUpdateGlobal.disabled = false;
      btnUpdateGlobal.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 2v6h-6"></path>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
          <path d="M3 22v-6h6"></path>
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
        </svg>
        Actualizar
      `;
    }
  });

  // ============================================================
  // FORM 2: RESULTADOS DE ULTIMO TORNEO (DYNAMIC ROWS & AUTO-INCREMENTAL PUESTO)
  // ============================================================
  function createTournamentRow(data = {}, rowIndex = 0) {
    const tr = document.createElement('tr');
    tr.className = 'tournament-data-row';

    const rankNumber = (rowIndex + 1).toString(); // Auto-incremental, starting at 1
    const puntosNum = extractNumber(data.puntos, '10');

    if (data.deckList) {
      tournamentDecklists[rowIndex] = data.deckList;
    }
    const hasDecklist = tournamentDecklists[rowIndex] && Object.values(tournamentDecklists[rowIndex]).some(v => v && v.trim().length > 0);

    tr.innerHTML = `
      <td>
        <input type="text" 
               class="row-input input-puesto readonly-puesto tourney-field-puesto" 
               value="${rankNumber}"
               readonly
               tabindex="-1"
               title="Puesto ${rankNumber} (no editable)">
      </td>
      <td>
        <input type="text" 
               class="row-input input-jugador tourney-field-jugador" 
               minlength="1" 
               maxlength="30" 
               required 
               placeholder="Nombre del jugador" 
               value="${escapeHtml(data.jugador || '')}"
               title="Jugador (1 a 30 caracteres)">
      </td>
      <td>
        <input type="text" 
               class="row-input input-deck tourney-field-deck" 
               minlength="1" 
               maxlength="40" 
               required 
               placeholder="Nombre del deck / mazo" 
               value="${escapeHtml(data.deck || '')}"
               title="Deck (1 a 40 caracteres)">
      </td>
      <td>
        <input type="number" 
               class="row-input input-puntos tourney-field-puntos" 
               min="1" 
               max="1000" 
               step="1" 
               required 
               placeholder="Puntos" 
               value="${escapeHtml(puntosNum)}"
               title="Puntos (entero entre 1 y 1000)">
      </td>
      <td style="text-align: center;">
        <button type="button" 
                class="btn-decklist ${hasDecklist ? 'has-data' : ''}" 
                title="Cargar Deck List para este jugador">
          Cargar
        </button>
      </td>
      <td style="text-align: center;">
        <button type="button" class="btn-remove-row" title="Eliminar fila">&times;</button>
      </td>
    `;

    tr.querySelector('.btn-decklist').addEventListener('click', () => {
      const currentRowIdx = Array.from(tournamentRowsBody.querySelectorAll('.tournament-data-row')).indexOf(tr);
      const playerName = tr.querySelector('.tourney-field-jugador').value.trim();
      openDecklistModal('tournament', currentRowIdx, playerName);
    });

    tr.querySelector('.btn-remove-row').addEventListener('click', () => {
      const allRows = tournamentRowsBody.querySelectorAll('.tournament-data-row');
      const currentRowIdx = Array.from(allRows).indexOf(tr);
      if (allRows.length > 1) {
        tr.remove();
        tournamentDecklists.splice(currentRowIdx, 1);
        reindexTournamentRows();
      } else {
        // Clear the single remaining row
        tr.querySelector('.tourney-field-jugador').value = '';
        tr.querySelector('.tourney-field-deck').value = '';
        tr.querySelector('.tourney-field-puntos').value = '10';
        tournamentDecklists[0] = {};
        const btn = tr.querySelector('.btn-decklist');
        if (btn) btn.classList.remove('has-data');
      }
      tournamentValidationBox.style.display = 'none';
    });

    tr.querySelectorAll('.row-input:not(.readonly-puesto)').forEach(input => {
      input.addEventListener('input', () => {
        tournamentValidationBox.style.display = 'none';
      });
    });

    return tr;
  }

  // Ensure "Puesto" is auto-incremental (1, 2, 3...)
  function reindexTournamentRows() {
    const rows = tournamentRowsBody.querySelectorAll('.tournament-data-row');
    rows.forEach((r, idx) => {
      const rankNumber = (idx + 1).toString();
      const puestoInput = r.querySelector('.tourney-field-puesto');
      if (puestoInput) {
        puestoInput.value = rankNumber;
        puestoInput.title = `Puesto ${rankNumber} (no editable)`;
      }
    });
  }

  function renderTournamentRows(rowsData) {
    tournamentRowsBody.innerHTML = '';
    tournamentDecklists = [];

    const initialRows = (rowsData && rowsData.length > 0) ? rowsData : [{ puesto: '1', jugador: '', deck: '', puntos: '10' }];

    initialRows.forEach((row, i) => {
      const tr = createTournamentRow(row, i);
      tournamentRowsBody.appendChild(tr);
    });

    reindexTournamentRows();
  }

  btnAddTournamentRow.addEventListener('click', () => {
    const currentCount = tournamentRowsBody.querySelectorAll('.tournament-data-row').length;
    const newTr = createTournamentRow({ jugador: '', deck: '', puntos: '10' }, currentCount);
    tournamentRowsBody.appendChild(newTr);
    reindexTournamentRows();
    newTr.querySelector('.tourney-field-jugador').focus();
    tournamentValidationBox.style.display = 'none';
  });

  function validateTournamentForm() {
    // 1. Validate Tournament Name
    const tournamentNameVal = tournamentNameInput ? tournamentNameInput.value.trim() : '';
    if (tournamentNameVal.length < 1 || tournamentNameVal.length > 100) {
      if (tournamentNameInput) tournamentNameInput.focus();
      return { valid: false, error: 'Nombre de torneo: debe tener entre 1 y 100 caracteres.' };
    }

    // 2. Validate Tournament Date
    const tournamentDateVal = tournamentDateInput ? tournamentDateInput.value.trim() : '';
    if (tournamentDateVal.length < 1 || tournamentDateVal.length > 15) {
      if (tournamentDateInput) tournamentDateInput.focus();
      return { valid: false, error: 'Fecha de torneo: debe tener entre 1 y 15 caracteres.' };
    }

    // 3. Validate Rows
    const rows = tournamentRowsBody.querySelectorAll('.tournament-data-row');
    if (rows.length === 0) {
      return { valid: false, error: 'Debe ingresar al menos una fila de resultados.' };
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const jugadorInput = r.querySelector('.tourney-field-jugador');
      const deckInput = r.querySelector('.tourney-field-deck');
      const puntosInput = r.querySelector('.tourney-field-puntos');

      const jugadorVal = jugadorInput.value.trim();
      if (jugadorVal.length < 1 || jugadorVal.length > 30) {
        jugadorInput.focus();
        return { valid: false, error: `Resultados Torneo - Fila ${i + 1}: El nombre del jugador debe tener entre 1 y 30 caracteres.` };
      }

      const deckVal = deckInput.value.trim();
      if (deckVal.length < 1 || deckVal.length > 40) {
        deckInput.focus();
        return { valid: false, error: `Resultados Torneo - Fila ${i + 1}: El nombre del deck debe tener entre 1 y 40 caracteres.` };
      }

      const puntosVal = parseInt(puntosInput.value, 10);
      if (isNaN(puntosVal) || puntosVal < 1 || puntosVal > 1000) {
        puntosInput.focus();
        return { valid: false, error: `Resultados Torneo - Fila ${i + 1}: Los puntos deben ser un número entero entre 1 y 1000.` };
      }
    }

    return { 
      valid: true, 
      title: tournamentNameVal, 
      date: tournamentDateVal 
    };
  }

  btnUpdateTournament.addEventListener('click', async () => {
    const val = validateTournamentForm();
    if (!val.valid) {
      showBoxError(tournamentValidationBox, tournamentValidationMessage, val.error);
      return;
    }

    const selectedGame = tournamentSelect.value;
    const normalizedKey = selectedGame.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    btnUpdateTournament.disabled = true;
    btnUpdateTournament.innerHTML = spinnerHtml('Actualizando Torneo...');

    const rows = [];
    const domRows = tournamentRowsBody.querySelectorAll('.tournament-data-row');
    domRows.forEach((r, idx) => {
      const puestoVal = (idx + 1).toString();
      const jugadorVal = r.querySelector('.tourney-field-jugador').value.trim();
      const deckVal = r.querySelector('.tourney-field-deck').value.trim();
      const puntosVal = r.querySelector('.tourney-field-puntos').value.trim();

      const rowObj = {
        puesto: puestoVal,
        jugador: jugadorVal,
        deck: deckVal,
        puntos: `${puntosVal} Pts`
      };

      if (tournamentDecklists[idx]) {
        rowObj.deckList = tournamentDecklists[idx];
      }

      rows.push(rowObj);
    });

    const payload = { 
      gameKey: selectedGame, 
      title: val.title,
      date: val.date,
      results: rows 
    };

    try {
      await fetch('/api/tournament/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      localStorage.setItem(`canelistico_${normalizedKey}`, JSON.stringify(payload));
      showBoxSuccess(tournamentValidationBox, tournamentValidationMessage, selectedGame, 'Resultados de Torneo');
    } catch (err) {
      console.error(err);
      localStorage.setItem(`canelistico_${normalizedKey}`, JSON.stringify(payload));
      showBoxSuccess(tournamentValidationBox, tournamentValidationMessage, selectedGame + ' (local)', 'Resultados de Torneo');
    } finally {
      btnUpdateTournament.disabled = false;
      btnUpdateTournament.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 2v6h-6"></path>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
          <path d="M3 22v-6h6"></path>
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
        </svg>
        Actualizar Torneo
      `;
    }
  });

  // ============================================================
  // DATA LOADER & DROPDOWN HANDLER
  // ============================================================
  async function loadAllDataForSelectedGame(gameName) {
    const normalizedKey = gameName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let globalRows = [...DEFAULT_GLOBAL];
    let tournamentRows = [];
    let tourneyTitle = gameName;
    let tourneyDate = 'Octubre 2026';

    try {
      const res = await fetch(`/api/tournament/${encodeURIComponent(normalizedKey)}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          if (data.game) {
            tourneyTitle = data.game.title || gameName;
            tourneyDate = data.game.date || data.game.subtitle || 'Octubre 2026';
          }
          if (Array.isArray(data.globalRanking) && data.globalRanking.length > 0) {
            globalRows = data.globalRanking;
          }
          if (Array.isArray(data.results) && data.results.length > 0) {
            tournamentRows = data.results;
          }
        }
      }
    } catch (e) {
      console.warn('API lookup failed, checking localStorage fallback...', e);
    }

    // Check localStorage cache
    try {
      const cachedGlobal = localStorage.getItem(`canelistico_global_${normalizedKey}`);
      if (cachedGlobal) {
        const parsed = JSON.parse(cachedGlobal);
        if (parsed && Array.isArray(parsed.results) && parsed.results.length > 0) {
          globalRows = parsed.results;
        }
      }
    } catch (e) {}

    try {
      const cachedTourney = localStorage.getItem(`canelistico_${normalizedKey}`);
      if (cachedTourney) {
        const parsed = JSON.parse(cachedTourney);
        if (parsed.title) tourneyTitle = parsed.title;
        if (parsed.date) tourneyDate = parsed.date;
        if (parsed && Array.isArray(parsed.results) && parsed.results.length > 0) {
          tournamentRows = parsed.results;
        }
      }
    } catch (e) {}

    // Populate title & date inputs
    if (tournamentNameInput) {
      tournamentNameInput.value = tourneyTitle;
    }
    if (tournamentDateInput) {
      tournamentDateInput.value = tourneyDate;
    }

    renderGlobalRows(globalRows);
    renderTournamentRows(tournamentRows);

    globalValidationBox.style.display = 'none';
    tournamentValidationBox.style.display = 'none';
  }

  function showBoxError(boxEl, msgEl, errorMsg) {
    boxEl.className = 'validation-box error';
    boxEl.style.display = 'flex';
    msgEl.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span><strong>Error:</strong> ${errorMsg}</span>
    `;
  }

  function showBoxSuccess(boxEl, msgEl, gameName, sectionLabel) {
    boxEl.className = 'validation-box success';
    boxEl.style.display = 'flex';
    msgEl.innerHTML = `
      <div class="preview-header">🎉 ¡${sectionLabel} actualizado exitosamente para ${gameName}!</div>
      <div class="preview-detail" style="margin-top: 6px;">
        <a href="tournament.html?game=${encodeURIComponent(gameName)}" style="color: #38bdf8; font-weight: 700; text-decoration: underline;">
          👉 Ver tabla de ${gameName}
        </a>
      </div>
    `;
  }

  function spinnerHtml(text) {
    return `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin">
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        <line x1="2" y1="12" x2="6" y2="12"></line>
        <line x1="18" y1="12" x2="22" y2="12"></line>
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
      </svg>
      ${text}
    `;
  }

  // Handle tournament dropdown changes
  tournamentSelect.addEventListener('change', () => {
    loadAllDataForSelectedGame(tournamentSelect.value);
  });

  // Initial load
  loadAllDataForSelectedGame(tournamentSelect.value);
});
