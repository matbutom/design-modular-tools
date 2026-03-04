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
  grid: [],
  cols: 8,
  rows: 8,
  hoveredCell: null,
  selectedCell: null,
  brushMode: false,
  brushColor: '#000000',
  brushShape: 'line',
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
const brushShape = document.getElementById('brushShape');

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
  editorCanvas.width = 800 * dpr;
  editorCanvas.height = 800 * dpr;
  editorCtx.scale(dpr, dpr);
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

// ========================================
// RENDERIZADO
// ========================================

function renderEditor() {
  const canvas = editorCanvas;
  const ctx = editorCtx;
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  
  ctx.clearRect(0, 0, w, h);
  
  const cellSizeW = w / state.cols;
  const cellSizeH = h / state.rows;
  const cellSize = Math.min(cellSizeW, cellSizeH);
  
  const gridWidth = cellSize * state.cols;
  const gridHeight = cellSize * state.rows;
  const offsetX = (w - gridWidth) / 2;
  const offsetY = (h - gridHeight) / 2;
  
  // Grilla
  ctx.strokeStyle = '#d0d0d0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= state.cols; i++) {
    ctx.beginPath();
    ctx.moveTo(offsetX + i * cellSize, offsetY);
    ctx.lineTo(offsetX + i * cellSize, offsetY + gridHeight);
    ctx.stroke();
  }
  for (let i = 0; i <= state.rows; i++) {
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY + i * cellSize);
    ctx.lineTo(offsetX + gridWidth, offsetY + i * cellSize);
    ctx.stroke();
  }
  
  // Formas
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  
  state.grid.forEach((row, rowIndex) => {
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
  
  // Hover (solo si no está en modo pincel)
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
  
  colsValue.textContent = newCols;
  rowsValue.textContent = newRows;
}

function getCellFromEvent(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  const w = rect.width;
  const h = rect.height;
  
  const cellSizeW = w / state.cols;
  const cellSizeH = h / state.rows;
  const cellSize = Math.min(cellSizeW, cellSizeH);
  
  const gridWidth = cellSize * state.cols;
  const gridHeight = cellSize * state.rows;
  const offsetX = (w - gridWidth) / 2;
  const offsetY = (h - gridHeight) / 2;
  
  const col = Math.floor((x - offsetX) / cellSize);
  const row = Math.floor((y - offsetY) / cellSize);
  
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
  
  // Forma del pincel
  brushShape.addEventListener('change', (e) => {
    state.brushShape = e.target.value;
    state.brushRotation = 0;
    renderEditor();
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
    if (state.cols < 20) {
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
    if (state.rows < 20) {
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
  
  // Controles de celda
  shapeSelect.addEventListener('change', (e) => {
    if (state.selectedCell) {
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
        cell.rotation = (cell.rotation + 1) % shape.rotations;
        renderEditor();
      }
    }
  });
  
  // Botones
  document.getElementById('btnClear').addEventListener('click', () => {
    if (confirm('¿Limpiar todo el lienzo?')) {
      state.grid = initGrid(state.cols, state.rows);
      state.selectedCell = null;
      updateCellControls();
      renderEditor();
    }
  });
  
  document.getElementById('btnExport').addEventListener('click', exportPNG);
}

// ========================================
// INICIO
// ========================================

init();