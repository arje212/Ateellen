// Short double-beep for new orders. Throttled so two listeners never beep twice.
let last = 0;
export function playBeep() {
  const now = Date.now();
  if (now - last < 4000) return;
  last = now;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25].forEach(t => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.15;
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.18);
    });
    setTimeout(() => ctx.close(), 800);
  } catch { /* browsers block audio until the page was clicked once */ }
}
