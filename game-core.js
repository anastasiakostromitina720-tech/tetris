window.NeonCore = (() => {
  const COLS = 10;
  const ROWS = 20;
  const MODES = {
    classic: { id: 'classic', title: 'Classic', targetLines: 0, timeLimitMs: 0, zen: false, baseInterval: 950, step: 70, minInterval: 120 },
    sprint: { id: 'sprint', title: 'Sprint 40', targetLines: 40, timeLimitMs: 0, zen: false, baseInterval: 650, step: 95, minInterval: 80 },
    ultra: { id: 'ultra', title: 'Ultra 5m', targetLines: 0, timeLimitMs: 300000, zen: false, baseInterval: 500, step: 110, minInterval: 65 },
    zen: { id: 'zen', title: 'Zen', targetLines: 0, timeLimitMs: 0, zen: true, baseInterval: 1050, step: 0, minInterval: 1050 },
  };
  const DEFAULT_KEYMAP = {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    down: 'ArrowDown',
    rotateCW: 'ArrowUp',
    rotateCCW: 'KeyZ',
    hardDrop: 'Space',
    hold: 'KeyC',
    pause: 'KeyP',
    restart: 'KeyR',
    start: 'Enter',
  };
  const POINTS = [0, 100, 300, 500, 800];
  const TSPIN_POINTS = [0, 800, 1200, 1600];
  const SRS_KICKS_JLSTZ = {
    '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  };
  const SRS_KICKS_I = {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  };
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  };
  const COLORS = {
    I: '#45dfff',
    O: '#ffd166',
    T: '#9d6bff',
    S: '#39f49a',
    Z: '#ff4f73',
    J: '#4f8cff',
    L: '#ff9f43',
  };
  const BAG_TYPES = Object.keys(SHAPES);

  function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }
  function cloneMatrix(matrix) {
    return matrix.map((row) => row.slice());
  }
  function randomSeed() {
    return Math.random().toString(36).slice(2, 10);
  }
  function hashSeed(seed) {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h >>> 0) || 1;
  }
  function createRng(seed) {
    let t = hashSeed(seed);
    return function nextRng() {
      t += 0x6D2B79F5;
      let n = Math.imul(t ^ (t >>> 15), 1 | t);
      n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
  }
  function collide(targetBoard, piece) {
    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (!piece.matrix[y][x]) continue;
        const bx = piece.x + x;
        const by = piece.y + y;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && targetBoard[by][bx]) return true;
      }
    }
    return false;
  }
  function merge(targetBoard, piece) {
    piece.matrix.forEach((row, y) =>
      row.forEach((value, x) => {
        if (value && piece.y + y >= 0) targetBoard[piece.y + y][piece.x + x] = piece.type;
      }),
    );
  }
  function rotate(matrix, dir = 1) {
    const n = matrix.length;
    const m = matrix[0].length;
    const result = Array.from({ length: m }, () => Array(n).fill(0));
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < m; x++) {
        if (dir > 0) result[x][n - 1 - y] = matrix[y][x];
        else result[m - 1 - x][y] = matrix[y][x];
      }
    }
    return result;
  }
  function clearLines(targetBoard) {
    let cleared = 0;
    outer: for (let y = targetBoard.length - 1; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) if (!targetBoard[y][x]) continue outer;
      const row = targetBoard.splice(y, 1)[0].fill(null);
      targetBoard.unshift(row);
      cleared++;
      y++;
    }
    return cleared;
  }
  function prettyKey(code) {
    return (code || '').replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', '');
  }
  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
  }
  function countBlocks(matrix) {
    return matrix.flat().filter(Boolean).length;
  }

  return {
    COLS,
    ROWS,
    MODES,
    DEFAULT_KEYMAP,
    POINTS,
    TSPIN_POINTS,
    SRS_KICKS_JLSTZ,
    SRS_KICKS_I,
    SHAPES,
    COLORS,
    BAG_TYPES,
    createBoard,
    cloneMatrix,
    randomSeed,
    createRng,
    collide,
    merge,
    rotate,
    clearLines,
    prettyKey,
    formatTime,
    countBlocks,
  };
})();
