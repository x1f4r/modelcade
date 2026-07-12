(() => {
  "use strict";

  if (window.__chatgptReasoningPowerPicker) return;
  window.__chatgptReasoningPowerPicker = true;

  const WORK_MODELS = ["Sol", "Terra", "Luna"];
  const WORK_EFFORTS = ["Light", "Medium", "High", "Extra High", "Max"];
  const CHAT_LEVELS = ["Instant", "Medium", "High", "Extra High", "Pro"];
  const CHAT_LEVEL_LABELS = { Instant: "Instant", Medium: "Med", High: "High", "Extra High": "X-High", Pro: "Pro" };
  const CHAT_STOP_COLORS = ["#7c8289", "#bd4815", "#ec7d18", "#ffbc34", "#fffdf0"];
  const COMPACT_CHAT_STOP_COLORS = ["#555b62", "#8c2c10", "#ec7d18", "#ffbc34", "#fffdf0"];
  const COMPACT_CHAT_GRADIENT = "linear-gradient(90deg, #08090a 0%, #16191d 12%, #343a41 22%, #57301f 28%, #8c2c10 33.333%, #bd4815 43%, #ec7d18 56%, #ffbc34 78%, #fffdf0 100%)";
  // Exact path used by ChatGPT's native Fast glyph, bundled locally so the
  // extension never depends on a versioned page sprite or another request.
  const CHATGPT_FAST_ICON_PATH = "M11.913 21.413q-.576.675-1.5.7-.925.024-1.5-.625-.563-.651-.238-1.8L9.688 16H4.575q-.85 0-1.325-.488a1.68 1.68 0 0 1-.475-1.2q0-.712.463-1.274l8.9-10.563q.574-.675 1.5-.7.924-.025 1.487.625.575.65.25 1.8L14.313 8h5.112q.85 0 1.325.5.488.5.488 1.212 0 .7-.476 1.25z";
  const MODEL_COLORS = {
    Sol: ["#ffd85a", "#fff3a8"],
    Terra: ["#4aa8ff", "#a8dcff"],
    Luna: ["#d8dde5", "#ffffff"],
    "5.5": ["#33383e", "#858b92"]
  };
  const MODEL_GRADIENTS = {
    Sol: "linear-gradient(90deg, #6f1f0d 0%, #a83a13 20%, #e76c16 43%, #ffad24 68%, #ffe16c 86%, #fff8d8 100%)",
    Terra: "linear-gradient(90deg, #071f4a 0%, #0b397d 22%, #1264ad 48%, #2b91d0 70%, #2e875d 78%, #87a867 88%, #dbe9e9 100%)",
    Luna: "linear-gradient(90deg, #35383d 0%, #50545b 22%, #66717c 40%, #89857f 60%, #b7b2a8 80%, #f0eee8 100%)",
    "5.5": "linear-gradient(90deg, #08090a 0%, #1d2024 54%, #4a5057 100%)"
  };
  const MODEL_STOP_COLORS = {
    Sol: ["#8c2c10", "#bd4815", "#ec7d18", "#ffbc34", "#fff2ad"],
    Terra: ["#0a2d68", "#0e4c95", "#176bb4", "#2b91d0", "#a0b985"],
    Luna: ["#41454a", "#585e66", "#6d7479", "#99948c", "#d2cec4"]
  };
  const COMPACT_WORK_GRADIENTS = {
    Sol: "linear-gradient(90deg, #6f1f0d 0%, #a83a13 18%, #e76c16 36%, #ffad24 55%, #ffe16c 71%, #fff8d8 81.8%, #9a63e5 91%, #c49aff 100%)",
    Terra: "linear-gradient(90deg, #071f4a 0%, #0b397d 18%, #1264ad 39%, #2b91d0 58%, #2e875d 65%, #87a867 73%, #dbe9e9 81.8%, #9560df 91%, #c49aff 100%)",
    Luna: "linear-gradient(90deg, #35383d 0%, #50545b 18%, #66717c 34%, #89857f 50%, #b7b2a8 67%, #f0eee8 81.8%, #9560df 91%, #c49aff 100%)"
  };
  const STORAGE_KEY = "reasoningPowerPicker";

  let mounted = null;
  let panel = null;
  let state = {
    surface: "chat",
    model: "Sol",
    effort: "Pro",
    ultra: false,
    returnModel: null,
    fast: false,
    pickerEnabled: true,
    compactMode: true,
    soundsEnabled: true,
    ultraSoundEnabled: true,
    slotJackpot: false,
    busy: false,
    dragging: false,
    ultraDragging: false
  };
  let scanTimer = null;
  const nativeOnlyTriggers = new WeakMap();
  const NATIVE_ONLY_TTL = 30_000;
  let nativeBridgeActive = false;
  let nativeSessionActive = false;
  let panelOpenPromise = null;
  let panelGeneration = 0;
  let panelPreserveUntil = 0;
  let capabilityState = { work: null, chat: null };
  let ultraSettingsByScope = {};
  let ultraSettingScope = null;
  // ChatGPT currently leaves an enabled-looking Ultra radio in the Work menu
  // even when General says off. Unknown accounts therefore start conservatively
  // off until the real switch is observed; the mirror is keyed by a local hash
  // of the visible account control so one account cannot affect another.
  let observedUltraSetting = false;
  let ultraSettingKnown = false;
  let motionShieldFrame = null;
  let nativeTriggerSnapshot = null;
  let nativeSnapshotObserver = null;
  const suppressedNativeMenus = new Set();
  let audioContext = null;
  let audioBus = null;
  const scheduledAudioSources = new Set();
  let preferencesLoaded = false;
  let savedBaseEffort = "High";

  const normalize = (value) => (value || "").replace(/\s+/g, " ").trim();
  const WORK_EFFORT_LABELS = {
    Light: "Low",
    Medium: "Med",
    High: "High",
    "Extra High": "X-High",
    Max: "Max"
  };
  const workEffortLabel = (value) => WORK_EFFORT_LABELS[value] || value;
  const chatLevelLabel = (value) => CHAT_LEVEL_LABELS[value] || value;
  const workEffortFromText = (value) => {
    const match = normalize(value).match(/(Extra High|Light|Medium|High|Max|Ultra)$/i);
    return match ? [...WORK_EFFORTS, "Ultra"].find((effort) => effort.toLowerCase() === match[1].toLowerCase()) || null : null;
  };
  const orderedSubset = (canonical, values) => canonical.filter((value) => values.includes(value));
  const workCapabilities = () => capabilityState.work || { models: [], efforts: [], speeds: [] };
  const chatCapabilities = () => capabilityState.chat || { levels: [] };
  const availableWorkModels = () => orderedSubset(WORK_MODELS, workCapabilities().models);
  const availableWorkEfforts = () => orderedSubset(WORK_EFFORTS, workCapabilities().efforts);
  const availableWorkLevels = () => [
    ...availableWorkEfforts(),
    ...(workHasUltra() ? ["Ultra"] : [])
  ];
  const workHasUltra = () => workCapabilities().efforts.includes("Ultra")
    && workCapabilities().efforts.includes("High")
    && workCapabilities().models.includes("Sol");
  const workHasFast = () => workCapabilities().speeds.includes("Standard") && workCapabilities().speeds.includes("Fast");
  const availableChatLevels = () => orderedSubset(CHAT_LEVELS, chatCapabilities().levels);
  const isNativeOnlyTrigger = (trigger) => {
    const markedAt = trigger ? nativeOnlyTriggers.get(trigger) : null;
    if (!markedAt) return false;
    if (Date.now() - markedAt < NATIVE_ONLY_TTL) return true;
    nativeOnlyTriggers.delete(trigger);
    return false;
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const visible = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };

  function makeChatRouteLayout(levels) {
    const count = Math.max(1, levels.length);
    const hasInstantBranch = levels[0] === "Instant" && count > 1;
    const positions = levels.map((_, index) => ({
      x: ((index + .5) / count) * 100,
      y: hasInstantBranch && index === 0 ? 30 : hasInstantBranch ? 70 : 50
    }));
    if (!positions.length) positions.push({ x: 50, y: 50 });
    const segmentLengths = [];
    let totalLength = 0;
    for (let index = 1; index < positions.length; index += 1) {
      const previous = positions[index - 1];
      const current = positions[index];
      const length = Math.hypot(current.x - previous.x, current.y - previous.y);
      segmentLengths.push(length);
      totalLength += length;
    }
    const progress = [0.0001];
    let traversed = 0;
    segmentLengths.forEach((length) => {
      traversed += length;
      progress.push(totalLength ? traversed / totalLength : 1);
    });
    return { positions, segmentLengths, totalLength, progress };
  }

  function chatRoutePoint(progress, route) {
    const clipped = Math.max(0, Math.min(1, progress));
    if (!route || route.positions.length < 2 || route.totalLength === 0) return route?.positions[0] || { x: 50, y: 50 };
    let remaining = clipped * route.totalLength;
    for (let index = 1; index < route.positions.length; index += 1) {
      const length = route.segmentLengths[index - 1];
      if (remaining <= length || index === route.positions.length - 1) {
        const start = route.positions[index - 1];
        const end = route.positions[index];
        const ratio = length ? Math.max(0, Math.min(1, remaining / length)) : 1;
        return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio, segment: index };
      }
      remaining -= length;
    }
    return route.positions.at(-1);
  }

  function renderChatRoute(field, progress) {
    const fill = field?.querySelector(".rpp-chat-route-fill");
    if (!fill) return;
    const clipped = Math.max(0.0001, Math.min(1, progress));
    const route = field._rppRouteLayout;
    const point = chatRoutePoint(clipped, route);
    const { x, y } = point;
    field._rppRouteProgress = clipped;
    field.style.setProperty("--chat-x", `${x}%`);
    field.style.setProperty("--chat-y", `${y}%`);
    const positions = route?.positions || [{ x: 50, y: 50 }];
    const segment = point.segment || 1;
    const path = [`M ${positions[0].x} ${positions[0].y}`];
    for (let index = 1; index < Math.min(segment, positions.length); index += 1) {
      path.push(`L ${positions[index].x} ${positions[index].y}`);
    }
    if (positions.length > 1) path.push(`L ${x} ${y}`);
    fill.setAttribute("d", path.join(" "));
  }

  function animateChatRoute(field, targetProgress) {
    if (!field) return;
    if (field._rppRouteFrame) cancelAnimationFrame(field._rppRouteFrame);
    const current = Number.isFinite(field._rppRouteProgress) ? field._rppRouteProgress : targetProgress;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(current - targetProgress) < .0001) {
      renderChatRoute(field, targetProgress);
      field._rppRouteFrame = null;
      return;
    }
    const start = performance.now();
    const duration = state.dragging ? 150 : 180 + Math.abs(targetProgress - current) * 140;
    const tick = (now) => {
      if (!field.isConnected) {
        field._rppRouteFrame = null;
        return;
      }
      const elapsed = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 4);
      renderChatRoute(field, current + (targetProgress - current) * eased);
      if (elapsed < 1) {
        field._rppRouteFrame = requestAnimationFrame(tick);
      } else {
        renderChatRoute(field, targetProgress);
        field._rppRouteFrame = null;
      }
    };
    field._rppRouteFrame = requestAnimationFrame(tick);
  }

  function ensureAudio() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!audioContext) {
        audioContext = new AudioContextClass();
        const master = audioContext.createGain();
        const compressor = audioContext.createDynamicsCompressor();
        master.gain.value = state.soundsEnabled ? .28 : 0;
        compressor.threshold.value = -18;
        compressor.knee.value = 16;
        compressor.ratio.value = 5;
        compressor.attack.value = .003;
        compressor.release.value = .18;
        master.connect(compressor).connect(audioContext.destination);
        audioBus = master;
      }
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
      return audioContext;
    } catch (_) {
      return null;
    }
  }

  function trackAudioSource(source) {
    scheduledAudioSources.add(source);
    source.addEventListener("ended", () => scheduledAudioSources.delete(source), { once: true });
    return source;
  }

  function syncAudioMaster() {
    if (!audioContext || !audioBus) return;
    const now = audioContext.currentTime;
    audioBus.gain.cancelScheduledValues(now);
    audioBus.gain.setValueAtTime(state.soundsEnabled ? .28 : 0, now);
    if (state.soundsEnabled) return;
    for (const source of scheduledAudioSources) {
      try { source.stop(now); } catch (_) {}
      try { source.disconnect(); } catch (_) {}
    }
    scheduledAudioSources.clear();
  }

  function markSound(name) {
    const context = ensureAudio();
    document.documentElement.dataset.rppLastSound = name;
    if (panel) {
      panel.dataset.lastSound = name;
      panel.dataset.audioState = context?.state || "unavailable";
    }
  }

  function scheduleTone(frequency, options = {}) {
    const context = ensureAudio();
    if (!context || !audioBus) return;
    const start = context.currentTime + (options.delay || 0);
    const duration = options.duration || .06;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    oscillator.type = options.type || "sine";
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    if (options.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.endFrequency), start + duration);
    filter.type = options.filterType || "lowpass";
    filter.frequency.value = options.filter || 9000;
    filter.Q.value = options.q || .4;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.gain || .05, start + Math.min(.012, duration * .25));
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(filter).connect(gain).connect(audioBus);
    trackAudioSource(oscillator);
    oscillator.start(start);
    oscillator.stop(start + duration + .03);
  }

  function scheduleNoise(options = {}) {
    const context = ensureAudio();
    if (!context || !audioBus) return;
    const start = context.currentTime + (options.delay || 0);
    const duration = options.duration || .12;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      const envelope = 1 - index / samples.length;
      samples[index] = (Math.random() * 2 - 1) * envelope;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = options.filterType || "lowpass";
    filter.frequency.value = options.filter || 900;
    filter.Q.value = options.q || 1.2;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.gain || .07, start + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.connect(filter).connect(gain).connect(audioBus);
    trackAudioSource(source);
    source.start(start);
  }

  function playMagneticTick(kind = "effort") {
    if (!state.soundsEnabled) return;
    markSound(kind === "model" ? "model-click" : "effort-click");
    if (kind === "model") {
      scheduleTone(320, { endFrequency: 210, duration: .075, gain: .06, type: "triangle", filter: 2400 });
      scheduleNoise({ duration: .035, gain: .018, filter: 1700 });
    } else {
      scheduleTone(920, { endFrequency: 690, duration: .032, gain: .032, type: "sine" });
      scheduleNoise({ duration: .018, gain: .009, filter: 4200, filterType: "highpass" });
    }
  }

  function playLeverPull(enabling) {
    if (!state.soundsEnabled) return;
    if (!state.ultraSoundEnabled) {
      playMagneticTick("effort");
      return;
    }
    markSound(enabling ? "ultra-lever-down" : "ultra-lever-up");
    scheduleNoise({ duration: .32, gain: .11, filter: enabling ? 420 : 620, q: 2.2 });
    scheduleTone(enabling ? 105 : 145, { endFrequency: enabling ? 43 : 86, duration: .36, gain: .13, type: "triangle", filter: 680 });
    scheduleTone(enabling ? 58 : 82, { endFrequency: 42, delay: .055, duration: .25, gain: .09, type: "sine", filter: 420 });
    scheduleTone(185, { endFrequency: 118, delay: .22, duration: .075, gain: .085, type: "square", filter: 950 });
  }

  function playStandardUltraJackpot() {
    if (!state.soundsEnabled || !state.ultraSoundEnabled) return;
    markSound("ultra-jackpot");
    scheduleNoise({ duration: .52, gain: .17, filter: 240, q: 1.8 });
    scheduleTone(72, { endFrequency: 34, duration: .58, gain: .18, type: "sine", filter: 420 });
    [0, .055, .11, .17, .24, .32].forEach((delay, index) => {
      scheduleTone(1180 + index * 95, { endFrequency: 820 + index * 70, delay, duration: .027, gain: .025, type: "square", filter: 5200 });
    });
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      scheduleTone(frequency, { delay: .18 + index * .095, duration: .28, gain: .065, type: index % 2 ? "triangle" : "sine", filter: 4600 });
      scheduleTone(frequency * 2, { delay: .19 + index * .095, duration: .16, gain: .022, type: "sine", filter: 6500 });
    });
    scheduleTone(1567.98, { delay: .62, duration: .48, gain: .07, type: "sine", filter: 7200 });
  }

  function playSlotMachineJackpot({ preview = false } = {}) {
    if (!state.soundsEnabled || !state.ultraSoundEnabled) return 0;
    markSound(preview ? "slot-jackpot-preview" : "ultra-slot-jackpot");
    const context = ensureAudio();
    if (!context || !audioBus) return 0;

    const spinDuration = preview ? .24 : .38;
    const jackpotAt = spinDuration + .035;
    const start = context.currentTime + .008;
    const carrier = context.createOscillator();
    const vibrato = context.createOscillator();
    const vibratoDepth = context.createGain();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    carrier.type = "sawtooth";
    carrier.frequency.setValueAtTime(1280, start);
    carrier.frequency.exponentialRampToValueAtTime(2240, start + spinDuration);
    vibrato.type = "triangle";
    vibrato.frequency.setValueAtTime(24, start);
    vibrato.frequency.linearRampToValueAtTime(38, start + spinDuration);
    vibratoDepth.gain.value = 105;
    filter.type = "bandpass";
    filter.frequency.value = 2450;
    filter.Q.value = 2.8;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(preview ? .025 : .038, start + .018);
    gain.gain.setValueAtTime(preview ? .025 : .038, start + Math.max(.02, spinDuration - .035));
    gain.gain.exponentialRampToValueAtTime(.0001, start + spinDuration);
    vibrato.connect(vibratoDepth).connect(carrier.frequency);
    carrier.connect(filter).connect(gain).connect(audioBus);
    trackAudioSource(carrier);
    trackAudioSource(vibrato);
    carrier.start(start);
    vibrato.start(start);
    carrier.stop(start + spinDuration + .02);
    vibrato.stop(start + spinDuration + .02);

    const reelTicks = preview ? [0, .05, .095, .137, .176] : [0, .052, .1, .145, .187, .226, .262, .295, .326];
    reelTicks.forEach((delay, index) => {
      scheduleTone(1680 + index * 74, { delay, duration: .018, gain: .018, type: "square", filter: 5800 });
    });
    [spinDuration - .075, spinDuration - .038, spinDuration].forEach((delay, index) => {
      scheduleNoise({ delay, duration: .035, gain: .028 + index * .008, filter: 880 + index * 170, q: 2.4 });
      scheduleTone(210 - index * 34, { delay, endFrequency: 96 - index * 12, duration: .055, gain: .047, type: "triangle", filter: 1200 });
    });

    const coinNotes = preview
      ? [2093, 2637.02, 3135.96, 2637.02, 3520]
      : [2093, 2637.02, 3135.96, 2349.32, 3520, 2793.83, 3951.07, 3135.96, 4186.01, 3520, 4698.63];
    coinNotes.forEach((frequency, index) => {
      const delay = jackpotAt + index * (preview ? .043 : .038);
      scheduleTone(frequency, { delay, duration: .07, gain: .038, type: "square", filter: 7600 });
      scheduleTone(frequency * 1.26, { delay: delay + .009, duration: .105, gain: .026, type: "sine", filter: 9200 });
      scheduleNoise({ delay: delay + .004, duration: .022, gain: .008, filter: 5200, filterType: "highpass", q: 1.6 });
    });
    if (!preview) {
      [1046.5, 1318.51, 1567.98, 2093].forEach((frequency, index) => {
        scheduleTone(frequency, { delay: jackpotAt + .08 + index * .055, duration: .28, gain: .035, type: "triangle", filter: 6200 });
      });
    }
    return Math.round(jackpotAt * 1000);
  }

  function playUltraJackpot() {
    if (!state.soundsEnabled || !state.ultraSoundEnabled) return 0;
    if (state.slotJackpot) return playSlotMachineJackpot();
    playStandardUltraJackpot();
    return 0;
  }

  async function waitFor(test, timeout = 2600, interval = 20) {
    const start = performance.now();
    while (performance.now() - start < timeout) {
      const result = test();
      if (result) return result;
      await sleep(interval);
    }
    throw new Error("ChatGPT's native selector did not respond in time.");
  }

  function checkedSurface() {
    const selected = [...document.querySelectorAll('[role="radio"][aria-checked="true"]')]
      .find((element) => /^(chat|work)$/i.test(normalize(element.textContent)));
    return /work/i.test(normalize(selected?.textContent)) ? "work" : "chat";
  }

  function looksLikeNativeTrigger(button, surface) {
    if (!(button instanceof HTMLButtonElement)) return false;
    const text = normalize(button.innerText || button.textContent);
    if (surface === "work") {
      return /(?:5\.6\s+)?(Sol|Terra|Luna)\s+(Light|Medium|High|Extra High|Max|Ultra)$/i.test(text);
    }
    return /^(Instant|Medium|High|Extra High|Pro)(?:\s+5\.5)?$/i.test(text);
  }

  function findNativeTrigger(surface = checkedSurface()) {
    const current = document.querySelector('button[data-rpp-native="true"]');
    if (current?.isConnected && visible(current) && looksLikeNativeTrigger(current, surface)) return current;
    return [...document.querySelectorAll('main button[aria-haspopup="menu"], button[aria-haspopup="menu"]')]
      .filter(visible)
      .find((button) => looksLikeNativeTrigger(button, surface)) || null;
  }

  function parseNativeState(trigger, surface) {
    const text = normalize(trigger?.innerText || trigger?.textContent);
    if (surface === "work") {
      state.fast = Boolean(trigger?.querySelector('[data-testid="composer-model-picker-fast-service-tier-icon"]'));
      const match = text.match(/(?:5\.6\s+)?(Sol|Terra|Luna)\s+(Light|Medium|High|Extra High|Max|Ultra)$/i);
      if (match) {
        state.model = WORK_MODELS.find((item) => item.toLowerCase() === match[1].toLowerCase()) || "Sol";
        const nativeEffort = match[2];
        if (nativeEffort.toLowerCase() === "ultra") {
          // A current Ultra selection is strong evidence only when this account's
          // General switch has never been observed. Never let a stale trigger
          // overwrite an explicitly observed off state during native transition.
          if (!ultraSettingKnown) {
            observedUltraSetting = true;
            ultraSettingKnown = true;
            if (ultraSettingScope) {
              ultraSettingsByScope = { ...ultraSettingsByScope, [ultraSettingScope]: true };
              persistPreferences({ ultraSettingsByScope }).catch(() => {});
            }
          }
          state.ultra = true;
          state.effort = WORK_EFFORTS.includes(savedBaseEffort) ? savedBaseEffort : "High";
        } else {
          const wasUltra = state.ultra;
          state.ultra = false;
          if (!state.busy || !wasUltra) state.returnModel = null;
          state.effort = WORK_EFFORTS.find((item) => item.toLowerCase() === nativeEffort.toLowerCase()) || "Medium";
          savedBaseEffort = state.effort;
        }
      }
    } else {
      const level = CHAT_LEVELS.find((item) => text.toLowerCase().startsWith(item.toLowerCase()));
      if (level) state.effort = level;
      state.model = level === "Instant" ? "5.5" : "Sol";
      state.ultra = false;
    }
    state.surface = surface;
  }

  function applyModelTheme(element = panel) {
    if (!element) return;
    const [base, bright] = MODEL_COLORS[state.model] || MODEL_COLORS.Sol;
    element.style.setProperty("--rpp-model", base);
    element.style.setProperty("--rpp-model-bright", bright);
    element.style.setProperty("--rpp-model-gradient", MODEL_GRADIENTS[state.model] || MODEL_GRADIENTS.Sol);
    element.dataset.model = state.model;
  }

  function updateTrigger() {
    if (!mounted?.native) return;
    mounted.native.querySelector(":scope > .rpp-native-fast-icon")?.remove();
    applyModelTheme();
  }

  function cleanupMount(preservePanel = false) {
    panelGeneration += 1;
    if (mounted?.native?.isConnected) {
      mounted.native.removeEventListener("pointerdown", mounted.pointerHandler, true);
      mounted.native.removeEventListener("click", mounted.clickHandler, true);
      mounted.native.removeEventListener("keydown", mounted.keyHandler, true);
      mounted.native.querySelector(":scope > .rpp-native-fast-icon")?.remove();
      delete mounted.native.dataset.rppNative;
    }
    mounted = null;
    if (!preservePanel) closePanel();
  }

  function mount(trigger, surface) {
    const preservePanel = Boolean(
      panel
      && (mounted?.surface === surface || state.surface === surface)
      && (state.busy || nativeSessionActive || performance.now() < panelPreserveUntil)
    );
    if (!preservePanel && panel && state.surface !== surface) panelPreserveUntil = 0;
    cleanupMount(preservePanel);
    if (!preservePanel) capabilityState[surface] = null;
    parseNativeState(trigger, surface);
    trigger.dataset.rppNative = "true";
    const pointerHandler = (event) => {
      if (nativeBridgeActive || isNativeOnlyTrigger(trigger) || event.button !== 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (nativeSessionActive) return;
      panel ? closePanel(true, "trigger-pointer") : openPanel();
    };
    const clickHandler = (event) => {
      if (nativeBridgeActive || isNativeOnlyTrigger(trigger)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (nativeSessionActive) return;
    };
    const keyHandler = (event) => {
      if (nativeBridgeActive || isNativeOnlyTrigger(trigger) || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (nativeSessionActive) return;
      panel ? closePanel(true, "trigger-key") : openPanel();
    };
    trigger.addEventListener("pointerdown", pointerHandler, true);
    trigger.addEventListener("click", clickHandler, true);
    trigger.addEventListener("keydown", keyHandler, true);
    mounted = { native: trigger, custom: trigger, surface, pointerHandler, clickHandler, keyHandler };
    updateTrigger();
    if (preservePanel) {
      syncPanel();
      requestAnimationFrame(placePanel);
    }
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanAndMount, 90);
  }

  function isModelPickerHotkey(event) {
    if (event.isComposing || event.altKey || event.metaKey) return false;
    const isM = event.code === "KeyM" || event.key?.toLowerCase() === "m";
    return isM && event.ctrlKey && event.shiftKey;
  }

  function handleModelPickerHotkey(event) {
    if (!isModelPickerHotkey(event) || !preferencesLoaded || !state.pickerEnabled) return;
    const surface = checkedSurface();
    const trigger = findNativeTrigger(surface);
    if (!trigger) {
      scheduleScan();
      return;
    }
    if (isNativeOnlyTrigger(trigger)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (!mounted || mounted.native !== trigger || mounted.surface !== surface) mount(trigger, surface);
    if (panel) {
      closePanel(true, "hotkey");
      mounted?.custom?.focus({ preventScroll: true });
      return;
    }
    const opening = openPanel();
    opening?.then(() => {
      panel?.querySelector(".rpp-compact-field, .rpp-field, .rpp-chat-field")?.focus({ preventScroll: true });
    });
  }

  // Installed at document_start so ChatGPT's later shortcut listener never sees
  // Ctrl-Shift-M while Modelcade is enabled. Disabling Modelcade deliberately
  // leaves the event untouched and restores ChatGPT's native shortcut.
  window.addEventListener("keydown", handleModelPickerHotkey, true);

  const blockInputDuringNativeSession = (event) => {
    if (!nativeSessionActive || nativeBridgeActive) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };
  ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "auxclick", "dblclick", "keydown", "keyup"].forEach((type) => {
    window.addEventListener(type, blockInputDuringNativeSession, true);
  });

  function setSettingsSwitch(row, enabled) {
    const button = row.querySelector('[role="switch"]');
    const knob = button?.querySelector("span");
    button?.setAttribute("aria-checked", String(enabled));
    button?.setAttribute("data-state", enabled ? "checked" : "unchecked");
    knob?.setAttribute("data-state", enabled ? "checked" : "unchecked");
    row.dataset.enabled = String(enabled);
  }

  function syncSettingsControls(section = document.querySelector("[data-rpp-settings-section]")) {
    if (!section) return;
    const pickerRow = section.querySelector('[data-rpp-setting="pickerEnabled"]');
    const compactRow = section.querySelector('[data-rpp-setting="compactMode"]');
    const soundsRow = section.querySelector('[data-rpp-setting="soundsEnabled"]');
    const ultraSoundRow = section.querySelector('[data-rpp-setting="ultraSoundEnabled"]');
    const slotRow = section.querySelector('[data-rpp-setting="slotJackpot"]');
    if (pickerRow) setSettingsSwitch(pickerRow, state.pickerEnabled);
    const settings = [
      [compactRow, state.compactMode, state.pickerEnabled],
      [soundsRow, state.soundsEnabled, state.pickerEnabled],
      [ultraSoundRow, state.ultraSoundEnabled, state.pickerEnabled && state.soundsEnabled],
      [slotRow, state.slotJackpot, state.pickerEnabled && state.soundsEnabled && state.ultraSoundEnabled]
    ];
    settings.forEach(([row, enabled, available]) => {
      if (!row) return;
      setSettingsSwitch(row, enabled);
      const button = row.querySelector('[role="switch"]');
      if (button) button.disabled = !available;
      row.dataset.available = String(available);
    });
  }

  function currentAccountScope() {
    const profile = [...document.querySelectorAll('button,[role="button"]')].filter(visible).find((button) => {
      const descriptor = `${button.getAttribute("aria-label") || ""} ${normalize(button.textContent)}`;
      return /open profile menu/i.test(descriptor) && /\b(Free|Go|Plus|Pro|Business|Enterprise)\b/i.test(descriptor);
    });
    if (!profile) return null;
    const avatarSource = profile.querySelector("img")?.getAttribute("src") || "";
    let accountIdentity = "";
    if (avatarSource) {
      try {
        const avatarUrl = new URL(avatarSource, location.href);
        const encodedIdentity = avatarUrl.pathname.split("/enc/")[1]?.split("/")[0];
        if (encodedIdentity) {
          const decodedIdentity = JSON.parse(atob(decodeURIComponent(encodedIdentity).replace(/-/g, "+").replace(/_/g, "/")));
          accountIdentity = String(decodedIdentity?.id || "").replace(/^postcache:/, "");
        }
        if (!accountIdentity) accountIdentity = avatarUrl.pathname;
      } catch (_) {
        accountIdentity = avatarSource.split("?")[0];
      }
    }
    if (!accountIdentity) {
      accountIdentity = normalize(profile.getAttribute("aria-label") || profile.textContent)
        .replace(/,?\s*open profile menu/i, "")
        .replace(/\b(Free|Go|Plus|Pro|Business|Enterprise)\b/ig, "")
        .trim();
    }
    const planIdentity = `${profile.getAttribute("aria-label") || ""} ${normalize(profile.textContent)}`
      .match(/\b(Free|Go|Plus|Pro|Business|Enterprise)\b/i)?.[1] || "unknown-plan";
    const workspaceRoute = location.pathname.match(/^\/(?:w|workspace)\/[^/]+/i)?.[0] || "";
    const workspaceControl = [...document.querySelectorAll('button,[role="button"]')]
      .filter(visible)
      .find((element) => /(?:workspace|organization)/i.test(`${element.getAttribute("aria-label") || ""} ${element.getAttribute("data-testid") || ""}`));
    const workspaceIdentity = workspaceControl
      ? `${workspaceControl.getAttribute("aria-label") || ""}|${normalize(workspaceControl.textContent)}`
      : "personal";
    const source = `${location.host}|${accountIdentity}|${planIdentity}|${workspaceRoute}|${workspaceIdentity}`;
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `account-${(hash >>> 0).toString(36)}`;
  }

  function syncUltraSettingScope() {
    const nextScope = currentAccountScope();
    if (nextScope === ultraSettingScope) return;
    ultraSettingScope = nextScope;
    ultraSettingKnown = Boolean(nextScope && Object.prototype.hasOwnProperty.call(ultraSettingsByScope, nextScope));
    observedUltraSetting = ultraSettingKnown ? Boolean(ultraSettingsByScope[nextScope]) : false;
    capabilityState.work = null;
    if (mounted?.native) nativeOnlyTriggers.delete(mounted.native);
    if (panel && state.surface === "work" && performance.now() >= panelPreserveUntil) closePanel();
  }

  function syncObservedUltraSetting() {
    syncUltraSettingScope();
    const switches = [...document.querySelectorAll('[role="switch"]')].filter(visible);
    const ultraSwitch = switches.find((element) => {
      let node = element;
      for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
        if (/Enable Ultra effort/i.test(normalize(node.textContent)) && node.querySelectorAll('[role="switch"]').length === 1) return true;
      }
      return false;
    });
    if (!ultraSwitch) return;
    const next = ultraSwitch.getAttribute("aria-checked") === "true";
    if (ultraSettingKnown && next === observedUltraSetting) return;
    observedUltraSetting = next;
    ultraSettingKnown = true;
    if (mounted?.native) nativeOnlyTriggers.delete(mounted.native);
    if (ultraSettingScope) {
      ultraSettingsByScope = { ...ultraSettingsByScope, [ultraSettingScope]: next };
      persistPreferences({ ultraSettingsByScope }).catch(() => {});
    }
    if (!next && capabilityState.work?.efforts.includes("Ultra")) {
      capabilityState.work = {
        ...capabilityState.work,
        efforts: capabilityState.work.efforts.filter((effort) => effort !== "Ultra")
      };
      if (panel && state.surface === "work" && performance.now() >= panelPreserveUntil) closePanel();
    }
  }

  function mountSettingsControl() {
    const tabpanel = [...document.querySelectorAll('[role="tabpanel"]')]
      .find((element) => visible(element) && (
        element.id.includes("content-Personalization") ||
        normalize(element.querySelector("h3")?.textContent) === "Personalization"
      ));
    if (!tabpanel) return;
    const existing = tabpanel.querySelector("[data-rpp-settings-section]");
    if (existing) {
      syncSettingsControls(existing);
      return;
    }

    document.querySelectorAll("[data-rpp-settings-row]").forEach((element) => element.remove());
    const firstSection = tabpanel.querySelector(":scope > section");
    if (!firstSection) return;
    const section = document.createElement("section");
    section.className = "rpp-settings-section";
    section.dataset.rppSettingsSection = "true";
    section.innerHTML = `
      <div class="rpp-settings-section__head">
        <h3>Modelcade</h3>
        <p class="rpp-settings-disclosure">Local data use: reads relevant ChatGPT control labels and availability plus account/workspace interface metadata to scope Ultra preferences. Raw values stay on this device and are never stored or transmitted by Modelcade.</p>
      </div>`;

    const pickerRow = document.createElement("div");
    pickerRow.className = "rpp-settings-row";
    pickerRow.dataset.rppSettingsRow = "true";
    pickerRow.dataset.rppSetting = "pickerEnabled";
    const pickerTitleId = `rpp-picker-title-${Math.random().toString(36).slice(2, 8)}`;
    const pickerDescriptionId = `rpp-picker-description-${Math.random().toString(36).slice(2, 8)}`;
    pickerRow.innerHTML = `
      <div class="rpp-settings-copy">
        <div id="${pickerTitleId}" class="rpp-settings-title">Use Modelcade picker</div>
        <div id="${pickerDescriptionId}" class="rpp-settings-description">Replace ChatGPT's Chat and Work model selectors. Turn this off to restore the native picker immediately.</div>
      </div>
      <button type="button" role="switch" class="rpp-settings-switch" aria-labelledby="${pickerTitleId}" aria-describedby="${pickerDescriptionId}">
        <span aria-hidden="true"></span>
      </button>`;
    pickerRow.querySelector("button").addEventListener("click", async () => {
      state.pickerEnabled = !state.pickerEnabled;
      syncSettingsControls(section);
      if (state.pickerEnabled) scheduleScan();
      else {
        panelPreserveUntil = 0;
        restoreNativePickerVisibility();
        cleanupMount();
      }
      playMagneticTick("model");
      await persistPreferences({ pickerEnabled: state.pickerEnabled });
    });
    section.append(pickerRow);

    const compactRow = document.createElement("div");
    compactRow.className = "rpp-settings-row";
    compactRow.dataset.rppSettingsRow = "true";
    compactRow.dataset.rppSetting = "compactMode";
    const compactTitleId = `rpp-compact-title-${Math.random().toString(36).slice(2, 8)}`;
    const compactDescriptionId = `rpp-compact-description-${Math.random().toString(36).slice(2, 8)}`;
    compactRow.innerHTML = `
      <div class="rpp-settings-copy">
        <div id="${compactTitleId}" class="rpp-settings-title">Compact picker</div>
        <div id="${compactDescriptionId}" class="rpp-settings-description">Use the one-lane Chat and Work layouts. Turn this off for the full field pickers.</div>
      </div>
      <button type="button" role="switch" class="rpp-settings-switch" aria-labelledby="${compactTitleId}" aria-describedby="${compactDescriptionId}">
        <span aria-hidden="true"></span>
      </button>`;
    compactRow.querySelector("button").addEventListener("click", async () => {
      state.compactMode = !state.compactMode;
      panelPreserveUntil = 0;
      closePanel(true, "compact-setting");
      syncSettingsControls(section);
      playMagneticTick("model");
      await persistPreferences({ compactMode: state.compactMode });
    });
    section.append(compactRow);

    const soundsRow = document.createElement("div");
    soundsRow.className = "rpp-settings-row";
    soundsRow.dataset.rppSettingsRow = "true";
    soundsRow.dataset.rppSetting = "soundsEnabled";
    const soundsTitleId = `rpp-sounds-title-${Math.random().toString(36).slice(2, 8)}`;
    const soundsDescriptionId = `rpp-sounds-description-${Math.random().toString(36).slice(2, 8)}`;
    soundsRow.innerHTML = `
      <div class="rpp-settings-copy">
        <div id="${soundsTitleId}" class="rpp-settings-title">Sounds</div>
        <div id="${soundsDescriptionId}" class="rpp-settings-description">Play Modelcade's restrained model, effort, and Ultra interaction sounds.</div>
      </div>
      <button type="button" role="switch" class="rpp-settings-switch" aria-labelledby="${soundsTitleId}" aria-describedby="${soundsDescriptionId}">
        <span aria-hidden="true"></span>
      </button>`;
    soundsRow.querySelector("button").addEventListener("click", async () => {
      state.soundsEnabled = !state.soundsEnabled;
      if (state.soundsEnabled) ensureAudio();
      syncAudioMaster();
      syncSettingsControls(section);
      if (state.soundsEnabled) playMagneticTick("model");
      await persistPreferences({ soundsEnabled: state.soundsEnabled });
    });
    section.append(soundsRow);

    const ultraSoundRow = document.createElement("div");
    ultraSoundRow.className = "rpp-settings-row";
    ultraSoundRow.dataset.rppSettingsRow = "true";
    ultraSoundRow.dataset.rppSetting = "ultraSoundEnabled";
    const ultraSoundTitleId = `rpp-ultra-sound-title-${Math.random().toString(36).slice(2, 8)}`;
    const ultraSoundDescriptionId = `rpp-ultra-sound-description-${Math.random().toString(36).slice(2, 8)}`;
    ultraSoundRow.innerHTML = `
      <div class="rpp-settings-copy">
        <div id="${ultraSoundTitleId}" class="rpp-settings-title">Ultra sound effects</div>
        <div id="${ultraSoundDescriptionId}" class="rpp-settings-description">Use the heavy lever and Ultra celebration sounds. When off, the lever uses the ordinary effort click.</div>
      </div>
      <button type="button" role="switch" class="rpp-settings-switch" aria-labelledby="${ultraSoundTitleId}" aria-describedby="${ultraSoundDescriptionId}">
        <span aria-hidden="true"></span>
      </button>`;
    ultraSoundRow.querySelector("button").addEventListener("click", async () => {
      state.ultraSoundEnabled = !state.ultraSoundEnabled;
      syncSettingsControls(section);
      if (state.ultraSoundEnabled) playLeverPull(true);
      else playMagneticTick("effort");
      await persistPreferences({ ultraSoundEnabled: state.ultraSoundEnabled });
    });
    section.append(ultraSoundRow);

    const row = document.createElement("div");
    row.className = "rpp-settings-row";
    row.dataset.rppSettingsRow = "true";
    row.dataset.rppSetting = "slotJackpot";
    const titleId = `rpp-coin-title-${Math.random().toString(36).slice(2, 8)}`;
    const descriptionId = `rpp-coin-description-${Math.random().toString(36).slice(2, 8)}`;
    row.innerHTML = `
      <div class="rpp-settings-copy">
        <div id="${titleId}" class="rpp-settings-title">Slot-machine jackpot</div>
        <div id="${descriptionId}" class="rpp-settings-description">Play a brief reel-spin whine, reel stops, and a jackpot coin burst when Ultra engages.</div>
      </div>
      <button type="button" role="switch" class="rpp-settings-switch" aria-labelledby="${titleId}" aria-describedby="${descriptionId}">
        <span aria-hidden="true"></span>
      </button>`;
    row.querySelector("button").addEventListener("click", async () => {
      state.slotJackpot = !state.slotJackpot;
      syncSettingsControls(section);
      await persistPreferences({ slotJackpot: state.slotJackpot });
      if (state.slotJackpot) playSlotMachineJackpot({ preview: true });
      else playMagneticTick("effort");
    });
    section.append(row);
    firstSection.insertAdjacentElement("afterend", section);
    syncSettingsControls(section);
  }

  function scanAndMount() {
    if (!preferencesLoaded) return;
    syncObservedUltraSetting();
    if (nativeSessionActive) return;
    mountSettingsControl();
    if (!state.pickerEnabled) {
      if (mounted || panel) cleanupMount();
      return;
    }
    const surface = checkedSurface();
    const trigger = findNativeTrigger(surface);
    if (!trigger) {
      if (mounted || panel) cleanupMount();
      return;
    }
    if (!mounted || mounted.native !== trigger || mounted.surface !== surface) {
      mount(trigger, surface);
      return;
    }
    if (state.busy || state.dragging || state.ultraDragging) return;
    parseNativeState(trigger, surface);
    updateTrigger();
    syncPanel();
  }

  function findComposerAnchor() {
    const triggerRect = mounted?.custom?.getBoundingClientRect();
    let node = mounted?.custom?.parentElement;
    let best = { rect: triggerRect, element: mounted?.custom };
    while (node && node !== document.body) {
      const rect = node.getBoundingClientRect();
      const hasInput = Boolean(node.querySelector('textarea, [contenteditable="true"], [role="textbox"]'));
      const hasSend = Boolean(node.querySelector('button[aria-label*="Send" i], button[data-testid*="send" i]'));
      const plausible = rect.width >= 480 && rect.width <= Math.min(window.innerWidth - 24, 1100) && rect.height >= 48 && rect.height <= 420;
      if (hasInput && plausible) {
        best = { rect, element: node };
        const radius = parseFloat(getComputedStyle(node).borderTopLeftRadius);
        if (hasSend || radius > 0) break;
      }
      node = node.parentElement;
    }
    return best;
  }

  function placePanel() {
    if (!panel || !mounted?.custom) return;
    const triggerRect = mounted.custom.getBoundingClientRect();
    const composer = findComposerAnchor();
    const composerRect = composer?.rect || triggerRect;
    const targetWidth = state.compactMode
      ? state.surface === "work"
        ? Math.max(286, Math.min(352, composerRect.width * .38))
        : Math.max(248, Math.min(320, composerRect.width * .34))
      : state.surface === "work"
        ? Math.max(320, Math.min(410, composerRect.width * .44))
        : Math.max(280, Math.min(390, composerRect.width * .42));
    panel.style.width = `${Math.min(targetWidth, window.innerWidth - 24)}px`;
    if (composer?.element) {
      const radius = getComputedStyle(composer.element).borderRadius;
      if (radius && radius !== "0px") {
        panel.style.borderRadius = radius;
        panel.style.setProperty("--rpp-panel-radius", radius.split(" ")[0]);
      }
    }
    const panelWidth = panel.offsetWidth;
    const gap = 8;
    const anchorRight = Math.min(window.innerWidth - 12, composerRect.right);
    const left = Math.max(12, anchorRight - panelWidth);
    const top = composerRect.bottom + gap;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.maxHeight = `${Math.max(160, window.innerHeight - top - 12)}px`;
  }

  function updateEffortGlow(model, effortOrIndex) {
    if (!panel) return;
    const effort = typeof effortOrIndex === "number" ? WORK_EFFORTS[effortOrIndex] : effortOrIndex;
    const canonicalIndex = Math.max(0, WORK_EFFORTS.indexOf(effort));
    const stopColor = MODEL_STOP_COLORS[model]?.[canonicalIndex] || MODEL_COLORS[model]?.[0] || MODEL_COLORS.Sol[0];
    panel.style.setProperty("--rpp-stop-color", stopColor);
    panel.querySelectorAll(".rpp-columns span").forEach((element) => {
      element.classList.toggle("is-active", element.dataset.effort === effort);
    });
  }

  const compactStopLeft = (index, count) => ((index + .5) / count) * 100;

  function renderCompactRail(field, index, labels, gradient, stopColor, valueText) {
    if (!field) return;
    const count = labels.length;
    const left = compactStopLeft(index, count);
    const lastCenter = compactStopLeft(count - 1, count);
    field.style.setProperty("--compact-puck-left", `${left}%`);
    field.style.setProperty("--compact-fill-width", `${left}%`);
    field.style.setProperty("--compact-gradient-progress", String(left / lastCenter));
    field.style.setProperty("--compact-gradient", gradient);
    field.style.setProperty("--rpp-stop-color", stopColor);
    field.dataset.compactIndex = String(index);
    if (field.getAttribute("role") === "slider") {
      field.setAttribute("aria-valuenow", String(index));
      field.setAttribute("aria-valuetext", valueText);
    } else {
      field.setAttribute("aria-label", `${field.dataset.baseLabel}: ${valueText}`);
    }
    field.closest(".rpp-compact-lane")?.querySelectorAll(".rpp-compact-labels span").forEach((element) => {
      element.classList.toggle("is-active", Number(element.dataset.compactIndex) === index);
    });
    panel?.style.setProperty("--rpp-stop-color", stopColor);
  }

  function appendNativeFastGlyph(svg) {
    svg.setAttribute("viewBox", "0 0 24 24");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", CHATGPT_FAST_ICON_PATH);
    path.setAttribute("fill", "currentColor");
    svg.append(path);
  }

  function syncCompactFastGlyph() {
    const field = panel?.querySelector(".rpp-compact-work__field");
    if (!field) return;
    if (!workHasFast()) {
      field.dataset.fast = "false";
      field.title = field.dataset.adjustable === "false" ? "Only available effort" : "Drag to change effort";
      field.removeAttribute("aria-description");
      return;
    }
    field.dataset.fast = String(state.fast);
    if (field.getAttribute("role") === "button") field.setAttribute("aria-pressed", String(state.fast));
    field.title = state.fast
      ? "Fast mode on — click the selected control to turn it off"
      : "Click the selected control to turn on Fast mode";
    field.setAttribute(
      "aria-description",
      `${state.fast ? "Fast mode on." : "Fast mode off."} Click the selected control to toggle Fast mode; drag to change effort.`
    );
  }

  function syncFullFastGlyph() {
    const field = panel?.querySelector(".rpp-field");
    if (!field) return;
    if (!workHasFast()) {
      field.dataset.fast = "false";
      field.title = state.ultra ? "Ultra is active" : "Drag to change model and effort";
      field.removeAttribute("aria-description");
      return;
    }
    field.dataset.fast = String(state.fast);
    field.title = state.fast
      ? "Fast mode on — click the selected control to turn it off"
      : "Click the selected control to turn on Fast mode";
    field.setAttribute(
      "aria-description",
      `${state.fast ? "Fast mode on." : "Fast mode off."} Click the selected control to toggle Fast mode; drag to change model or effort.`
    );
  }

  function makeCompactLane({ labels, ariaLabel, className, getCurrentIndex, previewIndex, commitIndex, transitionKind, onTapSelected = null }) {
    const lane = document.createElement("div");
    lane.className = `rpp-compact-lane ${className}`;

    const labelRow = document.createElement("div");
    labelRow.className = "rpp-compact-labels";
    labelRow.style.gridTemplateColumns = `repeat(${labels.length}, minmax(0, 1fr))`;
    labels.forEach((label, index) => {
      const item = document.createElement("span");
      item.textContent = label;
      item.dataset.compactIndex = String(index);
      labelRow.append(item);
    });
    lane.append(labelRow);

    const field = document.createElement("div");
    field.className = `rpp-compact-field ${className}__field`;
    field.dataset.baseLabel = ariaLabel;
    const adjustable = labels.length > 1;
    const wholeFieldButton = !adjustable && Boolean(onTapSelected);
    field.dataset.adjustable = String(adjustable);
    if (adjustable) {
      field.tabIndex = 0;
      field.setAttribute("role", "slider");
      field.setAttribute("aria-label", ariaLabel);
      field.setAttribute("aria-valuemin", "0");
      field.setAttribute("aria-valuemax", String(labels.length - 1));
    } else if (onTapSelected) {
      field.tabIndex = 0;
      field.setAttribute("role", "button");
      field.setAttribute("aria-label", `${ariaLabel}: ${labels[0]}`);
      field.setAttribute("aria-pressed", String(state.fast));
    } else {
      field.tabIndex = -1;
      field.setAttribute("role", "img");
      field.setAttribute("aria-label", `${ariaLabel}: ${labels[0]}`);
    }

    const bed = document.createElement("div");
    bed.className = "rpp-compact-bed";
    field.append(bed);

    const fill = document.createElement("div");
    fill.className = "rpp-compact-fill";
    field.append(fill);

    labels.forEach((_, index) => {
      const node = document.createElement("i");
      node.className = "rpp-compact-node";
      node.style.setProperty("--compact-node-left", `${compactStopLeft(index, labels.length)}%`);
      node.setAttribute("aria-hidden", "true");
      field.append(node);
    });

    const puck = document.createElement("div");
    puck.className = "rpp-compact-puck";
    if (onTapSelected) {
      const fast = document.createElement("span");
      fast.className = "rpp-compact-puck__fast";
      fast.setAttribute("aria-hidden", "true");
      const fastSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      fastSvg.setAttribute("width", "24");
      fastSvg.setAttribute("height", "24");
      fastSvg.setAttribute("aria-hidden", "true");
      appendNativeFastGlyph(fastSvg);
      fast.append(fastSvg);
      puck.append(fast);
    }
    field.append(puck);

    let dragIndex = null;
    let gesture = null;
    let liquidTimer = null;
    const pulseLiquid = (kind) => {
      const liquidClass = kind === "model" ? "is-liquid-model" : "is-liquid-effort";
      field.classList.remove("is-liquid-model", "is-liquid-effort");
      void field.offsetWidth;
      field.classList.add(liquidClass);
      clearTimeout(liquidTimer);
      liquidTimer = setTimeout(() => field.classList.remove(liquidClass), kind === "model" ? 410 : 340);
    };
    const eventIndex = (event) => {
      const rect = field.getBoundingClientRect();
      return Math.max(0, Math.min(labels.length - 1, Math.round(((event.clientX - rect.left) / rect.width) * labels.length - .5)));
    };
    const isOverSelectedPuck = (event, index = getCurrentIndex()) => {
      const rect = field.getBoundingClientRect();
      const centerX = rect.left + rect.width * compactStopLeft(index, labels.length) / 100;
      const centerY = rect.top + rect.height / 2;
      return Math.hypot(event.clientX - centerX, event.clientY - centerY) <= 20;
    };
    const previewAt = (event) => {
      const index = eventIndex(event);
      const previousIndex = dragIndex ?? getCurrentIndex();
      if (index === dragIndex) return;
      dragIndex = index;
      if (gesture && index !== gesture.startIndex) gesture.moved = true;
      if (index === previousIndex) return;
      const kind = transitionKind(previousIndex, index);
      playMagneticTick(kind);
      pulseLiquid(kind);
      previewIndex(index);
    };
    field.addEventListener("pointerdown", (event) => {
      if (state.busy || (event.button !== 0 && event.pointerType !== "touch")) return;
      if (!adjustable && !onTapSelected) return;
      ensureAudio();
      state.dragging = true;
      const startIndex = getCurrentIndex();
      gesture = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        startIndex,
        startedOnSelectedPuck: Boolean(onTapSelected && (wholeFieldButton || isOverSelectedPuck(event, startIndex))),
        moved: false
      };
      field.setPointerCapture(event.pointerId);
      field.classList.add("is-dragging");
      previewAt(event);
    });
    field.addEventListener("pointermove", (event) => {
      if (field.hasPointerCapture(event.pointerId)) {
        if (gesture?.pointerId === event.pointerId) {
          const slop = gesture.pointerType === "touch" ? 10 : 6;
          if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > slop) gesture.moved = true;
        }
        previewAt(event);
        return;
      }
      if (onTapSelected && event.pointerType !== "touch") {
        field.dataset.puckHover = String(!state.busy && (wholeFieldButton || isOverSelectedPuck(event)));
      }
    });
    field.addEventListener("pointerleave", () => { field.dataset.puckHover = "false"; });
    field.addEventListener("pointerup", (event) => {
      if (!field.hasPointerCapture(event.pointerId)) return;
      if (gesture?.pointerId === event.pointerId) {
        const slop = gesture.pointerType === "touch" ? 10 : 6;
        if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > slop) gesture.moved = true;
      }
      previewAt(event);
      const nextIndex = dragIndex;
      const tappedSelected = Boolean(
        onTapSelected &&
        gesture?.pointerId === event.pointerId &&
        gesture.startedOnSelectedPuck &&
        !gesture.moved &&
        nextIndex === gesture.startIndex &&
        nextIndex === getCurrentIndex()
      );
      field.releasePointerCapture(event.pointerId);
      field.classList.remove("is-dragging");
      field.dataset.puckHover = "false";
      state.dragging = false;
      dragIndex = null;
      gesture = null;
      if (tappedSelected) onTapSelected();
      else if (nextIndex !== null) commitIndex(nextIndex);
    });
    field.addEventListener("pointercancel", (event) => {
      if (field.hasPointerCapture(event.pointerId)) field.releasePointerCapture(event.pointerId);
      field.classList.remove("is-dragging");
      field.dataset.puckHover = "false";
      state.dragging = false;
      dragIndex = null;
      gesture = null;
      syncPanel();
    });
    field.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && onTapSelected) {
        event.preventDefault();
        if (!state.busy) onTapSelected();
        return;
      }
      if (!adjustable) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      if (state.busy) return;
      const current = getCurrentIndex();
      const next = event.key === "ArrowLeft" ? Math.max(0, current - 1)
        : event.key === "ArrowRight" ? Math.min(labels.length - 1, current + 1) : current;
      if (next === current) return;
      const kind = transitionKind(current, next);
      playMagneticTick(kind);
      pulseLiquid(kind);
      previewIndex(next);
      commitIndex(next);
    });

    lane.append(field);
    return lane;
  }

  function compactWorkIndex() {
    const levels = availableWorkLevels();
    return state.ultra ? Math.max(0, levels.indexOf("Ultra")) : Math.max(0, levels.indexOf(state.effort));
  }

  function compactWorkDisplayModel(index) {
    if (availableWorkLevels()[index] === "Ultra") return "Sol";
    if (state.returnModel && (state.ultra || state.busy)) return state.returnModel;
    return state.model;
  }

  function gradientFromStops(colors) {
    if (!colors.length) return "none";
    if (colors.length === 1) return colors[0];
    return `linear-gradient(90deg, ${colors.map((color, index) => `${color} ${(index / (colors.length - 1)) * 100}%`).join(", ")})`;
  }

  function compactWorkGradient(model, levels) {
    if (levels.length === WORK_EFFORTS.length && !levels.includes("Ultra")) return MODEL_GRADIENTS[model];
    if (levels.length === WORK_EFFORTS.length + 1 && levels.at(-1) === "Ultra") return COMPACT_WORK_GRADIENTS[model];
    const colors = levels.map((level) => level === "Ultra"
      ? "#c49aff"
      : MODEL_STOP_COLORS[model]?.[WORK_EFFORTS.indexOf(level)] || MODEL_COLORS[model]?.[0] || MODEL_COLORS.Sol[0]);
    return gradientFromStops(colors);
  }

  function compactChatGradient(levels) {
    if (levels.length === CHAT_LEVELS.length) return COMPACT_CHAT_GRADIENT;
    const colors = levels.map((level) => COMPACT_CHAT_STOP_COLORS[Math.max(0, CHAT_LEVELS.indexOf(level))]);
    if (levels[0] !== "Instant" || levels.length < 2) return gradientFromStops(colors);
    const firstSolPosition = 100 / (levels.length - 1);
    const stops = [
      "#08090a 0%",
      `#16191d ${firstSolPosition * .36}%`,
      `#343a41 ${firstSolPosition * .66}%`,
      `#57301f ${firstSolPosition * .84}%`,
      `${colors[1]} ${firstSolPosition}%`
    ];
    for (let index = 2; index < colors.length; index += 1) {
      stops.push(`${colors[index]} ${(index / (levels.length - 1)) * 100}%`);
    }
    return `linear-gradient(90deg, ${stops.join(", ")})`;
  }

  function workFieldGradient(model, efforts = availableWorkEfforts()) {
    if (efforts.length === WORK_EFFORTS.length) return MODEL_GRADIENTS[model];
    return gradientFromStops(efforts.map((effort) => (
      MODEL_STOP_COLORS[model]?.[WORK_EFFORTS.indexOf(effort)] || MODEL_COLORS[model]?.[0] || MODEL_COLORS.Sol[0]
    )));
  }

  function previewCompactWork(index) {
    if (!panel) return;
    const levels = availableWorkLevels();
    const level = levels[index] || levels[0];
    const model = compactWorkDisplayModel(index);
    const stopColor = level === "Ultra"
      ? "#b784ff"
      : MODEL_STOP_COLORS[model]?.[WORK_EFFORTS.indexOf(level)] || MODEL_COLORS[model]?.[0] || MODEL_COLORS.Sol[0];
    const field = panel.querySelector(".rpp-compact-work__field");
    const labels = levels.map((item) => item === "Ultra" ? "Ultra" : workEffortLabel(item));
    const valueText = level === "Ultra"
      ? `Sol, Ultra. Base effort ${workEffortLabel(state.effort)}`
      : `${model}, ${workEffortLabel(level)}`;
    renderCompactRail(
      field,
      index,
      labels,
      compactWorkGradient(model, levels),
      stopColor,
      `${valueText}${workHasFast() && state.fast ? ", Fast mode" : ""}`
    );
    panel.dataset.model = model;
    renderCompactModelWheel(model);
    syncCompactFastGlyph();
  }

  function renderCompactModelWheel(model) {
    const wheel = panel?.querySelector(".rpp-model-wheel");
    if (!wheel) return;
    const models = availableWorkModels();
    const current = Math.max(0, models.indexOf(model));
    const visibleModels = models.length >= 3 ? [
      models[(current - 1 + models.length) % models.length],
      models[current],
      models[(current + 1) % models.length]
    ] : models;
    const disabled = state.ultra || state.busy;
    wheel.querySelectorAll(".rpp-model-wheel__option").forEach((option, slot) => {
      const optionModel = visibleModels[slot];
      if (!optionModel) {
        option.hidden = true;
        return;
      }
      option.hidden = false;
      option.textContent = optionModel;
      option.dataset.model = optionModel;
      option.setAttribute("aria-selected", String(optionModel === model));
      option.classList.toggle("is-active", optionModel === model);
      option.disabled = disabled;
    });
    const activeOption = [...wheel.querySelectorAll(".rpp-model-wheel__option")]
      .find((option) => !option.hidden && option.dataset.model === model);
    if (activeOption) wheel.setAttribute("aria-activedescendant", activeOption.id);
    else wheel.removeAttribute("aria-activedescendant");
    wheel.style.setProperty("--rpp-model-count", String(Math.max(1, visibleModels.length)));
    wheel.dataset.modelCount = String(visibleModels.length);
    wheel.setAttribute("aria-label", `Model, ${model} selected`);
    wheel.setAttribute("aria-disabled", String(disabled));
    wheel.dataset.disabled = String(disabled);
  }

  async function commitCompactWorkEffort(index) {
    const levels = availableWorkLevels();
    const level = levels[index];
    if (!level) return;
    if (level === "Ultra") {
      if (!state.ultra) {
        playLeverPull(true);
        await setUltra(true);
      }
      return;
    }
    if (!state.ultra && level === state.effort) {
      syncPanel();
      return;
    }
    if (state.ultra) {
      const previousEffort = state.effort;
      state.effort = level;
      savedBaseEffort = state.effort;
      playLeverPull(false);
      const restored = await setUltra(false, level);
      if (!restored) {
        state.effort = previousEffort;
        savedBaseEffort = previousEffort;
        syncPanel();
      }
      return;
    }
    await selectWork(availableWorkModels().indexOf(state.model), availableWorkEfforts().indexOf(level));
  }

  function makeCompactWorkPanel() {
    const area = document.createElement("div");
    area.className = "rpp-compact-work-layout";

    const wheel = document.createElement("div");
    wheel.className = "rpp-model-wheel";
    wheel.tabIndex = 0;
    wheel.setAttribute("role", "listbox");
    wheel.setAttribute("aria-orientation", "vertical");
    for (let index = 0; index < Math.max(1, availableWorkModels().length); index += 1) {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "rpp-model-wheel__option";
      option.setAttribute("role", "option");
      option.id = `rpp-model-wheel-option-${index}`;
      option.tabIndex = -1;
      wheel.append(option);
    }

    const chooseModel = (model) => {
      const models = availableWorkModels();
      if (state.busy || state.ultra || !models.includes(model) || model === state.model) return;
      playMagneticTick("model");
      selectWork(models.indexOf(model), Math.max(0, availableWorkEfforts().indexOf(state.effort)));
    };
    const moveModel = (direction) => {
      const models = availableWorkModels();
      if (models.length < 2) return;
      const current = Math.max(0, models.indexOf(state.model));
      chooseModel(models[(current + direction + models.length) % models.length]);
    };
    let wheelLocked = false;
    let wheelDelta = 0;
    let wheelResetTimer = null;
    let suppressWheelClickUntil = 0;
    wheel.addEventListener("wheel", (event) => {
      clearTimeout(wheelResetTimer);
      wheelResetTimer = setTimeout(() => {
        wheelDelta = 0;
        wheelLocked = false;
      }, 160);
      if (state.busy || state.ultra) return;
      event.preventDefault();
      const normalizedDelta = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 120 : 1);
      if (wheelDelta && Math.sign(normalizedDelta) !== Math.sign(wheelDelta)) wheelDelta = 0;
      wheelDelta += normalizedDelta;
      if (wheelLocked || Math.abs(wheelDelta) < 6) return;
      wheelLocked = true;
      moveModel(wheelDelta > 0 ? 1 : -1);
      wheelDelta = 0;
    }, { passive: false });
    wheel.addEventListener("click", (event) => {
      if (performance.now() < suppressWheelClickUntil) return;
      const option = event.target.closest(".rpp-model-wheel__option");
      if (option) chooseModel(option.dataset.model);
    });
    wheel.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      if (state.busy || state.ultra) return;
      event.preventDefault();
      moveModel(event.key === "ArrowDown" ? 1 : -1);
    });
    let wheelDrag = null;
    wheel.addEventListener("pointerdown", (event) => {
      if (state.busy || state.ultra || (event.button !== 0 && event.pointerType !== "touch")) return;
      wheelDrag = {
        pointerId: event.pointerId,
        startY: event.clientY,
        targetModel: event.target.closest(".rpp-model-wheel__option")?.dataset.model || null
      };
      wheel.setPointerCapture(event.pointerId);
    });
    wheel.addEventListener("pointerup", (event) => {
      if (!wheelDrag || wheelDrag.pointerId !== event.pointerId) return;
      const delta = event.clientY - wheelDrag.startY;
      const targetModel = wheelDrag.targetModel;
      if (wheel.hasPointerCapture(event.pointerId)) wheel.releasePointerCapture(event.pointerId);
      wheelDrag = null;
      if (Math.abs(delta) > 8) {
        event.preventDefault();
        suppressWheelClickUntil = performance.now() + 240;
        moveModel(delta < 0 ? 1 : -1);
      } else if (targetModel) {
        suppressWheelClickUntil = performance.now() + 240;
        chooseModel(targetModel);
      }
    });
    wheel.addEventListener("pointercancel", (event) => {
      if (wheel.hasPointerCapture(event.pointerId)) wheel.releasePointerCapture(event.pointerId);
      wheelDrag = null;
    });
    area.append(wheel);

    const levels = availableWorkLevels();
    const lane = makeCompactLane({
      labels: levels.map((level) => level === "Ultra" ? "Ultra" : workEffortLabel(level)),
      ariaLabel: "Work reasoning power",
      className: "rpp-compact-work",
      getCurrentIndex: compactWorkIndex,
      previewIndex: previewCompactWork,
      commitIndex: commitCompactWorkEffort,
      transitionKind: () => "effort",
      onTapSelected: workHasFast() ? () => {
        playMagneticTick("effort");
        setFast(!state.fast);
      } : null
    });
    area.append(lane);

    const live = document.createElement("span");
    live.className = "rpp-live";
    live.setAttribute("aria-live", "polite");
    area.append(live);
    return area;
  }

  function previewCompactChat(index) {
    if (!panel) return;
    const levels = availableChatLevels();
    const level = levels[index] || levels[0];
    const canonicalIndex = Math.max(0, CHAT_LEVELS.indexOf(level));
    const model = level === "Instant" ? "5.5" : "Sol";
    const stopColor = COMPACT_CHAT_STOP_COLORS[canonicalIndex] || COMPACT_CHAT_STOP_COLORS[0];
    const field = panel.querySelector(".rpp-compact-chat__field");
    const labels = levels.map(chatLevelLabel);
    const gradient = compactChatGradient(levels);
    renderCompactRail(field, index, labels, gradient, stopColor, `${model}, ${chatLevelLabel(level)}`);
    panel.dataset.model = model;
  }

  function makeCompactChatPanel() {
    const layout = document.createElement("div");
    layout.className = "rpp-compact-chat-layout";
    const levels = availableChatLevels();
    layout.append(makeCompactLane({
      labels: levels.map(chatLevelLabel),
      ariaLabel: "Chat model and effort",
      className: "rpp-compact-chat",
      getCurrentIndex: () => Math.max(0, levels.indexOf(state.effort)),
      previewIndex: previewCompactChat,
      commitIndex: (index) => selectChat(levels[index]),
      transitionKind: (previous, next) => (levels[previous] === "Instant") !== (levels[next] === "Instant") ? "model" : "effort"
    }));
    const live = document.createElement("span");
    live.className = "rpp-live";
    live.setAttribute("aria-live", "polite");
    layout.append(live);
    return layout;
  }

  function makeWorkPanel() {
    const models = availableWorkModels();
    const efforts = availableWorkEfforts();
    const hasUltra = workHasUltra();
    const hasFast = workHasFast();
    const area = document.createElement("div");
    area.className = "rpp-work-area";
    area.style.setProperty("--rpp-work-columns", String(efforts.length));
    area.style.setProperty("--rpp-work-rows", String(models.length));
    area.style.setProperty("--rpp-work-layout-rows", String(hasUltra ? 3 : models.length));
    area.dataset.hasUltra = String(hasUltra);

    const columns = document.createElement("div");
    columns.className = "rpp-columns";
    columns.style.gridTemplateColumns = `repeat(${efforts.length}, minmax(0, 1fr))`;
    efforts.forEach((effort) => {
      const label = document.createElement("span");
      label.textContent = workEffortLabel(effort);
      label.dataset.effort = effort;
      columns.append(label);
    });
    area.append(columns);

    const rows = document.createElement("div");
    rows.className = "rpp-rows";
    rows.style.gridTemplateRows = `repeat(${models.length}, 1fr)`;
    models.forEach((model) => {
      const row = document.createElement("div");
      row.className = "rpp-row";
      row.dataset.model = model;
      row.style.setProperty("--row-color", MODEL_COLORS[model][0]);
      row.textContent = model;
      rows.append(row);
    });
    area.append(rows);

    const field = document.createElement("div");
    field.className = "rpp-field";
    field.tabIndex = 0;
    field.setAttribute("role", "slider");
    field.setAttribute("aria-label", "Reasoning power");
    field.setAttribute("aria-valuemin", "0");
    field.setAttribute("aria-valuemax", String(models.length * efforts.length - 1));
    field.setAttribute("aria-disabled", "false");
    field.style.setProperty("--rpp-work-rows", String(models.length));
    field.dataset.rowCount = String(models.length);

    const trackBeds = document.createElement("div");
    trackBeds.className = "rpp-track-beds";
    trackBeds.style.gridTemplateRows = `repeat(${models.length}, 1fr)`;
    models.forEach(() => trackBeds.append(document.createElement("i")));
    field.append(trackBeds);

    const trail = document.createElement("div");
    trail.className = "rpp-trail";
    field.append(trail);

    models.forEach((model, rowIndex) => {
      efforts.forEach((effort, columnIndex) => {
        const node = document.createElement("i");
        node.className = "rpp-node";
        node.style.setProperty("--x-pos", `${((columnIndex + .5) / efforts.length) * 100}%`);
        node.style.setProperty("--y-pos", `${((rowIndex + .5) / models.length) * 100}%`);
        node.setAttribute("aria-hidden", "true");
        field.append(node);
      });
    });

    const puck = document.createElement("div");
    puck.className = "rpp-puck";
    if (hasFast) {
      const fast = document.createElement("span");
      fast.className = "rpp-puck__fast";
      fast.setAttribute("aria-hidden", "true");
      const fastSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      fastSvg.setAttribute("width", "24");
      fastSvg.setAttribute("height", "24");
      fastSvg.setAttribute("aria-hidden", "true");
      appendNativeFastGlyph(fastSvg);
      fast.append(fastSvg);
      puck.append(fast);
    }
    field.append(puck);

    let drag = null;
    let gesture = null;
    let liquidTimer = null;
    const pulseLiquid = (kind) => {
      const className = kind === "model" ? "is-liquid-model" : "is-liquid-effort";
      field.classList.remove("is-liquid-model", "is-liquid-effort");
      void field.offsetWidth;
      field.classList.add(className);
      clearTimeout(liquidTimer);
      liquidTimer = setTimeout(() => field.classList.remove(className), kind === "model" ? 410 : 340);
    };
    const currentPosition = () => ({
      row: Math.max(0, models.indexOf(state.model)),
      column: Math.max(0, efforts.indexOf(state.effort))
    });
    const isOverSelectedPuck = (event) => {
      const rect = field.getBoundingClientRect();
      const current = currentPosition();
      const centerX = rect.left + rect.width * ((current.column + .5) / efforts.length);
      const centerY = rect.top + rect.height * ((current.row + .5) / models.length);
      return Math.hypot(event.clientX - centerX, event.clientY - centerY) <= 21;
    };
    const previewAt = (event) => {
      const rect = field.getBoundingClientRect();
      const rawX = Math.max(0, Math.min(efforts.length - 1, ((event.clientX - rect.left) / rect.width) * efforts.length - .5));
      const rawY = Math.max(0, Math.min(models.length - 1, ((event.clientY - rect.top) / rect.height) * models.length - .5));
      const row = Math.round(rawY);
      const column = Math.round(rawX);
      const snappedLeft = ((column + .5) / efforts.length) * 100;
      const snappedTop = ((row + .5) / models.length) * 100;
      const previousDrag = drag || currentPosition();
      const choiceChanged = previousDrag.row !== row || previousDrag.column !== column;
      const modelChanged = previousDrag.row !== row;
      field.style.setProperty("--puck-left", `${snappedLeft}%`);
      field.style.setProperty("--puck-top", `${snappedTop}%`);
      drag = { row, column };
      if (gesture && (row !== gesture.startRow || column !== gesture.startColumn)) gesture.moved = true;
      const previewModel = models[drag.row];
      const previewEffort = efforts[drag.column];
      const [base, bright] = MODEL_COLORS[previewModel];
      panel?.style.setProperty("--rpp-model", base);
      panel?.style.setProperty("--rpp-model-bright", bright);
      panel?.style.setProperty("--rpp-model-gradient", workFieldGradient(previewModel, efforts));
      if (panel) panel.dataset.model = previewModel;
      field.style.setProperty("--row-pos", `${snappedTop}%`);
      field.style.setProperty("--fill-width", `${snappedLeft}%`);
      field.style.setProperty("--gradient-progress", String((snappedLeft / 100) / ((efforts.length - .5) / efforts.length)));
      field.setAttribute("aria-valuenow", String(row * efforts.length + column));
      field.setAttribute("aria-valuetext", `${previewModel}, ${workEffortLabel(previewEffort)}${hasFast && state.fast ? ", Fast mode" : ""}`);
      updateEffortGlow(previewModel, previewEffort);
      if (choiceChanged) {
        playMagneticTick(modelChanged ? "model" : "effort");
        pulseLiquid(modelChanged ? "model" : "effort");
      }
      panel?.querySelectorAll(".rpp-row").forEach((element) => element.classList.toggle("is-active", element.dataset.model === previewModel));
    };
    field.addEventListener("pointerdown", (event) => {
      if (state.busy) return;
      if (event.button !== 0 && event.pointerType !== "touch") return;
      const start = currentPosition();
      const startedOnSelectedPuck = Boolean(hasFast && isOverSelectedPuck(event));
      if (state.ultra && !startedOnSelectedPuck) return;
      ensureAudio();
      state.dragging = true;
      gesture = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startX: event.clientX,
        startY: event.clientY,
        startRow: start.row,
        startColumn: start.column,
        startedOnSelectedPuck,
        moved: false
      };
      drag = { ...start };
      field.setPointerCapture(event.pointerId);
      field.classList.add("is-dragging");
      if (!state.ultra) previewAt(event);
    });
    field.addEventListener("pointermove", (event) => {
      if (field.hasPointerCapture(event.pointerId)) {
        if (gesture?.pointerId === event.pointerId) {
          const slop = gesture.pointerType === "touch" ? 10 : 6;
          if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > slop) gesture.moved = true;
        }
        if (!state.ultra) previewAt(event);
        return;
      }
      if (hasFast && event.pointerType !== "touch") field.dataset.puckHover = String(!state.busy && isOverSelectedPuck(event));
    });
    field.addEventListener("pointerleave", () => { field.dataset.puckHover = "false"; });
    field.addEventListener("pointerup", (event) => {
      if (!field.hasPointerCapture(event.pointerId)) return;
      if (gesture?.pointerId === event.pointerId) {
        const slop = gesture.pointerType === "touch" ? 10 : 6;
        if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > slop) gesture.moved = true;
      }
      if (!state.ultra) previewAt(event);
      const next = drag;
      const tappedSelected = Boolean(
        hasFast &&
        gesture?.pointerId === event.pointerId &&
        gesture.startedOnSelectedPuck &&
        !gesture.moved &&
        next?.row === gesture.startRow &&
        next?.column === gesture.startColumn &&
        currentPosition().row === gesture.startRow &&
        currentPosition().column === gesture.startColumn
      );
      field.releasePointerCapture(event.pointerId);
      field.classList.remove("is-dragging");
      field.dataset.puckHover = "false";
      state.dragging = false;
      drag = null;
      gesture = null;
      if (tappedSelected) {
        playMagneticTick("effort");
        setFast(!state.fast);
      } else if (next && !state.ultra) {
        selectWork(next.row, next.column);
      }
    });
    field.addEventListener("pointercancel", (event) => {
      if (field.hasPointerCapture(event.pointerId)) field.releasePointerCapture(event.pointerId);
      field.classList.remove("is-dragging");
      field.dataset.puckHover = "false";
      state.dragging = false;
      drag = null;
      gesture = null;
      syncPanel();
    });
    field.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && hasFast) {
        event.preventDefault();
        if (!state.busy) {
          playMagneticTick("effort");
          setFast(!state.fast);
        }
        return;
      }
      if (state.busy || state.ultra) return;
      const row = Math.max(0, models.indexOf(state.model));
      const column = Math.max(0, efforts.indexOf(state.effort));
      const next = { row, column };
      if (event.key === "ArrowLeft") next.column = Math.max(0, column - 1);
      else if (event.key === "ArrowRight") next.column = Math.min(efforts.length - 1, column + 1);
      else if (event.key === "ArrowUp") next.row = Math.max(0, row - 1);
      else if (event.key === "ArrowDown") next.row = Math.min(models.length - 1, row + 1);
      else return;
      event.preventDefault();
      if (next.row === row && next.column === column) return;
      playMagneticTick(next.row !== row ? "model" : "effort");
      pulseLiquid(next.row !== row ? "model" : "effort");
      selectWork(next.row, next.column);
    });

    const fieldLine = document.createElement("div");
    fieldLine.className = "rpp-field-line";
    fieldLine.append(field);
    if (hasUltra) {
      const ultra = document.createElement("button");
      ultra.type = "button";
      ultra.className = "rpp-ultra-toggle";
      ultra.setAttribute("aria-label", "Ultra override");
      ultra.setAttribute("aria-pressed", String(state.ultra));
      ultra.innerHTML = '<span class="rpp-ultra-toggle__label">ULTRA</span><span class="rpp-ultra-toggle__rail" aria-hidden="true"></span><span class="rpp-ultra-toggle__knob" aria-hidden="true"></span>';
      let ultraDrag = null;
      ultra.addEventListener("pointerdown", (event) => {
        if (state.busy || (event.button !== 0 && event.pointerType !== "touch")) return;
        ensureAudio();
        state.ultraDragging = true;
        ultraDrag = { pointerId: event.pointerId, startY: event.clientY, lastY: event.clientY, moved: false };
        ultra.setPointerCapture(event.pointerId);
        ultra.classList.add("is-dragging");
      });
      ultra.addEventListener("pointermove", (event) => {
        if (!ultraDrag || ultraDrag.pointerId !== event.pointerId) return;
        ultraDrag.lastY = event.clientY;
        ultraDrag.moved ||= Math.abs(event.clientY - ultraDrag.startY) > 8;
      });
      ultra.addEventListener("pointerup", (event) => {
        if (!ultraDrag || ultraDrag.pointerId !== event.pointerId) return;
        if (ultra.hasPointerCapture(event.pointerId)) ultra.releasePointerCapture(event.pointerId);
        ultra.classList.remove("is-dragging");
        const deltaY = event.clientY - ultraDrag.startY;
        const nextUltra = ultraDrag.moved ? deltaY > 0 : !state.ultra;
        ultraDrag = null;
        state.ultraDragging = false;
        playLeverPull(nextUltra);
        setUltra(nextUltra);
      });
      ultra.addEventListener("pointercancel", (event) => {
        if (ultra.hasPointerCapture(event.pointerId)) ultra.releasePointerCapture(event.pointerId);
        ultra.classList.remove("is-dragging");
        ultraDrag = null;
        state.ultraDragging = false;
        syncPanel();
      });
      ultra.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        playLeverPull(!state.ultra);
        setUltra(!state.ultra);
      });
      fieldLine.append(ultra);
    } else {
      fieldLine.classList.add("rpp-field-line--solo");
    }
    area.append(fieldLine);

    const live = document.createElement("span");
    live.className = "rpp-live";
    live.setAttribute("aria-live", "polite");
    area.append(live);
    return area;
  }

  function makeChatPanel() {
    const levels = availableChatLevels();
    const route = makeChatRouteLayout(levels);
    const layout = document.createElement("div");
    layout.className = "rpp-chat-layout";

    const columns = document.createElement("div");
    columns.className = "rpp-chat-columns";
    columns.style.gridTemplateColumns = `repeat(${levels.length}, minmax(0, 1fr))`;
    levels.forEach((level) => {
      const item = document.createElement("span");
      item.textContent = chatLevelLabel(level);
      item.dataset.level = level;
      columns.append(item);
    });
    layout.append(columns);

    const models = document.createElement("div");
    models.className = "rpp-chat-models";
    const displayModels = [...new Set(levels.map((level) => level === "Instant" ? "5.5" : "Sol"))];
    models.style.gridTemplateRows = `repeat(${displayModels.length}, 1fr)`;
    models.dataset.modelCount = String(displayModels.length);
    displayModels.forEach((model) => {
      const label = document.createElement("div");
      label.dataset.model = model;
      label.textContent = model;
      models.append(label);
    });
    layout.append(models);

    const field = document.createElement("div");
    field.className = "rpp-chat-field";
    field.tabIndex = 0;
    field.setAttribute("role", "slider");
    field.setAttribute("aria-label", "Chat model and effort");
    field.setAttribute("aria-valuemin", "0");
    field.setAttribute("aria-valuemax", String(levels.length - 1));
    field._rppRouteLayout = route;

    const first = route.positions[0];
    const last = route.positions.at(-1);
    const bedPath = route.positions.map((position, index) => `${index ? "L" : "M"} ${position.x} ${position.y}`).join(" ");
    const fillStops = levels.map((level, index) => {
      const canonicalIndex = Math.max(0, CHAT_LEVELS.indexOf(level));
      return `<stop offset="${route.progress[index] ?? 0}" stop-color="${CHAT_STOP_COLORS[canonicalIndex]}"/>`;
    }).join("");
    field.innerHTML = `
      <svg class="rpp-chat-track" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="rpp-chat-route-bed-gradient" gradientUnits="userSpaceOnUse" x1="${first.x}" y1="${first.y}" x2="${last.x}" y2="${last.y}">
            <stop offset="0" stop-color="#08090a"/>
            <stop offset=".28" stop-color="#25292e"/>
            <stop offset=".47" stop-color="#202226"/>
            <stop offset="1" stop-color="#1a1b1e"/>
          </linearGradient>
          <linearGradient id="rpp-chat-route-fill-gradient" gradientUnits="userSpaceOnUse" x1="${first.x}" y1="${first.y}" x2="${last.x}" y2="${last.y}">
            ${fillStops}
          </linearGradient>
        </defs>
        <g class="rpp-chat-route-shell">
          <path class="rpp-chat-route-bed" d="${bedPath}"/>
          <path class="rpp-chat-route-fill" d="M ${first.x} ${first.y}"/>
        </g>
      </svg>`;
    route.positions.forEach(({ x, y }, index) => {
      const node = document.createElement("i");
      node.className = "rpp-chat-node";
      node.style.setProperty("--chat-node-x", `${x}%`);
      node.style.setProperty("--chat-node-y", `${y}%`);
      node.dataset.levelIndex = String(index);
      node.dataset.level = levels[index];
      field.append(node);
    });

    const puck = document.createElement("div");
    puck.className = "rpp-chat-puck";
    field.append(puck);

    let dragIndex = null;
    let liquidTimer = null;
    const pulseLiquid = (modelChanged) => {
      const className = modelChanged ? "is-liquid-model" : "is-liquid-effort";
      field.classList.remove("is-liquid-model", "is-liquid-effort");
      void field.offsetWidth;
      field.classList.add(className);
      clearTimeout(liquidTimer);
      liquidTimer = setTimeout(() => field.classList.remove(className), modelChanged ? 410 : 340);
    };
    const previewAt = (event) => {
      const rect = field.getBoundingClientRect();
      const index = Math.max(0, Math.min(levels.length - 1, Math.round(((event.clientX - rect.left) / rect.width) * levels.length - .5)));
      const previousIndex = dragIndex ?? Math.max(0, levels.indexOf(state.effort));
      if (index === dragIndex) return;
      dragIndex = index;
      const modelChanged = (levels[previousIndex] === "Instant") !== (levels[index] === "Instant");
      playMagneticTick(modelChanged ? "model" : "effort");
      pulseLiquid(modelChanged);
      previewChat(index);
    };
    field.addEventListener("pointerdown", (event) => {
      if (state.busy || (event.button !== 0 && event.pointerType !== "touch")) return;
      ensureAudio();
      state.dragging = true;
      field.setPointerCapture(event.pointerId);
      field.classList.add("is-dragging");
      previewAt(event);
    });
    field.addEventListener("pointermove", (event) => {
      if (field.hasPointerCapture(event.pointerId)) previewAt(event);
    });
    field.addEventListener("pointerup", (event) => {
      if (!field.hasPointerCapture(event.pointerId)) return;
      field.releasePointerCapture(event.pointerId);
      field.classList.remove("is-dragging");
      state.dragging = false;
      if (dragIndex !== null) selectChat(levels[dragIndex]);
      dragIndex = null;
    });
    field.addEventListener("pointercancel", (event) => {
      if (field.hasPointerCapture(event.pointerId)) field.releasePointerCapture(event.pointerId);
      field.classList.remove("is-dragging");
      state.dragging = false;
      dragIndex = null;
      syncPanel();
    });
    field.addEventListener("keydown", (event) => {
      const current = Math.max(0, levels.indexOf(state.effort));
      const next = event.key === "ArrowLeft" ? Math.max(0, current - 1)
        : event.key === "ArrowRight" ? Math.min(levels.length - 1, current + 1) : current;
      if (next === current) return;
      event.preventDefault();
      const modelChanged = (levels[current] === "Instant") !== (levels[next] === "Instant");
      playMagneticTick(modelChanged ? "model" : "effort");
      pulseLiquid(modelChanged);
      selectChat(levels[next]);
    });

    layout.append(field);
    const live = document.createElement("span");
    live.className = "rpp-live";
    live.setAttribute("aria-live", "polite");
    layout.append(live);
    return layout;
  }

  function previewChat(index) {
    if (!panel) return;
    const levels = availableChatLevels();
    const level = levels[index] || levels[0];
    const canonicalIndex = Math.max(0, CHAT_LEVELS.indexOf(level));
    const model = level === "Instant" ? "5.5" : "Sol";
    const stopColor = CHAT_STOP_COLORS[canonicalIndex] || CHAT_STOP_COLORS[0];
    const field = panel.querySelector(".rpp-chat-field");
    field?.style.setProperty("--rpp-stop-color", stopColor);
    animateChatRoute(field, field?._rppRouteLayout?.progress[index] ?? 0.0001);
    if (field) field.dataset.chatIndex = String(index);
    field?.setAttribute("aria-valuenow", String(index));
    field?.setAttribute("aria-valuetext", `${model}, ${chatLevelLabel(level)}`);
    panel.style.setProperty("--rpp-stop-color", stopColor);
    panel.dataset.model = model;
    panel.querySelectorAll(".rpp-chat-columns span").forEach((element) => {
      element.classList.toggle("is-active", element.dataset.level === level);
    });
    panel.querySelectorAll(".rpp-chat-models [data-model]").forEach((element) => {
      element.classList.toggle("is-active", element.dataset.model === model);
    });
  }

  function buildPanel() {
    if (!mounted?.native || panel) return null;
    panel = document.createElement("section");
    panel.className = `rpp-panel rpp-panel--${state.surface} rpp-panel--entering${state.compactMode ? " rpp-panel--compact" : ""}`;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-label", state.surface === "work" ? "Work reasoning power" : "Chat model and effort");
    if (state.surface === "work") {
      if (state.compactMode) panel.append(makeCompactWorkPanel());
      else panel.append(makeWorkPanel());
    } else {
      panel.append(state.compactMode ? makeCompactChatPanel() : makeChatPanel());
    }
    document.body.append(panel);
    applyModelTheme();
    syncPanel();
    requestAnimationFrame(placePanel);
    setTimeout(() => panel?.classList.remove("rpp-panel--entering"), 340);
    return panel;
  }

  function openPanel() {
    if (!mounted?.native || panel || panelOpenPromise) return panelOpenPromise;
    const surface = mounted.surface;
    const trigger = mounted.native;
    const generation = ++panelGeneration;
    panelOpenPromise = (async () => {
      try {
        const capabilities = await probeNativeCapabilities(surface, trigger, generation);
        if (generation !== panelGeneration || !state.pickerEnabled || checkedSurface() !== surface) return null;
        if (surface === "chat") {
          if (capabilities.levels.length < 2) {
            nativeOnlyTriggers.set(trigger, Date.now());
            throw new Error("Fewer than two supported Chat choices are available.");
          }
          capabilityState.chat = capabilities;
        } else {
          const actionableChoices = capabilities.models.length * capabilities.efforts.filter((effort) => WORK_EFFORTS.includes(effort)).length
            + (capabilities.efforts.includes("Ultra") ? 1 : 0);
          if (actionableChoices < 2) {
            nativeOnlyTriggers.set(trigger, Date.now());
            throw new Error("Fewer than two supported Work choices are available.");
          }
          capabilityState.work = capabilities;
        }
        const liveTrigger = findNativeTrigger(surface) || (trigger.isConnected && visible(trigger) ? trigger : null);
        if (!liveTrigger) throw new Error("ChatGPT replaced the selector while capabilities were being read.");
        if (mounted?.native !== liveTrigger) mount(liveTrigger, surface);
        parseNativeState(liveTrigger, surface);
        if (surface === "work" && state.ultra && !availableWorkEfforts().includes(state.effort)) {
          const fallbackEffort = availableWorkEfforts().includes("High") ? "High" : availableWorkEfforts()[0];
          if (!fallbackEffort) throw new Error("No supported base effort remains available.");
          state.effort = fallbackEffort;
          savedBaseEffort = fallbackEffort;
        }
        const currentSupported = surface === "chat"
          ? availableChatLevels().includes(state.effort)
          : availableWorkModels().includes(state.model) && (state.ultra ? workHasUltra() : availableWorkEfforts().includes(state.effort));
        if (!currentSupported) throw new Error("The current native selection is outside Modelcade's supported choices.");
        return buildPanel();
      } catch (error) {
        if (generation !== panelGeneration || !state.pickerEnabled) return null;
        console.debug("[Modelcade] Using ChatGPT's native picker:", error);
        const fallbackTrigger = findNativeTrigger(surface) || (trigger.isConnected && visible(trigger) ? trigger : null);
        if (fallbackTrigger) await showNativeFallback(surface, fallbackTrigger);
        return null;
      } finally {
        if (generation === panelGeneration) panelOpenPromise = null;
      }
    })();
    return panelOpenPromise;
  }

  function closePanel(force = false, reason = "system") {
    if (!force && panel && performance.now() < panelPreserveUntil) return;
    document.documentElement.dataset.rppLastPanelClose = reason;
    panelGeneration += 1;
    panel?.remove();
    panel = null;
    panelOpenPromise = null;
  }

  function syncPanel(statusText = "") {
    updateTrigger();
    if (!panel) return;
    panel.dataset.busy = String(state.busy);
    if (state.surface === "chat") state.model = state.effort === "Instant" ? "5.5" : "Sol";
    applyModelTheme();
    if (state.surface === "work") {
      const models = availableWorkModels();
      const efforts = availableWorkEfforts();
      const row = Math.max(0, models.indexOf(state.model));
      const column = Math.max(0, efforts.indexOf(state.effort));
      if (state.compactMode) {
        const compactIndex = compactWorkIndex();
        previewCompactWork(compactIndex);
        const field = panel.querySelector(".rpp-compact-work__field");
        field?.setAttribute("aria-disabled", "false");
      } else {
        const field = panel.querySelector(".rpp-field");
        const puckLeft = ((column + .5) / efforts.length) * 100;
        const puckTop = ((row + .5) / models.length) * 100;
        panel.style.setProperty("--rpp-model-gradient", workFieldGradient(state.model, efforts));
        field?.style.setProperty("--puck-left", `${puckLeft}%`);
        field?.style.setProperty("--puck-top", `${puckTop}%`);
        field?.style.setProperty("--row-pos", `${puckTop}%`);
        field?.style.setProperty("--row-highlight-top", `${(row / models.length) * 100}%`);
        field?.style.setProperty("--fill-width", `${puckLeft}%`);
        field?.style.setProperty("--gradient-progress", String((puckLeft / 100) / ((efforts.length - .5) / efforts.length)));
        field?.setAttribute("aria-valuenow", String(row * efforts.length + column));
        field?.setAttribute("aria-valuetext", state.ultra
          ? `${state.model}, Ultra. Base effort ${workEffortLabel(state.effort)}${workHasFast() && state.fast ? ", Fast mode" : ""}`
          : `${state.model}, ${workEffortLabel(state.effort)}${workHasFast() && state.fast ? ", Fast mode" : ""}`);
        field?.setAttribute("aria-disabled", String(state.ultra && !workHasFast()));
        updateEffortGlow(state.model, state.effort);
        panel.querySelectorAll(".rpp-row").forEach((element) => element.classList.toggle("is-active", element.dataset.model === state.model));
        syncFullFastGlyph();
      }
      panel.classList.toggle("is-ultra", state.ultra);
      const ultra = panel.querySelector(".rpp-ultra-toggle");
      ultra?.setAttribute("aria-pressed", String(state.ultra));
      ultra?.style.setProperty("--ultra-lever", state.ultra ? "1" : "0");
      setPanelStatus(statusText);
    } else {
      const levels = availableChatLevels();
      const index = Math.max(0, levels.indexOf(state.effort));
      if (state.compactMode) previewCompactChat(index);
      else previewChat(index);
      setPanelStatus(statusText);
    }
  }

  function setPanelStatus(text, kind = state.busy ? "working" : "") {
    const target = panel?.querySelector(".rpp-live");
    if (!target) return;
    target.textContent = text;
    target.dataset.state = kind;
  }

  function burstUltra() {
    if (!panel || !state.ultra) return;
    panel.classList.remove("rpp-ultra-celebrate");
    void panel.offsetWidth;
    panel.classList.add("rpp-ultra-celebrate");

    document.querySelector(".rpp-ultra-fx-layer")?.remove();
    const knob = panel.querySelector(".rpp-ultra-toggle__knob, .rpp-compact-work__field .rpp-compact-puck");
    if (!knob) return;
    const knobRect = knob.getBoundingClientRect();
    const originX = knobRect.left + knobRect.width / 2;
    const originY = knobRect.top + knobRect.height / 2;
    const layer = document.createElement("div");
    layer.className = "rpp-ultra-fx-layer";
    layer.style.setProperty("--origin-x", `${originX}px`);
    layer.style.setProperty("--origin-y", `${originY}px`);

    const flash = document.createElement("i");
    flash.className = "rpp-ultra-fx__flash";
    layer.append(flash);

    for (let index = 0; index < 3; index += 1) {
      const shockwave = document.createElement("i");
      shockwave.className = "rpp-ultra-fx__shockwave";
      shockwave.style.setProperty("--delay", `${index * 105}ms`);
      shockwave.style.setProperty("--ring-size", `${130 + index * 74}px`);
      layer.append(shockwave);
    }

    for (let index = 0; index < 82; index += 1) {
      const particle = document.createElement("i");
      const type = index % 11 === 0 ? "smoke" : index % 4 === 0 ? "coin" : "spark";
      particle.className = `rpp-ultra-fx__particle rpp-ultra-fx__particle--${type}`;
      const angle = Math.random() * Math.PI * 2;
      const distance = type === "smoke" ? 70 + Math.random() * 150 : 105 + Math.random() * 270;
      const gravity = type === "coin" ? 85 + Math.random() * 120 : type === "smoke" ? -25 : 25 + Math.random() * 90;
      particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      particle.style.setProperty("--dy", `${Math.sin(angle) * distance + gravity}px`);
      particle.style.setProperty("--rotation", `${(Math.random() * 1080 - 540).toFixed(0)}deg`);
      particle.style.setProperty("--size", `${type === "smoke" ? 15 + Math.random() * 23 : type === "coin" ? 5 + Math.random() * 4 : 2 + Math.random() * 4}px`);
      particle.style.setProperty("--duration", `${type === "smoke" ? 850 + Math.random() * 650 : 600 + Math.random() * 700}ms`);
      particle.style.setProperty("--delay", `${Math.random() * 125}ms`);
      layer.append(particle);
    }
    document.body.append(layer);
    setTimeout(() => {
      layer.remove();
      panel?.classList.remove("rpp-ultra-celebrate");
    }, 1650);
  }

  function nativeItems(role = "menuitem", scope = document) {
    return [...scope.querySelectorAll(`[role="${role}"]`)].filter(visible);
  }

  function nativeItemEnabled(element) {
    if (!(element instanceof HTMLElement) || !visible(element)) return false;
    if (element.getAttribute("aria-disabled") === "true" || element.hasAttribute("data-disabled")) return false;
    if ("disabled" in element && element.disabled) return false;
    return true;
  }

  function enabledNativeItems(role = "menuitem", scope = document) {
    return nativeItems(role, scope).filter(nativeItemEnabled);
  }

  function controlledNativeMenu(control) {
    const id = control?.getAttribute?.("aria-controls");
    if (!id) return null;
    const menu = document.getElementById(id);
    return menu?.getAttribute("role") === "menu" && visible(menu) ? menu : null;
  }

  function findNativeRootMenu(surface = state.surface, trigger = mounted?.native) {
    const controlled = controlledNativeMenu(trigger);
    if (controlled) return controlled;
    return nativeItems("menu").find((menu) => {
      const text = normalize(menu.textContent);
      if (surface === "work") return /(?:Reset to default|Model.*Effort.*Speed)/i.test(text);
      return /Intelligence/i.test(text) && /(?:Instant|Medium|High|Extra High|Pro)/i.test(text);
    }) || null;
  }

  function activateNativeTrigger(element) {
    const eventOptions = {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: 0,
      buttons: 1,
      clientX: element.getBoundingClientRect().left + 1,
      clientY: element.getBoundingClientRect().top + 1,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true
    };
    nativeBridgeActive = true;
    try {
      element.dispatchEvent(new PointerEvent("pointerdown", eventOptions));
      element.dispatchEvent(new PointerEvent("pointerup", { ...eventOptions, buttons: 0 }));
    } finally {
      nativeBridgeActive = false;
    }
  }

  function activateNativeItem(element) {
    nativeBridgeActive = true;
    try {
      element.click();
    } finally {
      nativeBridgeActive = false;
    }
  }

  function releaseSuppressedNativeMenus() {
    for (const element of suppressedNativeMenus) {
      element.removeAttribute("data-rpp-native-leak-hidden");
    }
    suppressedNativeMenus.clear();
  }

  function dispatchNativeEscape() {
    nativeBridgeActive = true;
    try {
      const options = { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true, cancelable: true, composed: true };
      document.dispatchEvent(new KeyboardEvent("keydown", options));
      document.dispatchEvent(new KeyboardEvent("keyup", options));
    } finally {
      nativeBridgeActive = false;
    }
  }

  function suppressLeakedNativeMenu(menu) {
    const wrapper = menu?.closest('[data-radix-popper-content-wrapper]') || menu;
    if (!(wrapper instanceof HTMLElement)) return;
    wrapper.dataset.rppNativeLeakHidden = "true";
    suppressedNativeMenus.add(wrapper);
  }

  function restoreNativePickerVisibility() {
    releaseSuppressedNativeMenus();
    if (findNativeRootMenu(state.surface, findNativeTrigger(state.surface) || mounted?.native)) {
      dispatchNativeEscape();
    }
  }

  async function normalizeNativeMenuClosed(surface = state.surface, preferredTrigger = null) {
    releaseSuppressedNativeMenus();
    let trigger = findNativeTrigger(surface) || preferredTrigger || mounted?.native;
    if (!findNativeRootMenu(surface, trigger)) return true;
    dispatchNativeEscape();
    await sleep(90);
    trigger = findNativeTrigger(surface) || preferredTrigger || trigger;
    if (findNativeRootMenu(surface, trigger) && trigger) {
      activateNativeTrigger(trigger);
      await sleep(90);
    }
    releaseSuppressedNativeMenus();
    return !findNativeRootMenu(surface, findNativeTrigger(surface) || trigger);
  }

  async function showNativeFallback(surface, preferredTrigger = null) {
    await normalizeNativeMenuClosed(surface, preferredTrigger);
    const trigger = findNativeTrigger(surface) || preferredTrigger;
    if (!trigger) return;
    if (!findNativeRootMenu(surface, trigger)) {
      activateNativeTrigger(trigger);
      await sleep(90);
    }
    releaseSuppressedNativeMenus();
  }

  async function openNativeMenu() {
    releaseSuppressedNativeMenus();
    const surface = state.surface;
    const trigger = findNativeTrigger(surface) || mounted?.native;
    if (!trigger) throw new Error("The native ChatGPT selector is unavailable.");
    const current = controlledNativeMenu(trigger);
    if (current) return current;
    activateNativeTrigger(trigger);
    return waitFor(() => controlledNativeMenu(trigger));
  }

  async function clickNative(role, test, scope = document) {
    const target = await waitFor(() => enabledNativeItems(role, scope).find((element) => test(normalize(element.textContent), element)));
    activateNativeItem(target);
    await sleep(60);
    return target;
  }

  async function ensureWorkAdvanced() {
    let root = await openNativeMenu();
    if (enabledNativeItems("menuitem", root).some((element) => /^(Model|Effort|Speed)/i.test(normalize(element.textContent)))) return root;
    const advancedItem = await clickNative("menuitem", (text) => /Advanced/i.test(text), root);
    root = await waitFor(() => {
      const controlled = controlledNativeMenu(advancedItem);
      if (controlled) return controlled;
      return nativeItems("menu").find((menu) => menu !== root && enabledNativeItems("menuitem", menu)
        .some((element) => /^(Model|Effort|Speed)/i.test(normalize(element.textContent)))) || null;
    });
    return root;
  }

  async function chooseWorkCategory(category, choice) {
    const root = await ensureWorkAdvanced();
    const categoryItem = await clickNative("menuitem", (text) => text.toLowerCase().startsWith(category.toLowerCase()), root);
    const submenu = await waitFor(() => controlledNativeMenu(categoryItem));
    const expected = category === "Model" ? `GPT-5.6 ${choice}` : choice;
    await clickNative("menuitemradio", (text) => {
      return text.startsWith(expected);
    }, submenu);
  }

  async function chooseChatLevel(level) {
    const root = await openNativeMenu();
    await clickNative("menuitemradio", (text) => level === "Instant" ? text.startsWith("Instant") : text === level, root);
  }

  async function refreshFromNative(expected) {
    const trigger = await waitFor(() => {
      const candidate = findNativeTrigger(state.surface) || (mounted?.native?.isConnected ? mounted.native : null);
      if (!candidate) return null;
      const text = normalize(candidate.innerText || candidate.textContent);
      return (expected ? expected(text) : Boolean(text)) ? candidate : null;
    });
    if (mounted && mounted.native !== trigger) mount(trigger, state.surface);
    else {
      parseNativeState(trigger, state.surface);
      updateTrigger();
    }
  }

  async function closeNativeMenu() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const trigger = findNativeTrigger(state.surface) || mounted?.native;
      const openMenu = findNativeRootMenu(state.surface, trigger);
      if (!openMenu) return true;
      if (attempt === 1) dispatchNativeEscape();
      else if (trigger) activateNativeTrigger(trigger);
      await sleep(90);
      if (!findNativeRootMenu(state.surface, findNativeTrigger(state.surface) || trigger)) return true;
    }
    const leakedMenu = findNativeRootMenu(state.surface, findNativeTrigger(state.surface) || mounted?.native);
    if (leakedMenu) suppressLeakedNativeMenu(leakedMenu);
    return false;
  }

  async function readWorkCapabilityCategory(category) {
    const root = await ensureWorkAdvanced();
    const item = enabledNativeItems("menuitem", root)
      .find((element) => normalize(element.textContent).toLowerCase().startsWith(category.toLowerCase()));
    if (!item) {
      await closeNativeMenu();
      return { enabled: [], present: [] };
    }
    activateNativeItem(item);
    const submenu = await waitFor(() => controlledNativeMenu(item));
    const present = nativeItems("menuitemradio", submenu).map((element) => normalize(element.textContent));
    const enabled = enabledNativeItems("menuitemradio", submenu).map((element) => normalize(element.textContent));
    await closeNativeMenu();
    return { enabled, present };
  }

  async function probeNativeCapabilities(surface, trigger, generation) {
    if (nativeSessionActive) throw new Error("The native selector is already in use.");
    nativeSessionActive = true;
    startNativeMotionShield();
    try {
      if (!trigger?.isConnected || generation !== panelGeneration || checkedSurface() !== surface) {
        throw new Error("The selector changed before capabilities could be read.");
      }
      if (surface === "chat") {
        const root = await openNativeMenu();
        const nativeLevels = enabledNativeItems("menuitemradio", root).map((element) => normalize(element.textContent));
        const levels = CHAT_LEVELS.filter((level) => nativeLevels.some((text) => level === "Instant" ? text.startsWith("Instant") : text === level));
        await closeNativeMenu();
        if (!levels.length) throw new Error("No supported Chat choices are available.");
        return { levels };
      }

      const originalText = normalize(trigger.innerText || trigger.textContent);
      const originalModel = WORK_MODELS.find((model) => new RegExp(`\\b${model}\\b`, "i").test(originalText)) || "Sol";
      const originalEffort = workEffortFromText(originalText) || "High";
      const originalFast = Boolean(trigger.querySelector('[data-testid="composer-model-picker-fast-service-tier-icon"]'));
      const currentWasUltra = /\bUltra$/i.test(originalText);
      const assertProbeCurrent = () => {
        if (!findNativeTrigger(surface) || generation !== panelGeneration || checkedSurface() !== surface) {
          throw new Error("The selector changed while capabilities were being read.");
        }
      };
      const waitForWorkModel = (model) => waitFor(() => {
        const candidate = findNativeTrigger("work");
        return candidate && new RegExp(`\\b${model}\\b`, "i").test(normalize(candidate.innerText || candidate.textContent))
          ? candidate
          : null;
      });
      const restoreOriginalWorkState = async () => {
        let lastError = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            let candidate = findNativeTrigger("work");
            let text = normalize(candidate?.innerText || candidate?.textContent);
            if (!candidate || !new RegExp(`\\b${originalModel}\\b`, "i").test(text)) {
              await chooseWorkCategory("Model", originalModel);
              candidate = await waitForWorkModel(originalModel);
              text = normalize(candidate.innerText || candidate.textContent);
            }
            if (workEffortFromText(text) !== originalEffort) {
              await chooseWorkCategory("Effort", originalEffort);
              candidate = await waitFor(() => {
                const current = findNativeTrigger("work");
                return current && workEffortFromText(current.innerText || current.textContent) === originalEffort ? current : null;
              });
            }
            const fastNow = Boolean(candidate.querySelector('[data-testid="composer-model-picker-fast-service-tier-icon"]'));
            if (fastNow !== originalFast) {
              await chooseWorkCategory("Speed", originalFast ? "Fast" : "Standard");
            }
            await waitFor(() => {
              const current = findNativeTrigger("work");
              if (!current) return null;
              const currentText = normalize(current.innerText || current.textContent);
              const currentFast = Boolean(current.querySelector('[data-testid="composer-model-picker-fast-service-tier-icon"]'));
              return new RegExp(`\\b${originalModel}\\b`, "i").test(currentText)
                && workEffortFromText(currentText) === originalEffort
                && currentFast === originalFast
                ? current
                : null;
            });
            return;
          } catch (error) {
            lastError = error;
            await closeNativeMenu().catch(() => {});
          }
        }
        throw lastError || new Error("The original Work selection could not be restored after capability probing.");
      };

      const nativeModels = await readWorkCapabilityCategory("Model");
      assertProbeCurrent();
      const nativeEfforts = await readWorkCapabilityCategory("Effort");
      assertProbeCurrent();
      const nativeSpeeds = await readWorkCapabilityCategory("Speed");
      assertProbeCurrent();

      const modelItems = currentWasUltra ? nativeModels.present : nativeModels.enabled;
      const effortItems = currentWasUltra ? nativeEfforts.present : nativeEfforts.enabled;
      const models = WORK_MODELS.filter((model) => modelItems.some((text) => text.startsWith(`GPT-5.6 ${model}`)));
      const efforts = WORK_EFFORTS.filter((effort) => effortItems.some((text) => text.startsWith(effort)));
      let ultraEnabled = nativeEfforts.enabled.some((text) => text.startsWith("Ultra"));

      const solCanBeProbed = observedUltraSetting && !ultraEnabled && originalModel !== "Sol"
        && nativeModels.enabled.some((text) => text.startsWith("GPT-5.6 Sol"));
      if (solCanBeProbed) {
        let switchedToSol = false;
        try {
          await chooseWorkCategory("Model", "Sol");
          switchedToSol = true;
          await waitForWorkModel("Sol");
          await sleep(100);
          assertProbeCurrent();
          const solEfforts = await readWorkCapabilityCategory("Effort");
          ultraEnabled = solEfforts.enabled.some((text) => text.startsWith("Ultra"));
        } finally {
          if (switchedToSol) {
            await restoreOriginalWorkState();
          }
        }
        assertProbeCurrent();
      }
      if (observedUltraSetting && ultraEnabled && models.includes("Sol")) efforts.push("Ultra");
      const speeds = ["Standard", "Fast"].filter((speed) => nativeSpeeds.enabled.some((text) => text.startsWith(speed)));
      if (!models.length || !efforts.some((effort) => WORK_EFFORTS.includes(effort))) {
        throw new Error("No supported Work choices are available.");
      }
      return { models, efforts, speeds };
    } finally {
      await closeNativeMenu().catch(() => {});
      stopNativeMotionShield();
      nativeSessionActive = false;
      scheduleScan();
    }
  }

  function cancelNativeMotion() {
    if (typeof document.getAnimations !== "function") return;
    for (const animation of document.getAnimations({ subtree: true })) {
      const target = animation.effect?.target;
      if (target instanceof Element && panel?.contains(target)) continue;
      if (!(target instanceof Element)) continue;
      const belongsToNativePicker = Boolean(
        target.closest('[role="menu"], [data-radix-popper-content-wrapper]') ||
        (mounted?.native && (mounted.native.contains(target) || target.contains(mounted.native))) ||
        (nativeTriggerSnapshot?.source && (
          nativeTriggerSnapshot.source.contains(target) || target.contains(nativeTriggerSnapshot.source)
        ))
      );
      if (!belongsToNativePicker) continue;
      try { animation.cancel(); } catch (_) {}
    }
  }

  function destroyNativeTriggerSnapshot() {
    nativeSnapshotObserver?.disconnect();
    nativeSnapshotObserver = null;
    nativeTriggerSnapshot?.source?.removeAttribute("data-rpp-bridge-source");
    document.querySelectorAll('[data-rpp-bridge-source="true"]').forEach((element) => {
      element.removeAttribute("data-rpp-bridge-source");
    });
    nativeTriggerSnapshot?.clone?.remove();
    document.querySelectorAll(".rpp-native-trigger-snapshot").forEach((element) => element.remove());
    nativeTriggerSnapshot = null;
  }

  function copyComputedPresentation(source, clone) {
    const sourceNodes = [source, ...source.querySelectorAll("*")];
    const cloneNodes = [clone, ...clone.querySelectorAll("*")];
    sourceNodes.forEach((sourceNode, index) => {
      const cloneNode = cloneNodes[index];
      if (!(cloneNode instanceof Element)) return;
      const computed = getComputedStyle(sourceNode);
      cloneNode.style.cssText = "";
      for (const property of computed) {
        cloneNode.style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
      }
      cloneNode.style.setProperty("animation", "none", "important");
      cloneNode.style.setProperty("transition", "none", "important");
      cloneNode.style.setProperty("pointer-events", "none", "important");
    });
  }

  function createNativeTriggerSnapshot(source) {
    if (!(source instanceof HTMLElement) || !visible(source)) return null;
    destroyNativeTriggerSnapshot();
    const rect = source.getBoundingClientRect();
    const clone = source.cloneNode(true);
    copyComputedPresentation(source, clone);
    clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
    clone.removeAttribute("id");
    clone.removeAttribute("aria-controls");
    clone.removeAttribute("aria-expanded");
    clone.removeAttribute("aria-haspopup");
    clone.removeAttribute("data-rpp-native");
    clone.removeAttribute("data-rpp-bridge-source");
    clone.classList.add("rpp-native-trigger-snapshot");
    clone.setAttribute("aria-hidden", "true");
    clone.inert = true;
    const snapshotStyle = clone.style;
    snapshotStyle.setProperty("position", "fixed", "important");
    snapshotStyle.setProperty("left", `${rect.left}px`, "important");
    snapshotStyle.setProperty("top", `${rect.top}px`, "important");
    snapshotStyle.setProperty("right", "auto", "important");
    snapshotStyle.setProperty("bottom", "auto", "important");
    snapshotStyle.setProperty("width", `${rect.width}px`, "important");
    snapshotStyle.setProperty("min-width", `${rect.width}px`, "important");
    snapshotStyle.setProperty("max-width", `${rect.width}px`, "important");
    snapshotStyle.setProperty("height", `${rect.height}px`, "important");
    snapshotStyle.setProperty("min-height", `${rect.height}px`, "important");
    snapshotStyle.setProperty("max-height", `${rect.height}px`, "important");
    snapshotStyle.setProperty("margin", "0", "important");
    snapshotStyle.setProperty("opacity", "1", "important");
    snapshotStyle.setProperty("transform", "none", "important");
    snapshotStyle.setProperty("z-index", "2147483645", "important");
    source.dataset.rppBridgeSource = "true";
    document.body.append(clone);
    nativeTriggerSnapshot = { source, clone };
    return nativeTriggerSnapshot;
  }

  function refreshNativeTriggerSnapshot() {
    if (!nativeTriggerSnapshot) return;
    const liveTrigger = findNativeTrigger(state.surface)
      || (nativeTriggerSnapshot.source?.isConnected ? nativeTriggerSnapshot.source : null);
    if (!liveTrigger) return;
    if (nativeTriggerSnapshot.source !== liveTrigger) {
      nativeTriggerSnapshot.source?.removeAttribute("data-rpp-bridge-source");
      nativeTriggerSnapshot.source = liveTrigger;
      liveTrigger.dataset.rppBridgeSource = "true";
    }
  }

  function startNativeMotionShield() {
    const liveTrigger = findNativeTrigger(state.surface) || mounted?.native;
    try {
      if (liveTrigger) createNativeTriggerSnapshot(liveTrigger);
    } catch (error) {
      destroyNativeTriggerSnapshot();
      console.debug("[Modelcade] Could not freeze the native trigger presentation:", error);
    }
    document.documentElement.classList.add("rpp-bridging");
    if (nativeTriggerSnapshot && document.body) {
      nativeSnapshotObserver = new MutationObserver(refreshNativeTriggerSnapshot);
      nativeSnapshotObserver.observe(document.body, { childList: true, subtree: true });
    }
    cancelNativeMotion();
    const tick = () => {
      if (!document.documentElement.classList.contains("rpp-bridging")) return;
      refreshNativeTriggerSnapshot();
      cancelNativeMotion();
      motionShieldFrame = requestAnimationFrame(tick);
    };
    motionShieldFrame = requestAnimationFrame(tick);
  }

  function stopNativeMotionShield() {
    if (motionShieldFrame !== null) cancelAnimationFrame(motionShieldFrame);
    motionShieldFrame = null;
    cancelNativeMotion();
    document.documentElement.classList.remove("rpp-bridging");
    destroyNativeTriggerSnapshot();
  }

  async function runNativeAction(action, workingText) {
    if (state.busy || nativeSessionActive) return false;
    state.busy = true;
    nativeSessionActive = true;
    panelPreserveUntil = performance.now() + 5000;
    startNativeMotionShield();
    syncPanel(workingText);
    let okay = false;
    try {
      await action();
      okay = true;
    } catch (error) {
      console.warn("[Modelcade]", error);
    } finally {
      await closeNativeMenu().catch(() => {});
      stopNativeMotionShield();
      state.busy = false;
      nativeSessionActive = false;
      panelPreserveUntil = performance.now() + 1200;
      syncPanel("");
      scheduleScan();
    }
    if (!okay) {
      await normalizeNativeMenuClosed(state.surface, mounted?.native);
      setPanelStatus("Native control changed — reopen and retry", "error");
      capabilityState[state.surface] = null;
      panelPreserveUntil = performance.now() + 1800;
    }
    return okay;
  }

  async function selectWork(row, column) {
    if (state.busy) return;
    if (state.ultra) {
      setPanelStatus("Turn Ultra off to change the base selection", "error");
      return;
    }
    const models = availableWorkModels();
    const efforts = availableWorkEfforts();
    const nextModel = models[row];
    const nextEffort = efforts[column];
    if (!nextModel || !nextEffort) {
      setPanelStatus("That choice is no longer available — reopen the picker", "error");
      return;
    }
    const previous = { model: state.model, effort: state.effort, ultra: state.ultra };
    state.model = nextModel;
    state.effort = nextEffort;
    savedBaseEffort = nextEffort;
    syncPanel("Applying…");

    const okay = await runNativeAction(async () => {
      if (previous.model !== nextModel) {
        await chooseWorkCategory("Model", nextModel);
        await refreshFromNative((text) => text.includes(nextModel));
        await sleep(100);
      }
      if (!state.ultra && previous.effort !== nextEffort) {
        await chooseWorkCategory("Effort", nextEffort);
        await refreshFromNative((text) => workEffortFromText(text) === nextEffort);
      }
      await persistPreferences({ baseEffort: nextEffort });
    }, "Applying…");
    if (!okay) {
      const currentTrigger = findNativeTrigger("work");
      if (currentTrigger) parseNativeState(currentTrigger, "work");
      else {
        state.model = previous.model;
        state.effort = previous.effort;
        state.ultra = previous.ultra;
        savedBaseEffort = previous.effort;
      }
      syncPanel();
      setPanelStatus("Native control changed — reopen and retry", "error");
    }
  }

  async function ensureWorkFastSelection(expectedFast) {
    if (!workHasFast()) {
      state.fast = expectedFast;
      return findNativeTrigger("work");
    }
    let trigger = findNativeTrigger("work");
    const isFast = Boolean(trigger?.querySelector('[data-testid="composer-model-picker-fast-service-tier-icon"]'));
    if (isFast !== expectedFast) {
      await chooseWorkCategory("Speed", expectedFast ? "Fast" : "Standard");
      trigger = await waitFor(() => {
        const candidate = findNativeTrigger("work");
        if (!candidate) return null;
        const candidateIsFast = Boolean(candidate.querySelector('[data-testid="composer-model-picker-fast-service-tier-icon"]'));
        return candidateIsFast === expectedFast ? candidate : null;
      });
    }
    state.fast = expectedFast;
    return trigger;
  }

  async function setUltra(nextUltra, requestedExitEffort = "High") {
    if (state.busy || state.surface !== "work" || nextUltra === state.ultra) return false;
    if (!workHasUltra() || !availableWorkModels().includes("Sol") || !availableWorkEfforts().includes("High")) {
      setPanelStatus("Ultra is not available for this account or workspace", "error");
      return false;
    }
    const previous = {
      ultra: state.ultra,
      model: state.model,
      effort: state.effort,
      returnModel: state.returnModel,
      fast: state.fast,
      savedBaseEffort
    };
    const expectedFast = state.fast;
    const exitEffort = !nextUltra && availableWorkEfforts().includes(requestedExitEffort)
      ? requestedExitEffort
      : "High";
    const restoreModel = availableWorkModels().includes(state.returnModel) ? state.returnModel : null;
    const targetReturnModel = nextUltra && state.model !== "Sol" ? state.model : null;
    if (nextUltra) {
      state.returnModel = targetReturnModel;
      state.model = "Sol";
      state.effort = "High";
      savedBaseEffort = "High";
    } else {
      state.effort = exitEffort;
      savedBaseEffort = exitEffort;
      if (!restoreModel) state.returnModel = null;
    }
    state.ultra = nextUltra;
    syncPanel(nextUltra ? "Starting Ultra…" : "Restoring base effort…");
    const okay = await runNativeAction(async () => {
      const finalModel = nextUltra ? "Sol" : (restoreModel || "Sol");
      const finalNativeEffort = nextUltra ? "Ultra" : exitEffort;
      if (nextUltra) {
        if (previous.model !== "Sol") {
          await chooseWorkCategory("Model", "Sol");
          await refreshFromNative((text) => text.includes("Sol"));
          await sleep(100);
        }
        const afterModel = findNativeTrigger("work");
        if (workEffortFromText(afterModel?.innerText || afterModel?.textContent) !== "High") {
          await chooseWorkCategory("Effort", "High");
          await refreshFromNative((text) => text.includes("Sol") && workEffortFromText(text) === "High");
          await sleep(100);
        }
        await chooseWorkCategory("Effort", "Ultra");
        await refreshFromNative((text) => text.includes("Sol") && workEffortFromText(text) === "Ultra");
      } else {
        if (restoreModel && restoreModel !== "Sol") {
          await chooseWorkCategory("Model", restoreModel);
          await refreshFromNative((text) => text.includes(restoreModel));
          await sleep(100);
        }
        await chooseWorkCategory("Effort", exitEffort);
        await refreshFromNative((text) => text.includes(finalModel) && workEffortFromText(text) === exitEffort);
      }
      await ensureWorkFastSelection(expectedFast);
      const finalTrigger = await waitFor(() => {
        const candidate = findNativeTrigger("work");
        if (!candidate) return null;
        const text = normalize(candidate.innerText || candidate.textContent);
        const fast = Boolean(candidate.querySelector('[data-testid="composer-model-picker-fast-service-tier-icon"]'));
        return text.includes(finalModel) && workEffortFromText(text) === finalNativeEffort && fast === expectedFast
          ? candidate
          : null;
      });
      if (mounted && mounted.native !== finalTrigger) mount(finalTrigger, "work");
      state.model = finalModel;
      state.effort = nextUltra ? "High" : exitEffort;
      savedBaseEffort = state.effort;
      state.ultra = nextUltra;
      state.fast = expectedFast;
      state.returnModel = nextUltra ? targetReturnModel : null;
      await persistPreferences({ baseEffort: nextUltra ? "High" : exitEffort, returnModel: state.returnModel, fast: expectedFast });
    }, nextUltra ? "Starting Ultra…" : "Restoring base effort…");
    if (okay && nextUltra) {
      const burstDelay = playUltraJackpot();
      if (burstDelay) setTimeout(() => state.ultra && panel && burstUltra(), burstDelay);
      else burstUltra();
    }
    if (!okay) {
      state.ultra = previous.ultra;
      state.model = previous.model;
      state.effort = previous.effort;
      state.returnModel = previous.returnModel;
      state.fast = previous.fast;
      savedBaseEffort = previous.savedBaseEffort;
      syncPanel();
      setPanelStatus("Native control changed — reopen and retry", "error");
    }
    return okay;
  }

  async function selectChat(level) {
    if (state.busy || level === state.effort) return;
    if (!availableChatLevels().includes(level)) {
      setPanelStatus("That choice is no longer available — reopen the picker", "error");
      return;
    }
    const previous = state.effort;
    state.effort = level;
    syncPanel();
    const okay = await runNativeAction(async () => {
      await chooseChatLevel(level);
      await refreshFromNative((text) => level === "Instant" ? text.startsWith("Instant") : text === level);
    }, "Applying…");
    if (!okay) {
      state.effort = previous;
      syncPanel();
      setPanelStatus("Native control changed — reopen and retry", "error");
    }
  }

  async function setFast(nextFast) {
    if (state.busy || state.surface !== "work") return;
    if (!workHasFast()) {
      setPanelStatus("Fast mode is not available for this account or workspace", "error");
      return;
    }
    const previous = state.fast;
    state.fast = nextFast;
    syncPanel();
    const okay = await runNativeAction(async () => {
      await chooseWorkCategory("Speed", nextFast ? "Fast" : "Standard");
      const trigger = await waitFor(() => {
        const candidate = findNativeTrigger("work") || (mounted?.native?.isConnected && visible(mounted.native) ? mounted.native : null);
        if (!candidate) return null;
        const isFast = Boolean(candidate.querySelector('[data-testid="composer-model-picker-fast-service-tier-icon"]'));
        return isFast === nextFast ? candidate : null;
      });
      if (mounted && mounted.native !== trigger) mount(trigger, "work");
      else {
        parseNativeState(trigger, "work");
        updateTrigger();
      }
      await persistPreferences({ fast: nextFast });
    }, nextFast ? "Enabling Fast…" : "Using Standard…");
    if (!okay) {
      state.fast = previous;
      syncPanel();
      setPanelStatus("Native control changed — reopen and retry", "error");
    }
  }


  async function persistPreferences(patch) {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        ...(stored?.[STORAGE_KEY] || {}),
        ...patch
      }
    });
  }

  chrome.storage.local.get(STORAGE_KEY).then((stored) => {
    const preferences = stored?.[STORAGE_KEY] || {};
    state.fast = Boolean(preferences.fast);
    state.pickerEnabled = preferences.pickerEnabled !== false;
    state.compactMode = preferences.compactMode !== false;
    state.soundsEnabled = preferences.soundsEnabled !== false;
    state.ultraSoundEnabled = preferences.ultraSoundEnabled !== false;
    state.slotJackpot = Boolean(preferences.slotJackpot);
    if (preferences.ultraSettingsByScope && typeof preferences.ultraSettingsByScope === "object") {
      ultraSettingsByScope = { ...preferences.ultraSettingsByScope };
    }
    syncUltraSettingScope();
    if (WORK_EFFORTS.includes(preferences.baseEffort)) savedBaseEffort = preferences.baseEffort;
    if (WORK_MODELS.includes(preferences.returnModel)) state.returnModel = preferences.returnModel;
    preferencesLoaded = true;
    syncPanel();
    syncSettingsControls();
    scheduleScan();
  }).catch(() => {
    preferencesLoaded = true;
    scheduleScan();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]?.newValue) return;
    const preferences = changes[STORAGE_KEY].newValue;
    const previousEnabled = state.pickerEnabled;
    const previousCompact = state.compactMode;
    const previousSounds = state.soundsEnabled;
    state.fast = Boolean(preferences.fast);
    state.pickerEnabled = preferences.pickerEnabled !== false;
    state.compactMode = preferences.compactMode !== false;
    state.soundsEnabled = preferences.soundsEnabled !== false;
    state.ultraSoundEnabled = preferences.ultraSoundEnabled !== false;
    state.slotJackpot = Boolean(preferences.slotJackpot);
    if (previousSounds !== state.soundsEnabled) syncAudioMaster();
    if (preferences.ultraSettingsByScope && typeof preferences.ultraSettingsByScope === "object") {
      ultraSettingsByScope = { ...preferences.ultraSettingsByScope };
      syncUltraSettingScope();
      if (ultraSettingScope && Object.prototype.hasOwnProperty.call(ultraSettingsByScope, ultraSettingScope)) {
        const nextUltraSetting = Boolean(ultraSettingsByScope[ultraSettingScope]);
        if (!ultraSettingKnown || nextUltraSetting !== observedUltraSetting) {
          observedUltraSetting = nextUltraSetting;
          ultraSettingKnown = true;
          capabilityState.work = null;
          if (panel && state.surface === "work" && performance.now() >= panelPreserveUntil) closePanel();
        }
      }
    }
    if (WORK_EFFORTS.includes(preferences.baseEffort)) savedBaseEffort = preferences.baseEffort;
    syncSettingsControls();

    if (!state.pickerEnabled) {
      panelPreserveUntil = 0;
      restoreNativePickerVisibility();
      cleanupMount();
      return;
    }
    if (panel && previousCompact !== state.compactMode) {
      panelPreserveUntil = 0;
      closePanel(true, "compact-storage-change");
    }
    if (!previousEnabled || previousCompact !== state.compactMode) scheduleScan();
    else syncPanel();
  });

  document.addEventListener("pointerdown", (event) => {
    if (nativeBridgeActive) return;
    if (!panel) return;
    if (panel.contains(event.target) || mounted?.custom?.contains(event.target)) return;
    closePanel(true, "outside-pointer");
  }, true);

  document.addEventListener("keydown", (event) => {
    if (nativeBridgeActive || nativeSessionActive) return;
    if (event.key === "Escape" && panel) {
      event.stopPropagation();
      closePanel(true, "escape");
      mounted?.custom?.focus();
    }
  }, true);

  window.addEventListener("resize", placePanel);
  window.addEventListener("scroll", placePanel, true);

  const observer = new MutationObserver(scheduleScan);
  const startObserver = () => {
    if (!document.documentElement) return;
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["aria-checked"] });
    scanAndMount();
  };
  if (document.documentElement) {
    startObserver();
  } else {
    const bootObserver = new MutationObserver(() => {
      if (!document.documentElement) return;
      bootObserver.disconnect();
      startObserver();
    });
    bootObserver.observe(document, { childList: true });
  }
})();
