const {
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
} = window.NeonCore;
const stateEngine = window.NeonGameState;
const STORAGE_KEY = 'neon_tetris_settings_v2';
const BESTS_KEY = 'neon_tetris_bests_v2';

const uiEngine = window.NeonUI.createUI();
const ui = uiEngine.elements;

let board = createBoard();
let bag = [];
let current = null;
let next = null;
let hold = null;
let canHold = true;
let score = 0;
let shownScore = 0;
let lines = 0;
let level = 1;
let dropInterval = 900;
let dropCounter = 0;
let lastTime = 0;
let paused = false;
let gameOver = false;
let started = false;
let clearFlash = 0;
let elapsedMs = 0;
let combo = -1;
let b2bChain = 0;
let lastRotate = false;
let waitingKeyAction = null;
let activeMode = MODES.classic;
let currentSeed = randomSeed();
let rng = createRng(currentSeed);
let bests = stateEngine.normalizeBests(stateEngine.loadJson(BESTS_KEY, {}));
let settings = stateEngine.loadJson(STORAGE_KEY, {
  muted: false,
  musicEnabled: true,
  musicTheme: 'chill',
  volume: 0.35,
  theme: 'dark',
  keymap: DEFAULT_KEYMAP,
});
settings.keymap = { ...DEFAULT_KEYMAP, ...(settings.keymap || {}) };
if (typeof settings.musicEnabled !== 'boolean') settings.musicEnabled = true;
if (!['chill', 'arcade', 'dark'].includes(settings.musicTheme)) settings.musicTheme = 'chill';
const audioEngine = window.NeonAudio.createAudioEngine({
  getSettings: () => settings,
  getState: () => ({ started, paused, gameOver }),
});
const renderer = window.NeonRenderer.createRenderer({
  boardCanvas: document.getElementById('board'),
  nextCanvas: document.getElementById('next'),
  holdCanvas: document.getElementById('hold'),
  cols: COLS,
  rows: ROWS,
  colors: COLORS,
});

window.restartGame = () => resetGame();

const safeCall = (fn) => {
  try {
    fn();
  } catch (error) {
    console.error(error);
  }
};
safeCall(() => applyTheme(settings.theme));
safeCall(() => {
  if (ui.volumeSlider) ui.volumeSlider.value = Math.round(settings.volume * 100);
});
safeCall(updateSoundUI);
safeCall(updateModeButtons);
safeCall(updateSeedLabel);
safeCall(renderKeymap);
safeCall(() => {
  try {
    runTests();
  } catch (error) {
    console.error(error);
    uiEngine.setTestsText('Тесты: ошибка (игра запущена)');
  }
});
safeCall(() => resetGame({ showStart: true }));
requestAnimationFrame(update);

function seededShuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
function takeFromBag() {
  if (bag.length === 0) bag = seededShuffle([...BAG_TYPES]);
  return bag.pop();
}
function createPiece(type = takeFromBag()) {
  return {
    type,
    matrix: cloneMatrix(SHAPES[type]),
    x: Math.floor(COLS / 2) - Math.ceil(SHAPES[type][0].length / 2),
    y: type === 'I' ? -1 : 0,
    rotation: 0,
  };
}
function resetGame(options = {}) {
  board = createBoard();
  bag = [];
  rng = createRng(currentSeed);
  current = createPiece();
  next = createPiece();
  hold = null;
  canHold = true;
  score = 0;
  shownScore = 0;
  lines = 0;
  level = 1;
  combo = -1;
  b2bChain = 0;
  clearFlash = 0;
  elapsedMs = 0;
  audioEngine.resetMusic();
  dropInterval = activeMode.baseInterval;
  dropCounter = 0;
  lastTime = 0;
  paused = false;
  gameOver = false;
  started = !options.showStart;
  hideStateModal();
  if (options.showStart) showStartModal();
  else hideStartModal();
  renderer.recalculateCellSize();
  updateUI();
  draw();
}
function startGame() {
  started = true;
  paused = false;
  hideStartModal();
  hideStateModal();
  refreshPauseButton();
  lastTime = performance.now();
  audioEngine.resetMusic();
  playTone('start');
  draw();
}
function safeStartGame() {
  try {
    if (!board || !Array.isArray(board) || board.length !== ROWS) board = createBoard();
    if (!current) current = createPiece();
    if (!next) next = createPiece();
    startGame();
  } catch (error) {
    console.error(error);
    // Fallback start path to avoid dead button if some optional feature fails.
    started = true;
    paused = false;
    gameOver = false;
    hideStartModal();
    hideStateModal();
    lastTime = performance.now();
    draw();
  }
}
window.startGame = safeStartGame;
function move(dx) {
  if (!canInteract()) return;
  current.x += dx;
  if (collide(board, current)) current.x -= dx;
  else playTone('move');
  draw();
}
function softDrop() {
  if (!canInteract()) return;
  current.y++;
  if (collide(board, current)) {
    current.y--;
    lockPiece();
  } else {
    score += 1;
    updateUI();
  }
  dropCounter = 0;
  draw();
}
function hardDrop() {
  if (!canInteract()) return;
  let distance = 0;
  while (!collide(board, { ...current, y: current.y + 1 })) {
    current.y++;
    distance++;
  }
  score += distance * 2;
  playTone('drop');
  lockPiece();
  draw();
}
function rotateCurrent(dir) {
  if (!canInteract()) return;
  if (current.type === 'O') {
    current.matrix = rotate(current.matrix, dir);
    lastRotate = true;
    playTone('rotate');
    draw();
    return;
  }
  const from = current.rotation ?? 0;
  const to = (from + (dir > 0 ? 1 : 3)) % 4;
  const oldMatrix = current.matrix;
  const oldX = current.x;
  const oldY = current.y;
  const rotated = rotate(current.matrix, dir);
  const kickMap = current.type === 'I' ? SRS_KICKS_I : SRS_KICKS_JLSTZ;
  const kicks = kickMap[`${from}>${to}`] || [[0, 0]];
  for (const [dx, dy] of kicks) {
    current.matrix = rotated;
    current.rotation = to;
    current.x = oldX + dx;
    current.y = oldY + dy;
    if (!collide(board, current)) {
      lastRotate = true;
      playTone('rotate');
      draw();
      return;
    }
  }
  current.matrix = oldMatrix;
  current.x = oldX;
  current.y = oldY;
  current.rotation = from;
  draw();
}
function holdPiece() {
  if (!canInteract() || !canHold) return;
  const oldType = current.type;
  if (!hold) {
    hold = oldType;
    current = next;
    next = createPiece();
  } else {
    current = createPiece(hold);
    hold = oldType;
  }
  canHold = false;
  lastRotate = false;
  playTone('hold');
  if (!activeMode.zen && collide(board, current)) endGame('lose');
  draw();
}
function detectTSpin(piece) {
  if (piece.type !== 'T' || !lastRotate) return false;
  const cx = piece.x + 1;
  const cy = piece.y + 1;
  const corners = [
    [cx - 1, cy - 1],
    [cx + 1, cy - 1],
    [cx - 1, cy + 1],
    [cx + 1, cy + 1],
  ];
  let blocked = 0;
  for (const [x, y] of corners) {
    if (x < 0 || x >= COLS || y >= ROWS) blocked++;
    else if (y >= 0 && board[y][x]) blocked++;
  }
  return blocked >= 3;
}
function lockPiece() {
  const tspin = detectTSpin(current);
  merge(board, current);
  const cleared = clearLines(board);
  let gained = 0;
  if (cleared > 0) {
    clearFlash = 0.45;
    lines += cleared;
    combo++;
    const special = cleared === 4 || (tspin && cleared > 0);
    gained = tspin ? TSPIN_POINTS[cleared] * level : POINTS[cleared] * level;
    if (special) {
      if (b2bChain > 0) gained += Math.floor(gained * 0.5);
      b2bChain++;
    } else {
      b2bChain = 0;
    }
    if (combo > 0) gained += combo * 50 * level;
    score += gained;
    playTone(cleared >= 4 || tspin ? 'special' : 'line');
  } else {
    combo = -1;
    if (!tspin) b2bChain = 0;
  }
  level = activeMode.zen ? 1 : Math.floor(lines / 10) + 1;
  dropInterval = activeMode.zen
    ? activeMode.baseInterval
    : Math.max(activeMode.minInterval, activeMode.baseInterval - (level - 1) * activeMode.step);
  current = next;
  next = createPiece();
  canHold = true;
  lastRotate = false;
  if (!activeMode.zen && collide(board, current)) endGame('lose');
  if (activeMode.targetLines > 0 && lines >= activeMode.targetLines) endGame('win');
  updateUI();
}
function getGhostPiece() {
  const ghost = { type: current.type, matrix: current.matrix, x: current.x, y: current.y };
  while (!collide(board, { ...ghost, y: ghost.y + 1 })) ghost.y++;
  return ghost;
}
function canInteract() {
  return started && !paused && !gameOver && current;
}
function draw() {
  renderer.drawFrame({
    board,
    current: current && !gameOver ? current : null,
    ghost: current && !gameOver ? getGhostPiece() : null,
    next,
    holdPreview: hold ? createPiece(hold) : null,
    clearFlash,
  });
}
function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;
  if (started && !paused && !gameOver) {
    dropCounter += delta;
    elapsedMs += delta;
    if (dropCounter > dropInterval) softDrop();
    if (activeMode.timeLimitMs > 0 && elapsedMs >= activeMode.timeLimitMs) endGame('time');
  }
  if (shownScore !== score) shownScore += Math.ceil((score - shownScore) * 0.2);
  if (clearFlash > 0) clearFlash = Math.max(0, clearFlash - delta / 400);
  tickMusic();
  updateUI();
  draw();
  requestAnimationFrame(update);
}
function updateUI() {
  uiEngine.updateHud({
    shownScore,
    lines,
    level,
    modeTitle: activeMode.title,
    timerText: formatTime(elapsedMs),
    b2b: b2bChain,
    combo,
    bestScore: getModeRecordText(),
    paused,
  });
}
function refreshPauseButton() {
  uiEngine.setPauseButton(paused);
}
function togglePause() {
  if (!started || gameOver) return;
  paused = !paused;
  audioEngine.resetMusic();
  refreshPauseButton();
  if (paused) showPauseModal();
  else hideStateModal();
}
function endGame(reason = 'lose') {
  if (gameOver) return;
  gameOver = true;
  audioEngine.resetMusic();
  const hasNewRecord = updateModeRecords(reason);
  uiEngine.showEndModal({
    reason,
    score,
    lines,
    level,
    activeModeId: activeMode.id,
    elapsedMs,
    hasNewRecord,
    formatTime,
  });
  playTone(reason === 'win' ? 'victory' : 'gameover');
}
function showPauseModal() {
  uiEngine.showPauseModal();
}
function hideStateModal() {
  uiEngine.hideStateModal();
}
function showStartModal() {
  uiEngine.showStartModal();
}
function hideStartModal() {
  uiEngine.hideStartModal();
}
function bindControls() {
  const on = (el, event, handler) => {
    if (el) el.addEventListener(event, handler);
  };
  document.addEventListener('keydown', (event) => {
    if (waitingKeyAction) {
      settings.keymap[waitingKeyAction] = event.code;
      waitingKeyAction = null;
      persistSettings();
      renderKeymap();
      event.preventDefault();
      return;
    }
    const map = settings.keymap;
    const shouldPreventScroll = [map.left, map.right, map.down, map.rotateCW, map.hardDrop].includes(event.code);
    if (shouldPreventScroll) event.preventDefault();
    if (event.code === map.left) move(-1);
    else if (event.code === map.right) move(1);
    else if (event.code === map.down) softDrop();
    else if (event.code === map.rotateCW) rotateCurrent(1);
    else if (event.code === map.rotateCCW) rotateCurrent(-1);
    else if (event.code === map.hardDrop) {
      event.preventDefault();
      if (!started) startGame();
      else hardDrop();
    } else if (event.code === map.hold) holdPiece();
    else if (event.code === map.pause) togglePause();
    else if (event.code === map.restart) resetGame();
    else if (event.code === map.start && !started) startGame();
  });
  on(ui.startBtn, 'click', startGame);
  on(ui.startDemoBtn, 'click', () => resetGame());
  on(ui.resumeBtn, 'click', togglePause);
  on(ui.pauseBtn, 'click', togglePause);
  on(ui.restartBtn, 'click', () => resetGame());
  on(ui.modalRestartBtn, 'click', () => resetGame());
  on(ui.modeClassicBtn, 'click', () => setMode('classic'));
  on(ui.modeSprintBtn, 'click', () => setMode('sprint'));
  on(ui.modeUltraBtn, 'click', () => setMode('ultra'));
  on(ui.modeZenBtn, 'click', () => setMode('zen'));
  on(ui.newSeedBtn, 'click', () => {
    currentSeed = randomSeed();
    updateSeedLabel();
    resetGame({ showStart: true });
  });
  on(ui.copySeedBtn, 'click', async () => {
    try {
      await navigator.clipboard.writeText(currentSeed);
      uiEngine.setSeedCopied(currentSeed, true);
    } catch (_) {
      uiEngine.setSeedCopied(currentSeed, false);
    }
  });
  on(ui.themeBtn, 'click', () => {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    applyTheme(settings.theme);
    persistSettings();
  });
  on(ui.muteBtn, 'click', () => {
    settings.muted = !settings.muted;
    persistSettings();
    updateSoundUI();
  });
  on(ui.musicBtn, 'click', () => {
    settings.musicEnabled = !settings.musicEnabled;
    persistSettings();
    updateSoundUI();
  });
  on(ui.musicThemeBtn, 'click', () => {
    const order = ['chill', 'arcade', 'dark'];
    const index = order.indexOf(settings.musicTheme);
    settings.musicTheme = order[(index + 1) % order.length];
    persistSettings();
    audioEngine.resetMusic();
    updateSoundUI();
  });
  on(ui.volumeSlider, 'input', () => {
    settings.volume = Number(ui.volumeSlider.value) / 100;
    persistSettings();
  });
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'left') move(-1);
      if (action === 'right') move(1);
      if (action === 'rotate') rotateCurrent(1);
      if (action === 'drop') hardDrop();
      if (action === 'hold') holdPiece();
    });
  });
  window.addEventListener('resize', () => {
    renderer.recalculateCellSize();
    draw();
  });
}
function setMode(modeId) {
  activeMode = MODES[modeId] || MODES.classic;
  if (!started) dropInterval = activeMode.baseInterval;
  safeCall(updateModeButtons);
  safeCall(updateUI);
  uiEngine.setSeedLabel(currentSeed, activeMode.title);
}
window.selectMode = (modeId) => {
  try {
    setMode(modeId);
  } catch (error) {
    console.error(error);
  }
};
function updateModeButtons() {
  uiEngine.updateModeButtons(activeMode.id);
}
function updateSeedLabel() {
  uiEngine.setSeedLabel(currentSeed);
}
function renderKeymap() {
  const labels = {
    left: 'Влево',
    right: 'Вправо',
    down: 'Вниз',
    rotateCW: 'Поворот CW',
    rotateCCW: 'Поворот CCW',
    hardDrop: 'Жёсткий сброс',
    hold: 'Hold',
    pause: 'Пауза',
    restart: 'Рестарт',
    start: 'Старт',
  };
  uiEngine.renderKeymap({
    labels,
    keymap: settings.keymap,
    waitingKeyAction,
    prettyKey,
    onSelect: (action) => {
      waitingKeyAction = action;
      renderKeymap();
    },
  });
}
function applyTheme(theme) {
  uiEngine.applyTheme(theme);
}
function persistSettings() {
  stateEngine.saveJson(STORAGE_KEY, settings);
}
function getModeRecordText() {
  return stateEngine.getModeRecordText({
    activeModeId: activeMode.id,
    bests,
    formatTime,
  });
}
function updateModeRecords(reason) {
  return stateEngine.updateModeRecords({
    bests,
    activeModeId: activeMode.id,
    reason,
    score,
    lines,
    elapsedMs,
    saveKey: BESTS_KEY,
  });
}
function updateSoundUI() {
  uiEngine.updateSoundUI(settings);
}
function playTone(type) {
  audioEngine.playTone(type);
}
function tickMusic() {
  audioEngine.tickMusic();
}
bindControls();
function runTests() {
  const results = [];
  const assert = (name, condition) => {
    results.push({ name, passed: Boolean(condition) });
    if (!condition) throw new Error('Test failed: ' + name);
  };
  const testBoard = createBoard();
  assert('board has 20 rows', testBoard.length === 20);
  assert('board has 10 columns', testBoard[0].length === 10);
  const piece = createPiece('O');
  piece.x = 4;
  piece.y = 0;
  assert('O piece does not collide at spawn', !collide(testBoard, piece));
  piece.x = -1;
  assert('piece collides with left wall', collide(testBoard, piece));
  const fullBoard = createBoard();
  fullBoard[19] = Array(COLS).fill('I');
  assert('one full line clears', clearLines(fullBoard) === 1);
  assert('top row is empty after clear', fullBoard[0].every((cell) => cell === null));
  const rotatedT = rotate(SHAPES.T, 1);
  assert('rotation keeps block count', countBlocks(rotatedT) === countBlocks(SHAPES.T));
  const bagTest = seededShuffle([...BAG_TYPES]);
  assert('bag has 7 unique pieces', bagTest.length === 7 && new Set(bagTest).size === 7);
  const rotatedI = rotate(SHAPES.I, 1);
  assert('I rotation keeps 4 blocks', countBlocks(rotatedI) === 4);
  assert('public restart function exists', typeof window.restartGame === 'function');
  assert('public restart is not self-recursive', window.restartGame !== resetGame);
  uiEngine.setTestsText(`Тесты: ${results.filter((r) => r.passed).length}/${results.length} пройдены`);
}
