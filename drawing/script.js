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
// HISTORIAL (UNDO)
// ========================================

const MAX_HISTORY = 50;
const history = [];

function pushHistory() {
  history.push(state.grid.map(row => row.map(cell => ({ ...cell }))));
  if (history.length > MAX_HISTORY) history.shift();
}

function undo() {
  if (history.length === 0) return;
  state.grid = history.pop();
  // Ajustar si la grilla guardada tiene distinto tamaño
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
  isPainting: false,
  isErasing: false,
};

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

// ========================================
// INICIALIZACIÓN
// ========================================

function init() {
  setupCanvas();
  populateShapeSelect();
  populateBrushShapeSelect();
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
  const maxH = window.innerHeight - 140; // viewport minus header and padding
  container.style.maxWidth = Math.floor(Math.min(800, maxH * ratio)) + 'px';
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
  if (state.selectedCell && !state.brushMode) {
    const { row, col } = state.selectedCell;
    const x = col * cellSize;
    const y = row * cellSize;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
  }

  // Hover (solo si no está en modo pincel)
  if (state.hoveredCell && !state.selectedCell && !state.brushMode) {
    const { row, col } = state.hoveredCell;
    const x = col * cellSize;
    const y = row * cellSize;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(x + 4, y + 4, cellSize - 8, cellSize - 8);
  }

  // Preview del pincel
  if (state.hoveredCell && state.brushMode && !state.isPainting) {
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
}

// ========================================
// PINCEL
// ========================================

function paintCell(row, col) {
  if (state.isErasing) {
    state.grid[row][col] = { shape: 'empty', rotation: 0, color: '#000000' };
  } else {
    state.grid[row][col] = {
      shape: state.brushShape,
      rotation: state.brushRotation,
      color: state.brushColor
    };
  }
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
  if (state.selectedCell && !state.brushMode) {
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

function getCellFromEvent(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const col = Math.floor(x / (rect.width / state.cols));
  const row = Math.floor(y / (rect.height / state.rows));

  if (row >= 0 && row < state.rows && col >= 0 && col < state.cols) {
    return { row, col };
  }

  return null;
}

// ========================================
// EXPORTAR
// ========================================

function exportPNG() {
  const link = document.createElement('a');
  link.download = 'dibujo-modular.png';
  link.href = editorCanvas.toDataURL();
  link.click();
}

function exportSVG() {
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
  // Canvas - clic derecho (solo si no está en modo pincel)
  editorCanvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (state.brushMode) return;
    
    const cell = getCellFromEvent(e);
    if (cell) {
      showContextMenu(e.pageX, e.pageY, cell.row, cell.col);
    }
  });
  
  // Canvas - mousedown
  editorCanvas.addEventListener('mousedown', (e) => {
    const cell = getCellFromEvent(e);
    if (!cell) return;
    
    if (state.brushMode) {
      pushHistory();
      state.isPainting = true;
      state.isErasing = e.shiftKey;
      paintCell(cell.row, cell.col);
    } else {
      state.selectedCell = cell;
      updateCellControls();
      renderEditor();
    }
  });
  
  // Canvas - mouseup
  document.addEventListener('mouseup', () => {
    state.isPainting = false;
  });
  
  // Canvas - mousemove
  editorCanvas.addEventListener('mousemove', (e) => {
    const cell = getCellFromEvent(e);
    
    if (cell) {
      state.hoveredCell = cell;
      
      // Pintar si está en modo pincel y arrastrando
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
  
  // Cerrar menú contextual
  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target) && e.target !== editorCanvas) {
      hideContextMenu();
    }
  });
  
  // Toggle modo pincel
  toggleBrush.addEventListener('change', (e) => {
    state.brushMode = e.target.checked;
    brushControls.style.display = state.brushMode ? 'block' : 'none';
    
    if (state.brushMode) {
      state.selectedCell = null;
      updateCellControls();
    }
    
    renderEditor();
  });
  
  // Color del pincel
  brushColor.addEventListener('input', (e) => {
    state.brushColor = e.target.value;
  });
  
  // Rotar forma del pincel con tecla R
  document.addEventListener('keydown', (e) => {
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
  
  document.getElementById('btnExport').addEventListener('click', exportPNG);
  document.getElementById('btnExportSVG').addEventListener('click', exportSVG);
}

// ========================================
// INICIO
// ========================================

init();