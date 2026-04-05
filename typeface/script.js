// ========================================
// CONFIGURACIÓN Y FORMAS DISPONIBLES
// ========================================

const SHAPES = {
  empty: {
    name: 'Vacío',
    rotations: 1,
    draw: () => {}
  },

  square: {
    name: 'Cuadrado',
    rotations: 1,
    draw: (ctx, x, y, s, _rotation, color = '#000000') => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, s, s);
    }
  },

  circle: {
    name: 'Círculo',
    rotations: 1,
    draw: (ctx, x, y, s, _rotation, color = '#000000') => {
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  },

  quarter: {
    name: '1/4 Círculo',
    rotations: 4,
    // Sector relleno: centro en la esquina superior-izquierda de la celda,
    // radio = s. Las 4 rotaciones cubren las 4 esquinas.
    draw: (ctx, x, y, s, rotation, color = '#000000') => {
      ctx.save();
      ctx.translate(x + s / 2, y + s / 2);
      ctx.rotate((rotation * Math.PI) / 2);
      ctx.translate(-s / 2, -s / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, s, 0, Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
  }
};

// ========================================
// ESTADO GLOBAL
// ========================================

const state = {
  currentLetter: 'A',
  letters: {},
  hoveredCell: null,
  selectedCell: null,
  gridCols: 4,
  gridRows: 4,
  xHeight: 2,
  ascender: 1,
  descender: 1,
  showGuides: false,
  proportionsEnabled: false,
  currentPage: 'letters',
  alternatives: {},  // { 'A': ['A_alt_0', 'A_alt_1'], ... }
  altBaseLetter: 'A',
  brushMode: true, // Activado por defecto
  brushColor: '#000000',
  brushShape: 'square',
  brushRotation: 0,
  isPainting: false,
  isErasing: false,
  eraserMode: false,
  history: [], // Para Ctrl+Z
  historyIndex: -1,
  maxHistory: 50,
  previewFontSize: 80
};

// Clasificación de letras por tipo
const LETTER_TYPES = {
  ascender: ['b', 'd', 'f', 'h', 'k', 'l'],
  descender: ['g', 'j', 'p', 'q', 'y'],
  xheight: ['a', 'c', 'e', 'i', 'm', 'n', 'o', 'r', 's', 't', 'u', 'v', 'w', 'x', 'z'],
  cap: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')
};

function getLetterType(letter) {
  if (LETTER_TYPES.ascender.includes(letter)) return 'ascender';
  if (LETTER_TYPES.descender.includes(letter)) return 'descender';
  if (LETTER_TYPES.xheight.includes(letter)) return 'xheight';
  if (LETTER_TYPES.cap.includes(letter)) return 'cap';
  return 'xheight';
}

function getLetterHeight(letter) {
  if (!state.proportionsEnabled) {
    return state.gridRows;
  }
  
  const type = getLetterType(letter);
  switch(type) {
    case 'ascender':
      return state.xHeight + state.ascender;
    case 'descender':
      return state.xHeight + state.descender;
    case 'xheight':
      return state.xHeight;
    case 'cap':
      return state.xHeight + state.ascender;
    default:
      return state.xHeight;
  }
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

const SYMBOLS = ['.', ',', ':', ';', '!', '?', "'", '"', '(', ')', '[', ']', '@', '#', '&', '*', '-', '+', '=', '/', '%', '_', '¡', '¿'];
const SYMBOL_NAMES = {
  '.': 'Punto', ',': 'Coma', ':': 'Dos puntos', ';': 'Pto y coma',
  '!': 'Exclamación', '?': 'Interrogación', "'": 'Apóstrofe', '"': 'Comillas',
  '(': 'Parén. ab.', ')': 'Parén. ci.', '[': 'Corch. ab.', ']': 'Corch. ci.',
  '@': 'Arroba', '#': 'Numeral', '&': 'Ampersand', '*': 'Asterisco',
  '-': 'Guión', '+': 'Más', '=': 'Igual', '/': 'Barra', '%': 'Porcentaje',
  '_': 'Guión bajo', '¡': 'Apertura exc.', '¿': 'Apertura int.'
};

function initLetter(letter) {
  const rows = getLetterHeight(letter);
  const cols = state.gridCols;
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({ shape: 'empty', rotation: 0, color: '#000000' });
    }
    grid.push(row);
  }
  return { grid, cols, rows };
}

ALPHABET.forEach(letter => {
  state.letters[letter] = initLetter(letter);
});
SYMBOLS.forEach(sym => {
  state.letters[sym] = initLetter(sym);
});

// ========================================
// PERSISTENCIA (localStorage)
// ========================================

const STORAGE_KEY = 'modular-type-v1';
let _saveTimer = null;
let _previewTimer = null;

function saveToStorage() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        letters: state.letters,
        alternatives: state.alternatives,
        gridCols: state.gridCols,
        gridRows: state.gridRows,
        xHeight: state.xHeight,
        ascender: state.ascender,
        descender: state.descender,
        proportionsEnabled: state.proportionsEnabled
      }));
    } catch(e) {}
  }, 400);
}

// ========================================
// HISTORIAL PARA CTRL+Z
// ========================================

function saveToHistory() {
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }
  const snapshot = JSON.parse(JSON.stringify(state.letters));
  state.history.push(snapshot);
  if (state.history.length > state.maxHistory) {
    state.history.shift();
  } else {
    state.historyIndex++;
  }
  saveToStorage();
}

function undo() {
  if (state.historyIndex > 0) {
    state.historyIndex--;
    state.letters = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
    saveToStorage();
    renderEditor();
    renderPreview();
    ALPHABET.forEach(l => updateLetterThumbnail(l));
  }
}

// Inicializar historial
saveToHistory();

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== 'object') return false;
    if (saved.letters)                            Object.keys(saved.letters).forEach(k => { state.letters[k] = saved.letters[k]; });
    if (saved.alternatives && typeof saved.alternatives === 'object') state.alternatives = saved.alternatives;
    if (typeof saved.gridCols === 'number')       state.gridCols = saved.gridCols;
    if (typeof saved.gridRows === 'number')       state.gridRows = saved.gridRows;
    if (typeof saved.xHeight === 'number')        state.xHeight = saved.xHeight;
    if (typeof saved.ascender === 'number')       state.ascender = saved.ascender;
    if (typeof saved.descender === 'number')      state.descender = saved.descender;
    if (typeof saved.proportionsEnabled === 'boolean') state.proportionsEnabled = saved.proportionsEnabled;
    return true;
  } catch(e) {
    return false;
  }
}

// ========================================
// HELPERS DE ALTERNATIVAS
// ========================================

function isAltKey(key) {
  return typeof key === 'string' && key.includes('_alt_');
}

function getAltBase(key) {
  return key.split('_alt_')[0];
}

function formatCurrentLetterLabel() {
  const key = state.currentLetter;
  if (!isAltKey(key)) return key;
  const base = getAltBase(key);
  const alts = state.alternatives[base] || [];
  const idx = alts.indexOf(key);
  return `${base}·${idx + 1}`;
}

// ========================================
// NAVEGACIÓN DE LETRAS / SÍMBOLOS
// ========================================

function currentPageChars() {
  return state.currentPage === 'symbols' ? SYMBOLS : ALPHABET;
}

function navigateToLetter(direction) {
  if (state.currentPage === 'alts') {
    const chars = [...ALPHABET, ...SYMBOLS];
    const currentIndex = chars.indexOf(state.altBaseLetter);
    const newIndex = direction === 'next'
      ? (currentIndex + 1) % chars.length
      : (currentIndex - 1 + chars.length) % chars.length;
    state.altBaseLetter = chars[newIndex];
    state.currentLetter = state.altBaseLetter;
    state.selectedCell = null;
    letterSelect.value = state.altBaseLetter;
    updateGridInfo();
    updateCellControls();
    renderEditor();
    renderAlternativesPanel();
    return;
  }

  const chars = currentPageChars();
  const currentIndex = chars.indexOf(state.currentLetter);
  const prev = state.currentLetter;
  let newIndex;

  if (direction === 'next') {
    newIndex = (currentIndex + 1) % chars.length;
  } else {
    newIndex = (currentIndex - 1 + chars.length) % chars.length;
  }

  state.currentLetter = chars[newIndex];
  state.selectedCell = null;
  letterSelect.value = state.currentLetter;
  updateGridInfo();
  updateCellControls();
  renderEditor();
  updateAlphabetActive(prev);
}

// ========================================
// EXPORTAR IMAGEN
// ========================================

function exportImage() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  
  const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letterHeight = 80;
  const spacing = 10;
  const padding = 40;
  
  let totalWidth = padding * 2;
  text.split('').forEach(char => {
    if (state.letters[char]) {
      const letter = state.letters[char];
      const letterWidth = (letterHeight / letter.rows) * letter.cols;
      totalWidth += letterWidth + spacing;
    }
  });
  
  canvas.width = totalWidth * dpr;
  canvas.height = (letterHeight + padding * 2) * dpr;
  ctx.scale(dpr, dpr);
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  
  let currentX = padding;
  const offsetY = padding;
  
  text.split('').forEach((char) => {
    if (!state.letters[char]) return;
    
    const letter = state.letters[char];
    const cellSize = letterHeight / letter.rows;
    const letterWidth = cellSize * letter.cols;
    
    letter.grid.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const shape = SHAPES[cell.shape];
        if (shape && cell.shape !== 'empty') {
          const x = currentX + colIndex * cellSize;
          const y = offsetY + rowIndex * cellSize;
          shape.draw(ctx, x, y, cellSize, cell.rotation, cell.color);
        }
      });
    });
    
    currentX += letterWidth + spacing;
  });
  
  const link = document.createElement('a');
  link.download = 'tipografia-modular.png';
  link.href = canvas.toDataURL();
  link.click();
}

// ========================================
// ELEMENTOS DEL DOM
// ========================================

const editorCanvas = document.getElementById('editorCanvas');
const editorCtx = editorCanvas.getContext('2d');
const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d');
const letterSelect = document.getElementById('letterSelect');
const currentLetterLabel = document.getElementById('currentLetterLabel');
const gridInfo = document.getElementById('gridInfo');
const previewText = document.getElementById('previewText');
const alphabetGrid = document.getElementById('alphabetGrid');
const contextMenu = document.getElementById('contextMenu');
const contextMenuContent = contextMenu.querySelector('.context-menu-content');

const btnDecCols = document.getElementById('btnDecCols');
const btnIncCols = document.getElementById('btnIncCols');
const btnDecRows = document.getElementById('btnDecRows');
const btnIncRows = document.getElementById('btnIncRows');
const colsValue = document.getElementById('colsValue');
const rowsValue = document.getElementById('rowsValue');

const cellControls = document.getElementById('cellControls');
const shapeSelect = document.getElementById('shapeSelect');
const btnRotate = document.getElementById('btnRotate');

const alphabetPanel = document.getElementById('alphabetPanel');
const alphabetToggle = document.getElementById('alphabetToggle');

const toggleProportions = document.getElementById('toggleProportions');
const proportionsControls = document.getElementById('proportionsControls');
const btnDecXHeight = document.getElementById('btnDecXHeight');
const btnIncXHeight = document.getElementById('btnIncXHeight');
const btnDecAscender = document.getElementById('btnDecAscender');
const btnIncAscender = document.getElementById('btnIncAscender');
const btnDecDescender = document.getElementById('btnDecDescender');
const btnIncDescender = document.getElementById('btnIncDescender');
const xHeightValue = document.getElementById('xHeightValue');
const ascenderValue = document.getElementById('ascenderValue');
const descenderValue = document.getElementById('descenderValue');
const toggleGuides = document.getElementById('toggleGuides');

const toggleBrush = document.getElementById('toggleBrush');
const brushControls = document.getElementById('brushControls');
const btnEraser = document.getElementById('btnEraser');

const previewOverlay = document.getElementById('previewOverlay');
const btnOpenPreview = document.getElementById('btnOpenPreview');
const btnClosePreview = document.getElementById('btnClosePreview');
const previewOverlayCanvas = document.getElementById('previewOverlayCanvas');
const previewOverlayText = document.getElementById('previewOverlayText');
const fontSizeLabel = document.getElementById('fontSizeLabel');
const btnFontSizeInc = document.getElementById('btnFontSizeInc');
const btnFontSizeDec = document.getElementById('btnFontSizeDec');
const previewEmptyHint = document.getElementById('previewEmptyHint');
const brushColor = document.getElementById('brushColor');
const brushShapePicker = document.getElementById('brushShapePicker');

const btnPrevLetter = document.getElementById('btnPrevLetter');
const btnNextLetter = document.getElementById('btnNextLetter');
const tabLetters = document.getElementById('tabLetters');
const tabSymbols = document.getElementById('tabSymbols');
const tabAlts = document.getElementById('tabAlts');

// ========================================
// INICIALIZACIÓN
// ========================================

function init() {
  const restored = loadFromStorage();
  if (restored) {
    // Sync UI controls with restored state
    if (toggleProportions) {
      toggleProportions.checked = state.proportionsEnabled;
      if (proportionsControls) proportionsControls.style.display = state.proportionsEnabled ? 'block' : 'none';
    }
  }
  setupCanvas();
  populateLetterSelect();
  populateShapeSelect();
  populateBrushShapeSelect();
  updateGridInfo();
  renderAlphabetGrid();
  renderEditor();
  renderPreview();
  setupEventListeners();

  // Recompute grid layout whenever the alphabet panel is resized
  const alphabetContent = document.querySelector('body.editor-app .alphabet-content');
  if (alphabetContent && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => updateAlphabetLayout()).observe(alphabetContent);
  }
}

function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const base = 480;
  const cols = state.gridCols;
  const rows = state.gridRows;
  const ratio = cols / rows;
  const physW = ratio >= 1 ? base : Math.round(base * ratio);
  const physH = ratio >= 1 ? Math.round(base / ratio) : base;
  editorCanvas.width = physW * dpr;
  editorCanvas.height = physH * dpr;
  editorCtx.scale(dpr, dpr);
  const maxH = window.innerHeight - 160;
  editorCanvas.parentElement.style.maxWidth = Math.floor(Math.min(window.innerHeight - 180, maxH * ratio)) + 'px';
  editorCanvas.parentElement.style.aspectRatio = `${cols} / ${rows}`;
  previewCanvas.width = 800 * dpr;
  previewCanvas.height = 120 * dpr;
  previewCtx.scale(dpr, dpr);
}

function populateLetterSelect() {
  letterSelect.innerHTML = '';
  const chars = state.currentPage === 'alts' ? [...ALPHABET, ...SYMBOLS] : currentPageChars();
  chars.forEach(char => {
    const option = document.createElement('option');
    option.value = char;
    option.textContent = state.currentPage === 'symbols' ? `${char} ${SYMBOL_NAMES[char] || char}` : char;
    letterSelect.appendChild(option);
  });
  letterSelect.value = state.currentPage === 'alts' ? state.altBaseLetter : state.currentLetter;
}

function populateShapeSelect() {
  shapeSelect.innerHTML = '';
  Object.entries(SHAPES).forEach(([shapeId, shape]) => {
    const option = document.createElement('option');
    option.value = shapeId;
    option.textContent = shape.name;
    shapeSelect.appendChild(option);
  });
}

const SHAPE_ICONS = {
  square:  `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="2" y="2" width="16" height="16"/></svg>`,
  circle:  `<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="8"/></svg>`,
  quarter: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2,2 L18,2 A16,16,0,0,1 2,18 Z"/></svg>`,
};

function populateBrushShapeSelect() {
  if (!brushShapePicker) return;
  brushShapePicker.innerHTML = '';
  Object.entries(SHAPES).forEach(([shapeId, shape]) => {
    if (shapeId === 'empty') return;
    const btn = document.createElement('button');
    btn.className = 'shape-btn' + (shapeId === state.brushShape ? ' active' : '');
    btn.dataset.shape = shapeId;
    btn.title = shape.name;
    btn.innerHTML = SHAPE_ICONS[shapeId] ?? shape.name;
    btn.addEventListener('click', () => {
      state.brushShape = shapeId;
      state.brushRotation = 0;
      state.eraserMode = false;
      btnEraser?.classList.remove('active');
      brushShapePicker.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderEditor();
    });
    brushShapePicker.appendChild(btn);
  });
}

function updateGridInfo() {
  const letter = state.letters[state.currentLetter];
  colsValue.textContent = state.gridCols;
  rowsValue.textContent = state.proportionsEnabled ? letter.rows : state.gridRows;
  gridInfo.textContent = `Grilla ${state.gridCols}×${letter.rows}`;
  if (xHeightValue) xHeightValue.textContent = state.xHeight;
  if (ascenderValue) ascenderValue.textContent = state.ascender;
  if (descenderValue) descenderValue.textContent = state.descender;
}

function adjustLetterHeight(letter) {
  const letterData = state.letters[letter];
  const newHeight = getLetterHeight(letter);
  if (letterData.rows !== newHeight) {
    resizeGrid(state.gridCols, newHeight, letter);
  }
}

function adjustAllLetterHeights() {
  ALPHABET.forEach(letter => {
    adjustLetterHeight(letter);
  });
}

function changeGlobalGridCols(newCols) {
  state.gridCols = newCols;
  
  ALPHABET.forEach(letter => {
    const letterData = state.letters[letter];
    resizeGrid(newCols, letterData.rows, letter);
  });
  
  updateGridInfo();
  renderEditor();
  renderPreview();
  renderAlphabetGrid();
  saveToHistory();
}

function changeGlobalGridRows(newRows) {
  state.gridRows = newRows;
  
  if (!state.proportionsEnabled) {
    ALPHABET.forEach(letter => {
      resizeGrid(state.gridCols, newRows, letter);
    });
    
    updateGridInfo();
    renderEditor();
    renderPreview();
    renderAlphabetGrid();
    saveToHistory();
  }
}

// ========================================
// RENDERIZADO
// ========================================

function renderEditor() {
  const letter = state.letters[state.currentLetter];
  const gridCols = letter.cols;
  const gridRows = letter.rows;

  // Update canvas physical dimensions and container aspect-ratio for current grid
  const dpr = window.devicePixelRatio || 1;
  const base = 480;
  const ratio = gridCols / gridRows;
  const physW = ratio >= 1 ? base : Math.round(base * ratio);
  const physH = ratio >= 1 ? Math.round(base / ratio) : base;
  if (editorCanvas.width !== physW * dpr || editorCanvas.height !== physH * dpr) {
    editorCanvas.width = physW * dpr;
    editorCanvas.height = physH * dpr;
    editorCtx.scale(dpr, dpr);
  }
  const maxH = window.innerHeight - 160;
  editorCanvas.parentElement.style.maxWidth = Math.floor(Math.min(window.innerHeight - 180, maxH * ratio)) + 'px';
  editorCanvas.parentElement.style.aspectRatio = `${gridCols} / ${gridRows}`;

  const canvas = editorCanvas;
  const ctx = editorCtx;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;

  ctx.clearRect(0, 0, w, h);

  const cellSize = w / gridCols;

  // Grilla
  ctx.strokeStyle = '#d0d0d0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= gridCols; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cellSize, 0);
    ctx.lineTo(i * cellSize, h);
    ctx.stroke();
  }
  for (let i = 0; i <= gridRows; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * cellSize);
    ctx.lineTo(w, i * cellSize);
    ctx.stroke();
  }

  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';

  // Guías
  if (state.showGuides && state.proportionsEnabled) {
    const type = getLetterType(state.currentLetter);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    let baselineY = 0;
    if (type === 'descender') {
      baselineY = state.descender * cellSize;
    }

    ctx.beginPath();
    ctx.moveTo(0, baselineY);
    ctx.lineTo(w, baselineY);
    ctx.stroke();

    const xHeightY = baselineY - state.xHeight * cellSize;
    ctx.beginPath();
    ctx.moveTo(0, xHeightY);
    ctx.lineTo(w, xHeightY);
    ctx.stroke();

    if (type === 'ascender' || type === 'cap') {
      const capY = baselineY - (state.xHeight + state.ascender) * cellSize;
      ctx.beginPath();
      ctx.moveTo(0, capY);
      ctx.lineTo(w, capY);
      ctx.stroke();
    }

    if (type === 'descender') {
      const descY = baselineY + state.descender * cellSize;
      ctx.beginPath();
      ctx.moveTo(0, descY);
      ctx.lineTo(w, descY);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.strokeStyle = '#000000';
  }

  // Formas
  letter.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const shape = SHAPES[cell.shape];
      if (shape && cell.shape !== 'empty') {
        const x = colIndex * cellSize;
        const y = rowIndex * cellSize;
        shape.draw(ctx, x, y, cellSize, cell.rotation, cell.color);
      }
    });
  });

  // Celda seleccionada
  if (state.selectedCell && !state.brushMode) {
    const { row, col } = state.selectedCell;
    const x = col * cellSize;
    const y = row * cellSize;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
  }

  // Hover
  if (state.hoveredCell && !state.selectedCell && !state.brushMode) {
    const { row, col } = state.hoveredCell;
    const x = col * cellSize;
    const y = row * cellSize;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(x + 4, y + 4, cellSize - 8, cellSize - 8);
  }

  // Preview del pincel
  if (state.hoveredCell && state.brushMode && !state.eraserMode && !state.isPainting) {
    const { row, col } = state.hoveredCell;
    const x = col * cellSize;
    const y = row * cellSize;
    ctx.save();
    ctx.globalAlpha = 0.4;
    const shape = SHAPES[state.brushShape];
    if (shape) {
      shape.draw(ctx, x, y, cellSize, state.brushRotation, state.brushColor);
    }
    ctx.restore();
  }

  // Preview de la goma
  if (state.hoveredCell && state.eraserMode && !state.isPainting) {
    const { row, col } = state.hoveredCell;
    const x = col * cellSize;
    const y = row * cellSize;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 80, 80, 0.25)';
    ctx.fillRect(x, y, cellSize, cellSize);
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
    ctx.restore();
  }

  currentLetterLabel.textContent = formatCurrentLetterLabel();
}

function renderPreview() {
  const canvas = previewCanvas;
  const ctx = previewCtx;
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  
  ctx.clearRect(0, 0, w, h);
  
  const text = previewText.value.toUpperCase();
  const letterHeight = 60;
  const spacing = 8;
  
  let totalWidth = 0;
  text.split('').forEach(char => {
    if (state.letters[char]) {
      const letter = state.letters[char];
      const letterWidth = (letterHeight / letter.rows) * letter.cols;
      totalWidth += letterWidth + spacing;
    }
  });
  totalWidth -= spacing;
  
  const offsetX = (w - totalWidth) / 2;
  const offsetY = (h - letterHeight) / 2;
  
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  
  let currentX = offsetX;
  
  text.split('').forEach((char) => {
    if (!state.letters[char]) return;
    
    const letter = state.letters[char];
    const cellSize = letterHeight / letter.rows;
    const letterWidth = cellSize * letter.cols;
    
    letter.grid.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const shape = SHAPES[cell.shape];
        if (shape && cell.shape !== 'empty') {
          const x = currentX + colIndex * cellSize;
          const y = offsetY + rowIndex * cellSize;
          shape.draw(ctx, x, y, cellSize, cell.rotation, cell.color);
        }
      });
    });
    
    currentX += letterWidth + spacing;
  });
}

// ========================================
// OVERLAY DE PREVISUALIZACIÓN
// ========================================

function renderOverlayPreview() {
  if (!previewOverlay.classList.contains('open')) return;

  const canvas = previewOverlayCanvas;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const raw = previewOverlayText.value.toUpperCase();
  const text = raw || '';
  const letterHeight = state.previewFontSize;
  const spacing = Math.max(2, Math.round(letterHeight * 0.1));

  // Mostrar/ocultar hint
  if (previewEmptyHint) {
    previewEmptyHint.style.display = text.length === 0 ? 'block' : 'none';
  }

  if (text.length === 0) {
    canvas.style.display = 'none';
    return;
  }
  canvas.style.display = 'block';

  // Calcular ancho total
  let totalWidth = 0;
  text.split('').forEach(char => {
    if (char === ' ') {
      totalWidth += Math.round(letterHeight * 0.5);
    } else if (state.letters[char]) {
      const letter = state.letters[char];
      const lw = (letterHeight / letter.rows) * letter.cols;
      totalWidth += lw + spacing;
    }
  });
  if (totalWidth > spacing) totalWidth -= spacing;

  const pad = 0;
  const physW = Math.max(totalWidth + pad * 2, 1);
  const physH = letterHeight;

  canvas.width = Math.round(physW * dpr);
  canvas.height = Math.round(physH * dpr);
  canvas.style.width = physW + 'px';
  canvas.style.height = physH + 'px';

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, physW, physH);
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  let currentX = pad;
  text.split('').forEach(char => {
    if (char === ' ') {
      currentX += Math.round(letterHeight * 0.5);
      return;
    }
    if (!state.letters[char]) return;
    const letter = state.letters[char];
    const cellSize = letterHeight / letter.rows;
    const letterWidth = cellSize * letter.cols;

    letter.grid.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const shape = SHAPES[cell.shape];
        if (shape && cell.shape !== 'empty') {
          const x = currentX + colIndex * cellSize;
          const y = rowIndex * cellSize;
          shape.draw(ctx, x, y, cellSize, cell.rotation, cell.color);
        }
      });
    });
    currentX += letterWidth + spacing;
  });
}

function openPreviewOverlay() {
  previewOverlay.classList.add('open');
  previewOverlay.removeAttribute('aria-hidden');
  renderOverlayPreview();
  previewOverlayText.focus();
}

function closePreviewOverlay() {
  previewOverlay.classList.remove('open');
  previewOverlay.setAttribute('aria-hidden', 'true');
}

function renderAlphabetGrid() {
  if (state.currentPage === 'alts') { renderAlternativesPanel(); return; }
  alphabetGrid.innerHTML = '';

  currentPageChars().forEach(letter => {
    const card = document.createElement('div');
    card.className = 'letter-card';
    card.dataset.letter = letter;
    if (letter === state.currentLetter) card.classList.add('active');

    const header = document.createElement('div');
    header.className = 'letter-card-header';

    const name = document.createElement('span');
    name.className = 'letter-name';
    name.textContent = letter;
    if (state.currentPage === 'symbols') name.title = SYMBOL_NAMES[letter] || letter;

    const status = document.createElement('span');
    status.className = 'letter-status';
    const letterData = state.letters[letter];
    const hasContent = letterData.grid.some(row =>
      row.some(cell => cell.shape !== 'empty')
    );
    status.textContent = hasContent ? '●' : '○';

    header.appendChild(name);
    header.appendChild(status);

    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 80;
    renderLetterThumbnail(canvas, letter);

    card.appendChild(header);
    card.appendChild(canvas);

    card.addEventListener('click', () => {
      const prev = state.currentLetter;
      state.currentLetter = letter;
      state.selectedCell = null;
      letterSelect.value = letter;
      updateGridInfo();
      updateCellControls();
      renderEditor();
      updateAlphabetActive(prev);
    });

    alphabetGrid.appendChild(card);
  });

  updateAlphabetLayout();
}

// ========================================
// PANEL DE ALTERNATIVAS
// ========================================

function renderAlternativesPanel() {
  alphabetGrid.innerHTML = '';
  const letter = state.altBaseLetter;

  // Card principal
  appendAltCard(letter, letter === state.currentLetter, letter);

  // Cards de alternativas
  const alts = state.alternatives[letter] || [];
  alts.forEach((altKey, i) => {
    appendAltCard(altKey, altKey === state.currentLetter, `${letter}·${i + 1}`);
  });

  // Botón añadir
  const addCard = document.createElement('div');
  addCard.className = 'letter-card alt-add-card';
  addCard.title = 'Agregar alternativa';
  addCard.innerHTML = '<span class="alt-add-icon">+</span>';
  addCard.addEventListener('click', () => addAlternative(letter));
  alphabetGrid.appendChild(addCard);

  updateAlphabetLayout();
}

function appendAltCard(key, isActive, label) {
  const card = document.createElement('div');
  card.className = 'letter-card' + (isActive ? ' active' : '');
  card.dataset.letter = key;

  const header = document.createElement('div');
  header.className = 'letter-card-header';

  const name = document.createElement('span');
  name.className = 'letter-name';
  name.textContent = label;

  const status = document.createElement('span');
  status.className = 'letter-status';
  const letterData = state.letters[key];
  const hasContent = letterData?.grid.some(row => row.some(cell => cell.shape !== 'empty'));
  status.textContent = hasContent ? '●' : '○';

  header.appendChild(name);
  header.appendChild(status);

  const canvas = document.createElement('canvas');
  canvas.width = 80;
  canvas.height = 80;
  renderLetterThumbnail(canvas, key);

  card.appendChild(header);
  card.appendChild(canvas);

  card.addEventListener('click', () => {
    const prev = state.currentLetter;
    state.currentLetter = key;
    state.selectedCell = null;
    updateGridInfo();
    updateCellControls();
    renderEditor();
    updateAlphabetActive(prev);
  });

  alphabetGrid.appendChild(card);
}

function addAlternative(letter) {
  if (!state.alternatives[letter]) state.alternatives[letter] = [];
  const idx = state.alternatives[letter].length;
  const key = `${letter}_alt_${idx}`;
  const base = state.letters[letter];
  state.letters[key] = {
    grid: base.grid.map(row => row.map(() => ({ shape: 'empty', rotation: 0, color: '#000000' }))),
    cols: base.cols,
    rows: base.rows
  };
  state.alternatives[letter].push(key);
  state.currentLetter = key;
  state.selectedCell = null;
  renderAlternativesPanel();
  updateCellControls();
  renderEditor();
  saveToStorage();
}

// Busca una card por su dataset.letter (seguro con caracteres especiales)
function findLetterCard(letter) {
  return Array.from(alphabetGrid.children).find(el => el.dataset.letter === letter) || null;
}

// Actualiza solo el estado activo en el panel — sin reconstruir el DOM
function updateAlphabetActive(prevLetter) {
  if (prevLetter) {
    findLetterCard(prevLetter)?.classList.remove('active');
  }
  findLetterCard(state.currentLetter)?.classList.add('active');
}

// Re-renderiza solo el thumbnail y el punto de estado de una letra concreta
function updateLetterThumbnail(letter) {
  const card = findLetterCard(letter);
  if (!card) return;
  const canvas = card.querySelector('canvas');
  if (canvas) renderLetterThumbnail(canvas, letter);
  const status = card.querySelector('.letter-status');
  if (status) {
    const letterData = state.letters[letter];
    const hasContent = letterData.grid.some(row => row.some(cell => cell.shape !== 'empty'));
    status.textContent = hasContent ? '●' : '○';
  }
}

function updateAlphabetLayout() {
  const grid = document.getElementById('alphabetGrid');
  const content = document.querySelector('body.editor-app .alphabet-content');
  if (!grid || !content) return;

  // Count actual content cards (not placeholders)
  grid.querySelectorAll('.placeholder-card').forEach(el => el.remove());
  const count = grid.children.length;
  if (count === 0) return;

  const W = content.clientWidth;
  const tabsEl = content.querySelector('.alphabet-tabs');
  const tabsH = tabsEl ? tabsEl.offsetHeight : 0;
  const H = content.clientHeight - tabsH;

  // Find N columns that minimises |cellWidth/cellHeight − 1| (closest to square)
  let bestN = Math.min(4, count);
  let bestScore = Infinity;
  for (let n = 1; n <= Math.min(count, 12); n++) {
    const m = Math.ceil(count / n);
    const cellW = W / n;
    const cellH = H / m;
    const score = Math.abs(cellW / cellH - 1);
    if (score < bestScore) {
      bestScore = score;
      bestN = n;
    }
  }

  grid.style.gridTemplateColumns = `repeat(${bestN}, 1fr)`;
  grid.style.gridAutoRows = '1fr';

  // Add placeholders to fill the last row
  const remainder = count % bestN;
  if (remainder !== 0) {
    const needed = bestN - remainder;
    for (let i = 0; i < needed; i++) {
      const ph = document.createElement('div');
      ph.className = 'placeholder-card';
      grid.appendChild(ph);
    }
  }
}

function renderLetterThumbnail(canvas, letter) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  
  ctx.clearRect(0, 0, w, h);
  
  const letterData = state.letters[letter];
  const cellSizeW = w / letterData.cols;
  const cellSizeH = h / letterData.rows;
  const cellSize = Math.min(cellSizeW, cellSizeH);
  
  const offsetX = (w - cellSize * letterData.cols) / 2;
  const offsetY = (h - cellSize * letterData.rows) / 2;
  
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  
  letterData.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const shape = SHAPES[cell.shape];
      if (shape && cell.shape !== 'empty') {
        const x = offsetX + colIndex * cellSize;
        const y = offsetY + rowIndex * cellSize;
        shape.draw(ctx, x, y, cellSize, cell.rotation, cell.color);
      }
    });
  });
}

// ========================================
// PINCEL
// ========================================

function paintCell(row, col) {
  const letter = state.letters[state.currentLetter];
  if (state.isErasing) {
    letter.grid[row][col] = { shape: 'empty', rotation: 0, color: '#000000' };
  } else {
    letter.grid[row][col] = {
      shape: state.brushShape,
      rotation: state.brushRotation,
      color: state.brushColor
    };
  }
  renderEditor();
  clearTimeout(_previewTimer);
  _previewTimer = setTimeout(() => {
    renderPreview();
    updateLetterThumbnail(state.currentLetter);
  }, 80);
}

// ========================================
// MENÚ CONTEXTUAL
// ========================================

function showContextMenu(x, y, row, col) {
  contextMenuContent.innerHTML = '';
  
  const emptyItem = createContextMenuItem('empty', 0);
  emptyItem.addEventListener('click', () => {
    const letter = state.letters[state.currentLetter];
    letter.grid[row][col] = { shape: 'empty', rotation: 0, color: '#000000' };
    hideContextMenu();
    saveToHistory();
    renderEditor();
    renderPreview();
    renderAlphabetGrid();
  });
  contextMenuContent.appendChild(emptyItem);
  
  Object.entries(SHAPES).forEach(([shapeId, shape]) => {
    if (shapeId === 'empty') return;
    
    for (let rotation = 0; rotation < shape.rotations; rotation++) {
      const item = createContextMenuItem(shapeId, rotation);
      item.addEventListener('click', () => {
        const letter = state.letters[state.currentLetter];
        letter.grid[row][col] = { shape: shapeId, rotation, color: '#000000' };
        hideContextMenu();
        state.selectedCell = { row, col };
        updateCellControls();
        saveToHistory();
        renderEditor();
        renderPreview();
        renderAlphabetGrid();
      });
      contextMenuContent.appendChild(item);
    }
  });
  
  contextMenu.style.display = 'block';
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  
  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = (x - rect.width) + 'px';
  }
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = (y - rect.height) + 'px';
  }
}

function createContextMenuItem(shapeId, rotation) {
  const item = document.createElement('div');
  item.className = 'context-menu-item';
  
  const canvas = document.createElement('canvas');
  canvas.width = 50;
  canvas.height = 50;
  const ctx = canvas.getContext('2d');
  
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  
  const shape = SHAPES[shapeId];
  if (shape) {
    shape.draw(ctx, 5, 5, 40, rotation);
  }
  
  item.appendChild(canvas);
  return item;
}

function hideContextMenu() {
  contextMenu.style.display = 'none';
}

// ========================================
// CONTROLES DE CELDA
// ========================================

function updateCellControls() {
  if (state.selectedCell && !state.brushMode) {
    const { row, col } = state.selectedCell;
    const letter = state.letters[state.currentLetter];
    const cell = letter.grid[row][col];

    cellControls.style.display = 'flex';
    shapeSelect.value = cell.shape;
  } else {
    cellControls.style.display = 'none';
  }
}

// ========================================
// GRILLA DINÁMICA
// ========================================

function resizeGrid(newCols, newRows, targetLetter = null) {
  const letter = targetLetter || state.currentLetter;
  const letterData = state.letters[letter];
  const oldGrid = letterData.grid;
  const newGrid = [];
  
  for (let r = 0; r < newRows; r++) {
    const row = [];
    for (let c = 0; c < newCols; c++) {
      if (r < oldGrid.length && c < oldGrid[r].length) {
        row.push(oldGrid[r][c]);
      } else {
        row.push({ shape: 'empty', rotation: 0, color: '#000000' });
      }
    }
    newGrid.push(row);
  }
  
  letterData.grid = newGrid;
  letterData.cols = newCols;
  letterData.rows = newRows;
  
  if (letter === state.currentLetter && state.selectedCell) {
    const { row, col } = state.selectedCell;
    if (row >= newRows || col >= newCols) {
      state.selectedCell = null;
    }
  }
}

function getCellFromEvent(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const letter = state.letters[state.currentLetter];
  const gridCols = letter.cols;
  const gridRows = letter.rows;

  const col = Math.floor(x / (rect.width / gridCols));
  const row = Math.floor(y / (rect.height / gridRows));

  if (row >= 0 && row < gridRows && col >= 0 && col < gridCols) {
    return { row, col };
  }

  return null;
}

// ========================================
// EXPORTAR FUENTE OTF
// ========================================

function exportFont() {
  if (typeof opentype === 'undefined') {
    alert('La librería opentype.js no se cargó correctamente.');
    return;
  }

  const UPM = 1000;
  const K = 0.5522847498; // cubic bezier circle approximation constant

  // Determine cell size from the tallest letter
  const maxRows = Math.max(...ALPHABET.map(l => state.letters[l]?.rows ?? 1));
  const cellSize = Math.floor(UPM / maxRows);
  const margin = Math.round(cellSize * 0.3); // side + vertical padding (~30% of a cell)

  // Build opentype Path commands for a single cell in font Y-up coordinates.
  // cx = left edge, cy = bottom edge (font Y-up), s = cellSize.
  // margin shifts glyphs away from the advance-width edges on all four sides.
  function cellCommands(cell, col, row, totalRows) {
    if (cell.shape === 'empty') return [];

    const s = cellSize;
    const ks = K * s;
    const cx = col * s + margin;                    // left side bearing
    const cy = (totalRows - 1 - row) * s + margin; // bottom padding (Y-up)

    // All outer contours are CCW in Y-up (verified with shoelace formula).
    if (cell.shape === 'square') {
      return [
        { type: 'M', x: cx,   y: cy   },
        { type: 'L', x: cx+s, y: cy   },
        { type: 'L', x: cx+s, y: cy+s },
        { type: 'L', x: cx,   y: cy+s },
        { type: 'Z' }
      ];
    }

    if (cell.shape === 'circle') {
      const ox = cx + s/2, oy = cy + s/2, r = s/2, kr = K * r;
      return [
        { type: 'M',  x: ox+r,  y: oy },
        { type: 'C',  x1: ox+r,  y1: oy+kr, x2: ox+kr,  y2: oy+r,  x: ox,   y: oy+r  },
        { type: 'C',  x1: ox-kr, y1: oy+r,  x2: ox-r,   y2: oy+kr, x: ox-r, y: oy    },
        { type: 'C',  x1: ox-r,  y1: oy-kr, x2: ox-kr,  y2: oy-r,  x: ox,   y: oy-r  },
        { type: 'C',  x1: ox+kr, y1: oy-r,  x2: ox+r,   y2: oy-kr, x: ox+r, y: oy    },
        { type: 'Z' }
      ];
    }

    if (cell.shape === 'quarter') {
      // Canvas rotation → font CCW path mapping (Y-axis flip changes centre corner):
      //  canvas R0 (centre top-left)   → font centre at (cx, cy+s)
      //  canvas R1 (centre top-right)  → font centre at (cx+s, cy+s)
      //  canvas R2 (centre bot-right)  → font centre at (cx+s, cy)
      //  canvas R3 (centre bot-left)   → font centre at (cx, cy)
      switch (cell.rotation) {
        case 0: // centre top-left (cx, cy+s)
          return [
            { type: 'M', x: cx,   y: cy+s },
            { type: 'L', x: cx,   y: cy   },
            { type: 'C', x1: cx+ks, y1: cy,    x2: cx+s, y2: cy+s-ks, x: cx+s, y: cy+s },
            { type: 'Z' }
          ];
        case 1: // centre top-right (cx+s, cy+s)
          return [
            { type: 'M', x: cx+s, y: cy+s },
            { type: 'L', x: cx,   y: cy+s },
            { type: 'C', x1: cx,   y1: cy+s-ks, x2: cx+s-ks, y2: cy, x: cx+s, y: cy },
            { type: 'Z' }
          ];
        case 2: // centre bottom-right (cx+s, cy)
          return [
            { type: 'M', x: cx+s, y: cy   },
            { type: 'L', x: cx+s, y: cy+s },
            { type: 'C', x1: cx+s-ks, y1: cy+s, x2: cx, y2: cy+ks, x: cx, y: cy },
            { type: 'Z' }
          ];
        case 3: // centre bottom-left (cx, cy)
          return [
            { type: 'M', x: cx,   y: cy   },
            { type: 'L', x: cx+s, y: cy   },
            { type: 'C', x1: cx+s, y1: cy+ks, x2: cx+ks, y2: cy+s, x: cx, y: cy+s },
            { type: 'Z' }
          ];
        default:
          return [];
      }
    }

    return [];
  }

  // .notdef (required by spec)
  const notdefGlyph = new opentype.Glyph({
    name: '.notdef',
    unicode: undefined,
    advanceWidth: cellSize * 4,
    path: new opentype.Path()
  });

  // space
  const spaceGlyph = new opentype.Glyph({
    name: 'space',
    unicode: 32,
    advanceWidth: cellSize * 2,
    path: new opentype.Path()
  });

  const glyphs = [notdefGlyph, spaceGlyph];

  for (const letter of ALPHABET) {
    const letterData = state.letters[letter];
    if (!letterData) continue;

    const { grid, cols, rows } = letterData;
    const path = new opentype.Path();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cmds = cellCommands(grid[r][c], c, r, rows);
        path.commands.push(...cmds);
      }
    }

    glyphs.push(new opentype.Glyph({
      name: letter,
      unicode: letter.codePointAt(0),
      advanceWidth: cols * cellSize + 2 * margin,
      path
    }));
  }

  const fontName = prompt('Nombre de la fuente:', 'Modular Type') || 'Modular Type';

  const font = new opentype.Font({
    familyName: fontName,
    styleName: 'Regular',
    unitsPerEm: UPM,
    ascender: maxRows * cellSize + 2 * margin,
    descender: 0,
    glyphs
  });

  font.download(fontName.replace(/\s+/g, '-').toLowerCase() + '.otf');
}

// ========================================
// IMPORTAR/EXPORTAR
// ========================================

function exportJSON() {
  const data = JSON.stringify(state.letters, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tipografia-modular.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      state.letters = imported;
      saveToHistory();
      renderEditor();
      renderPreview();
      renderAlphabetGrid();
    } catch (err) {
      alert('Error al importar: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
  letterSelect.addEventListener('change', (e) => {
    const prev = state.currentLetter;
    if (state.currentPage === 'alts') {
      state.altBaseLetter = e.target.value;
      state.currentLetter = e.target.value;
      state.selectedCell = null;
      updateGridInfo();
      updateCellControls();
      renderEditor();
      renderAlternativesPanel();
    } else {
      state.currentLetter = e.target.value;
      state.selectedCell = null;
      updateGridInfo();
      updateCellControls();
      renderEditor();
      updateAlphabetActive(prev);
    }
  });
  
  previewText.addEventListener('input', renderPreview);
  
  editorCanvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (state.brushMode) return;
    const cell = getCellFromEvent(e);
    if (cell) {
      showContextMenu(e.pageX, e.pageY, cell.row, cell.col);
    }
  });
  
  editorCanvas.addEventListener('mousedown', (e) => {
    const cell = getCellFromEvent(e);
    if (!cell) return;

    if (state.brushMode) {
      state.isPainting = true;
      state.isErasing = state.eraserMode || e.shiftKey;
      paintCell(cell.row, cell.col);
    } else {
      state.selectedCell = cell;
      updateCellControls();
      renderEditor();
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (state.isPainting) {
      saveToHistory();
    }
    state.isPainting = false;
  });
  
  editorCanvas.addEventListener('mousemove', (e) => {
    const cell = getCellFromEvent(e);
    if (cell) {
      state.hoveredCell = cell;
      if (state.brushMode && state.isPainting) {
        state.isErasing = state.eraserMode || e.shiftKey;
        paintCell(cell.row, cell.col);
      } else {
        renderEditor();
      }
    } else {
      if (state.hoveredCell) {
        state.hoveredCell = null;
        renderEditor();
      }
    }
  });
  
  editorCanvas.addEventListener('mouseleave', () => {
    state.hoveredCell = null;
    state.isPainting = false;
    renderEditor();
  });
  
  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target) && e.target !== editorCanvas) {
      hideContextMenu();
    }
  });
  
  // Toggle proporciones
  toggleProportions?.addEventListener('change', (e) => {
    state.proportionsEnabled = e.target.checked;
    proportionsControls.style.display = state.proportionsEnabled ? 'block' : 'none';
    
    if (state.proportionsEnabled) {
      adjustAllLetterHeights();
    } else {
      changeGlobalGridRows(state.gridRows);
    }
    
    updateGridInfo();
    renderEditor();
    renderPreview();
    renderAlphabetGrid();
    saveToHistory();
  });
  
  // Toggle pincel
  toggleBrush?.addEventListener('change', (e) => {
    state.brushMode = e.target.checked;
    brushControls.style.display = state.brushMode ? 'block' : 'none';
    if (state.brushMode) {
      state.selectedCell = null;
      updateCellControls();
    } else {
      state.eraserMode = false;
      btnEraser?.classList.remove('active');
      editorCanvas.classList.remove('eraser-cursor');
    }
    renderEditor();
  });

  // Goma de borrar
  btnEraser?.addEventListener('click', () => {
    state.eraserMode = !state.eraserMode;
    btnEraser.classList.toggle('active', state.eraserMode);
    editorCanvas.classList.toggle('eraser-cursor', state.eraserMode);
    if (state.eraserMode) {
      brushShapePicker.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
    } else {
      const activeBtn = brushShapePicker.querySelector(`[data-shape="${state.brushShape}"]`);
      activeBtn?.classList.add('active');
    }
    renderEditor();
  });
  
  brushColor?.addEventListener('input', (e) => {
    state.brushColor = e.target.value;
  });
  
  // Navegación de letras
  btnPrevLetter?.addEventListener('click', () => {
    navigateToLetter('prev');
  });
  
  btnNextLetter?.addEventListener('click', () => {
    navigateToLetter('next');
  });

  // Tabs del panel lateral
  function switchPage(page) {
    if (state.currentPage === page) return;
    state.currentPage = page;
    tabLetters?.classList.toggle('active', page === 'letters');
    tabSymbols?.classList.toggle('active', page === 'symbols');
    tabAlts?.classList.toggle('active', page === 'alts');

    if (page === 'alts') {
      const base = isAltKey(state.currentLetter) ? getAltBase(state.currentLetter) : state.currentLetter;
      const allChars = [...ALPHABET, ...SYMBOLS];
      state.altBaseLetter = allChars.includes(base) ? base : 'A';
      state.currentLetter = state.altBaseLetter;
    } else {
      // Al salir de alts, volver a la letra base si estábamos en una alternativa
      if (isAltKey(state.currentLetter)) {
        state.currentLetter = getAltBase(state.currentLetter);
      }
      const chars = currentPageChars();
      if (!chars.includes(state.currentLetter)) state.currentLetter = chars[0];
    }

    state.selectedCell = null;
    populateLetterSelect();
    updateGridInfo();
    updateCellControls();
    renderAlphabetGrid();
    renderEditor();
  }

  tabLetters?.addEventListener('click', () => switchPage('letters'));
  tabSymbols?.addEventListener('click', () => switchPage('symbols'));
  tabAlts?.addEventListener('click', () => switchPage('alts'));

  // Atajos de teclado
  document.addEventListener('keydown', (e) => {
    // Ctrl+Z / Cmd+Z para deshacer
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undo();
    }

    // E para activar/desactivar goma
    if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey && state.brushMode) {
      if (btnEraser) btnEraser.click();
    }

    // Escape para cerrar el overlay de previsualización
    if (e.key === 'Escape' && previewOverlay?.classList.contains('open')) {
      closePreviewOverlay();
    }

    // Flechas para navegar letras
    if (e.key === 'ArrowLeft') {
      navigateToLetter('prev');
    }
    if (e.key === 'ArrowRight') {
      navigateToLetter('next');
    }

    // R para rotar
    if (e.key === 'r' || e.key === 'R') {
      if (state.brushMode && !state.eraserMode) {
        const shape = SHAPES[state.brushShape];
        if (shape) {
          state.brushRotation = (state.brushRotation + 1) % shape.rotations;
          renderEditor();
        }
      }
    }
  });
  
  // Controles de columnas
  btnIncCols?.addEventListener('click', () => {
    if (state.gridCols < 8) {
      changeGlobalGridCols(state.gridCols + 1);
    }
  });
  
  btnDecCols?.addEventListener('click', () => {
    if (state.gridCols > 2) {
      changeGlobalGridCols(state.gridCols - 1);
      if (state.selectedCell && state.selectedCell.col >= state.gridCols) {
        state.selectedCell = null;
        updateCellControls();
      }
    }
  });
  
  // Controles de filas
  btnIncRows?.addEventListener('click', () => {
    if (state.proportionsEnabled) return;
    
    if (state.gridRows < 8) {
      changeGlobalGridRows(state.gridRows + 1);
    }
  });
  
  btnDecRows?.addEventListener('click', () => {
    if (state.proportionsEnabled) return;
    
    if (state.gridRows > 2) {
      changeGlobalGridRows(state.gridRows - 1);
      if (state.selectedCell && state.selectedCell.row >= state.gridRows) {
        state.selectedCell = null;
        updateCellControls();
      }
    }
  });
  
  shapeSelect?.addEventListener('change', (e) => {
    if (state.selectedCell) {
      const { row, col } = state.selectedCell;
      const letter = state.letters[state.currentLetter];
      letter.grid[row][col].shape = e.target.value;
      letter.grid[row][col].rotation = 0;
      saveToHistory();
      renderEditor();
      renderPreview();
      renderAlphabetGrid();
    }
  });
  
  btnRotate?.addEventListener('click', () => {
    if (state.selectedCell) {
      const { row, col } = state.selectedCell;
      const letter = state.letters[state.currentLetter];
      const cell = letter.grid[row][col];
      const shape = SHAPES[cell.shape];
      
      if (shape && shape.rotations > 1) {
        cell.rotation = (cell.rotation + 1) % shape.rotations;
        saveToHistory();
        renderEditor();
        renderPreview();
        renderAlphabetGrid();
      }
    }
  });
  
  document.getElementById('btnClearLetter')?.addEventListener('click', () => {
    const letter = state.letters[state.currentLetter];
    letter.grid = letter.grid.map(row => 
      row.map(() => ({ shape: 'empty', rotation: 0, color: '#000000' }))
    );
    state.selectedCell = null;
    updateCellControls();
    saveToHistory();
    renderEditor();
    renderPreview();
    renderAlphabetGrid();
  });
  
  document.getElementById('btnReset')?.addEventListener('click', () => {
    if (confirm('¿Resetear todas las letras?')) {
      state.xHeight = 2;
      state.ascender = 1;
      state.descender = 1;
      state.gridCols = 4;
      state.gridRows = 4;
      state.proportionsEnabled = false;
      if (toggleProportions) toggleProportions.checked = false;
      if (proportionsControls) proportionsControls.style.display = 'none';

      ALPHABET.forEach(letter => {
        state.letters[letter] = initLetter(letter);
      });
      state.selectedCell = null;
      state.history = [];
      state.historyIndex = -1;
      try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
      saveToHistory();
      updateGridInfo();
      updateCellControls();
      renderEditor();
      renderPreview();
      renderAlphabetGrid();
    }
  });
  
  document.getElementById('btnExport')?.addEventListener('click', exportJSON);
  document.getElementById('btnExportImage')?.addEventListener('click', exportImage);
  document.getElementById('btnExportFont')?.addEventListener('click', exportFont);
  document.getElementById('fileImport')?.addEventListener('change', importJSON);
  
  alphabetToggle?.addEventListener('click', () => {
    alphabetPanel.classList.toggle('collapsed');
  });
  
  // Proporciones tipográficas
  btnIncXHeight?.addEventListener('click', () => {
    if (state.xHeight < 6) {
      state.xHeight++;
      adjustAllLetterHeights();
      updateGridInfo();
      saveToHistory();
      renderEditor();
      renderPreview();
      renderAlphabetGrid();
    }
  });
  
  btnDecXHeight?.addEventListener('click', () => {
    if (state.xHeight > 1) {
      state.xHeight--;
      adjustAllLetterHeights();
      updateGridInfo();
      saveToHistory();
      renderEditor();
      renderPreview();
      renderAlphabetGrid();
    }
  });
  
  btnIncAscender?.addEventListener('click', () => {
    if (state.ascender < 4) {
      state.ascender++;
      adjustAllLetterHeights();
      updateGridInfo();
      saveToHistory();
      renderEditor();
      renderPreview();
      renderAlphabetGrid();
    }
  });
  
  btnDecAscender?.addEventListener('click', () => {
    if (state.ascender > 0) {
      state.ascender--;
      adjustAllLetterHeights();
      updateGridInfo();
      saveToHistory();
      renderEditor();
      renderPreview();
      renderAlphabetGrid();
    }
  });
  
  btnIncDescender?.addEventListener('click', () => {
    if (state.descender < 4) {
      state.descender++;
      adjustAllLetterHeights();
      updateGridInfo();
      saveToHistory();
      renderEditor();
      renderPreview();
      renderAlphabetGrid();
    }
  });
  
  btnDecDescender?.addEventListener('click', () => {
    if (state.descender > 0) {
      state.descender--;
      adjustAllLetterHeights();
      updateGridInfo();
      saveToHistory();
      renderEditor();
      renderPreview();
      renderAlphabetGrid();
    }
  });
  
  toggleGuides?.addEventListener('change', (e) => {
    state.showGuides = e.target.checked;
    renderEditor();
  });

  // ── Overlay de previsualización ──
  btnOpenPreview?.addEventListener('click', openPreviewOverlay);
  btnClosePreview?.addEventListener('click', closePreviewOverlay);

  previewOverlayText?.addEventListener('input', renderOverlayPreview);

  btnFontSizeInc?.addEventListener('click', () => {
    if (state.previewFontSize < 400) {
      state.previewFontSize = Math.min(400, state.previewFontSize + (state.previewFontSize < 100 ? 10 : 20));
      fontSizeLabel.textContent = state.previewFontSize;
      renderOverlayPreview();
    }
  });

  btnFontSizeDec?.addEventListener('click', () => {
    if (state.previewFontSize > 20) {
      state.previewFontSize = Math.max(20, state.previewFontSize - (state.previewFontSize <= 100 ? 10 : 20));
      fontSizeLabel.textContent = state.previewFontSize;
      renderOverlayPreview();
    }
  });

}

init();