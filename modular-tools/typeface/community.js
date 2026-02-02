// Script para la página de comunidad

// Cargar tipografías compartidas
function loadSharedFonts() {
  const fonts = JSON.parse(localStorage.getItem('sharedFonts') || '[]');
  const fontsGrid = document.getElementById('fontsGrid');
  const emptyState = document.getElementById('emptyState');
  
  if (fonts.length === 0) {
    fontsGrid.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }
  
  fontsGrid.style.display = 'grid';
  emptyState.style.display = 'none';
  fontsGrid.innerHTML = '';
  
  fonts.forEach(font => {
    const card = createFontCard(font);
    fontsGrid.appendChild(card);
  });
}

function createFontCard(font) {
  const card = document.createElement('div');
  card.className = 'font-card';
  
  card.innerHTML = `
    <div class="font-card-header">
      <div>
        <div class="font-card-title">${font.name}</div>
        <div class="font-card-author">por ${font.author}</div>
      </div>
    </div>
    <div class="font-card-preview">
      <canvas id="preview-${font.id}" width="280" height="80"></canvas>
    </div>
    ${font.description ? `<div class="font-card-description">${font.description}</div>` : ''}
    <div class="font-card-actions">
      <button class="btn" onclick="downloadFont(${font.id})">Descargar</button>
      <button class="btn btn-secondary" onclick="likeFont(${font.id})">❤️ ${font.likes}</button>
    </div>
  `;
  
  // Renderizar preview
  setTimeout(() => {
    renderFontPreview(font, `preview-${font.id}`);
  }, 0);
  
  return card;
}

function renderFontPreview(font, canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const text = 'ABC';
  const letterHeight = 60;
  const spacing = 8;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  let totalWidth = 0;
  text.split('').forEach(char => {
    if (font.data[char]) {
      const letter = font.data[char];
      const letterWidth = (letterHeight / letter.rows) * letter.cols;
      totalWidth += letterWidth + spacing;
    }
  });
  totalWidth -= spacing;
  
  const offsetX = (canvas.width - totalWidth) / 2;
  const offsetY = (canvas.height - letterHeight) / 2;
  
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  
  let currentX = offsetX;
  
  // Definir SHAPES localmente
  const SHAPES = {
    line: {
      draw: (ctx, x, y, s, rotation, color = '#000000') => {
        const w = s * 0.12;
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
      draw: (ctx, x, y, s, rotation, color = '#000000') => {
        const w = s * 0.12;
        ctx.save();
        ctx.translate(x + s/2, y + s/2);
        ctx.rotate((rotation * Math.PI) / 2);
        ctx.translate(-s/2, -s/2);
        const radius = s - w/2;
        ctx.beginPath();
        ctx.arc(s, s, radius, Math.PI, Math.PI * 1.5);
        ctx.lineWidth = w;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.restore();
      }
    },
    half: {
      draw: (ctx, x, y, s, rotation, color = '#000000') => {
        const w = s * 0.12;
        ctx.save();
        ctx.translate(x + s/2, y + s/2);
        ctx.rotate((rotation * Math.PI) / 2);
        ctx.translate(-s/2, -s/2);
        const radius = (s/2) - w/2;
        ctx.beginPath();
        ctx.arc(s/2, s, radius, Math.PI, 0);
        ctx.lineWidth = w;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.restore();
      }
    },
    circle: {
      draw: (ctx, x, y, s, rotation, color = '#000000') => {
        const w = s * 0.12;
        const radius = (s/2) - w/2;
        ctx.beginPath();
        ctx.arc(x + s/2, y + s/2, radius, 0, Math.PI * 2);
        ctx.lineWidth = w;
        ctx.strokeStyle = color;
        ctx.stroke();
      }
    },
    diagonal: {
      draw: (ctx, x, y, s, rotation, color = '#000000') => {
        const w = s * 0.12;
        ctx.save();
        ctx.translate(x + s/2, y + s/2);
        ctx.rotate((rotation * Math.PI) / 2);
        ctx.translate(-s/2, -s/2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(s, s);
        ctx.lineWidth = w;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.restore();
      }
    }
  };
  
  text.split('').forEach((char) => {
    if (!font.data[char]) return;
    
    const letter = font.data[char];
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

function downloadFont(fontId) {
  const fonts = JSON.parse(localStorage.getItem('sharedFonts') || '[]');
  const font = fonts.find(f => f.id === fontId);
  
  if (font) {
    const data = JSON.stringify(font.data, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${font.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function likeFont(fontId) {
  const fonts = JSON.parse(localStorage.getItem('sharedFonts') || '[]');
  const font = fonts.find(f => f.id === fontId);
  
  if (font) {
    font.likes = (font.likes || 0) + 1;
    localStorage.setItem('sharedFonts', JSON.stringify(fonts));
    loadSharedFonts();
  }
}

// Búsqueda y filtrado
document.getElementById('searchInput')?.addEventListener('input', (e) => {
  const search = e.target.value.toLowerCase();
  const cards = document.querySelectorAll('.font-card');
  
  cards.forEach(card => {
    const title = card.querySelector('.font-card-title').textContent.toLowerCase();
    const author = card.querySelector('.font-card-author').textContent.toLowerCase();
    
    if (title.includes(search) || author.includes(search)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
});

document.getElementById('sortSelect')?.addEventListener('change', (e) => {
  const fonts = JSON.parse(localStorage.getItem('sharedFonts') || '[]');
  
  switch(e.target.value) {
    case 'recent':
      fonts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      break;
    case 'popular':
      fonts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
      break;
    case 'name':
      fonts.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  
  localStorage.setItem('sharedFonts', JSON.stringify(fonts));
  loadSharedFonts();
});

// Inicializar
loadSharedFonts();