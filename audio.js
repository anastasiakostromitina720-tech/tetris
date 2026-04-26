window.NeonAudio = (() => {
  function createAudioEngine({ getSettings, getState }) {
    let audioCtx = null;
    let musicIndex = 0;
    let nextMusicAt = 0;

    const MUSIC_THEMES = {
      chill: {
        pattern: [220, 247, 262, 294, 262, 247, 220, 196],
        stepSec: 0.33,
        leadWave: 'triangle',
        layerWave: 'sine',
        leadGain: 0.085,
        layerGain: 0.045,
        leadDuration: 0.24,
        layerDuration: 0.2,
        layerOctave: 2,
      },
      arcade: {
        pattern: [262, 330, 392, 523, 392, 330, 294, 349],
        stepSec: 0.25,
        leadWave: 'square',
        layerWave: 'triangle',
        leadGain: 0.1,
        layerGain: 0.055,
        leadDuration: 0.18,
        layerDuration: 0.14,
        layerOctave: 2,
      },
      dark: {
        pattern: [164, 185, 196, 174, 164, 147, 138, 147],
        stepSec: 0.38,
        leadWave: 'sawtooth',
        layerWave: 'triangle',
        leadGain: 0.08,
        layerGain: 0.04,
        leadDuration: 0.3,
        layerDuration: 0.24,
        layerOctave: 0.5,
      },
    };

    function getAudioCtx() {
      if (audioCtx) return audioCtx;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
      return audioCtx;
    }

    function resetMusic() {
      musicIndex = 0;
      nextMusicAt = 0;
    }

    function playTone(type) {
      const settings = getSettings();
      if (settings.muted || settings.volume <= 0) return;
      const audio = getAudioCtx();
      if (!audio) return;
      if (audio.state === 'suspended') audio.resume();
      const now = audio.currentTime;
      const tones = {
        move: { duration: 0.035, layers: [{ wave: 'triangle', freq: 230, gain: 0.16 }] },
        rotate: { duration: 0.055, layers: [{ wave: 'sine', freq: 430, gain: 0.18 }, { wave: 'triangle', freq: 860, gain: 0.08 }] },
        line: { duration: 0.09, layers: [{ wave: 'square', freq: 520, gain: 0.16 }, { wave: 'sine', freq: 780, gain: 0.1 }] },
        special: { duration: 0.14, layers: [{ wave: 'sawtooth', freq: 620, gain: 0.18 }, { wave: 'triangle', freq: 1240, gain: 0.1 }] },
        drop: { duration: 0.06, layers: [{ wave: 'square', freq: 300, gain: 0.14 }] },
        hold: { duration: 0.065, layers: [{ wave: 'triangle', freq: 270, gain: 0.15 }, { wave: 'sine', freq: 405, gain: 0.08 }] },
        start: { duration: 0.12, layers: [{ wave: 'triangle', freq: 390, gain: 0.14 }, { wave: 'sine', freq: 585, gain: 0.1 }, { wave: 'sine', freq: 780, gain: 0.08 }] },
        gameover: { duration: 0.26, layers: [{ wave: 'sawtooth', freq: 180, gain: 0.16 }, { wave: 'square', freq: 120, gain: 0.08 }] },
        victory: { duration: 0.2, layers: [{ wave: 'sine', freq: 660, gain: 0.14 }, { wave: 'triangle', freq: 990, gain: 0.12 }, { wave: 'square', freq: 1320, gain: 0.06 }] },
      };
      const config = tones[type] || { duration: 0.06, layers: [{ wave: 'sine', freq: 300, gain: 0.14 }] };
      for (const layer of config.layers) {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = layer.wave;
        osc.frequency.setValueAtTime(layer.freq, now);
        gain.gain.setValueAtTime(settings.volume * layer.gain, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(now);
        osc.stop(now + config.duration);
      }
    }

    function playMusicNote(freq, when, duration, layerGain, wave = 'triangle') {
      const settings = getSettings();
      const audio = getAudioCtx();
      if (!audio) return;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, when);
      gain.gain.setValueAtTime(settings.volume * layerGain, when);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(when);
      osc.stop(when + duration);
    }

    function tickMusic() {
      const settings = getSettings();
      const state = getState();
      if (!state.started || state.paused || state.gameOver) return;
      if (!settings.musicEnabled || settings.muted || settings.volume <= 0) return;
      const audio = getAudioCtx();
      if (!audio) return;
      if (audio.state === 'suspended') return;
      const theme = MUSIC_THEMES[settings.musicTheme] || MUSIC_THEMES.chill;
      const now = audio.currentTime;
      if (!nextMusicAt || nextMusicAt < now) nextMusicAt = now + 0.02;
      while (nextMusicAt < now + 0.08) {
        const base = theme.pattern[musicIndex % theme.pattern.length];
        playMusicNote(base, nextMusicAt, theme.leadDuration, theme.leadGain, theme.leadWave);
        playMusicNote(base * theme.layerOctave, nextMusicAt, theme.layerDuration, theme.layerGain, theme.layerWave);
        musicIndex++;
        nextMusicAt += theme.stepSec;
      }
    }

    return {
      playTone,
      tickMusic,
      resetMusic,
    };
  }

  return {
    createAudioEngine,
  };
})();
