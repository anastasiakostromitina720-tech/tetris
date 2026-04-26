window.NeonUI = (() => {
  function createUI() {
    const elements = {
      score: document.getElementById('score'),
      bestScore: document.getElementById('bestScore'),
      lines: document.getElementById('lines'),
      level: document.getElementById('level'),
      tests: document.getElementById('tests'),
      modeLabel: document.getElementById('modeLabel'),
      timerLabel: document.getElementById('timerLabel'),
      b2bLabel: document.getElementById('b2bLabel'),
      comboLabel: document.getElementById('comboLabel'),
      startModal: document.getElementById('startModal'),
      stateModal: document.getElementById('stateModal'),
      stateTitle: document.getElementById('stateTitle'),
      stateText: document.getElementById('stateText'),
      recordBanner: document.getElementById('recordBanner'),
      stateBadge: document.getElementById('stateBadge'),
      stateDot: document.getElementById('stateDot'),
      resultCards: document.getElementById('resultCards'),
      finalScore: document.getElementById('finalScore'),
      finalLines: document.getElementById('finalLines'),
      finalLevel: document.getElementById('finalLevel'),
      pauseBtn: document.getElementById('pauseBtn'),
      restartBtn: document.getElementById('restartBtn'),
      startBtn: document.getElementById('startBtn'),
      startDemoBtn: document.getElementById('startDemoBtn'),
      resumeBtn: document.getElementById('resumeBtn'),
      modalRestartBtn: document.getElementById('modalRestartBtn'),
      muteBtn: document.getElementById('muteBtn'),
      musicBtn: document.getElementById('musicBtn'),
      musicThemeBtn: document.getElementById('musicThemeBtn'),
      themeBtn: document.getElementById('themeBtn'),
      volumeSlider: document.getElementById('volumeSlider'),
      keymapList: document.getElementById('keymapList'),
      seedInfo: document.getElementById('seedInfo'),
      newSeedBtn: document.getElementById('newSeedBtn'),
      copySeedBtn: document.getElementById('copySeedBtn'),
      modeClassicBtn: document.getElementById('modeClassicBtn'),
      modeSprintBtn: document.getElementById('modeSprintBtn'),
      modeUltraBtn: document.getElementById('modeUltraBtn'),
      modeZenBtn: document.getElementById('modeZenBtn'),
    };

    function setPauseButton(paused) {
      elements.pauseBtn.textContent = paused ? 'Продолжить' : 'Пауза';
    }

    function updateHud({ shownScore, lines, level, modeTitle, timerText, b2b, combo, bestScore, paused }) {
      elements.score.textContent = shownScore;
      elements.lines.textContent = lines;
      elements.level.textContent = level;
      elements.modeLabel.textContent = `Режим: ${modeTitle}`;
      elements.timerLabel.textContent = `Время: ${timerText}`;
      elements.b2bLabel.textContent = String(b2b);
      elements.comboLabel.textContent = String(Math.max(0, combo));
      elements.bestScore.textContent = bestScore;
      setPauseButton(paused);
    }

    function showPauseModal() {
      elements.stateBadge.textContent = 'Paused';
      elements.stateDot.style.background = 'var(--green)';
      elements.stateDot.style.boxShadow = '0 0 20px var(--green)';
      elements.stateTitle.textContent = 'Пауза';
      elements.stateText.textContent = 'Нажми продолжить, чтобы вернуться в игру.';
      elements.recordBanner.style.display = 'none';
      elements.resultCards.style.display = 'none';
      elements.resumeBtn.style.display = '';
      elements.stateModal.classList.add('show');
    }

    function showEndModal({ reason, score, lines, level, activeModeId, elapsedMs, hasNewRecord, formatTime }) {
      elements.finalScore.textContent = score;
      elements.finalLines.textContent = lines;
      elements.finalLevel.textContent = level;
      elements.stateBadge.textContent = reason === 'win' ? 'Victory' : 'Game over';
      elements.stateDot.style.background = reason === 'win' ? 'var(--gold)' : 'var(--danger)';
      elements.stateDot.style.boxShadow = reason === 'win' ? '0 0 20px var(--gold)' : '0 0 20px var(--danger)';
      elements.stateTitle.innerHTML =
        reason === 'win' ? '<span class="gradient-text">Отлично!</span>' : '<span class="gradient-text">Game Over</span>';
      if (reason === 'time') elements.stateText.textContent = 'Время Ultra закончилось. Отличный темп!';
      else if (reason === 'win') elements.stateText.textContent = 'Цель режима выполнена. Можно запускать новый раунд.';
      else elements.stateText.textContent = 'Отличная попытка. Можно перезапустить и попробовать выбить результат выше.';

      if (hasNewRecord) {
        elements.recordBanner.style.display = '';
        if (activeModeId === 'sprint') elements.recordBanner.textContent = `Новый рекорд времени: ${formatTime(elapsedMs)}!`;
        else if (activeModeId === 'ultra') elements.recordBanner.textContent = `Новый рекорд по линиям: ${lines}!`;
        else elements.recordBanner.textContent = `Новый рекорд по очкам: ${score}!`;
      } else {
        elements.recordBanner.style.display = 'none';
      }
      elements.resultCards.style.display = 'grid';
      elements.resumeBtn.style.display = 'none';
      elements.stateModal.classList.add('show');
    }

    function hideStateModal() {
      elements.stateModal.classList.remove('show');
    }

    function showStartModal() {
      elements.startModal.classList.add('show');
    }

    function hideStartModal() {
      elements.startModal.classList.remove('show');
    }

    function updateModeButtons(activeModeId) {
      const list = [
        [elements.modeClassicBtn, 'classic'],
        [elements.modeSprintBtn, 'sprint'],
        [elements.modeUltraBtn, 'ultra'],
        [elements.modeZenBtn, 'zen'],
      ];
      list.forEach(([btn, id]) => {
        if (!btn) return;
        btn.style.outline = activeModeId === id ? '2px solid rgba(69,223,255,.7)' : 'none';
      });
    }

    function setSeedLabel(seed, modeTitle) {
      if (!elements.seedInfo) return;
      elements.seedInfo.textContent = modeTitle ? `Seed: ${seed} • mode: ${modeTitle}` : `Seed: ${seed}`;
    }

    function setSeedCopied(seed, copied) {
      if (!elements.seedInfo) return;
      elements.seedInfo.textContent = copied ? `Seed: ${seed} (copied)` : `Seed: ${seed}`;
    }

    function renderKeymap({ labels, keymap, waitingKeyAction, prettyKey, onSelect }) {
      if (!elements.keymapList) return;
      elements.keymapList.innerHTML = '';
      Object.keys(labels).forEach((action) => {
        const row = document.createElement('div');
        row.className = 'help-row';
        const left = document.createElement('span');
        left.textContent = labels[action];
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.style.minHeight = '30px';
        btn.style.padding = '0 10px';
        btn.textContent = waitingKeyAction === action ? 'Нажми...' : prettyKey(keymap[action]);
        btn.addEventListener('click', () => onSelect(action));
        row.append(left, btn);
        elements.keymapList.appendChild(row);
      });
    }

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
      if (elements.themeBtn) elements.themeBtn.textContent = theme === 'light' ? 'Light' : 'Dark';
    }

    function updateSoundUI(settings) {
      if (elements.muteBtn) elements.muteBtn.textContent = settings.muted ? 'Off' : 'On';
      if (elements.musicBtn) elements.musicBtn.textContent = settings.musicEnabled ? 'On' : 'Off';
      if (elements.musicThemeBtn) {
        const labels = { chill: 'Chill', arcade: 'Arcade', dark: 'Dark' };
        elements.musicThemeBtn.textContent = labels[settings.musicTheme] || 'Chill';
      }
    }

    function setTestsText(text) {
      if (elements.tests) elements.tests.textContent = text;
    }

    return {
      elements,
      setPauseButton,
      updateHud,
      showPauseModal,
      showEndModal,
      hideStateModal,
      showStartModal,
      hideStartModal,
      updateModeButtons,
      setSeedLabel,
      setSeedCopied,
      renderKeymap,
      applyTheme,
      updateSoundUI,
      setTestsText,
    };
  }

  return {
    createUI,
  };
})();
