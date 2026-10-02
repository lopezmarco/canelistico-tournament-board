document.addEventListener('DOMContentLoaded', () => {
  const tournamentSelect = document.getElementById('tournament-select');

  // Helper CSV line parser respecting quotes
  function parseCSVLine(text) {
    const result = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  }

  // Validator for Widget 1: Tournament Results (Line 1 = Title, Line 2 = Date, Lines 3+ = Results)
  function validateTournamentResultsCSV(content) {
    const invalidCharsRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
    if (invalidCharsRegex.test(content)) {
      return { valid: false, error: 'El archivo contiene caracteres binarios o no legibles.' };
    }

    const rawLines = content.split(/\r\n|\n|\r/);
    const lines = rawLines.map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length < 3) {
      return { valid: false, error: 'El archivo debe contener al menos 3 líneas: Título (L1), Fecha (L2) y al menos 1 resultado (L3).' };
    }

    const tournamentTitle = lines[0];
    if (!tournamentTitle || tournamentTitle.trim() === '') {
      return { valid: false, error: 'La primera línea debe contener el título del torneo.' };
    }

    const tournamentDate = lines[1];
    if (!tournamentDate || tournamentDate.trim() === '') {
      return { valid: false, error: 'La segunda línea debe contener la fecha del torneo.' };
    }

    const results = [];
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i];
      const cols = parseCSVLine(line);

      if (cols.length !== 4) {
        return {
          valid: false,
          error: `Línea ${i + 1} inválida ("${line}"). Debe contener exactamente 4 columnas separadas por comas (Puesto, Jugador, Deck, Puntos).`
        };
      }

      results.push({
        puesto: cols[0].trim(),
        jugador: cols[1].trim(),
        deck: cols[2].trim(),
        puntos: cols[3].trim()
      });
    }

    if (results.length === 0) {
      return { valid: false, error: 'No se encontraron filas de resultados válidas en el archivo.' };
    }

    return {
      valid: true,
      title: tournamentTitle,
      date: tournamentDate,
      results: results
    };
  }

  // Validator for Widget 2: Ranking Global (Only results rows, each with 4 columns: Puesto,Jugador,Deck,Puntos)
  // No title and no date header
  function validateRankingGlobalCSV(content) {
    const invalidCharsRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
    if (invalidCharsRegex.test(content)) {
      return { valid: false, error: 'El archivo contiene caracteres binarios o no legibles.' };
    }

    const rawLines = content.split(/\r\n|\n|\r/);
    const lines = rawLines.map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length === 0) {
      return { valid: false, error: 'El archivo está vacío.' };
    }

    // Check if the first line is already a 4-column result row or if it has a header
    let startIndex = 0;
    const firstCols = parseCSVLine(lines[0]);
    if (firstCols.length !== 4 && lines.length >= 3) {
      // User included title/date header
      const secondCols = parseCSVLine(lines[1]);
      if (secondCols.length !== 4) {
        startIndex = 2; // Skip title and date
      } else {
        startIndex = 1;
      }
    }

    const results = [];
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const cols = parseCSVLine(line);

      if (cols.length !== 4) {
        return {
          valid: false,
          error: `Línea ${i + 1} inválida ("${line}"). Debe contener exactamente 4 columnas separadas por comas (Puesto, Jugador, Deck, Puntos).`
        };
      }

      results.push({
        puesto: cols[0].trim(),
        jugador: cols[1].trim(),
        deck: cols[2].trim(),
        puntos: cols[3].trim()
      });
    }

    if (results.length === 0) {
      return { valid: false, error: 'No se encontraron filas de resultados válidas en el archivo.' };
    }

    return {
      valid: true,
      results: results
    };
  }

  // ============================================================
  // WIDGET 1: Resultados del Torneo
  // ============================================================
  const fileInput1 = document.getElementById('csv-file-input');
  const dropzone1 = document.getElementById('dropzone');
  const dropzoneTextMain1 = document.getElementById('dropzone-text-main');
  const dropzoneTextSub1 = document.getElementById('dropzone-text-sub');
  const validationBox1 = document.getElementById('validation-box');
  const validationMessage1 = document.getElementById('validation-message');
  const btnUpload1 = document.getElementById('btn-upload');

  let parsedData1 = null;

  setupDropzone(dropzone1, fileInput1, processFile1);

  function processFile1(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showError(validationBox1, validationMessage1, btnUpload1, 'El archivo debe tener extensión .csv');
      dropzoneTextMain1.textContent = file.name;
      dropzoneTextSub1.textContent = 'Extensión inválida';
      parsedData1 = null;
      return;
    }

    dropzoneTextMain1.textContent = file.name;
    dropzoneTextSub1.textContent = `${(file.size / 1024).toFixed(1)} KB - Validando...`;

    const reader = new FileReader();
    reader.onload = (e) => {
      const res = validateTournamentResultsCSV(e.target.result);
      if (!res.valid) {
        parsedData1 = null;
        showError(validationBox1, validationMessage1, btnUpload1, res.error);
      } else {
        parsedData1 = res;
        showSuccessTournament(validationBox1, validationMessage1, btnUpload1, res);
      }
    };
    reader.onerror = () => showError(validationBox1, validationMessage1, btnUpload1, 'No se pudo leer el archivo.');
    reader.readAsText(file, 'UTF-8');
  }

  btnUpload1.addEventListener('click', async () => {
    if (!parsedData1) return;
    const selectedGame = tournamentSelect.value;
    btnUpload1.disabled = true;
    btnUpload1.textContent = 'Guardando...';

    const payload = {
      gameKey: selectedGame,
      title: parsedData1.title,
      date: parsedData1.date,
      results: parsedData1.results
    };

    try {
      await fetch('/api/tournament/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const normalizedKey = selectedGame.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      localStorage.setItem(`canelistico_${normalizedKey}`, JSON.stringify(payload));

      showUploadSuccess(validationBox1, validationMessage1, btnUpload1, selectedGame, 'Resultados del Torneo');
    } catch (err) {
      console.error(err);
      const normalizedKey = selectedGame.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      localStorage.setItem(`canelistico_${normalizedKey}`, JSON.stringify(payload));
      showUploadSuccess(validationBox1, validationMessage1, btnUpload1, selectedGame, 'Resultados del Torneo (local)');
    }
  });

  // ============================================================
  // WIDGET 2: Archivo de Ranking Global
  // ============================================================
  const fileInput2 = document.getElementById('csv-global-input');
  const dropzone2 = document.getElementById('dropzone-global');
  const dropzoneTextMain2 = document.getElementById('dropzone-global-text-main');
  const dropzoneTextSub2 = document.getElementById('dropzone-global-text-sub');
  const validationBox2 = document.getElementById('validation-box-global');
  const validationMessage2 = document.getElementById('validation-message-global');
  const btnUpload2 = document.getElementById('btn-upload-global');

  let parsedData2 = null;

  setupDropzone(dropzone2, fileInput2, processFile2);

  function processFile2(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showError(validationBox2, validationMessage2, btnUpload2, 'El archivo debe tener extensión .csv');
      dropzoneTextMain2.textContent = file.name;
      dropzoneTextSub2.textContent = 'Extensión inválida';
      parsedData2 = null;
      return;
    }

    dropzoneTextMain2.textContent = file.name;
    dropzoneTextSub2.textContent = `${(file.size / 1024).toFixed(1)} KB - Validando...`;

    const reader = new FileReader();
    reader.onload = (e) => {
      const res = validateRankingGlobalCSV(e.target.result);
      if (!res.valid) {
        parsedData2 = null;
        showError(validationBox2, validationMessage2, btnUpload2, res.error);
      } else {
        parsedData2 = res;
        showSuccessGlobal(validationBox2, validationMessage2, btnUpload2, res);
      }
    };
    reader.onerror = () => showError(validationBox2, validationMessage2, btnUpload2, 'No se pudo leer el archivo.');
    reader.readAsText(file, 'UTF-8');
  }

  btnUpload2.addEventListener('click', async () => {
    if (!parsedData2) return;
    const selectedGame = tournamentSelect.value;
    btnUpload2.disabled = true;
    btnUpload2.textContent = 'Guardando...';

    // Global ranking updates the 4 rows of the table
    const top4Results = parsedData2.results.slice(0, 4);

    const payload = {
      gameKey: selectedGame,
      results: top4Results
    };

    try {
      await fetch('/api/tournament/upload-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const normalizedKey = selectedGame.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      localStorage.setItem(`canelistico_global_${normalizedKey}`, JSON.stringify(payload));

      showUploadSuccess(validationBox2, validationMessage2, btnUpload2, selectedGame, 'Ranking Global');
    } catch (err) {
      console.error(err);
      const normalizedKey = selectedGame.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      localStorage.setItem(`canelistico_global_${normalizedKey}`, JSON.stringify(payload));
      showUploadSuccess(validationBox2, validationMessage2, btnUpload2, selectedGame, 'Ranking Global (local)');
    }
  });

  // ============================================================
  // Common UI Helpers
  // ============================================================
  function setupDropzone(dropzoneEl, inputEl, onFileSelected) {
    ['dragenter', 'dragover'].forEach(name => {
      dropzoneEl.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneEl.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzoneEl.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneEl.classList.remove('dragover');
      }, false);
    });

    dropzoneEl.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        inputEl.files = e.dataTransfer.files;
        onFileSelected(e.dataTransfer.files[0]);
      }
    });

    inputEl.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        onFileSelected(e.target.files[0]);
      }
    });
  }

  function showError(boxEl, msgEl, btnEl, errorMsg) {
    btnEl.disabled = true;
    boxEl.className = 'validation-box error';
    boxEl.style.display = 'flex';
    msgEl.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span><strong>Error de formato:</strong> ${errorMsg}</span>
    `;
  }

  function showSuccessTournament(boxEl, msgEl, btnEl, data) {
    btnEl.disabled = false;
    boxEl.className = 'validation-box success';
    boxEl.style.display = 'flex';
    msgEl.innerHTML = `
      <div class="preview-header">✓ Archivo validado para Resultados de Torneo</div>
      <div class="preview-detail"><strong>Título:</strong> ${data.title}</div>
      <div class="preview-detail"><strong>Fecha:</strong> ${data.date}</div>
      <div class="preview-detail"><strong>Participantes:</strong> ${data.results.length} filas detectadas</div>
    `;
  }

  function showSuccessGlobal(boxEl, msgEl, btnEl, data) {
    btnEl.disabled = false;
    boxEl.className = 'validation-box success';
    boxEl.style.display = 'flex';
    const rowCount = data.results.length;
    msgEl.innerHTML = `
      <div class="preview-header">✓ Archivo validado para Ranking Global</div>
      <div class="preview-detail"><strong>Filas detectadas:</strong> ${rowCount} (se actualizarán las posiciones 1 a 4)</div>
      <div class="preview-detail"><strong>Top 1:</strong> ${data.results[0] ? `${data.results[0].jugador} (${data.results[0].deck}) - ${data.results[0].puntos}` : 'N/A'}</div>
    `;
  }

  function showUploadSuccess(boxEl, msgEl, btnEl, game, typeLabel) {
    boxEl.className = 'validation-box success';
    boxEl.style.display = 'flex';
    msgEl.innerHTML = `
      <div class="preview-header">🎉 ¡${typeLabel} cargado exitosamente para ${game}!</div>
      <div class="preview-detail" style="margin-top: 8px;">
        <a href="tournament.html?game=${encodeURIComponent(game)}" style="color: #38bdf8; font-weight: 700; text-decoration: underline;">
          👉 Ver tabla de ${game}
        </a>
      </div>
    `;
    btnEl.textContent = '✓ Cargado';
    btnEl.disabled = false;
    btnEl.style.background = '#10b981';
  }
});
