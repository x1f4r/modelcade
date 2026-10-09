// Modelcade's sound engine. Everything is synthesized locally with Web Audio:
// no samples, no downloads. Sounds are small instruments built from a shared
// noise buffer, oscillators, resonant filters, and a generated room reverb.
(() => {
  const ns = (globalThis.Modelcade = globalThis.Modelcade || {});

  // C-major pentatonic across two octaves: any run of detents sounds musical.
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const ROOT = 523.25; // C5
  const MASTER = 1.1;

  let context = null;
  let input = null;
  let reverbSend = null;
  let noiseBuffer = null;
  let settings = { sounds: true, volume: 0.7, jackpot: "arcade" };
  const live = new Set();
  const lastPlayed = new Map();

  const semitone = (steps) => ROOT * Math.pow(2, steps / 12);
  const degree = (index, count) => {
    const span = Math.max(1, count - 1);
    const position = Math.round((index / span) * Math.min(SCALE.length - 1, Math.max(4, count + 1)));
    return SCALE[Math.max(0, Math.min(SCALE.length - 1, position))];
  };
  const panFor = (index, count) => (count > 1 ? (index / (count - 1) - 0.5) * 0.7 : 0);

  function makeImpulse(ctx, seconds = 1.6, decay = 3.2) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      const predelay = Math.floor(ctx.sampleRate * 0.012);
      for (let i = predelay; i < length; i += 1) {
        const t = (i - predelay) / (length - predelay);
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (0.6 + 0.4 * Math.sin(i * 0.0007 + channel));
      }
    }
    return impulse;
  }

  function softClipCurve() {
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i += 1) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4);
    }
    return curve;
  }

  function ensure() {
    if (context) {
      if (context.state === "suspended") context.resume().catch(() => {});
      return context;
    }
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      context = new AudioContextClass({ latencyHint: "interactive" });
    } catch (_) {
      return null;
    }
    input = context.createGain();
    input.gain.value = settings.sounds ? settings.volume * MASTER : 0;
    const shaper = context.createWaveShaper();
    shaper.curve = softClipCurve();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.16;
    input.connect(shaper).connect(compressor).connect(context.destination);

    const reverb = context.createConvolver();
    reverb.buffer = makeImpulse(context);
    const reverbReturn = context.createGain();
    reverbReturn.gain.value = 0.32;
    reverbSend = context.createGain();
    reverbSend.connect(reverb).connect(reverbReturn).connect(input);

    noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    if (context.state === "suspended") context.resume().catch(() => {});
    return context;
  }

  function track(node, stopAt) {
    live.add(node);
    node.onended = () => live.delete(node);
    node.stop(stopAt);
    return node;
  }

  // Routes a voice's output through optional pan and reverb send into the bus.
  function route(node, { pan = 0, send = 0 } = {}) {
    let tail = node;
    if (pan && context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      tail = tail.connect(panner);
    }
    tail.connect(input);
    if (send > 0) {
      const sendGain = context.createGain();
      sendGain.gain.value = send;
      tail.connect(sendGain).connect(reverbSend);
    }
  }

  function envelope(gainNode, start, { gain = 0.1, attack = 0.002, hold = 0, release = 0.08 }) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, start);
    g.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + attack);
    if (hold) g.setValueAtTime(Math.max(0.0002, gain), start + attack + hold);
    g.exponentialRampToValueAtTime(0.0001, start + attack + hold + release);
    return start + attack + hold + release;
  }

  function tone(frequency, options = {}) {
    const start = context.currentTime + (options.at || 0);
    const osc = context.createOscillator();
    osc.type = options.type || "sine";
    osc.frequency.setValueAtTime(Math.max(20, frequency), start);
    if (options.to) {
      const glideEnd = start + (options.glide || (options.attack || 0.002) + (options.hold || 0) + (options.release || 0.08));
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.to), glideEnd);
    }
    if (options.detune) osc.detune.value = options.detune;
    let node = osc;
    if (options.vibrato) {
      const lfo = context.createOscillator();
      const depth = context.createGain();
      lfo.frequency.value = options.vibrato.rate;
      depth.gain.value = options.vibrato.depth;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(start);
      track(lfo, start + 3);
    }
    if (options.filter) {
      const filter = context.createBiquadFilter();
      filter.type = options.filterType || "lowpass";
      filter.frequency.setValueAtTime(options.filter, start);
      if (options.filterTo) filter.frequency.exponentialRampToValueAtTime(options.filterTo, start + (options.release || 0.1));
      filter.Q.value = options.q ?? 0.7;
      node = node.connect(filter);
    }
    const amp = context.createGain();
    const end = envelope(amp, start, options);
    node.connect(amp);
    route(amp, options);
    osc.start(start);
    track(osc, end + 0.05);
  }

  function noise(options = {}) {
    const start = context.currentTime + (options.at || 0);
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    source.playbackRate.value = options.rate || 1;
    const filter = context.createBiquadFilter();
    filter.type = options.filterType || "bandpass";
    filter.frequency.setValueAtTime(options.freq || 2000, start);
    if (options.freqTo) {
      filter.frequency.exponentialRampToValueAtTime(options.freqTo, start + (options.sweep || (options.attack || 0.002) + (options.hold || 0) + (options.release || 0.06)));
    }
    filter.Q.value = options.q ?? 1;
    const amp = context.createGain();
    const end = envelope(amp, start, options);
    source.connect(filter).connect(amp);
    route(amp, options);
    source.start(start, Math.random() * 0.5);
    track(source, end + 0.05);
  }

  // A struck resonant body: a noise impulse ringing through a few band-passes.
  function knock(partials, options = {}) {
    for (const [frequency, gain, decay] of partials) {
      noise({ ...options, freq: frequency, q: options.q ?? 18, gain: gain * 3 * (options.gain ?? 1), attack: 0.0012, release: decay });
    }
  }

  // Two-operator FM bell for coins, sparkles, and chimes.
  function bell(frequency, options = {}) {
    const start = context.currentTime + (options.at || 0);
    const carrier = context.createOscillator();
    const modulator = context.createOscillator();
    const modGain = context.createGain();
    carrier.frequency.value = frequency;
    modulator.frequency.value = Math.min(frequency * (options.ratio || 3.5), context.sampleRate * 0.4);
    modGain.gain.setValueAtTime(frequency * (options.index || 2.2), start);
    modGain.gain.exponentialRampToValueAtTime(frequency * 0.05, start + (options.release || 0.4));
    modulator.connect(modGain).connect(carrier.frequency);
    const amp = context.createGain();
    const end = envelope(amp, start, { gain: options.gain || 0.05, attack: 0.002, release: options.release || 0.4 });
    carrier.connect(amp);
    route(amp, { pan: options.pan || 0, send: options.send ?? 0.35 });
    carrier.start(start);
    modulator.start(start);
    track(carrier, end + 0.05);
    track(modulator, end + 0.05);
  }

  // ----- Instruments ---------------------------------------------------------

  const instruments = {
    detent({ index = 0, count = 5, special = null } = {}) {
      const pan = panFor(index, count);
      const pitch = semitone(degree(index, count));
      knock([[3400, 0.05, 0.022], [5200, 0.03, 0.016]], { pan });
      tone(pitch, { type: "triangle", gain: 0.08, release: 0.08, to: pitch * 0.985, pan, send: 0.12 });
      tone(pitch * 2, { gain: 0.018, release: 0.05, pan });
      if (special === "ultra") tone(pitch / 2, { type: "sawtooth", gain: 0.025, release: 0.09, filter: 900, pan });
    },

    model({ index = 0, count = 3 } = {}) {
      const pan = panFor(index, count) * 0.6;
      knock([[820, 0.09, 0.05], [1640, 0.05, 0.035], [2460, 0.03, 0.025]], { pan, q: 12 });
      tone(150, { to: 88, gain: 0.07, release: 0.09, pan });
      tone(semitone(degree(index, count) - 12), { type: "triangle", gain: 0.03, release: 0.11, pan, send: 0.1 });
    },

    speed({ level = 1, count = 2 } = {}) {
      if (level === 0) {
        noise({ freq: 3600, freqTo: 500, q: 2.2, gain: 0.05, attack: 0.004, release: 0.2, sweep: 0.2 });
        tone(880, { to: 330, type: "triangle", gain: 0.035, release: 0.16 });
        return;
      }
      const lift = level / Math.max(1, count - 1);
      noise({ freq: 500, freqTo: 5200 + lift * 2800, q: 2.4, gain: 0.06, attack: 0.01, release: 0.18, sweep: 0.18, pan: -0.2 });
      tone(330, { to: 1320 + lift * 900, type: "sawtooth", gain: 0.035, release: 0.13, filter: 2600, q: 4, pan: 0.15 });
      bell(2093 * (1 + lift * 0.5), { at: 0.1, gain: 0.03, release: 0.25, pan: 0.3 });
      if (level > 1) bell(3136, { at: 0.16, gain: 0.025, release: 0.3, pan: -0.3 });
    },

    open() {
      noise({ freq: 1400, freqTo: 3800, q: 0.8, gain: 0.03, attack: 0.01, release: 0.09 });
      tone(392, { to: 784, gain: 0.06, attack: 0.006, release: 0.12, send: 0.15 });
    },

    close() {
      tone(660, { to: 330, gain: 0.045, attack: 0.004, release: 0.1 });
      noise({ freq: 2400, freqTo: 900, q: 0.8, gain: 0.012, release: 0.07 });
    },

    instant() {
      noise({ freq: 7000, freqTo: 1800, q: 1.4, gain: 0.07, attack: 0.002, release: 0.11, filterType: "bandpass" });
      tone(1568, { to: 2349, gain: 0.045, release: 0.08, send: 0.15 });
    },

    max() {
      tone(55, { to: 110, type: "sine", gain: 0.12, attack: 0.01, release: 0.32 });
      tone(220, { to: 440, type: "sawtooth", gain: 0.04, attack: 0.02, hold: 0.06, release: 0.2, filter: 600, filterTo: 3800, q: 6 });
      [0, 7, 12, 19].forEach((step, i) => tone(semitone(step - 12), { at: 0.05 + i * 0.045, type: "square", gain: 0.022, release: 0.11, filter: 2600, pan: (i - 1.5) * 0.2, send: 0.2 }));
    },

    pro() {
      [0, 4, 7, 11, 14].forEach((step, i) => bell(semitone(step), { at: i * 0.03, gain: 0.03, release: 0.9, ratio: 2, index: 1.2, pan: (i - 2) * 0.22, send: 0.55 }));
      tone(130.81, { gain: 0.05, attack: 0.03, release: 0.6, send: 0.3 });
    },

    ultraArm() {
      // Ratchet: accelerating pawl clicks, then a heavy latch and a sprung shaft.
      [0, 0.055, 0.1, 0.138, 0.168].forEach((at, i) => knock([[2100 + i * 120, 0.06, 0.02], [4300, 0.025, 0.012]], { at, pan: -0.15 + i * 0.07 }));
      knock([[92, 0.5, 0.22], [184, 0.25, 0.16], [520, 0.12, 0.09]], { at: 0.2, q: 9 });
      tone(70, { at: 0.2, to: 38, gain: 0.16, release: 0.35 });
      tone(240, { at: 0.24, to: 160, gain: 0.03, release: 0.4, vibrato: { rate: 23, depth: 18 }, send: 0.2 });
    },

    ultra() {
      if (settings.jackpot === "slot") return slotJackpot();
      // Arcade jackpot: sub drop, rising arpeggio, coin rain, sustained major chord.
      tone(98, { to: 41, gain: 0.18, attack: 0.005, release: 0.6 });
      noise({ freq: 220, q: 0.7, gain: 0.08, attack: 0.004, release: 0.4, filterType: "lowpass" });
      [0, 4, 7, 12, 16, 19, 24].forEach((step, i) => tone(semitone(step - 12), { at: 0.08 + i * 0.05, type: "square", gain: 0.03, release: 0.12, filter: 3200, pan: (i - 3) * 0.12, send: 0.25 }));
      for (let i = 0; i < 14; i += 1) {
        bell(semitone(12 + SCALE[(i * 3) % SCALE.length]), { at: 0.42 + i * 0.045 + Math.random() * 0.02, gain: 0.028, release: 0.32, ratio: 3.5, pan: Math.random() * 1.4 - 0.7 });
      }
      [0, 4, 7, 12].forEach((step) => tone(semitone(step), { at: 0.42, type: "triangle", gain: 0.035, attack: 0.02, hold: 0.25, release: 0.7, send: 0.45 }));
      return 420;
    }
  };

  function slotJackpot() {
    // Reel whir: amplitude-gated noise whose gating speeds up, then three reel stops.
    const spin = 0.62;
    for (let i = 0; i < 22; i += 1) {
      const at = spin * Math.pow(i / 22, 0.8);
      knock([[1800 + (i % 3) * 260, 0.035, 0.014]], { at, pan: ((i % 3) - 1) * 0.4 });
    }
    noise({ freq: 900, freqTo: 2400, q: 3, gain: 0.025, attack: 0.04, hold: spin - 0.1, release: 0.06, sweep: spin, pan: 0 });
    [spin - 0.2, spin - 0.1, spin].forEach((at, i) => {
      knock([[140, 0.35, 0.12], [420, 0.15, 0.06]], { at, q: 10, pan: (i - 1) * 0.45 });
      tone(660 + i * 220, { at, gain: 0.03, release: 0.08, type: "square", filter: 2400, pan: (i - 1) * 0.45 });
    });
    const payout = spin + 0.06;
    for (let i = 0; i < 18; i += 1) {
      bell(semitone(24 + [0, 4, 7, 12][i % 4]), { at: payout + i * 0.038, gain: 0.03, release: 0.22, ratio: 4.1, index: 2.8, pan: Math.sin(i) * 0.6 });
    }
    [0, 4, 7, 12, 16].forEach((step) => tone(semitone(step), { at: payout, type: "triangle", gain: 0.03, attack: 0.01, hold: 0.3, release: 0.6, send: 0.4 }));
    return Math.round(payout * 1000);
  }

  instruments.deny = () => {
    tone(220, { type: "square", gain: 0.035, release: 0.07, filter: 1200 });
    tone(207.65, { at: 0.085, type: "square", gain: 0.035, release: 0.1, filter: 1000 });
  };

  // Returns milliseconds until the sound's "payoff" moment, so visuals can sync.
  function play(name, options = {}) {
    if (!settings.sounds) return 0;
    const instrument = instruments[name];
    if (!instrument || !ensure() || context.state !== "running" && context.state !== "suspended") return 0;
    const now = performance.now();
    const minGap = name === "detent" || name === "model" ? 22 : 60;
    if (now - (lastPlayed.get(name) || 0) < minGap) return 0;
    lastPlayed.set(name, now);
    try {
      return instrument(options) || 0;
    } catch (error) {
      console.debug("[Modelcade] sound failed", error);
      return 0;
    }
  }

  function silence() {
    if (!context) return;
    const now = context.currentTime;
    for (const node of live) {
      try { node.stop(now); } catch (_) {}
    }
    live.clear();
  }

  function configure(next) {
    settings = { ...settings, ...next };
    if (!context || !input) return;
    const now = context.currentTime;
    input.gain.cancelScheduledValues(now);
    input.gain.setTargetAtTime(settings.sounds ? settings.volume * MASTER : 0, now, 0.015);
    if (!settings.sounds) silence();
  }

  ns.audio = {
    play,
    configure,
    silence,
    unlock: () => { if (settings.sounds) ensure(); },
    names: Object.keys(instruments)
  };
})();
