window.NeonRenderer = (() => {
  function createRenderer({ boardCanvas, nextCanvas, holdCanvas, cols, rows, colors }) {
    const ctx = boardCanvas.getContext('2d');
    const nextCtx = nextCanvas.getContext('2d');
    const holdCtx = holdCanvas.getContext('2d');
    let cachedCellSize = 32;

    function getCssCellSize() {
      const value = getComputedStyle(document.documentElement).getPropertyValue('--cell').trim();
      const probe = document.createElement('div');
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.style.width = value;
      document.body.appendChild(probe);
      const size = probe.getBoundingClientRect().width;
      probe.remove();
      return Math.max(20, Math.round(size));
    }

    function recalculateCellSize() {
      cachedCellSize = getCssCellSize();
    }

    function syncCanvasSize(canvas, cssWidth, cssHeight) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      const w = Math.round(cssWidth * dpr);
      const h = Math.round(cssHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function roundRect(targetCtx, x, y, w, h, r) {
      targetCtx.beginPath();
      targetCtx.moveTo(x + r, y);
      targetCtx.arcTo(x + w, y, x + w, y + h, r);
      targetCtx.arcTo(x + w, y + h, x, y + h, r);
      targetCtx.arcTo(x, y + h, x, y, r);
      targetCtx.arcTo(x, y, x + w, y, r);
      targetCtx.closePath();
    }

    function drawBackground(size) {
      const w = cols * size;
      const h = rows * size;
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#070b1e');
      gradient.addColorStop(1, '#02040d');
      ctx.fillStyle = gradient;
      roundRect(ctx, 0, 0, w, h, 22);
      ctx.fill();
      for (let x = 0; x <= cols; x++) {
        ctx.strokeStyle = x % 5 === 0 ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.045)';
        ctx.beginPath();
        ctx.moveTo(x * size, 0);
        ctx.lineTo(x * size, h);
        ctx.stroke();
      }
      for (let y = 0; y <= rows; y++) {
        ctx.strokeStyle = y % 5 === 0 ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.045)';
        ctx.beginPath();
        ctx.moveTo(0, y * size);
        ctx.lineTo(w, y * size);
        ctx.stroke();
      }
    }

    function drawBlock(targetCtx, x, y, color, size, alpha = 1) {
      if (y < 0) return;
      const px = x * size;
      const py = y * size;
      const pad = Math.max(2, size * 0.07);
      const radius = Math.max(6, size * 0.22);
      targetCtx.save();
      targetCtx.globalAlpha = alpha;
      targetCtx.shadowColor = color;
      targetCtx.shadowBlur = alpha >= 1 ? size * 0.34 : size * 0.18;
      targetCtx.fillStyle = color;
      roundRect(targetCtx, px + pad, py + pad, size - pad * 2, size - pad * 2, radius);
      targetCtx.fill();
      targetCtx.shadowBlur = 0;
      const gradient = targetCtx.createLinearGradient(px, py, px + size, py + size);
      gradient.addColorStop(0, 'rgba(255,255,255,.40)');
      gradient.addColorStop(0.42, 'rgba(255,255,255,.05)');
      gradient.addColorStop(1, 'rgba(0,0,0,.26)');
      targetCtx.fillStyle = gradient;
      roundRect(targetCtx, px + pad, py + pad, size - pad * 2, size - pad * 2, radius);
      targetCtx.fill();
      targetCtx.strokeStyle = alpha >= 1 ? 'rgba(255,255,255,.32)' : 'rgba(255,255,255,.38)';
      targetCtx.lineWidth = 1;
      roundRect(targetCtx, px + pad + 0.5, py + pad + 0.5, size - pad * 2 - 1, size - pad * 2 - 1, radius);
      targetCtx.stroke();
      targetCtx.restore();
    }

    function drawPiece(targetCtx, piece, size, alpha = 1) {
      piece.matrix.forEach((row, y) =>
        row.forEach((value, x) => {
          if (value) drawBlock(targetCtx, piece.x + x, piece.y + y, colors[piece.type], size, alpha);
        }),
      );
    }

    function drawBoard(board, size) {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const type = board[y][x];
          if (type) drawBlock(ctx, x, y, colors[type], size, 1);
        }
      }
    }

    function drawMiniBlock(targetCtx, x, y, size, color) {
      targetCtx.save();
      targetCtx.shadowColor = color;
      targetCtx.shadowBlur = 14;
      targetCtx.fillStyle = color;
      roundRect(targetCtx, x + 2, y + 2, size - 4, size - 4, 7);
      targetCtx.fill();
      targetCtx.shadowBlur = 0;
      targetCtx.strokeStyle = 'rgba(255,255,255,.26)';
      targetCtx.stroke();
      targetCtx.restore();
    }

    function drawPreview(targetCtx, piece) {
      const canvas = targetCtx.canvas;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssWidth = rect.width || 180;
      const cssHeight = rect.height || 120;
      const w = Math.round(cssWidth * dpr);
      const h = Math.round(cssHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      targetCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      targetCtx.clearRect(0, 0, cssWidth, cssHeight);
      const bg = targetCtx.createRadialGradient(
        cssWidth / 2,
        cssHeight / 2,
        4,
        cssWidth / 2,
        cssHeight / 2,
        cssWidth / 1.2,
      );
      bg.addColorStop(0, 'rgba(255,255,255,.08)');
      bg.addColorStop(1, 'rgba(255,255,255,.015)');
      targetCtx.fillStyle = bg;
      roundRect(targetCtx, 0, 0, cssWidth, cssHeight, 16);
      targetCtx.fill();
      if (!piece) return;
      const size = Math.min(28, Math.floor(Math.min(cssWidth / 6, cssHeight / 5)));
      const width = piece.matrix[0].length * size;
      const height = piece.matrix.length * size;
      const offsetX = Math.floor((cssWidth - width) / 2);
      const offsetY = Math.floor((cssHeight - height) / 2);
      piece.matrix.forEach((row, y) =>
        row.forEach((value, x) => {
          if (!value) return;
          drawMiniBlock(targetCtx, offsetX + x * size, offsetY + y * size, size, colors[piece.type]);
        }),
      );
    }

    function drawFrame({ board, current, ghost, next, holdPreview, clearFlash }) {
      const size = cachedCellSize;
      syncCanvasSize(boardCanvas, cols * size, rows * size);
      ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
      drawBackground(size);
      drawBoard(board, size);
      if (current) {
        drawPiece(ctx, ghost, size, 0.18);
        drawPiece(ctx, current, size, 1);
      }
      if (clearFlash > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.3, clearFlash)})`;
        ctx.fillRect(0, 0, cols * size, rows * size);
        ctx.restore();
      }
      drawPreview(nextCtx, next);
      drawPreview(holdCtx, holdPreview);
    }

    return {
      recalculateCellSize,
      drawFrame,
    };
  }

  return {
    createRenderer,
  };
})();
