// Background music for the Play section: one looping track shared by the
// dungeon and the games. It starts muted and is only fetched once switched on,
// so the page never downloads the track for people who never ask for it.
// The volume is remembered in this browser; whether it is on is not.
(() => {
  const root = document.querySelector('[data-music]');
  if (!root) return;

  const VOLUME_KEY = 'play-volume';
  const btn = root.querySelector('[data-toggle]');
  const slider = root.querySelector('[data-volume]');
  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'none';
  let loaded = false;
  let hiddenPause = false; // paused only because the tab went away

  const loadVolume = () => {
    try {
      const v = Number(localStorage.getItem(VOLUME_KEY));
      return Number.isFinite(v) && v > 0 ? Math.min(1, v) : 0.5;
    } catch { return 0.5; }
  };
  const saveVolume = (v) => {
    try { localStorage.setItem(VOLUME_KEY, String(v)); } catch { /* storage unavailable */ }
  };

  const setOn = (on) => {
    root.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('[data-label]').textContent = on ? 'Music on' : 'Music off';
  };

  const play = () => {
    if (!loaded) {
      audio.src = root.dataset.music;
      loaded = true;
    }
    // Show "on" at once while the track buffers; drop back if the browser refuses.
    setOn(true);
    audio.play().catch(() => setOn(false));
  };
  const stop = () => {
    audio.pause();
    setOn(false);
  };

  audio.volume = loadVolume();
  slider.value = Math.round(audio.volume * 100);
  setOn(false);

  btn.addEventListener('click', () => (audio.paused ? play() : stop()));
  slider.addEventListener('input', () => {
    audio.volume = slider.value / 100;
    saveVolume(audio.volume);
  });

  // Silence while the tab is hidden, back when it returns.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenPause = !audio.paused;
      if (hiddenPause) audio.pause();
    } else if (hiddenPause) {
      hiddenPause = false;
      audio.play().catch(() => setOn(false));
    }
  });
})();
