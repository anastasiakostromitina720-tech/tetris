window.NeonGameState = (() => {
  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveJson(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (_) {}
  }

  function normalizeBests(raw) {
    const legacyClassic = typeof raw.classic === 'number' ? raw.classic : 0;
    const legacySprint = typeof raw.sprint === 'number' ? raw.sprint : 0;
    const legacyUltra = typeof raw.ultra === 'number' ? raw.ultra : 0;
    const legacyZen = typeof raw.zen === 'number' ? raw.zen : 0;
    return {
      classic: {
        score: Math.max((raw.classic && raw.classic.score) || 0, legacyClassic),
      },
      sprint: {
        score: Math.max((raw.sprint && raw.sprint.score) || 0, legacySprint),
        bestTimeMs: Number.isFinite(raw.sprint && raw.sprint.bestTimeMs) ? raw.sprint.bestTimeMs : null,
      },
      ultra: {
        score: Math.max((raw.ultra && raw.ultra.score) || 0, legacyUltra),
        bestLines: Math.max((raw.ultra && raw.ultra.bestLines) || 0, 0),
      },
      zen: {
        score: Math.max((raw.zen && raw.zen.score) || 0, legacyZen),
      },
    };
  }

  function getModeRecordText({ activeModeId, bests, formatTime }) {
    if (activeModeId === 'sprint') {
      const sprint = bests.sprint || { bestTimeMs: null };
      if (Number.isFinite(sprint.bestTimeMs)) return formatTime(sprint.bestTimeMs);
      return '--:--';
    }
    if (activeModeId === 'ultra') {
      const ultra = bests.ultra || { bestLines: 0 };
      return `${ultra.bestLines || 0}L`;
    }
    return String((bests[activeModeId] && bests[activeModeId].score) || 0);
  }

  function updateModeRecords({ bests, activeModeId, reason, score, lines, elapsedMs, saveKey }) {
    const target = bests[activeModeId];
    if (!target) return false;
    let isNewRecord = false;
    const prevScore = target.score || 0;
    target.score = Math.max(prevScore, score);
    if (score > prevScore) isNewRecord = true;
    if (activeModeId === 'sprint' && reason === 'win') {
      if (!Number.isFinite(target.bestTimeMs) || elapsedMs < target.bestTimeMs) {
        target.bestTimeMs = Math.floor(elapsedMs);
        isNewRecord = true;
      }
    }
    if (activeModeId === 'ultra' && reason === 'time') {
      const prevLines = target.bestLines || 0;
      target.bestLines = Math.max(prevLines, lines);
      if (lines > prevLines) isNewRecord = true;
    }
    saveJson(saveKey, bests);
    return isNewRecord;
  }

  return {
    loadJson,
    saveJson,
    normalizeBests,
    getModeRecordText,
    updateModeRecords,
  };
})();
