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
// HISTORIAL (UNDO / REDO)
// ========================================

const MAX_HISTORY = 50;
const undoStack = [];
const redoStack = [];

// Copia de la grilla, la paleta y el dibujo guardado que se está editando
function snapshot() {
  return {
    grid: state.grid.map(row => row.map(cell => ({ ...cell }))),
    palette: [...state.palette],
    drawingId: state.currentDrawingId
  };
}

function pushHistory() {
  if (state.selection) commitSelection(); // la selección flotante no está en la grilla
  undoStack.push(snapshot());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0; // un cambio nuevo invalida lo rehecho
}

function undo() {
  if (state.selection) commitSelection();
  if (undoStack.length === 0) return;
  redoStack.push(snapshot());
  restoreSnapshot(undoStack.pop());
}

function redo() {
  if (state.selection) commitSelection();
  if (redoStack.length === 0) return;
  undoStack.push(snapshot());
  restoreSnapshot(redoStack.pop());
}

function restoreSnapshot(snap) {
  state.grid = snap.grid;
  state.palette = snap.palette;
  savePalette();
  renderPalette();
  // Evita que "Guardar cambios" sobrescriba otro dibujo después de deshacer una carga
  state.currentDrawingId = snap.drawingId;
  renderGallery();
  syncGridDimensions();
}

// Ajustar controles y lienzo al tamaño de state.grid (puede haber cambiado)
function syncGridDimensions() {
  state.rows = state.grid.length;
  state.cols = state.grid[0]?.length ?? state.cols;
  colsValue.value = state.cols;
  rowsValue.value = state.rows;
  setupCanvas();
  if (state.selectedCell) {
    const { row, col } = state.selectedCell;
    if (row >= state.rows || col >= state.cols) state.selectedCell = null;
  }
  updateCellControls();
  renderEditor();
}

// ========================================
// ESTADO GLOBAL
// ========================================

const state = {
  grid: [],
  cols: 8,
  rows: 8,
  hoveredCell: null,
  selectedCell: null,
  brushMode: false,
  brushColor: '#000000',
  brushShape: 'square',
  brushRotation: 0,
  recolorMode: false,
  recolorPendingHistory: false,
  palette: [],
  isPainting: false,
  isErasing: false,
  rightErasing: false,
  selectMode: false,
  // Selección flotante (Ctrl/⌘ + A o por área): celdas levantadas de la grilla y su desplazamiento
  selection: null, // { cells: [{ row, col, cell }], box: { minRow, maxRow, minCol, maxCol }, dRow, dCol }
  dragSelection: null, // { startRow, startCol, baseDRow, baseDCol }
  marquee: null, // rectángulo que se está arrastrando en modo seleccionar: { startRow, startCol, endRow, endCol }
  // Galería de dibujos guardados
  drawings: [],
  currentDrawingId: null,
};

// Pincel o recolorear: ambos pintan arrastrando y desactivan la selección
function isPaintMode() {
  return state.brushMode || state.recolorMode;
}

// Ningún modo activo: click selecciona celda, click derecho abre el menú de formas
function isCellEditMode() {
  return !isPaintMode() && !state.selectMode;
}

// Inicializar grilla vacía
function initGrid(cols, rows) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({ shape: 'empty', rotation: 0, color: '#000000' });
    }
    grid.push(row);
  }
  return grid;
}

state.grid = initGrid(state.cols, state.rows);

// ========================================
// ELEMENTOS DEL DOM
// ========================================

const editorCanvas = document.getElementById('editorCanvas');
const editorCtx = editorCanvas.getContext('2d');
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

const toggleBrush = document.getElementById('toggleBrush');
const brushControls = document.getElementById('brushControls');
const brushColor = document.getElementById('brushColor');
const brushShapePicker = document.getElementById('brushShapePicker');

const toggleRecolor = document.getElementById('toggleRecolor');
const paletteGrid = document.getElementById('paletteGrid');
const paletteCount = document.getElementById('paletteCount');
const paletteImageInput = document.getElementById('paletteImageInput');

const toggleSelect = document.getElementById('toggleSelect');

const galleryList = document.getElementById('galleryList');
const galleryEmpty = document.getElementById('galleryEmpty');
const btnSaveDrawing = document.getElementById('btnSaveDrawing');
const btnSaveAsNew = document.getElementById('btnSaveAsNew');

// ========================================
// PALETA
// ========================================

const PALETTE_KEY = 'modular-drawing-palette-v1';
const DEFAULT_PALETTE = [
  '#000000', '#ffffff', '#e63946', '#f4a261',
  '#e9c46a', '#2a9d8f', '#457b9d', '#1d3557'
];

function loadPalette() {
  try {
    const saved = JSON.parse(localStorage.getItem(PALETTE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch (e) {}
  return [...DEFAULT_PALETTE];
}

function savePalette() {
  try {
    localStorage.setItem(PALETTE_KEY, JSON.stringify(state.palette));
  } catch (e) {}
}

function setActiveColor(color) {
  state.brushColor = color;
  brushColor.value = color;
  renderPalette();
  renderEditor();
}

function renderPalette() {
  paletteGrid.innerHTML = '';
  state.palette.forEach((color, index) => {
    const swatch = document.createElement('button');
    swatch.className = 'palette-swatch' + (color === state.brushColor ? ' active' : '');
    swatch.style.background = color;
    swatch.title = color;
    swatch.addEventListener('click', () => setActiveColor(color));
    swatch.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      pushHistory();
      state.palette.splice(index, 1);
      savePalette();
      renderPalette();
    });
    paletteGrid.appendChild(swatch);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'palette-swatch palette-add';
  addBtn.textContent = '+';
  addBtn.title = 'Guardar color activo';
  addBtn.addEventListener('click', () => {
    if (!state.palette.includes(state.brushColor)) {
      pushHistory();
      state.palette.push(state.brushColor);
      savePalette();
      renderPalette();
    }
  });
  paletteGrid.appendChild(addBtn);
}

// Extrae una paleta de una imagen con median cut
function paletteFromImage(img, count) {
  const MAX_SIDE = 120; // reducir la imagen acelera el cálculo sin perder colores dominantes
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // ignorar transparentes
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (pixels.length === 0) return [];

  const channelRange = (box, ch) => {
    let min = 255, max = 0;
    for (const p of box) {
      if (p[ch] < min) min = p[ch];
      if (p[ch] > max) max = p[ch];
    }
    return max - min;
  };

  // Dividir siempre la caja con mayor rango ponderado por cantidad de pixeles
  let boxes = [pixels];
  while (boxes.length < count) {
    let best = -1, bestScore = 0, bestCh = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let ch = 0; ch < 3; ch++) {
        const score = channelRange(box, ch) * box.length;
        if (score > bestScore) { bestScore = score; best = i; bestCh = ch; }
      }
    });
    if (best === -1) break; // no quedan cajas divisibles
    const box = boxes[best].sort((a, b) => a[bestCh] - b[bestCh]);
    const mid = box.length >> 1;
    boxes.splice(best, 1, box.slice(0, mid), box.slice(mid));
  }

  const average = (group) => {
    const sum = group.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]);
    return sum.map(v => v / group.length);
  };

  // Refinar con k-means: median cut mezcla colores vecinos, k-means los separa
  let centers = boxes.map(average);
  for (let iter = 0; iter < 8; iter++) {
    const groups = centers.map(() => []);
    for (const p of pixels) {
      let nearest = 0, nearestDist = Infinity;
      centers.forEach((c, i) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < nearestDist) { nearestDist = d; nearest = i; }
      });
      groups[nearest].push(p);
    }
    centers = groups.map((group, i) => group.length ? average(group) : centers[i]);
  }

  const toHex = (v) => Math.round(v).toString(16).padStart(2, '0');
  const colors = centers.map(([r, g, b]) => (
    { hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`, lum: 0.299 * r + 0.587 * g + 0.114 * b }
  ));

  // Ordenar de oscuro a claro y quitar duplicados
  colors.sort((a, b) => a.lum - b.lum);
  return [...new Set(colors.map(c => c.hex))];
}

function loadPaletteFromFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const count = Math.min(24, Math.max(2, parseInt(paletteCount.value, 10) || 8));
    paletteCount.value = count;
    const colors = paletteFromImage(img, count);
    URL.revokeObjectURL(url);
    if (colors.length === 0) return;
    pushHistory();
    state.palette = colors;
    savePalette();
    setActiveColor(colors[0]);
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

// ========================================
// GALERÍA DE DIBUJOS
// ========================================

const DRAWINGS_KEY = 'modular-drawing-gallery-v1';

function loadDrawings() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAWINGS_KEY));
    if (Array.isArray(saved)) return saved;
  } catch (e) {}
  return [];
}

function persistDrawings() {
  try {
    localStorage.setItem(DRAWINGS_KEY, JSON.stringify(state.drawings));
    return true;
  } catch (e) {
    alert('No se pudo guardar: el almacenamiento del navegador está lleno. Borra algunos dibujos e inténtalo de nuevo.');
    state.drawings = loadDrawings(); // volver a lo que sí quedó guardado
    return false;
  }
}

// Solo se guardan las celdas con forma: [fila, columna, forma, rotación, color]
function serializeGrid() {
  const cells = [];
  state.grid.forEach((row, r) => row.forEach((cell, c) => {
    if (cell.shape !== 'empty') cells.push([r, c, cell.shape, cell.rotation, cell.color]);
  }));
  return { cols: state.cols, rows: state.rows, cells };
}

function gridFromDrawing(drawing) {
  const grid = initGrid(drawing.cols, drawing.rows);
  drawing.cells.forEach(([r, c, shape, rotation, color]) => {
    grid[r][c] = { shape, rotation, color };
  });
  return grid;
}

function saveDrawing(asNew) {
  if (state.selection) commitSelection();
  const data = serializeGrid();
  if (data.cells.length === 0) {
    alert('El lienzo está vacío.');
    return;
  }

  const existing = !asNew && state.drawings.find(d => d.id === state.currentDrawingId);
  if (existing) {
    Object.assign(existing, data, { updatedAt: Date.now() });
  } else {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const drawing = { id, ...data, updatedAt: Date.now() };
    state.drawings.unshift(drawing);
    state.currentDrawingId = drawing.id;
  }
  if (!persistDrawings() && !existing) state.currentDrawingId = null;
  renderGallery();
}

function openDrawing(id) {
  const drawing = state.drawings.find(d => d.id === id);
  if (!drawing || id === state.currentDrawingId) return;
  pushHistory(); // Ctrl+Z vuelve a lo que había antes de abrirlo
  state.grid = gridFromDrawing(drawing);
  state.currentDrawingId = id;
  state.selectedCell = null;
  syncGridDimensions();
  renderGallery();
}

function newDrawing() {
  pushHistory();
  state.grid = initGrid(state.cols, state.rows);
  state.currentDrawingId = null;
  state.selectedCell = null;
  updateCellControls();
  renderEditor();
  renderGallery();
}

function deleteDrawing(id) {
  if (!confirm('¿Borrar este dibujo guardado?')) return;
  state.drawings = state.drawings.filter(d => d.id !== id);
  if (state.currentDrawingId === id) state.currentDrawingId = null;
  persistDrawings();
  renderGallery();
}

function drawThumbnail(canvas, drawing) {
  const dpr = window.devicePixelRatio || 1;
  const width = 160;
  const cellSize = width / drawing.cols;
  const height = cellSize * drawing.rows;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.aspectRatio = `${drawing.cols} / ${drawing.rows}`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  drawing.cells.forEach(([r, c, shape, rotation, color]) => {
    SHAPES[shape]?.draw(ctx, c * cellSize, r * cellSize, cellSize, rotation, color);
  });
}

function renderGallery() {
  const current = state.drawings.find(d => d.id === state.currentDrawingId);
  btnSaveDrawing.textContent = current ? 'Guardar cambios' : 'Guardar dibujo';
  btnSaveAsNew.style.display = current ? 'block' : 'none';
  galleryEmpty.style.display = state.drawings.length ? 'none' : 'block';

  galleryList.innerHTML = '';
  state.drawings.forEach(drawing => {
    const item = document.createElement('div');
    item.className = 'gallery-item' + (drawing.id === state.currentDrawingId ? ' active' : '');
    item.title = 'Abrir para editar';
    item.addEventListener('click', () => openDrawing(drawing.id));

    const thumb = document.createElement('canvas');
    drawThumbnail(thumb, drawing);
    item.appendChild(thumb);

    const caption = document.createElement('div');
    caption.className = 'gallery-caption';
    caption.textContent = `${drawing.cols}×${drawing.rows}`;
    item.appendChild(caption);

    const del = document.createElement('button');
    del.className = 'gallery-delete';
    del.textContent = '×';
    del.title = 'Borrar dibujo';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteDrawing(drawing.id);
    });
    item.appendChild(del);

    galleryList.appendChild(item);
  });
}

// ========================================
// INICIALIZACIÓN
// ========================================

function init() {
  setupCanvas();
  populateShapeSelect();
  populateBrushShapeSelect();
  state.palette = loadPalette();
  renderPalette();
  state.drawings = loadDrawings();
  renderGallery();
  renderEditor();
  setupEventListeners();
}

function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const base = 800;
  const ratio = state.cols / state.rows;
  const physW = ratio >= 1 ? base : Math.round(base * ratio);
  const physH = ratio >= 1 ? Math.round(base / ratio) : base;
  editorCanvas.width = physW * dpr;
  editorCanvas.height = physH * dpr;
  editorCtx.scale(dpr, dpr);
  const container = editorCanvas.parentElement;
  // Espacio disponible del editor (sin padding) para que el lienzo siempre quepa centrado
  const editor = container.parentElement;
  const style = getComputedStyle(editor);
  const maxW = editor.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const maxH = editor.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  container.style.maxWidth = Math.floor(Math.min(800, maxW, maxH * ratio)) + 'px';
  container.style.aspectRatio = `${state.cols} / ${state.rows}`;
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
      brushShapePicker.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderEditor();
    });
    brushShapePicker.appendChild(btn);
  });
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
  
  const cellSize = w / state.cols;

  // Grilla
  ctx.strokeStyle = '#d0d0d0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= state.cols; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cellSize, 0);
    ctx.lineTo(i * cellSize, h);
    ctx.stroke();
  }
  for (let i = 0; i <= state.rows; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * cellSize);
    ctx.lineTo(w, i * cellSize);
    ctx.stroke();
  }

  // Formas
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  state.grid.forEach((row, rowIndex) => {
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
  if (state.selectedCell && isCellEditMode()) {
    const { row, col } = state.selectedCell;
    const x = col * cellSize;
    const y = row * cellSize;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
  }

  // Hover (solo si no está en modo pincel ni recolorear)
  if (state.hoveredCell && !state.selectedCell && isCellEditMode() && !state.selection) {
    const { row, col } = state.hoveredCell;
    const x = col * cellSize;
    const y = row * cellSize;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(x + 4, y + 4, cellSize - 8, cellSize - 8);
  }

  // Preview del pincel
  if (state.hoveredCell && state.brushMode && !state.isPainting && !state.selection) {
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

  // Preview de recolorear: la forma de la celda con el color activo
  if (state.hoveredCell && state.recolorMode && !state.isPainting && !state.selection) {
    const { row, col } = state.hoveredCell;
    const cell = state.grid[row][col];
    const shape = SHAPES[cell.shape];
    if (shape && cell.shape !== 'empty') {
      ctx.save();
      ctx.globalAlpha = 0.6;
      shape.draw(ctx, col * cellSize, row * cellSize, cellSize, cell.rotation, state.brushColor);
      ctx.restore();
    }
  }

  // Selección flotante: formas desplazadas + contorno punteado
  if (state.selection) {
    const { cells, dRow, dCol } = state.selection;
    cells.forEach(({ row, col, cell }) => {
      SHAPES[cell.shape]?.draw(ctx, (col + dCol) * cellSize, (row + dRow) * cellSize, cellSize, cell.rotation, cell.color);
    });

    drawSelectionBox(ctx, selectionBounds(), cellSize);
  }

  // Área que se está seleccionando
  if (state.marquee) {
    drawSelectionBox(ctx, marqueeBox(state.marquee), cellSize);
  }
}

// Contorno punteado blanco/negro para que se vea sobre cualquier color
function drawSelectionBox(ctx, b, cellSize) {
  const x = b.minCol * cellSize;
  const y = b.minRow * cellSize;
  const bw = (b.maxCol - b.minCol + 1) * cellSize;
  const bh = (b.maxRow - b.minRow + 1) * cellSize;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 120, 255, 0.06)';
  ctx.fillRect(x, y, bw, bh);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
  ctx.lineDashOffset = 5;
  ctx.strokeStyle = '#000000';
  ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
  ctx.restore();
}

// ========================================
// PINCEL
// ========================================

function eraseCell(row, col) {
  state.grid[row][col] = { shape: 'empty', rotation: 0, color: '#000000' };
  renderEditor();
}

function paintCell(row, col) {
  if (state.isErasing) {
    eraseCell(row, col);
    return;
  }
  state.grid[row][col] = {
    shape: state.brushShape,
    rotation: state.brushRotation,
    color: state.brushColor
  };
  renderEditor();
}

function recolorCell(row, col) {
  const cell = state.grid[row][col];
  if (cell.shape === 'empty' || cell.color === state.brushColor) return;
  // Guardar historial solo al primer cambio real del trazo
  if (state.recolorPendingHistory) {
    pushHistory();
    state.recolorPendingHistory = false;
  }
  cell.color = state.brushColor;
  renderEditor();
}

// ========================================
// SELECCIÓN (Ctrl/⌘ + A o por área)
// ========================================

// Levanta las celdas con forma dentro de box a una capa flotante que se puede mover.
// Devuelve false si el área no tiene nada que levantar.
function liftArea(box) {
  if (state.selection) commitSelection();
  const cells = [];
  for (let r = box.minRow; r <= box.maxRow; r++) {
    for (let c = box.minCol; c <= box.maxCol; c++) {
      const cell = state.grid[r][c];
      if (cell.shape !== 'empty') cells.push({ row: r, col: c, cell });
    }
  }
  if (cells.length === 0) return false;

  pushHistory(); // Ctrl+Z deshace el movimiento completo
  cells.forEach(({ row, col }) => {
    state.grid[row][col] = { shape: 'empty', rotation: 0, color: '#000000' };
  });
  state.selection = { cells, box, dRow: 0, dCol: 0 };
  state.selectedCell = null;
  updateCellControls();
  renderEditor();
  return true;
}

// Ctrl/⌘ + A: el contorno se ajusta a lo dibujado
function selectAll() {
  if (state.selection) commitSelection();
  const box = { minRow: Infinity, maxRow: -1, minCol: Infinity, maxCol: -1 };
  state.grid.forEach((row, r) => row.forEach((cell, c) => {
    if (cell.shape === 'empty') return;
    box.minRow = Math.min(box.minRow, r);
    box.maxRow = Math.max(box.maxRow, r);
    box.minCol = Math.min(box.minCol, c);
    box.maxCol = Math.max(box.maxCol, c);
  }));
  if (box.maxRow === -1) return;
  liftArea(box);
}

// Rectángulo del marquee normalizado y limitado al lienzo
function marqueeBox(m) {
  return {
    minRow: Math.max(0, Math.min(m.startRow, m.endRow)),
    maxRow: Math.min(state.rows - 1, Math.max(m.startRow, m.endRow)),
    minCol: Math.max(0, Math.min(m.startCol, m.endCol)),
    maxCol: Math.min(state.cols - 1, Math.max(m.startCol, m.endCol))
  };
}

function selectionBounds() {
  const { box, dRow, dCol } = state.selection;
  return {
    minRow: box.minRow + dRow, maxRow: box.maxRow + dRow,
    minCol: box.minCol + dCol, maxCol: box.maxCol + dCol
  };
}

function isInsideSelection(row, col) {
  if (!state.selection) return false;
  const b = selectionBounds();
  return row >= b.minRow && row <= b.maxRow && col >= b.minCol && col <= b.maxCol;
}

function moveSelection(dRow, dCol) {
  state.selection.dRow += dRow;
  state.selection.dCol += dCol;
  renderEditor();
}

// Deja caer la selección en la grilla; lo que queda fuera del lienzo se pierde
function commitSelection() {
  const { cells, dRow, dCol } = state.selection;
  cells.forEach(({ row, col, cell }) => {
    const r = row + dRow;
    const c = col + dCol;
    if (r >= 0 && r < state.rows && c >= 0 && c < state.cols) {
      state.grid[r][c] = cell;
    }
  });
  state.selection = null;
  state.dragSelection = null;
  editorCanvas.style.cursor = '';
  renderEditor();
}

function deleteSelection() {
  state.selection = null;
  state.dragSelection = null;
  editorCanvas.style.cursor = '';
  renderEditor();
}

// ========================================
// MENÚ CONTEXTUAL
// ========================================

function showContextMenu(x, y, row, col) {
  contextMenuContent.innerHTML = '';
  
  const emptyItem = createContextMenuItem('empty', 0);
  emptyItem.addEventListener('click', () => {
    pushHistory();
    state.grid[row][col] = { shape: 'empty', rotation: 0, color: '#000000' };
    hideContextMenu();
    renderEditor();
  });
  contextMenuContent.appendChild(emptyItem);
  
  Object.entries(SHAPES).forEach(([shapeId, shape]) => {
    if (shapeId === 'empty') return;
    
    for (let rotation = 0; rotation < shape.rotations; rotation++) {
      const item = createContextMenuItem(shapeId, rotation);
      item.addEventListener('click', () => {
        pushHistory();
        state.grid[row][col] = { shape: shapeId, rotation, color: '#000000' };
        hideContextMenu();
        state.selectedCell = { row, col };
        updateCellControls();
        renderEditor();
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
// CONTROLES
// ========================================

function updateCellControls() {
  if (state.selectedCell && isCellEditMode()) {
    const { row, col } = state.selectedCell;
    const cell = state.grid[row][col];
    cellControls.style.display = 'flex';
    noCellSelected.style.display = 'none';
    shapeSelect.value = cell.shape;
  } else {
    cellControls.style.display = 'none';
    noCellSelected.style.display = 'block';
  }
}

function resizeGrid(newCols, newRows) {
  pushHistory();
  const oldGrid = state.grid;
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
  
  state.grid = newGrid;
  state.cols = newCols;
  state.rows = newRows;
  
  if (state.selectedCell) {
    const { row, col } = state.selectedCell;
    if (row >= newRows || col >= newCols) {
      state.selectedCell = null;
    }
  }
  
  colsValue.value = newCols;
  rowsValue.value = newRows;
  setupCanvas();
}

// Celda bajo el mouse, aunque esté fuera del lienzo (para arrastrar la selección)
function getRawCellFromEvent(e) {
  const rect = editorCanvas.getBoundingClientRect();
  return {
    row: Math.floor((e.clientY - rect.top) / (rect.height / state.rows)),
    col: Math.floor((e.clientX - rect.left) / (rect.width / state.cols))
  };
}

function getCellFromEvent(e) {
  const { row, col } = getRawCellFromEvent(e);

  if (row >= 0 && row < state.rows && col >= 0 && col < state.cols) {
    return { row, col };
  }

  return null;
}

// ========================================
// EXPORTAR
// ========================================

function exportPNG() {
  if (state.selection) commitSelection(); // sin el contorno punteado
  const link = document.createElement('a');
  link.download = 'dibujo-modular.png';
  link.href = editorCanvas.toDataURL();
  link.click();
}

function exportSVG() {
  if (state.selection) commitSelection();
  const dpr = window.devicePixelRatio || 1;
  const w = editorCanvas.width / dpr;
  const h = editorCanvas.height / dpr;
  const cellSize = w / state.cols;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('width', w);
  svg.setAttribute('height', h);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

  // Fondo blanco
  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', w);
  bg.setAttribute('height', h);
  bg.setAttribute('fill', '#ffffff');
  svg.appendChild(bg);

  // Grupo de formas
  const shapesGroup = document.createElementNS(ns, 'g');
  state.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell.shape === 'empty') return;
      const x = colIndex * cellSize;
      const y = rowIndex * cellSize;
      const s = cellSize;
      const color = cell.color || '#000000';
      let el;

      if (cell.shape === 'square') {
        el = document.createElementNS(ns, 'rect');
        el.setAttribute('x', x);
        el.setAttribute('y', y);
        el.setAttribute('width', s);
        el.setAttribute('height', s);
        el.setAttribute('fill', color);

      } else if (cell.shape === 'circle') {
        el = document.createElementNS(ns, 'circle');
        el.setAttribute('cx', x + s / 2);
        el.setAttribute('cy', y + s / 2);
        el.setAttribute('r', s / 2);
        el.setAttribute('fill', color);

      } else if (cell.shape === 'quarter') {
        // Arco desde (x+s, y) hasta (x, y+s) pasando por el cuadrante inferior-derecho
        // con rotación aplicada alrededor del centro de la celda
        el = document.createElementNS(ns, 'path');
        el.setAttribute('d', `M ${x},${y} L ${x + s},${y} A ${s},${s} 0 0,1 ${x},${y + s} Z`);
        el.setAttribute('fill', color);
        if (cell.rotation !== 0) {
          el.setAttribute('transform', `rotate(${cell.rotation * 90}, ${x + s / 2}, ${y + s / 2})`);
        }
      }

      if (el) shapesGroup.appendChild(el);
    });
  });
  svg.appendChild(shapesGroup);

  // Grilla
  const gridGroup = document.createElementNS(ns, 'g');
  gridGroup.setAttribute('stroke', '#d0d0d0');
  gridGroup.setAttribute('stroke-width', '1');
  for (let i = 0; i <= state.cols; i++) {
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', i * cellSize);
    line.setAttribute('y1', 0);
    line.setAttribute('x2', i * cellSize);
    line.setAttribute('y2', h);
    gridGroup.appendChild(line);
  }
  for (let i = 0; i <= state.rows; i++) {
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', 0);
    line.setAttribute('y1', i * cellSize);
    line.setAttribute('x2', w);
    line.setAttribute('y2', i * cellSize);
    gridGroup.appendChild(line);
  }
  svg.appendChild(gridGroup);

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svg);
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.download = 'dibujo-modular.svg';
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
  // Canvas - clic derecho (menú de formas solo sin modo activo)
  editorCanvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!isCellEditMode()) return;

    const cell = getCellFromEvent(e);
    if (cell) {
      showContextMenu(e.pageX, e.pageY, cell.row, cell.col);
    }
  });
  
  // Canvas - mousedown
  editorCanvas.addEventListener('mousedown', (e) => {
    const cell = getCellFromEvent(e);
    if (!cell) return;

    // Con selección flotante: arrastrar desde dentro, o soltarla al hacer click fuera
    if (state.selection) {
      if (e.button === 0 && isInsideSelection(cell.row, cell.col)) {
        state.dragSelection = {
          startRow: cell.row,
          startCol: cell.col,
          baseDRow: state.selection.dRow,
          baseDCol: state.selection.dCol
        };
        return;
      }
      commitSelection();
      // En modo seleccionar, el mismo click empieza un área nueva
      if (!state.selectMode || e.button !== 0) return;
    }

    // Modo seleccionar: arrastrar dibuja el área a levantar
    if (state.selectMode) {
      if (e.button !== 0) return;
      state.marquee = { startRow: cell.row, startCol: cell.col, endRow: cell.row, endCol: cell.col };
      renderEditor();
      return;
    }

    // Click derecho borra en pincel y recolorear (arrastrando borra varias)
    if (e.button === 2 && isPaintMode()) {
      pushHistory();
      state.isPainting = true;
      state.isErasing = true;
      state.rightErasing = true;
      eraseCell(cell.row, cell.col);
      return;
    }
    if (e.button !== 0) return;

    if (state.brushMode) {
      pushHistory();
      state.isPainting = true;
      state.isErasing = e.shiftKey;
      paintCell(cell.row, cell.col);
    } else if (state.recolorMode) {
      const target = state.grid[cell.row][cell.col];
      if (e.altKey) {
        // Cuentagotas: tomar el color de la celda
        if (target.shape !== 'empty') setActiveColor(target.color);
        return;
      }
      state.isPainting = true;
      state.recolorPendingHistory = true;
      recolorCell(cell.row, cell.col);
    } else {
      state.selectedCell = cell;
      updateCellControls();
      renderEditor();
    }
  });
  
  // Canvas - mouseup
  document.addEventListener('mouseup', () => {
    state.isPainting = false;
    state.rightErasing = false;
    state.dragSelection = null;
    if (state.marquee) {
      const box = marqueeBox(state.marquee);
      state.marquee = null;
      if (!liftArea(box)) renderEditor(); // área vacía: solo borrar el contorno
    }
  });

  // Arrastre del área y de la selección: en document para poder salir del lienzo
  document.addEventListener('mousemove', (e) => {
    if (state.marquee) {
      const { row, col } = getRawCellFromEvent(e);
      if (row !== state.marquee.endRow || col !== state.marquee.endCol) {
        state.marquee.endRow = row;
        state.marquee.endCol = col;
        renderEditor();
      }
      return;
    }

    const drag = state.dragSelection;
    if (!drag || !state.selection) return;
    const { row, col } = getRawCellFromEvent(e);
    const dRow = drag.baseDRow + row - drag.startRow;
    const dCol = drag.baseDCol + col - drag.startCol;
    if (dRow !== state.selection.dRow || dCol !== state.selection.dCol) {
      moveSelection(dRow - state.selection.dRow, dCol - state.selection.dCol);
    }
  });

  // Canvas - mousemove
  editorCanvas.addEventListener('mousemove', (e) => {
    const cell = getCellFromEvent(e);

    if (state.selection) {
      const overSelection = state.dragSelection || (cell && isInsideSelection(cell.row, cell.col));
      editorCanvas.style.cursor = overSelection ? 'move' : (state.selectMode ? 'crosshair' : '');
      return;
    }
    if (state.selectMode) {
      editorCanvas.style.cursor = 'crosshair';
      return;
    }

    if (cell) {
      state.hoveredCell = cell;

      // Pintar si está en modo pincel y arrastrando
      if (state.brushMode && state.isPainting) {
        state.isErasing = e.shiftKey || state.rightErasing;
        paintCell(cell.row, cell.col);
      } else if (state.recolorMode && state.isPainting) {
        if (state.rightErasing) eraseCell(cell.row, cell.col);
        else recolorCell(cell.row, cell.col);
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
    state.rightErasing = false;
    renderEditor();
  });
  
  // Cerrar menú contextual
  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target) && e.target !== editorCanvas) {
      hideContextMenu();
    }
  });
  
  // Pincel, recolorear y seleccionar son excluyentes: mode es 'brush', 'recolor', 'select' o null
  function setMode(mode) {
    if (state.selection) commitSelection();
    state.brushMode = mode === 'brush';
    state.recolorMode = mode === 'recolor';
    state.selectMode = mode === 'select';
    toggleBrush.checked = state.brushMode;
    toggleRecolor.checked = state.recolorMode;
    toggleSelect.checked = state.selectMode;
    brushControls.style.display = state.brushMode ? 'block' : 'none';
    editorCanvas.style.cursor = '';

    if (!isCellEditMode()) {
      state.selectedCell = null;
      updateCellControls();
    }

    renderEditor();
  }

  toggleBrush.addEventListener('change', (e) => {
    setMode(e.target.checked ? 'brush' : null);
  });

  toggleRecolor.addEventListener('change', (e) => {
    setMode(e.target.checked ? 'recolor' : null);
  });

  toggleSelect.addEventListener('change', (e) => {
    setMode(e.target.checked ? 'select' : null);
  });

  // Galería
  btnSaveDrawing.addEventListener('click', () => saveDrawing(false));
  btnSaveAsNew.addEventListener('click', () => saveDrawing(true));
  document.getElementById('btnNewDrawing').addEventListener('click', newDrawing);

  // Paleta desde imagen
  document.getElementById('btnPaletteFromImage').addEventListener('click', () => {
    paletteImageInput.click();
  });

  paletteImageInput.addEventListener('change', () => {
    const file = paletteImageInput.files[0];
    if (file) loadPaletteFromFile(file);
    paletteImageInput.value = ''; // permitir subir la misma imagen otra vez
  });

  // Color activo (pincel y recolorear)
  brushColor.addEventListener('input', (e) => {
    state.brushColor = e.target.value;
    renderPalette();
    renderEditor();
  });
  
  // Atajos: R rota el pincel, P/V cambian de modo, Ctrl+Z deshace, Ctrl+Shift+Z o Ctrl+Y rehace
  document.addEventListener('keydown', (e) => {
    // toLowerCase: con Shift o Bloq Mayús la tecla llega como 'Z'
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if (e.ctrlKey && key === 'y') {
      e.preventDefault();
      redo();
      return;
    }

    // En campos de texto/número, dejar los atajos nativos (seleccionar texto, flechas).
    // Toggles y color no cuentan: tras hacerles click quedan con el foco.
    if (e.target.closest?.('input:not([type=checkbox]):not([type=color]):not([type=file]), select, textarea')) return;

    if ((e.ctrlKey || e.metaKey) && key === 'a') {
      e.preventDefault();
      selectAll();
      return;
    }

    // P = pincel, V = seleccionar (sin modificadores: Ctrl/⌘ + P/V son imprimir/pegar)
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (key === 'p') {
        setMode(state.brushMode ? null : 'brush');
        return;
      }
      if (key === 'v') {
        setMode(state.selectMode ? null : 'select');
        return;
      }
    }

    if (state.selection) {
      const step = e.shiftKey ? 5 : 1;
      const arrows = {
        arrowup: [-step, 0], arrowdown: [step, 0],
        arrowleft: [0, -step], arrowright: [0, step]
      };
      if (arrows[key]) {
        e.preventDefault();
        moveSelection(...arrows[key]);
        return;
      }
      if (key === 'enter' || key === 'escape') {
        commitSelection();
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        deleteSelection();
        return;
      }
    }
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
  
  // Controles de grilla
  btnIncCols.addEventListener('click', () => {
    if (state.cols < 100) {
      resizeGrid(state.cols + 1, state.rows);
      renderEditor();
    }
  });
  
  btnDecCols.addEventListener('click', () => {
    if (state.cols > 2) {
      resizeGrid(state.cols - 1, state.rows);
      updateCellControls();
      renderEditor();
    }
  });
  
  btnIncRows.addEventListener('click', () => {
    if (state.rows < 100) {
      resizeGrid(state.cols, state.rows + 1);
      renderEditor();
    }
  });
  
  btnDecRows.addEventListener('click', () => {
    if (state.rows > 2) {
      resizeGrid(state.cols, state.rows - 1);
      updateCellControls();
      renderEditor();
    }
  });
  
  // Input numérico de columnas y filas
  function applyInputValue(input, getCurrent, applyFn) {
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 2 && val <= 100) {
      applyFn(val);
    } else {
      input.value = getCurrent();
    }
  }

  colsValue.addEventListener('change', () => {
    applyInputValue(colsValue, () => state.cols, (val) => {
      resizeGrid(val, state.rows);
      updateCellControls();
      renderEditor();
    });
  });

  rowsValue.addEventListener('change', () => {
    applyInputValue(rowsValue, () => state.rows, (val) => {
      resizeGrid(state.cols, val);
      updateCellControls();
      renderEditor();
    });
  });

  // Controles de celda
  shapeSelect.addEventListener('change', (e) => {
    if (state.selectedCell) {
      pushHistory();
      const { row, col } = state.selectedCell;
      state.grid[row][col].shape = e.target.value;
      state.grid[row][col].rotation = 0;
      renderEditor();
    }
  });
  
  btnRotate.addEventListener('click', () => {
    if (state.selectedCell) {
      const { row, col } = state.selectedCell;
      const cell = state.grid[row][col];
      const shape = SHAPES[cell.shape];

      if (shape && shape.rotations > 1) {
        pushHistory();
        cell.rotation = (cell.rotation + 1) % shape.rotations;
        renderEditor();
      }
    }
  });
  
  // Botones
  document.getElementById('btnClear').addEventListener('click', () => {
    if (confirm('¿Limpiar todo el lienzo?')) {
      pushHistory();
      state.grid = initGrid(state.cols, state.rows);
      state.selectedCell = null;
      updateCellControls();
      renderEditor();
    }
  });
  
  // Reajustar el lienzo al cambiar el tamaño de la ventana
  window.addEventListener('resize', () => {
    setupCanvas();
    renderEditor();
  });

  document.getElementById('btnExport').addEventListener('click', exportPNG);
  document.getElementById('btnExportSVG').addEventListener('click', exportSVG);
}

// ========================================
// INICIO
// ========================================

init();