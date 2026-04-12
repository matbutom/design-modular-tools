// ========================================
// UTILIDADES
// ========================================

const STORAGE_KEY = 'communityFontsV2';

// Cache of loaded FontFace family names: fontId → 'community-font-<id>'
const loadedFamilies = {};

function getFonts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveFonts(fonts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fonts));
  } catch (e) {
    alert('No hay espacio suficiente en el almacenamiento local. Intenta eliminar alguna tipografía.');
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes.buffer;
}

// ========================================
// CARGA DE FUENTES (FontFace API)
// ========================================

async function loadFontFace(fontId, base64Data) {
  if (loadedFamilies[fontId]) return loadedFamilies[fontId];

  const familyName = `community-font-${fontId}`;
  const buffer = base64ToArrayBuffer(base64Data);
  const face = new FontFace(familyName, buffer);
  await face.load();
  document.fonts.add(face);
  loadedFamilies[fontId] = familyName;
  return familyName;
}

// ========================================
// TEXTO DE MUESTRA GLOBAL
// ========================================

function getSampleText() {
  return document.getElementById('sampleText').value.trim()
    || 'El veloz murciélago hindú comía feliz cardillo y kiwi';
}

document.getElementById('sampleText').addEventListener('input', () => {
  const text = getSampleText();
  document.querySelectorAll('.font-entry-sample').forEach(el => {
    el.textContent = text;
  });
});

// ========================================
// RENDERIZADO DE ENTRADAS
// ========================================

function createFontEntry(font, familyName) {
  const sampleText = getSampleText();

  const entry = document.createElement('article');
  entry.className = 'font-entry';
  entry.dataset.id = font.id;

  const meta = font.author && font.author !== 'Anónimo'
    ? `por ${font.author}`
    : '';

  entry.innerHTML = `
    <div class="font-entry-header">
      <div class="font-entry-info">
        <div class="font-entry-name" style="font-family:'${familyName}'">${font.name}</div>
        ${meta ? `<div class="font-entry-meta">${meta}</div>` : ''}
      </div>
      <button class="btn font-entry-download" data-id="${font.id}">Descargar OTF</button>
    </div>
    <div class="font-entry-sample" style="font-family:'${familyName}'">${sampleText}</div>
    <div class="font-entry-alphabet" style="font-family:'${familyName}'">ABCDEFGHIJKLMNOPQRSTUVWXYZ&nbsp;&nbsp;0123456789</div>
  `;

  entry.querySelector('.font-entry-download').addEventListener('click', () => {
    downloadFontOTF(font.id);
  });

  return entry;
}

async function loadCommunityFonts() {
  // Only show typefaces made with this tool
  const fonts = getFonts().filter(f => f.toolMade === true);
  const fontList = document.getElementById('fontList');
  const emptyState = document.getElementById('emptyState');

  fontList.innerHTML = '';

  if (fonts.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  for (const font of fonts) {
    try {
      const familyName = await loadFontFace(font.id, font.otfData);
      const entry = createFontEntry(font, familyName);
      fontList.appendChild(entry);
    } catch (err) {
      console.warn(`No se pudo cargar la fuente "${font.name}":`, err);
    }
  }
}

// ========================================
// DESCARGA
// ========================================

function downloadFontOTF(fontId) {
  const font = getFonts().find(f => f.id === fontId);
  if (!font) return;

  const buffer = base64ToArrayBuffer(font.otfData);
  const blob = new Blob([buffer], { type: 'font/otf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = font.name.replace(/\s+/g, '-').toLowerCase() + '.otf';
  a.click();
  URL.revokeObjectURL(url);
}


// ========================================
// INIT
// ========================================

loadCommunityFonts();
