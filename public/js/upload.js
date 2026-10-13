document.addEventListener('DOMContentLoaded', () => {
  const tournamentSelect = document.getElementById('tournament-select');

  // Form 0 Elements (Registro de Jugadores)
  const playerNicknameInput = document.getElementById('player-nickname');
  const playerNombreInput = document.getElementById('player-nombre');
  const playerCorreoInput = document.getElementById('player-correo');
  const playerTcgInput = document.getElementById('player-tcg');
  const playerPuntosInput = document.getElementById('player-puntos');
  const btnAddPlayer = document.getElementById('btn-add-player');
  const playerValidationBox = document.getElementById('player-validation-box');
  const playerValidationMessage = document.getElementById('player-validation-message');

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

  // Modal Inputs (Standard)
  const inputLegend = document.getElementById('decklist-legend');
  const inputChampion = document.getElementById('decklist-champion');
  const inputBattlefields = document.getElementById('decklist-battlefields');
  const inputRunes = document.getElementById('decklist-runes');
  const inputUnits = document.getElementById('decklist-units');
  const inputSpells = document.getElementById('decklist-spells');
  const inputGears = document.getElementById('decklist-gears');
  const inputSideboard = document.getElementById('decklist-sideboard');

  // Modal Inputs & Containers (Digimon specific)
  const decklistFieldsStandard = document.getElementById('decklist-fields-standard');
  const decklistFieldsDigimon = document.getElementById('decklist-fields-digimon');
  const inputDigiEggs = document.getElementById('decklist-digi-eggs');
  const inputDigimon = document.getElementById('decklist-digimon');
  const decklistDigiEggsHint = document.getElementById('decklist-digi-eggs-hint');
  const decklistDigimonHint = document.getElementById('decklist-digimon-hint');
  const decklistModalValidation = document.getElementById('decklist-modal-validation');
  const decklistModalValidationText = document.getElementById('decklist-modal-validation-text');

  // State to track decklists per section and row index
  let globalDecklists = {};
  let tournamentDecklists = [];
  let currentModalTarget = null; // { section: 'global' | 'tournament', index: number }

  function isDecklistComplete(decklistData, gameName = '') {
    if (!decklistData || typeof decklistData !== 'object') return false;
    const currentGame = (gameName || (tournamentSelect ? tournamentSelect.value : '')).toLowerCase();
    const isDigimon = currentGame ? currentGame.includes('digimon') : (Boolean(decklistData.digieggs) || Boolean(decklistData.digimon));

    if (isDigimon) {
      const eggs = (decklistData.digieggs || decklistData.digiEggs || '').trim();
      const mon = (decklistData.digimon || '').trim();
      return eggs.length > 0 && mon.length > 0;
    }

    const sections = ['legend', 'champion', 'battlefields', 'runes', 'units', 'spells', 'gears', 'sideboard'];
    return sections.every(k => decklistData[k] && typeof decklistData[k] === 'string' && decklistData[k].trim().length > 0);
  }

  function setupTextareaLimits(textarea, maxRows, maxChars, hintEl) {
    if (!textarea) return () => {};

    function enforce() {
      let val = textarea.value;
      let lines = val.split(/\r?\n/);

      if (lines.length > maxRows) {
        lines = lines.slice(0, maxRows);
      }

      lines = lines.map(line => line.length > maxChars ? line.slice(0, maxChars) : line);

      const updated = lines.join('\n');
      if (textarea.value !== updated) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = updated;
        try {
          textarea.setSelectionRange(Math.min(start, updated.length), Math.min(end, updated.length));
        } catch (_) {}
      }

      const filled = lines.filter(l => l.trim().length > 0).length;
      if (hintEl) {
        hintEl.textContent = `${filled}/${maxRows} filas • máx. ${maxChars} car./fila`;
        if (filled >= maxRows) {
          hintEl.style.color = '#f59e0b';
        } else {
          hintEl.style.color = 'var(--text-muted)';
        }
      }
    }

    textarea.addEventListener('input', enforce);
    textarea.addEventListener('keydown', (e) => {
      const lines = textarea.value.split(/\r?\n/);
      if (e.key === 'Enter' && lines.length >= maxRows) {
        e.preventDefault();
      }
    });

    return enforce;
  }

  const updateDigiEggsLimits = setupTextareaLimits(inputDigiEggs, 5, 50, decklistDigiEggsHint);
  const updateDigimonLimits = setupTextareaLimits(inputDigimon, 50, 50, decklistDigimonHint);

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
  if (playerValidationBox) {
    [playerNicknameInput, playerNombreInput, playerCorreoInput, playerPuntosInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('input', () => {
          playerValidationBox.style.display = 'none';
        });
      }
    });
  }

  if (btnAddPlayer) {
    btnAddPlayer.addEventListener('click', async () => {
      const nickname = (playerNicknameInput ? playerNicknameInput.value : '').trim();
      const nombre = (playerNombreInput ? playerNombreInput.value : '').trim();
      const correo = (playerCorreoInput ? playerCorreoInput.value : '').trim();
      const tcg = (playerTcgInput ? playerTcgInput.value : (tournamentSelect ? tournamentSelect.value : 'Riftbound')).trim();
      const puntosStr = (playerPuntosInput ? playerPuntosInput.value : '0').trim();

      // Validations
      if (!nickname) {
        showBoxError(playerValidationBox, playerValidationMessage, 'Por favor ingresa un Nickname.');
        if (playerNicknameInput) playerNicknameInput.focus();
        return;
      }
      if (nickname.length > 64) {
        showBoxError(playerValidationBox, playerValidationMessage, 'El Nickname no puede superar los 64 caracteres.');
        if (playerNicknameInput) playerNicknameInput.focus();
        return;
      }

      if (!nombre) {
        showBoxError(playerValidationBox, playerValidationMessage, 'Por favor ingresa un Nombre.');
        if (playerNombreInput) playerNombreInput.focus();
        return;
      }
      if (nombre.length > 64) {
        showBoxError(playerValidationBox, playerValidationMessage, 'El Nombre no puede superar los 64 caracteres.');
        if (playerNombreInput) playerNombreInput.focus();
        return;
      }

      if (!correo) {
        showBoxError(playerValidationBox, playerValidationMessage, 'Por favor ingresa un Correo electrónico.');
        if (playerCorreoInput) playerCorreoInput.focus();
        return;
      }
      if (correo.length > 64) {
        showBoxError(playerValidationBox, playerValidationMessage, 'El Correo no puede superar los 64 caracteres.');
        if (playerCorreoInput) playerCorreoInput.focus();
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(correo)) {
        showBoxError(playerValidationBox, playerValidationMessage, 'Por favor ingresa un formato de correo válido (ejemplo: usuario@correo.com).');
        if (playerCorreoInput) playerCorreoInput.focus();
        return;
      }

      const puntos = parseInt(puntosStr, 10);
      if (isNaN(puntos) || puntos < 0 || puntos > 1000) {
        showBoxError(playerValidationBox, playerValidationMessage, 'Puntos debe ser un número entero entre 0 y 1000.');
        if (playerPuntosInput) playerPuntosInput.focus();
        return;
      }

      btnAddPlayer.disabled = true;
      btnAddPlayer.innerHTML = spinnerHtml('Agregando...');

      try {
        const response = await fetch('/api/player/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nickname, nombre, correo, tcg, puntos })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          showBoxError(playerValidationBox, playerValidationMessage, data.error || 'El usuario ya existe con este Nickname.');
          return;
        }

        // Success
        playerValidationBox.className = 'validation-box success';
        playerValidationBox.style.display = 'flex';
        playerValidationMessage.innerHTML = `
          <div class="preview-header">🎉 ¡Jugador "${escapeHtml(nickname)}" registrado exitosamente!</div>
          <div class="preview-detail" style="margin-top: 4px;">Nombre: ${escapeHtml(nombre)} &bull; Correo: ${escapeHtml(correo)} &bull; TCG: ${escapeHtml(tcg)} &bull; Puntos: ${puntos}</div>
        `;

        // Refresh registered players table
        loadRegisteredPlayers(tournamentSelect ? tournamentSelect.value : tcg);

        // Reset inputs
        if (playerNicknameInput) playerNicknameInput.value = '';
        if (playerNombreInput) playerNombreInput.value = '';
        if (playerCorreoInput) playerCorreoInput.value = '';
        if (playerPuntosInput) playerPuntosInput.value = '0';
        if (playerNicknameInput) playerNicknameInput.focus();

      } catch (err) {
        console.error('Error adding player:', err);
        showBoxError(playerValidationBox, playerValidationMessage, 'Error de conexión con el servidor al registrar el jugador.');
      } finally {
        btnAddPlayer.disabled = false;
        btnAddPlayer.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
          </svg>
          Agregar Jugador
        `;
      }
    });
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

    if (decklistModalValidation) {
      decklistModalValidation.style.display = 'none';
    }

    // Retrieve saved decklist data if exists
    let data = {};
    if (section === 'global') {
      data = globalDecklists[index] || {};
    } else {
      data = tournamentDecklists[index] || {};
    }

    const currentGame = (tournamentSelect ? tournamentSelect.value : '').toLowerCase();
    const isDigimon = currentGame.includes('digimon');

    if (isDigimon) {
      if (decklistFieldsStandard) decklistFieldsStandard.style.display = 'none';
      if (decklistFieldsDigimon) decklistFieldsDigimon.style.display = 'flex';

      if (inputDigiEggs) {
        inputDigiEggs.value = data.digieggs || data.digiEggs || '';
        updateDigiEggsLimits();
      }
      if (inputDigimon) {
        inputDigimon.value = data.digimon || '';
        updateDigimonLimits();
      }
      decklistModalOverlay.classList.add('active');
      if (inputDigiEggs) inputDigiEggs.focus();
    } else {
      if (decklistFieldsStandard) decklistFieldsStandard.style.display = 'block';
      if (decklistFieldsDigimon) decklistFieldsDigimon.style.display = 'none';

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
  }

  function closeDecklistModal() {
    decklistModalOverlay.classList.remove('active');
    currentModalTarget = null;
    if (decklistModalValidation) {
      decklistModalValidation.style.display = 'none';
    }
  }

  // "Enviar" button only closes the modal and saves the in-memory decklist for that row
  btnDecklistSubmit.addEventListener('click', () => {
    if (currentModalTarget) {
      const { section, index } = currentModalTarget;
      const currentGame = (tournamentSelect ? tournamentSelect.value : '').toLowerCase();
      const isDigimon = currentGame.includes('digimon');
      let decklistData = {};

      if (isDigimon) {
        const eggsRaw = (inputDigiEggs ? inputDigiEggs.value : '').trim();
        const digimonRaw = (inputDigimon ? inputDigimon.value : '').trim();

        const eggsLines = eggsRaw ? eggsRaw.split(/\r?\n/) : [];
        const digimonLines = digimonRaw ? digimonRaw.split(/\r?\n/) : [];

        if (eggsLines.length > 5) {
          if (decklistModalValidation && decklistModalValidationText) {
            decklistModalValidationText.textContent = 'Digi-eggs no puede tener más de 5 filas.';
            decklistModalValidation.style.display = 'flex';
          }
          if (inputDigiEggs) inputDigiEggs.focus();
          return;
        }

        const longEgg = eggsLines.find(l => l.length > 50);
        if (longEgg) {
          if (decklistModalValidation && decklistModalValidationText) {
            decklistModalValidationText.textContent = `La fila "${longEgg.slice(0, 25)}..." supera los 50 caracteres permitidos.`;
            decklistModalValidation.style.display = 'flex';
          }
          if (inputDigiEggs) inputDigiEggs.focus();
          return;
        }

        if (digimonLines.length > 50) {
          if (decklistModalValidation && decklistModalValidationText) {
            decklistModalValidationText.textContent = 'Digimon no puede tener más de 50 filas.';
            decklistModalValidation.style.display = 'flex';
          }
          if (inputDigimon) inputDigimon.focus();
          return;
        }

        const longDigimon = digimonLines.find(l => l.length > 50);
        if (longDigimon) {
          if (decklistModalValidation && decklistModalValidationText) {
            decklistModalValidationText.textContent = `La fila "${longDigimon.slice(0, 25)}..." supera los 50 caracteres permitidos.`;
            decklistModalValidation.style.display = 'flex';
          }
          if (inputDigimon) inputDigimon.focus();
          return;
        }

        decklistData = {
          digieggs: eggsRaw,
          digimon: digimonRaw
        };
      } else {
        decklistData = {
          legend: inputLegend.value.trim(),
          champion: inputChampion.value.trim(),
          battlefields: inputBattlefields.value,
          runes: inputRunes.value,
          units: inputUnits.value,
          spells: inputSpells.value,
          gears: inputGears.value,
          sideboard: inputSideboard.value
        };
      }

      const isComplete = isDecklistComplete(decklistData, currentGame);
      const hasAnyContent = isComplete;

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
    const hasDecklist = isDecklistComplete(tournamentDecklists[rowIndex]);

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
          if (Array.isArray(data.results) && data.results.length > 0) {
            tournamentRows = data.results;
          }
        }
      }
    } catch (e) {
      console.warn('API lookup failed, checking localStorage fallback...', e);
    }

    // Check localStorage cache for tournament results fallback
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

    renderTournamentRows(tournamentRows);
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

  // ── Registered Players Table (paginated max 5, editable puntos, delete, filter) ──
  const PLAYERS_PAGE_SIZE = 5;
  // Full list for the selected TCG. `id` is kept here only (never rendered in the DOM).
  let playersState = [];
  let playersCurrentPage = 1;
  let playersCurrentTcg = '';
  let playersSearchQuery = '';
  let pendingDeletePlayer = null;

  const playersTableBody = document.getElementById('players-table-body');
  const playersPagination = document.getElementById('players-pagination');
  const playersSearchInput = document.getElementById('players-search-input');
  const playersTableValidationBox = document.getElementById('players-table-validation-box');
  const playersTableValidationMessage = document.getElementById('players-table-validation-message');
  const btnUpdatePlayers = document.getElementById('btn-update-players');
  const btnResetPoints = document.getElementById('btn-reset-points');
  const btnExportPlayers = document.getElementById('btn-export-players');
  const deletePlayerModal = document.getElementById('delete-player-modal-overlay');
  const deletePlayerModalDetail = document.getElementById('delete-player-modal-detail');
  const btnConfirmDeletePlayer = document.getElementById('btn-confirm-delete-player');
  const btnCloseDeletePlayerModal = document.getElementById('btn-close-delete-player-modal');

  const resetPointsModal = document.getElementById('reset-points-modal-overlay');
  const resetPointsModalDetail = document.getElementById('reset-points-modal-detail');
  const btnConfirmResetPoints = document.getElementById('btn-confirm-reset-points');
  const btnCloseResetPointsModal = document.getElementById('btn-close-reset-points-modal');



  function sortPlayersState() {
    playersState.sort((a, b) => {
      const diff = (Number(b.puntos) || 0) - (Number(a.puntos) || 0);
      if (diff !== 0) return diff;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });
  }

  function playersMessageRow(html) {
    return `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 22px 14px; font-size: 13px;">
          ${html}
        </td>
      </tr>
    `;
  }

  async function loadRegisteredPlayers(selectedTcg) {
    const tcgLabel = document.getElementById('players-table-tcg-name');
    if (!playersTableBody) return;

    if (tcgLabel) tcgLabel.textContent = selectedTcg;
    if (selectedTcg !== playersCurrentTcg) {
      playersCurrentPage = 1;
      playersSearchQuery = '';
      if (playersSearchInput) playersSearchInput.value = '';
    }
    playersCurrentTcg = selectedTcg;

    try {
      const res = await fetch(`/api/players?tcg=${encodeURIComponent(selectedTcg)}`);
      const result = await res.json();
      if (res.ok && result.success && Array.isArray(result.data)) {
        playersState = result.data.map(p => ({ ...p, puntos: Number(p.puntos) || 0 }));
        sortPlayersState();
        renderPlayersTable();
      } else {
        playersState = [];
        playersTableBody.innerHTML = playersMessageRow('No se pudieron cargar los jugadores.');
        if (playersPagination) playersPagination.innerHTML = '';
      }
    } catch (err) {
      console.error('Error fetching players:', err);
      playersState = [];
      playersTableBody.innerHTML = playersMessageRow('Error al consultar jugadores en el servidor.');
      if (playersPagination) playersPagination.innerHTML = '';
    }
  }

  function getFilteredPlayers() {
    if (!playersSearchQuery) return playersState;
    const q = playersSearchQuery.toLowerCase();
    return playersState.filter(p => {
      const nick = (p.nickname || '').toLowerCase();
      const nom = (p.nombre || '').toLowerCase();
      const mail = (p.correo || '').toLowerCase();
      return nick.includes(q) || nom.includes(q) || mail.includes(q);
    });
  }

  function renderPlayersTable() {
    const countBadge = document.getElementById('players-count-badge');
    if (!playersTableBody) return;

    const filtered = getFilteredPlayers();
    const totalMatching = filtered.length;
    const totalAll = playersState.length;

    if (countBadge) {
      if (playersSearchQuery && totalMatching !== totalAll) {
        countBadge.textContent = `${totalMatching} de ${totalAll} ${totalAll === 1 ? 'Jugador' : 'Jugadores'}`;
      } else {
        countBadge.textContent = `${totalAll} ${totalAll === 1 ? 'Jugador' : 'Jugadores'}`;
      }
    }

    if (totalAll === 0) {
      playersTableBody.innerHTML = playersMessageRow(
        `No hay jugadores registrados para <strong>${escapeHtml(playersCurrentTcg)}</strong>.`
      );
      if (playersPagination) playersPagination.innerHTML = '';
      return;
    }

    if (totalMatching === 0) {
      playersTableBody.innerHTML = playersMessageRow(
        `No se encontraron jugadores que coincidan con "<strong>${escapeHtml(playersSearchQuery)}</strong>".`
      );
      if (playersPagination) playersPagination.innerHTML = '';
      return;
    }

    const totalPages = Math.max(1, Math.ceil(totalMatching / PLAYERS_PAGE_SIZE));
    if (playersCurrentPage > totalPages) playersCurrentPage = totalPages;
    if (playersCurrentPage < 1) playersCurrentPage = 1;

    const start = (playersCurrentPage - 1) * PLAYERS_PAGE_SIZE;
    const end = Math.min(start + PLAYERS_PAGE_SIZE, totalMatching);

    let rowsHtml = '';
    for (let i = start; i < end; i++) {
      const p = filtered[i];
      rowsHtml += `
        <tr>
          <td style="font-weight: 700; color: #ffffff;">${escapeHtml(p.nickname)}</td>
          <td style="color: #dddddd;">${escapeHtml(p.nombre)}</td>
          <td style="color: var(--text-muted); font-size: 12px; font-family: monospace;">${escapeHtml(p.correo)}</td>
          <td><span class="player-tcg-tag">${escapeHtml(p.tcg)}</span></td>
          <td>
            <input type="number" class="row-input input-puntos player-puntos-input"
                   data-player-id="${p.id}" min="0" max="1000" step="1" value="${String(p.puntos)}">
          </td>
          <td style="text-align: center;">
            <button type="button" class="btn-delete-player" data-player-id="${p.id}">Eliminar Jugador</button>
          </td>
        </tr>
      `;
    }
    playersTableBody.innerHTML = rowsHtml;
    renderPlayersPagination(totalPages, start, end, totalMatching);
  }

  function renderPlayersPagination(totalPages, start, end, total) {
    if (!playersPagination) return;
    if (totalPages <= 1) {
      playersPagination.innerHTML = '';
      return;
    }

    let html = `<span class="page-info">Mostrando ${start + 1}–${end} de ${total}</span>`;
    html += `<button type="button" class="page-btn" data-page="${playersCurrentPage - 1}" ${playersCurrentPage === 1 ? 'disabled' : ''}>&lsaquo;</button>`;
    for (let pg = 1; pg <= totalPages; pg++) {
      html += `<button type="button" class="page-btn ${pg === playersCurrentPage ? 'active' : ''}" data-page="${pg}">${pg}</button>`;
    }
    html += `<button type="button" class="page-btn" data-page="${playersCurrentPage + 1}" ${playersCurrentPage === totalPages ? 'disabled' : ''}>&rsaquo;</button>`;
    playersPagination.innerHTML = html;
  }

  // Filter input typing
  if (playersSearchInput) {
    playersSearchInput.addEventListener('input', (e) => {
      playersSearchQuery = e.target.value.toLowerCase().trim();
      playersCurrentPage = 1;
      renderPlayersTable();
    });
  }

  // Pagination clicks
  if (playersPagination) {
    playersPagination.addEventListener('click', (e) => {
      const btn = e.target.closest('.page-btn');
      if (!btn || btn.disabled) return;
      const pg = parseInt(btn.dataset.page, 10);
      if (!isNaN(pg)) {
        playersCurrentPage = pg;
        renderPlayersTable();
      }
    });
  }

  if (playersTableBody) {
    // Keep edited puntos in memory so edits survive page/filter changes
    playersTableBody.addEventListener('input', (e) => {
      const inp = e.target.closest('.player-puntos-input');
      if (!inp) return;
      const playerId = parseInt(inp.dataset.playerId, 10);
      const p = playersState.find(x => x.id === playerId);
      if (p) {
        p.puntos = inp.value === '' ? '' : parseInt(inp.value, 10);
      }
      if (playersTableValidationBox) playersTableValidationBox.style.display = 'none';
    });

    // Open delete confirmation modal
    playersTableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-delete-player');
      if (!btn) return;
      const playerId = parseInt(btn.dataset.playerId, 10);
      const p = playersState.find(x => x.id === playerId);
      if (!p) return;
      pendingDeletePlayer = p;
      if (deletePlayerModalDetail) {
        deletePlayerModalDetail.textContent = `${p.nickname} • ${p.tcg}`;
      }
      if (deletePlayerModal) deletePlayerModal.classList.add('active');
    });
  }

  function closeDeletePlayerModal() {
    pendingDeletePlayer = null;
    if (deletePlayerModal) deletePlayerModal.classList.remove('active');
  }

  if (btnCloseDeletePlayerModal) {
    btnCloseDeletePlayerModal.addEventListener('click', closeDeletePlayerModal);
  }
  if (deletePlayerModal) {
    deletePlayerModal.addEventListener('click', (e) => {
      if (e.target === deletePlayerModal) closeDeletePlayerModal();
    });
  }

  if (btnConfirmDeletePlayer) {
    btnConfirmDeletePlayer.addEventListener('click', async () => {
      if (!pendingDeletePlayer) {
        closeDeletePlayerModal();
        return;
      }
      const p = pendingDeletePlayer;

      btnConfirmDeletePlayer.disabled = true;
      try {
        const res = await fetch('/api/player/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: p.id })
        });
        const data = await res.json();
        closeDeletePlayerModal();

        if (!res.ok || !data.success) {
          showBoxError(playersTableValidationBox, playersTableValidationMessage, data.error || 'No se pudo eliminar al jugador.');
          return;
        }

        // Remove only this exact record from memory
        playersState = playersState.filter(x => x.id !== p.id);
        renderPlayersTable();

        playersTableValidationBox.className = 'validation-box success';
        playersTableValidationBox.style.display = 'flex';
        playersTableValidationMessage.innerHTML = `
          <div class="preview-header">Jugador "${escapeHtml(p.nickname)}" eliminado de ${escapeHtml(p.tcg)}.</div>
        `;
      } catch (err) {
        console.error('Error deleting player:', err);
        closeDeletePlayerModal();
        showBoxError(playersTableValidationBox, playersTableValidationMessage, 'Error de conexión al eliminar el jugador.');
      } finally {
        btnConfirmDeletePlayer.disabled = false;
      }
    });
  }

  // Bulk update of puntos for ALL players of the selected TCG (all pages)
  if (btnUpdatePlayers) {
    const updateBtnHtml = btnUpdatePlayers.innerHTML;
    btnUpdatePlayers.addEventListener('click', async () => {
      if (playersState.length === 0) {
        showBoxError(playersTableValidationBox, playersTableValidationMessage, 'No hay jugadores para actualizar.');
        return;
      }

      // Validate every player, including those on non-visible pages
      for (let i = 0; i < playersState.length; i++) {
        const pts = playersState[i].puntos;
        if (pts === '' || !Number.isInteger(pts) || pts < 0 || pts > 1000) {
          playersCurrentPage = Math.floor(i / PLAYERS_PAGE_SIZE) + 1;
          renderPlayersTable();
          const inp = playersTableBody.querySelector(`.player-puntos-input[data-index="${i}"]`);
          if (inp) inp.focus();
          showBoxError(
            playersTableValidationBox,
            playersTableValidationMessage,
            `Puntos de "${escapeHtml(playersState[i].nickname)}" debe ser un número entero entre 0 y 1000.`
          );
          return;
        }
      }

      btnUpdatePlayers.disabled = true;
      btnUpdatePlayers.innerHTML = spinnerHtml('Actualizando...');

      try {
        const res = await fetch('/api/players/update-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: playersState.map(p => ({ id: p.id, puntos: p.puntos })) })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          showBoxError(playersTableValidationBox, playersTableValidationMessage, data.error || 'No se pudieron actualizar los jugadores.');
          return;
        }

        playersTableValidationBox.className = 'validation-box success';
        playersTableValidationBox.style.display = 'flex';
        playersTableValidationMessage.innerHTML = `
          <div class="preview-header">🎉 ¡${data.updated} jugador(es) de ${escapeHtml(playersCurrentTcg)} actualizados!</div>
        `;
        await loadRegisteredPlayers(playersCurrentTcg);
      } catch (err) {
        console.error('Error updating players:', err);
        showBoxError(playersTableValidationBox, playersTableValidationMessage, 'Error de conexión al actualizar los jugadores.');
      } finally {
        btnUpdatePlayers.disabled = false;
        btnUpdatePlayers.innerHTML = updateBtnHtml;
      }
    });
  }

  // ── Reiniciar Puntajes (Reset points to 0 for selected TCG) ──
  function openResetPointsModal() {
    if (resetPointsModalDetail) {
      resetPointsModalDetail.textContent = `Todos los jugadores de "${playersCurrentTcg}" volverán a tener 0 puntos.`;
    }
    if (resetPointsModal) resetPointsModal.classList.add('active');
  }

  function closeResetPointsModal() {
    if (resetPointsModal) resetPointsModal.classList.remove('active');
  }

  if (btnResetPoints) {
    btnResetPoints.addEventListener('click', () => {
      openResetPointsModal();
    });
  }

  if (btnCloseResetPointsModal) {
    btnCloseResetPointsModal.addEventListener('click', closeResetPointsModal);
  }

  if (resetPointsModal) {
    resetPointsModal.addEventListener('click', (e) => {
      if (e.target === resetPointsModal) closeResetPointsModal();
    });
  }

  if (btnConfirmResetPoints) {
    btnConfirmResetPoints.addEventListener('click', async () => {
      const targetTcg = playersCurrentTcg || (tournamentSelect ? tournamentSelect.value : 'Riftbound');
      btnConfirmResetPoints.disabled = true;
      try {
        const res = await fetch('/api/players/reset-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tcg: targetTcg })
        });
        const data = await res.json();
        closeResetPointsModal();

        if (!res.ok || !data.success) {
          showBoxError(playersTableValidationBox, playersTableValidationMessage, data.error || 'No se pudieron reiniciar los puntajes.');
          return;
        }

        playersTableValidationBox.className = 'validation-box success';
        playersTableValidationBox.style.display = 'flex';
        playersTableValidationMessage.innerHTML = `
          <div class="preview-header">🎉 ¡Puntajes de ${escapeHtml(targetTcg)} reiniciados a 0 (${data.updated} jugadores actualizados)!</div>
        `;
        await loadRegisteredPlayers(targetTcg);
      } catch (err) {
        console.error('Error resetting points:', err);
        closeResetPointsModal();
        showBoxError(playersTableValidationBox, playersTableValidationMessage, 'Error de conexión al reiniciar puntajes.');
      } finally {
        btnConfirmResetPoints.disabled = false;
      }
    });
  }

  // ── Exportar Jugadores a Excel (.xls / Spreadsheet XML) ──
  function generateExcelXml(players, tcgName) {
    const sanitize = (val) => {
      if (val === null || val === undefined) return '';
      return String(val)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
   </Borders>
  </Style>
  <Style ss:ID="PuntosHeader">
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#0E7490" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
   </Borders>
  </Style>
  <Style ss:ID="RowStyle">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
  <Style ss:ID="PuntosStyle">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="11" ss:Color="#0F172A" ss:Bold="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Jugadores ${sanitize(tcgName)}">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="60"/>
   <Column ss:Width="150"/>
   <Column ss:Width="180"/>
   <Column ss:Width="220"/>
   <Column ss:Width="110"/>
   <Column ss:Width="80"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Puesto</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Nickname</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Nombre</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Correo</Data></Cell>
    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">TCG</Data></Cell>
    <Cell ss:StyleID="PuntosHeader"><Data ss:Type="String">Puntos</Data></Cell>
   </Row>`;

    players.forEach((p, idx) => {
      xml += `
   <Row>
    <Cell ss:StyleID="RowStyle"><Data ss:Type="Number">${idx + 1}</Data></Cell>
    <Cell ss:StyleID="RowStyle"><Data ss:Type="String">${sanitize(p.nickname)}</Data></Cell>
    <Cell ss:StyleID="RowStyle"><Data ss:Type="String">${sanitize(p.nombre)}</Data></Cell>
    <Cell ss:StyleID="RowStyle"><Data ss:Type="String">${sanitize(p.correo)}</Data></Cell>
    <Cell ss:StyleID="RowStyle"><Data ss:Type="String">${sanitize(p.tcg)}</Data></Cell>
    <Cell ss:StyleID="PuntosStyle"><Data ss:Type="Number">${Number(p.puntos) || 0}</Data></Cell>
   </Row>`;
    });

    xml += `
  </Table>
 </Worksheet>
</Workbook>`;
    return xml;
  }

  if (btnExportPlayers) {
    const originalExportHtml = btnExportPlayers.innerHTML;
    btnExportPlayers.addEventListener('click', async () => {
      const selectedTcg = tournamentSelect ? tournamentSelect.value : 'Riftbound';

      // Disable button while file is being generated
      btnExportPlayers.disabled = true;
      btnExportPlayers.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin">
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
          <line x1="2" y1="12" x2="6" y2="12"></line>
          <line x1="18" y1="12" x2="22" y2="12"></line>
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
        </svg>
        Generando Excel...
      `;

      try {
        // Fetch fresh players matching the selected TCG from SQLite
        const res = await fetch(`/api/players?tcg=${encodeURIComponent(selectedTcg)}`);
        const json = await res.json();
        const records = (json && json.success && Array.isArray(json.data)) ? json.data : [];

        // Build Excel document (Office XML Spreadsheet, recognized by Excel natively)
        const xmlContent = generateExcelXml(records, selectedTcg);
        const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });

        // Trigger automatic download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeTcg = selectedTcg.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `jugadores_${safeTcg}_${dateStr}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Error exporting players to Excel:', err);
        showBoxError(playersTableValidationBox, playersTableValidationMessage, 'Error al exportar el archivo Excel.');
      } finally {
        // Re-enable button upon finalization
        btnExportPlayers.disabled = false;
        btnExportPlayers.innerHTML = originalExportHtml;
      }
    });
  }

  // Handle tournament dropdown changes
  tournamentSelect.addEventListener('change', () => {
    if (playerTcgInput) {
      playerTcgInput.value = tournamentSelect.value;
    }
    loadAllDataForSelectedGame(tournamentSelect.value);
    loadRegisteredPlayers(tournamentSelect.value);
  });

  // Initial load
  if (playerTcgInput) {
    playerTcgInput.value = tournamentSelect.value;
  }
  loadAllDataForSelectedGame(tournamentSelect.value);
  loadRegisteredPlayers(tournamentSelect.value);
});
