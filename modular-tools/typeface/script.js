// ========================================
// CONFIGURACIÓN Y FORMAS DISPONIBLES
// ========================================

const STROKE_WIDTH = 12;

const SHAPES = {
  empty: {
    name: 'Vacío',
    rotations: 1,
    draw: () => {}
  },
  
  line: {
    name: 'Línea',
    rotations: 4,
    draw: (ctx, x, y, s, rotation, color = '#000000') => {
      const w = s * (STROKE_WIDTH / 100);
      ctx.save();
      ctx.translate(x + s/2, y + s/2);
      ctx.rotate((rotation * Math.PI) / 2);
      ctx.translate(-s/2, -s/2);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, s, w);
      ctx.restore();
    }
  },
  
  quarter: {
    name: '1/4 Círculo',
    rotations: 4,
    draw: (ctx, x, y, s, rotation, color = '#000000') => {
      const w = s * (STROKE_WIDTH / 100);
      ctx.save();
      ctx.translate(x + s/2, y + s/2);
      ctx.rotate((rotation * Math.PI) / 2);
      ctx.translate(-s/2, -s/2);
      const radius = s - w/2;
      ctx.beginPath();
      ctx.arc(s, s, radius, Math.PI, Math.PI * 1.5);
      ctx.lineWidth = w;
      ctx.lineCap = 'butt';
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.restore();
    }
  },
  
  half: {
    name: '1/2 Círculo',
    rotations: 4,
    draw: (ctx, x, y, s, rotation, color = '#000000') => {
      const w = s * (STROKE_WIDTH / 100);
      ctx.save();
      ctx.translate(x + s/2, y + s/2);
      ctx.rotate((rotation * Math.PI) / 2);
      ctx.translate(-s/2, -s/2);
      const radius = (s/2) - w/2;
      ctx.beginPath();
      ctx.arc(s/2, s, radius, Math.PI, 0);
      ctx.lineWidth = w;
      ctx.lineCap = 'butt';
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.restore();
    }
  },
  
  circle: {
    name: 'Círculo',
    rotations: 1,
    draw: (ctx, x, y, s, rotation, color = '#000000') => {
      const w = s * (STROKE_WIDTH / 100);
      const radius = (s/2) - w/2;
      ctx.beginPath();
      ctx.arc(x + s/2, y + s/2, radius, 0, Math.PI * 2);
      ctx.lineWidth = w;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
  },
  
  diagonal: {
    name: 'Diagonal',
    rotations: 4,
    draw: (ctx, x, y, s, rotation, color = '#000000') => {
      const w = s * (STROKE_WIDTH / 100);
      ctx.save();
      ctx.translate(x + s/2, y + s/2);
      ctx.rotate((rotation * Math.PI) / 2);
      ctx.translate(-s/2, -s/2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s, s);
      ctx.lineWidth = w;
      ctx.lineCap = 'butt';
      ctx.strokeStyle = color;
      ctx.stroke();
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
  brushMode: true, // Activado por defecto
  brushColor: '#000000',
  brushShape: 'line',
  brushRotation: 0,
  isPainting: false,
  isErasing: false,
  history: [], // Para Ctrl+Z
  historyIndex: -1,
  maxHistory: 50
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
}

function undo() {
  if (state.historyIndex > 0) {
    state.historyIndex--;
    state.letters = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
    renderEditor();
    renderPreview();
    renderAlphabetGrid();
  }
}

// Inicializar historial
saveToHistory();

// ========================================
// NAVEGACIÓN DE LETRAS
// ========================================

function navigateToLetter(direction) {
  const currentIndex = ALPHABET.indexOf(state.currentLetter);
  let newIndex;
  
  if (direction === 'next') {
    newIndex = (currentIndex + 1) % ALPHABET.length;
  } else {
    newIndex = (currentIndex - 1 + ALPHABET.length) % ALPHABET.length;
  }
  
  state.currentLetter = ALPHABET[newIndex];
  state.selectedCell = null;
  letterSelect.value = state.currentLetter;
  updateGridInfo();
  updateCellControls();
  renderEditor();
  renderAlphabetGrid();
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
const noCellSelected = document.getElementById('noCellSelected');
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
const brushColor = document.getElementById('brushColor');
const brushShape = document.getElementById('brushShape');

const btnPrevLetter = document.getElementById('btnPrevLetter');
const btnNextLetter = document.getElementById('btnNextLetter');

// ========================================
// INICIALIZACIÓN
// ========================================

function init() {
  setupCanvas();
  populateLetterSelect();
  populateShapeSelect();
  populateBrushShapeSelect();
  updateGridInfo();
  renderAlphabetGrid();
  renderEditor();
  renderPreview();
  setupEventListeners();
}

function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  editorCanvas.width = 480 * dpr;
  editorCanvas.height = 480 * dpr;
  editorCtx.scale(dpr, dpr);
  previewCanvas.width = 800 * dpr;
  previewCanvas.height = 120 * dpr;
  previewCtx.scale(dpr, dpr);
}

function populateLetterSelect() {
  letterSelect.innerHTML = '';
  ALPHABET.forEach(letter => {
    const option = document.createElement('option');
    option.value = letter;
    option.textContent = letter;
    letterSelect.appendChild(option);
  });
  letterSelect.value = state.currentLetter;
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

function populateBrushShapeSelect() {
  brushShape.innerHTML = '';
  Object.entries(SHAPES).forEach(([shapeId, shape]) => {
    if (shapeId === 'empty') return;
    const option = document.createElement('option');
    option.value = shapeId;
    option.textContent = shape.name;
    brushShape.appendChild(option);
  });
  brushShape.value = 'line';
}

function updateGridInfo() {
  const letter = state.letters[state.currentLetter];
  colsValue.textContent = state.gridCols;
  rowsValue.textContent = state.proportionsEnabled ? letter.rows : state.gridRows;
  gridInfo.textContent = `Grilla ${state.gridCols}×${letter.rows}`;
  xHeightValue.textContent = state.xHeight;
  ascenderValue.textContent = state.ascender;
  descenderValue.textContent = state.descender;
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
  const canvas = editorCanvas;
  const ctx = editorCtx;
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  
  ctx.clearRect(0, 0, w, h);
  
  const letter = state.letters[state.currentLetter];
  const gridCols = letter.cols;
  const gridRows = letter.rows;
  
  const cellSizeW = w / gridCols;
  const cellSizeH = h / gridRows;
  const cellSize = Math.min(cellSizeW, cellSizeH);
  
  const gridWidth = cellSize * gridCols;
  const gridHeight = cellSize * gridRows;
  const offsetX = (w - gridWidth) / 2;
  const offsetY = (h - gridHeight) / 2;
  
  // Grilla
  ctx.strokeStyle = '#d0d0d0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= gridCols; i++) {
    ctx.beginPath();
    ctx.moveTo(offsetX + i * cellSize, offsetY);
    ctx.lineTo(offsetX + i * cellSize, offsetY + gridHeight);
    ctx.stroke();
  }
  for (let i = 0; i <= gridRows; i++) {
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY + i * cellSize);
    ctx.lineTo(offsetX + gridWidth, offsetY + i * cellSize);
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
    
    let baselineY = offsetY;
    if (type === 'descender') {
      baselineY = offsetY + state.descender * cellSize;
    }
    
    ctx.beginPath();
    ctx.moveTo(offsetX, baselineY);
    ctx.lineTo(offsetX + gridWidth, baselineY);
    ctx.stroke();
    
    const xHeightY = baselineY - state.xHeight * cellSize;
    ctx.beginPath();
    ctx.moveTo(offsetX, xHeightY);
    ctx.lineTo(offsetX + gridWidth, xHeightY);
    ctx.stroke();
    
    if (type === 'ascender' || type === 'cap') {
      const capY = baselineY - (state.xHeight + state.ascender) * cellSize;
      ctx.beginPath();
      ctx.moveTo(offsetX, capY);
      ctx.lineTo(offsetX + gridWidth, capY);
      ctx.stroke();
    }
    
    if (type === 'descender') {
      const descY = baselineY + state.descender * cellSize;
      ctx.beginPath();
      ctx.moveTo(offsetX, descY);
      ctx.lineTo(offsetX + gridWidth, descY);
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
        const x = offsetX + colIndex * cellSize;
        const y = offsetY + rowIndex * cellSize;
        shape.draw(ctx, x, y, cellSize, cell.rotation, cell.color);
      }
    });
  });
  
  // Celda seleccionada
  if (state.selectedCell && !state.brushMode) {
    const { row, col } = state.selectedCell;
    const x = offsetX + col * cellSize;
    const y = offsetY + row * cellSize;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
  }
  
  // Hover
  if (state.hoveredCell && !state.selectedCell && !state.brushMode) {
    const { row, col } = state.hoveredCell;
    const x = offsetX + col * cellSize;
    const y = offsetY + row * cellSize;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(x + 4, y + 4, cellSize - 8, cellSize - 8);
  }
  
  // Preview del pincel
  if (state.hoveredCell && state.brushMode && !state.isPainting) {
    const { row, col } = state.hoveredCell;
    const x = offsetX + col * cellSize;
    const y = offsetY + row * cellSize;
    ctx.save();
    ctx.globalAlpha = 0.4;
    const shape = SHAPES[state.brushShape];
    if (shape) {
      shape.draw(ctx, x, y, cellSize, state.brushRotation, state.brushColor);
    }
    ctx.restore();
  }
  
  currentLetterLabel.textContent = state.currentLetter;
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

function renderAlphabetGrid() {
  alphabetGrid.innerHTML = '';
  
  ALPHABET.forEach(letter => {
    const card = document.createElement('div');
    card.className = 'letter-card';
    if (letter === state.currentLetter) {
      card.classList.add('active');
    }
    
    const header = document.createElement('div');
    header.className = 'letter-card-header';
    
    const name = document.createElement('span');
    name.className = 'letter-name';
    name.textContent = letter;
    
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
      state.currentLetter = letter;
      state.selectedCell = null;
      letterSelect.value = letter;
      updateGridInfo();
      updateCellControls();
      renderEditor();
      renderAlphabetGrid();
    });
    
    alphabetGrid.appendChild(card);
  });
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
  renderPreview();
  renderAlphabetGrid();
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
    noCellSelected.style.display = 'none';
    
    shapeSelect.value = cell.shape;
  } else {
    cellControls.style.display = 'none';
    noCellSelected.style.display = 'block';
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
  
  const w = rect.width;
  const h = rect.height;
  
  const letter = state.letters[state.currentLetter];
  const gridCols = letter.cols;
  const gridRows = letter.rows;
  
  const cellSizeW = w / gridCols;
  const cellSizeH = h / gridRows;
  const cellSize = Math.min(cellSizeW, cellSizeH);
  
  const gridWidth = cellSize * gridCols;
  const gridHeight = cellSize * gridRows;
  const offsetX = (w - gridWidth) / 2;
  const offsetY = (h - gridHeight) / 2;
  
  const col = Math.floor((x - offsetX) / cellSize);
  const row = Math.floor((y - offsetY) / cellSize);
  
  if (row >= 0 && row < gridRows && col >= 0 && col < gridCols) {
    return { row, col };
  }
  
  return null;
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
    state.currentLetter = e.target.value;
    state.selectedCell = null;
    updateGridInfo();
    updateCellControls();
    renderEditor();
    renderAlphabetGrid();
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
      state.isErasing = e.shiftKey;
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
        state.isErasing = e.shiftKey;
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
    }
    renderEditor();
  });
  
  brushColor?.addEventListener('input', (e) => {
    state.brushColor = e.target.value;
  });
  
  brushShape?.addEventListener('change', (e) => {
    state.brushShape = e.target.value;
    state.brushRotation = 0;
    renderEditor();
  });
  
  // Navegación de letras
  btnPrevLetter?.addEventListener('click', () => {
    navigateToLetter('prev');
  });
  
  btnNextLetter?.addEventListener('click', () => {
    navigateToLetter('next');
  });
  
  // Atajos de teclado
  document.addEventListener('keydown', (e) => {
    // Ctrl+Z para deshacer
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undo();
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
      if (state.brushMode) {
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
}

init();