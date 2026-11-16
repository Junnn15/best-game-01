// All sound is synthesized with WebAudio: no audio files, nothing fetched.
// A tiny synth for effects plus a slow ambient arpeggio that loops while the
// game runs. Audio starts only after the player's first gesture (browsers
// require it), and M mutes everything.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  // A minor-key ember arpeggio: A, C, E, G, E, C, drifting slowly.
  const MELODY = [220, 261.63, 329.63, 392, 329.63, 261.63, 196, 246.94];
  const STEP_MS = 340;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.14;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  function startMusic() {
    if (!ctx || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const freq = MELODY[musicStep % MELODY.length];
      musicStep += 1;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + STEP_MS / 1000);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(t0);
      osc.stop(t0 + STEP_MS / 1000 + 0.05);
    }, STEP_MS);
  }

  return {
    unlock() {
      if (ensure()) {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        startMusic();
      }
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
    shoot(kind) {
      if (kind === 'ember') tone(520, 0.09, 'square', 0.10, 0, 180);
      else if (kind === 'frost') tone(880, 0.12, 'sine', 0.10, 0, 1400);
      else tone(1200, 0.05, 'sawtooth', 0.07, 0, 500);
    },
    hit() {
      noise(0.06, 0.10, 900);
    },
    pop() {
      tone(660, 0.08, 'triangle', 0.14, 0, 990);
      noise(0.08, 0.08, 1600);
    },
    coin() {
      tone(990, 0.07, 'sine', 0.10);
      tone(1320, 0.1, 'sine', 0.10, 0.06);
    },
    build() {
      tone(330, 0.1, 'triangle', 0.14, 0, 495);
      tone(495, 0.12, 'triangle', 0.12, 0.08);
    },
    upgrade() {
      tone(523, 0.09, 'triangle', 0.13);
      tone(659, 0.09, 'triangle', 0.13, 0.08);
      tone(784, 0.14, 'triangle', 0.13, 0.16);
    },
    sell() {
      tone(784, 0.08, 'sine', 0.10, 0, 523);
    },
    leak() {
      tone(140, 0.35, 'sawtooth', 0.16, 0, 60);
      noise(0.2, 0.12, 400);
    },
    horn() {
      tone(196, 0.4, 'sawtooth', 0.12);
      tone(294, 0.4, 'sawtooth', 0.10, 0.02);
    },
    waveClear() {
      tone(523, 0.1, 'triangle', 0.12);
      tone(659, 0.1, 'triangle', 0.12, 0.09);
      tone(880, 0.18, 'triangle', 0.12, 0.18);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.14, i * 0.14));
    },
    lose() {
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.10, i * 0.18));
    },
    click() {
      tone(700, 0.04, 'sine', 0.08);
    },
    denied() {
      tone(160, 0.12, 'square', 0.09, 0, 110);
    },
  };
}
