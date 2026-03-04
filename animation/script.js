// ========================================
// FORMAS (modo manual)
// ========================================

const SHAPES = {
  empty:  { name: 'Vacío',      rotations: 1, draw: () => {} },
  square: {
    name: 'Cuadrado', rotations: 1,
    draw: (ctx, x, y, s, _r, color = '#000000') => {
      ctx.fillStyle = color; ctx.fillRect(x, y, s, s);
    }
  },
  circle: {
    name: 'Círculo', rotations: 1,
    draw: (ctx, x, y, s, _r, color = '#000000') => {
      ctx.beginPath(); ctx.arc(x + s/2, y + s/2, s/2, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    }
  },
  quarter: {
    name: '1/4 Círculo', rotations: 4,
    draw: (ctx, x, y, s, rotation, color = '#000000') => {
      ctx.save();
      ctx.translate(x + s/2, y + s/2); ctx.rotate((rotation * Math.PI) / 2);
      ctx.translate(-s/2, -s/2);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, s, 0, Math.PI / 2);
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      ctx.restore();
    }
  }
};

const SHAPE_ICONS = {
  square:  `<svg viewBox="0 0 20 20" fill="currentColor"><rect x="2" y="2" width="16" height="16"/></svg>`,
  circle:  `<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="8"/></svg>`,
  quarter: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2,2 L18,2 A16,16,0,0,1 2,18 Z"/></svg>`,
};

// ========================================
// PRESETS GENERATIVOS
// Cada función: (t, row, col, cols, rows, palette) => color (string hex)
// ========================================

const PRESETS = {
  capas: {
    name: 'Capas',
    fn: (t, r, c, cols, rows, pal) => {
      // Horizontal color bands with wavy boundaries — matches the reference image
      const wave = Math.sin(c * 0.7 + t * 0.9) * 1.8
                 + Math.sin(c * 0.25 - t * 0.5) * 1.0;
      const idx = Math.floor(((r + wave) / rows) * pal.length);
      return pal[Math.max(0, Math.min(pal.length - 1, idx))];
    }
  },
  olas: {
    name: 'Olas',
    fn: (t, r, c, cols, rows, pal) => {
      const v = Math.sin(c * 0.8 - t * 2 + r * 0.5) * 0.5 + 0.5;
      return pal[Math.min(Math.floor(v * pal.length), pal.length - 1)];
    }
  },
  ruido: {
    name: 'Ruido',
    fn: (t, r, c, cols, rows, pal) => {
      const v = (Math.sin(c * 1.3 + t * 0.8) * Math.cos(r * 0.9 + t * 0.6)
               + Math.sin((c - r) * 0.5 + t * 0.4)) / 2 * 0.5 + 0.5;
      return pal[Math.max(0, Math.min(pal.length - 1, Math.floor(v * pal.length)))];
    }
  },
  pulso: {
    name: 'Pulso',
    fn: (t, r, c, cols, rows, pal) => {
      const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
      const dist = Math.sqrt((c - cx) ** 2 + (r - cy) ** 2);
      const v = ((dist - t * 2.5) % pal.length + pal.length) % pal.length;
      return pal[Math.floor(v) % pal.length];
    }
  },
  diagonal: {
    name: 'Diagonal',
    fn: (t, r, c, cols, rows, pal) => {
      const v = ((c + r - t * 3) % pal.length + pal.length) % pal.length;
      return pal[Math.floor(v) % pal.length];
    }
  },
  espiral: {
    name: 'Espiral',
    fn: (t, r, c, cols, rows, pal) => {
      const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
      const angle = Math.atan2(r - cy, c - cx) / Math.PI;
      const dist  = Math.sqrt((c - cx) ** 2 + (r - cy) ** 2);
      const v = ((angle + dist * 0.6 - t * 1.2) % pal.length + pal.length) % pal.length;
      return pal[Math.floor(v) % pal.length];
    }
  },
};

const DEFAULT_PALETTES = [
  { name: 'Atardecer', colors: ['#212121', '#9c1752', '#d81b60', '#f4d03f', '#e67e22', '#c0392b'] },
  { name: 'Océano',    colors: ['#0d1b2a', '#1b4f72', '#2e86c1', '#1abc9c', '#76d7c4'] },
  { name: 'Bosque',    colors: ['#1a2a1a', '#1e8449', '#27ae60', '#a9dfbf', '#fdfefe'] },
  { name: 'Noche',     colors: ['#0a0a0a', '#1a1a2e', '#16213e', '#0f3460', '#e94560'] },
  { name: 'Mono',      colors: ['#000000', '#333333', '#666666', '#999999', '#cccccc'] },
  { name: 'Fuego',     colors: ['#1a0000', '#7b0000', '#c0392b', '#e67e22', '#f9ca24'] },
];

const SPEEDS = [0.25, 0.5, 1, 2, 3, 5];

// ========================================
// ESTADO
// ========================================

const state = {
  // Modo
  mode: 'manual',           // 'manual' | 'generative'

  // Manual
  frames: [],
  currentFrame: 0,
  fps: 8,
  loop: true,
  isPlaying: false,
  animTimer: null,
  brushColor: '#000000',
  brushShape: 'square',
  brushRotation: 0,
  isPainting: false,
  isErasing: false,
  hoveredCell: null,

  // Generativo
  genPreset: 'capas',
  genPalette: [...DEFAULT_PALETTES[0].colors],
  genSpeedIdx: 2,           // index into SPEEDS[]
  genPlaying: false,
  genT: 0,
  genStartTime: null,
  genRafId: null,

  // Grilla (compartido)
  cols: 16,
  rows: 10,
};

function initGrid(cols, rows) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ shape: 'empty', rotation: 0, color: '#000000' }))
  );
}

state.frames.push(initGrid(state.cols, state.rows));

// ========================================
// DOM
// ========================================

const editorCanvas    = document.getElementById('editorCanvas');
const editorCtx       = editorCanvas.getContext('2d');
const canvasContainer = document.getElementById('canvasContainer');
const timelineEl      = document.getElementById('timeline');
const timelineFrames  = document.getElementById('timelineFrames');
const fpsValueEl      = document.getElementById('fpsValue');
const colsValueEl     = document.getElementById('colsValue');
const rowsValueEl     = document.getElementById('rowsValue');
const brushColorEl    = document.getElementById('brushColor');
const brushShapePicker = document.getElementById('brushShapePicker');
const btnPlay         = document.getElementById('btnPlay');
const toggleLoop      = document.getElementById('toggleLoop');
const btnGenPlay      = document.getElementById('btnGenPlay');
const presetSelect    = document.getElementById('presetSelect');
const paletteEditor   = document.getElementById('paletteEditor');
const palettePreset   = document.getElementById('palettePreset');
const speedValueEl    = document.getElementById('speedValue');

// ========================================
// CANVAS SETUP
// ========================================

function setupCanvas() {
  const dpr   = window.devicePixelRatio || 1;
  const base  = 700;
  const ratio = state.cols / state.rows;
  const physW = ratio >= 1 ? base : Math.round(base * ratio);
  const physH = ratio >= 1 ? Math.round(base / ratio) : base;
  editorCanvas.width  = physW * dpr;
  editorCanvas.height = physH * dpr;
  editorCtx.scale(dpr, dpr);

  // topbar(44) + timeline(72, manual only) + bottombar(56) + padding(32)
  const chrome = state.mode === 'manual' ? 220 : 148;
  const maxH   = window.innerHeight - chrome;
  canvasContainer.style.maxWidth    = Math.floor(Math.min(base, maxH * ratio)) + 'px';
  canvasContainer.style.aspectRatio = `${state.cols} / ${state.rows}`;
}

// ========================================
// RENDERIZADO MANUAL
// ========================================

function renderGrid(ctx, grid, cols, rows, w, h) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  const s = w / cols;
  ctx.lineCap  = 'butt';
  ctx.lineJoin = 'miter';
  grid.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      const shape = SHAPES[cell.shape];
      if (shape && cell.shape !== 'empty') {
        shape.draw(ctx, ci * s, ri * s, s, cell.rotation, cell.color);
      }
    });
  });
}

function renderEditor() {
  const dpr  = window.devicePixelRatio || 1;
  const w    = editorCanvas.width  / dpr;
  const h    = editorCanvas.height / dpr;
  const grid = state.frames[state.currentFrame];

  renderGrid(editorCtx, grid, state.cols, state.rows, w, h);

  if (!state.isPlaying) {
    const s = w / state.cols;
    editorCtx.strokeStyle = '#d0d0d0';
    editorCtx.lineWidth   = 1;
    for (let i = 0; i <= state.cols; i++) {
      editorCtx.beginPath(); editorCtx.moveTo(i * s, 0); editorCtx.lineTo(i * s, h); editorCtx.stroke();
    }
    for (let i = 0; i <= state.rows; i++) {
      editorCtx.beginPath(); editorCtx.moveTo(0, i * s); editorCtx.lineTo(w, i * s); editorCtx.stroke();
    }
  }

  if (state.hoveredCell && !state.isPainting && !state.isPlaying) {
    const { row, col } = state.hoveredCell;
    const s = w / state.cols;
    editorCtx.save();
    editorCtx.globalAlpha = 0.4;
    const shape = SHAPES[state.brushShape];
    if (shape) shape.draw(editorCtx, col * s, row * s, s, state.brushRotation, state.brushColor);
    editorCtx.restore();
  }
}

// ========================================
// RENDERIZADO GENERATIVO
// ========================================

function renderGenerative(t) {
  const dpr   = window.devicePixelRatio || 1;
  const w     = editorCanvas.width  / dpr;
  const h     = editorCanvas.height / dpr;
  const s     = w / state.cols;
  const fn    = PRESETS[state.genPreset].fn;
  const pal   = state.genPalette;

  editorCtx.fillStyle = '#ffffff';
  editorCtx.fillRect(0, 0, w, h);

  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const color = fn(t, r, c, state.cols, state.rows, pal);
      if (color) {
        editorCtx.fillStyle = color;
        editorCtx.fillRect(c * s, r * s, s, s);
      }
    }
  }
}

function genLoop(timestamp) {
  if (!state.genPlaying) return;
  if (!state.genStartTime) state.genStartTime = timestamp;
  const t = (timestamp - state.genStartTime) / 1000 * SPEEDS[state.genSpeedIdx];
  state.genT = t;
  renderGenerative(t);
  state.genRafId = requestAnimationFrame(genLoop);
}

function startGen() {
  state.genPlaying  = true;
  state.genStartTime = null;
  btnGenPlay.textContent = '⏸';
  btnGenPlay.classList.add('playing');
  state.genRafId = requestAnimationFrame(genLoop);
}

function stopGen() {
  state.genPlaying = false;
  if (state.genRafId) { cancelAnimationFrame(state.genRafId); state.genRafId = null; }
  btnGenPlay.textContent = '▶';
  btnGenPlay.classList.remove('playing');
  renderGenerative(state.genT);
}

// ========================================
// TIMELINE (manual)
// ========================================

const THUMB = 48;

function renderThumb(canvas, frame) {
  canvas.width  = THUMB;
  canvas.height = THUMB;
  renderGrid(canvas.getContext('2d'), frame, state.cols, state.rows, THUMB, THUMB);
}

function renderTimeline() {
  timelineFrames.innerHTML = '';
  state.frames.forEach((frame, i) => {
    const item = document.createElement('div');
    item.className     = 'timeline-item' + (i === state.currentFrame ? ' active' : '');
    item.dataset.index = i;

    const canvas = document.createElement('canvas');
    renderThumb(canvas, frame);

    const label = document.createElement('span');
    label.className   = 'frame-label';
    label.textContent = i + 1;

    item.appendChild(canvas);
    item.appendChild(label);
    item.addEventListener('click', () => {
      if (state.isPlaying) return;
      state.currentFrame = i;
      renderTimeline();
      renderEditor();
    });
    timelineFrames.appendChild(item);
  });

  const active = timelineFrames.querySelector('.timeline-item.active');
  if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
}

function updateTimelineActive() {
  timelineFrames.querySelectorAll('.timeline-item').forEach((el, i) => {
    el.classList.toggle('active', i === state.currentFrame);
  });
}

function refreshThumb(idx) {
  const el = timelineFrames.querySelector(`.timeline-item[data-index="${idx}"] canvas`);
  if (el) renderThumb(el, state.frames[idx]);
}

// ========================================
// ANIMACIÓN MANUAL
// ========================================

function startAnim() {
  if (state.frames.length < 2) return;
  state.isPlaying = true;
  btnPlay.textContent = '⏸';
  btnPlay.classList.add('playing');
  tick();
}

function stopAnim() {
  state.isPlaying = false;
  if (state.animTimer) { clearTimeout(state.animTimer); state.animTimer = null; }
  btnPlay.textContent = '▶';
  btnPlay.classList.remove('playing');
  renderEditor();
  updateTimelineActive();
}

function tick() {
  if (!state.isPlaying) return;
  state.animTimer = setTimeout(() => {
    let next = state.currentFrame + 1;
    if (next >= state.frames.length) {
      if (state.loop) { next = 0; } else { stopAnim(); return; }
    }
    state.currentFrame = next;
    renderEditor();
    updateTimelineActive();
    tick();
  }, 1000 / state.fps);
}

// ========================================
// GESTIÓN DE FRAMES
// ========================================

function addFrame() {
  state.frames.splice(state.currentFrame + 1, 0, initGrid(state.cols, state.rows));
  state.currentFrame++;
  renderTimeline(); renderEditor();
}

function duplicateFrame() {
  const copy = state.frames[state.currentFrame].map(row => row.map(cell => ({ ...cell })));
  state.frames.splice(state.currentFrame + 1, 0, copy);
  state.currentFrame++;
  renderTimeline(); renderEditor();
}

function deleteFrame() {
  if (state.frames.length <= 1) return;
  state.frames.splice(state.currentFrame, 1);
  if (state.currentFrame >= state.frames.length) state.currentFrame = state.frames.length - 1;
  renderTimeline(); renderEditor();
}

// ========================================
// REDIMENSIONAR GRILLA
// ========================================

function resizeGrid(newCols, newRows) {
  state.frames = state.frames.map(grid =>
    Array.from({ length: newRows }, (_, r) =>
      Array.from({ length: newCols }, (_, c) =>
        (r < grid.length && c < grid[r].length)
          ? grid[r][c]
          : { shape: 'empty', rotation: 0, color: '#000000' }
      )
    )
  );
  state.cols = newCols;
  state.rows = newRows;
  colsValueEl.textContent = newCols;
  rowsValueEl.textContent = newRows;
  setupCanvas();
  if (state.mode === 'manual') { renderTimeline(); renderEditor(); }
  else renderGenerative(state.genT);
}

// ========================================
// PINCEL
// ========================================

function getCellFromEvent(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const col  = Math.floor((e.clientX - rect.left) / (rect.width  / state.cols));
  const row  = Math.floor((e.clientY - rect.top)  / (rect.height / state.rows));
  if (row >= 0 && row < state.rows && col >= 0 && col < state.cols) return { row, col };
  return null;
}

function paintCell(row, col) {
  const grid = state.frames[state.currentFrame];
  grid[row][col] = state.isErasing
    ? { shape: 'empty', rotation: 0, color: '#000000' }
    : { shape: state.brushShape, rotation: state.brushRotation, color: state.brushColor };
  renderEditor();
  refreshThumb(state.currentFrame);
}

// ========================================
// MODO
// ========================================

function setMode(mode) {
  state.mode = mode;
  document.body.classList.toggle('mode-generative', mode === 'generative');
  document.getElementById('btnModeManual').classList.toggle('active', mode === 'manual');
  document.getElementById('btnModeGen').classList.toggle('active', mode === 'generative');

  // Stop any running animation when switching modes
  if (state.isPlaying) stopAnim();
  if (state.genPlaying) stopGen();

  setupCanvas();

  if (mode === 'manual') {
    renderTimeline();
    renderEditor();
  } else {
    renderGenerative(state.genT);
  }
}

// ========================================
// UI GENERATIVO
// ========================================

function buildPresetSelect() {
  presetSelect.innerHTML = '';
  Object.entries(PRESETS).forEach(([id, p]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = p.name;
    if (id === state.genPreset) opt.selected = true;
    presetSelect.appendChild(opt);
  });
}

function buildPalettePreset() {
  palettePreset.innerHTML = '';
  DEFAULT_PALETTES.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = p.name;
    palettePreset.appendChild(opt);
  });
}

function buildPaletteEditor() {
  paletteEditor.innerHTML = '';
  state.genPalette.forEach((color, i) => {
    const input = document.createElement('input');
    input.type      = 'color';
    input.className = 'palette-swatch';
    input.value     = color;
    input.addEventListener('input', (e) => {
      state.genPalette[i] = e.target.value;
      if (!state.genPlaying) renderGenerative(state.genT);
    });
    paletteEditor.appendChild(input);
  });
}

// ========================================
// INIT
// ========================================

function populateBrushShapeSelect() {
  brushShapePicker.innerHTML = '';
  Object.entries(SHAPES).forEach(([id, shape]) => {
    if (id === 'empty') return;
    const btn = document.createElement('button');
    btn.className = 'shape-btn' + (id === state.brushShape ? ' active' : '');
    btn.title     = shape.name;
    btn.innerHTML = SHAPE_ICONS[id] ?? id;
    btn.addEventListener('click', () => {
      state.brushShape    = id;
      state.brushRotation = 0;
      brushShapePicker.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    brushShapePicker.appendChild(btn);
  });
}

function setupEventListeners() {
  // Canvas — manual brush
  editorCanvas.addEventListener('mousedown', (e) => {
    if (state.mode !== 'manual' || state.isPlaying) return;
    const cell = getCellFromEvent(e);
    if (!cell) return;
    state.isPainting = true;
    state.isErasing  = e.shiftKey;
    paintCell(cell.row, cell.col);
  });

  document.addEventListener('mouseup', () => { state.isPainting = false; });

  editorCanvas.addEventListener('mousemove', (e) => {
    if (state.mode !== 'manual' || state.isPlaying) return;
    const cell = getCellFromEvent(e);
    if (cell) {
      state.hoveredCell = cell;
      if (state.isPainting) { state.isErasing = e.shiftKey; paintCell(cell.row, cell.col); }
      else renderEditor();
    } else if (state.hoveredCell) {
      state.hoveredCell = null; renderEditor();
    }
  });

  editorCanvas.addEventListener('mouseleave', () => {
    state.hoveredCell = null; state.isPainting = false;
    if (state.mode === 'manual') renderEditor();
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === ' ') {
      e.preventDefault();
      if (state.mode === 'manual') { state.isPlaying ? stopAnim() : startAnim(); }
      else { state.genPlaying ? stopGen() : startGen(); }
    }
    if (e.key === 'r' || e.key === 'R') {
      const shape = SHAPES[state.brushShape];
      if (shape) state.brushRotation = (state.brushRotation + 1) % shape.rotations;
    }
    if (state.mode === 'manual' && !state.isPlaying) {
      if (e.key === 'ArrowRight' && state.currentFrame < state.frames.length - 1) {
        state.currentFrame++; renderTimeline(); renderEditor();
      }
      if (e.key === 'ArrowLeft' && state.currentFrame > 0) {
        state.currentFrame--; renderTimeline(); renderEditor();
      }
    }
  });

  // Mode switch
  document.getElementById('btnModeManual').addEventListener('click', () => setMode('manual'));
  document.getElementById('btnModeGen').addEventListener('click', () => setMode('generative'));

  // Manual playback
  btnPlay.addEventListener('click', () => { state.isPlaying ? stopAnim() : startAnim(); });
  toggleLoop.addEventListener('change', (e) => { state.loop = e.target.checked; });
  document.getElementById('btnDecFps').addEventListener('click', () => {
    if (state.fps > 1) { state.fps--; fpsValueEl.textContent = state.fps; }
  });
  document.getElementById('btnIncFps').addEventListener('click', () => {
    if (state.fps < 60) { state.fps++; fpsValueEl.textContent = state.fps; }
  });

  // Generative playback
  btnGenPlay.addEventListener('click', () => { state.genPlaying ? stopGen() : startGen(); });

  presetSelect.addEventListener('change', (e) => {
    state.genPreset = e.target.value;
    state.genStartTime = null; // reset time on preset change
    if (!state.genPlaying) renderGenerative(state.genT);
  });

  document.getElementById('btnDecSpeed').addEventListener('click', () => {
    if (state.genSpeedIdx > 0) {
      state.genSpeedIdx--;
      speedValueEl.textContent = SPEEDS[state.genSpeedIdx] + '×';
      state.genStartTime = null;
    }
  });
  document.getElementById('btnIncSpeed').addEventListener('click', () => {
    if (state.genSpeedIdx < SPEEDS.length - 1) {
      state.genSpeedIdx++;
      speedValueEl.textContent = SPEEDS[state.genSpeedIdx] + '×';
      state.genStartTime = null;
    }
  });

  palettePreset.addEventListener('change', (e) => {
    state.genPalette = [...DEFAULT_PALETTES[+e.target.value].colors];
    buildPaletteEditor();
    if (!state.genPlaying) renderGenerative(state.genT);
  });

  // Grid
  document.getElementById('btnDecCols').addEventListener('click', () => {
    if (state.cols > 2) resizeGrid(state.cols - 1, state.rows);
  });
  document.getElementById('btnIncCols').addEventListener('click', () => {
    if (state.cols < 32) resizeGrid(state.cols + 1, state.rows);
  });
  document.getElementById('btnDecRows').addEventListener('click', () => {
    if (state.rows > 2) resizeGrid(state.cols, state.rows - 1);
  });
  document.getElementById('btnIncRows').addEventListener('click', () => {
    if (state.rows < 32) resizeGrid(state.cols, state.rows + 1);
  });

  // Brush color
  brushColorEl.addEventListener('input', (e) => { state.brushColor = e.target.value; });

  // Frames
  document.getElementById('btnAddFrame').addEventListener('click', addFrame);
  document.getElementById('btnDupFrame').addEventListener('click', duplicateFrame);
  document.getElementById('btnDelFrame').addEventListener('click', deleteFrame);
}

function init() {
  setupCanvas();
  populateBrushShapeSelect();
  buildPresetSelect();
  buildPalettePreset();
  buildPaletteEditor();
  renderTimeline();
  renderEditor();
  setupEventListeners();
  speedValueEl.textContent = SPEEDS[state.genSpeedIdx] + '×';
  colsValueEl.textContent  = state.cols;
  rowsValueEl.textContent  = state.rows;
}

init();
