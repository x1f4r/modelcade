// Color ramps for every model family plus the helpers that turn a rail's stops
// into one gradient. Each ramp runs dark → light and is modelled on photographs
// of its namesake, so a trail reads as "more light" the further it fills.
(() => {
  const ns = globalThis.Modelcade;

  // [position 0..1, hex]
  const RAMPS = {
    // Sunspot umbra through photosphere: deep amber, orange, gold, near-white.
    sol: [[0, "#4a1105"], [0.16, "#8f2a0c"], [0.36, "#d4581a"], [0.56, "#f79424"], [0.74, "#ffc94a"], [0.9, "#ffe9a8"], [1, "#fff8e4"]],
    // Earth: roughly 71% ocean, then vegetation and land, then cloud and ice.
    terra: [[0, "#041634"], [0.18, "#082e63"], [0.38, "#0c4b8f"], [0.56, "#1670b9"], [0.71, "#2f93cf"], [0.78, "#2f8b5f"], [0.88, "#93b06a"], [1, "#e9f0ef"]],
    // Moon: basalt maria with titanium-blue and warm mineral tints up to highland stone.
    luna: [[0, "#26282c"], [0.16, "#3c4047"], [0.34, "#525a66"], [0.5, "#6b7584"], [0.64, "#89847b"], [0.78, "#aea89c"], [0.9, "#d4cfc4"], [1, "#f3f0ea"]],
    // Astra: deep indigo, violet, then starlight white-cyan.
    astra: [[0, "#0d0830"], [0.18, "#241566"], [0.38, "#4a2fc2"], [0.58, "#7a5cf0"], [0.76, "#a28cff"], [0.9, "#c8c0ff"], [1, "#e4f7ff"]],
    // Plain GPT-6 (runs on Sol): honey-amber, a touch softer than Sol itself.
    prime: [[0, "#2e1407"], [0.18, "#7a3210"], [0.4, "#c86a1c"], [0.6, "#f29d2e"], [0.78, "#ffc866"], [0.92, "#ffe3ad"], [1, "#fff6e8"]],
    // Legacy GPT-5.5: brushed graphite and steel.
    steel: [[0, "#121418"], [0.2, "#24282e"], [0.4, "#3d434b"], [0.6, "#5c646d"], [0.8, "#848d97"], [0.92, "#b4bcc5"], [1, "#e1e6eb"]],
    // "Default": a pearl that stays neutral next to whichever families it mixes.
    auto: [[0, "#2b2f3a"], [0.25, "#4f5668"], [0.5, "#7d879c"], [0.72, "#aab3c6"], [0.88, "#d2d9e6"], [1, "#f1f4fa"]],
    // Instant: cool graphite.
    instant: [[0, "#15181d"], [0.3, "#272c33"], [0.6, "#3e454e"], [0.85, "#5b636d"], [1, "#7b838d"]],
    // Ultra: violet override.
    ultra: [[0, "#1d0a4d"], [0.25, "#4a22b3"], [0.5, "#7a4cf0"], [0.7, "#a675ff"], [0.86, "#c9a8ff"], [1, "#ebdfff"]],
    // Pro: sun-white.
    pro: [[0, "#f6c86a"], [0.5, "#ffe9b0"], [1, "#fff9ea"]]
  };

  const SPECIAL_COLOR = {
    ultra: "#a675ff",
    pro: "#fff3cf",
    max: "#ffd36a",
    instant: "#7b838d",
    persistent: "#ffb8a0"
  };

  // Where an effort sits inside its family's ramp. Stable across rails so
  // "Medium" is the same orange whether the rail has three stops or six.
  const EFFORT_FRACTION = {
    instant: 0, none: 0, minimal: 0.12, low: 0.2, medium: 0.42, high: 0.62,
    xhigh: 0.8, max: 1, ultra: 1, pro: 1, persistent: 0.9
  };

  const hexToRgb = (hex) => {
    const value = hex.replace("#", "");
    const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgbToHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

  function mix(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    return rgbToHex(ca.map((v, i) => v + (cb[i] - v) * t));
  }

  function rgba(hex, alpha) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
  }

  // Unknown families get a pleasant ramp seeded by their name.
  function unknownRamp(name) {
    let hash = 0;
    for (const ch of String(name || "model")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = hash % 360;
    const steps = [[0, 10, 55], [0.2, 24, 62], [0.4, 40, 64], [0.6, 56, 58], [0.8, 72, 48], [1, 91, 30]];
    return steps.map(([t, l, s]) => [t, hslToHex(hue, s, l)]);
  }

  const unknownCache = new Map();

  // key for {family, version, name} or a stop
  function resolve(model) {
    const family = model?.family || "unknown";
    if (family === "prime") {
      const major = parseFloat(model.version || model.modelVersion || "6");
      return Number.isFinite(major) && major < 6 ? "steel" : "prime";
    }
    if (RAMPS[family]) return family;
    const name = model?.name || model?.modelName || model?.label || "model";
    const key = `unknown:${name}`;
    if (!unknownCache.has(key)) unknownCache.set(key, unknownRamp(name));
    return key;
  }

  function ramp(key) {
    return RAMPS[key] || unknownCache.get(key) || RAMPS.auto;
  }

  function sample(key, t) {
    const stops = ramp(key);
    const x = Math.max(0, Math.min(1, Number(t) || 0));
    for (let i = 1; i < stops.length; i += 1) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      if (x <= t1) return t1 === t0 ? c1 : mix(c0, c1, (x - t0) / (t1 - t0));
    }
    return stops[stops.length - 1][1];
  }

  // The color a model's name is written in: bright enough for dark glass.
  function accent(key) {
    return key === "steel" || key === "instant" ? sample(key, 0.95) : sample(key, 0.78);
  }

  function css(key, angle = 90) {
    return `linear-gradient(${angle}deg, ${ramp(key).map(([t, c]) => `${c} ${(t * 100).toFixed(1)}%`).join(", ")})`;
  }

  // Computes one color per stop plus the gradient that joins them. Stops are
  // placed at fractions 0..1 of the lane between the first and last centers.
  // Consecutive stops of the same family share a ramp; a change of family (the
  // mixed "Default" rail) blends quickly around the boundary; special stops
  // (Ultra, Pro, Instant) take their own color regardless of family.
  function rail(stops) {
    const n = stops.length;
    if (!n) return { css: "transparent", colors: [], first: "#2a2b30", last: "#2a2b30" };
    const keyOf = (stop) => {
      if (stop.special === "ultra") return "ultra";
      if (stop.special === "pro") return "pro";
      if (stop.special === "instant") return "instant";
      return resolve(stop);
    };
    const keys = stops.map(keyOf);
    const fractions = stops.map((stop) => EFFORT_FRACTION[stop.effort] ?? 0.5);

    // Stretch a single-family rail so its last ordinary stop reaches the ramp's
    // bright end. Mixed rails keep absolute effort positions for consistency.
    const ordinary = stops.map((stop, i) => (keys[i] === "ultra" || keys[i] === "pro" || keys[i] === "instant" ? null : i)).filter((i) => i !== null);
    const singleFamily = ordinary.length >= 2 && new Set(ordinary.map((i) => keys[i])).size === 1;
    if (singleFamily) {
      const min = Math.min(...ordinary.map((i) => fractions[i]));
      const max = Math.max(...ordinary.map((i) => fractions[i]));
      if (max > min) for (const i of ordinary) fractions[i] = min + ((fractions[i] - min) * (1 - min)) / (max - min);
    }
    const colors = stops.map((stop, i) => {
      if (keys[i] === "ultra") return SPECIAL_COLOR.ultra;
      if (keys[i] === "pro") return SPECIAL_COLOR.pro;
      if (keys[i] === "instant") return sample("instant", 0.75);
      return sample(keys[i], fractions[i]);
    });

    if (n === 1) return { css: `linear-gradient(90deg, ${colors[0]}, ${colors[0]})`, colors, first: colors[0], last: colors[0] };

    const points = [];
    const push = (x, color) => points.push([Math.max(0, Math.min(1, x)), color]);
    for (let i = 0; i < n; i += 1) {
      const x = i / (n - 1);
      if (i === 0) { push(0, colors[0]); continue; }
      const prev = i - 1;
      const gap = 1 / (n - 1);
      if (keys[i] === keys[prev] && !["ultra", "pro", "instant"].includes(keys[i])) {
        // Same ramp: sub-sample so the band bends the way the photo does.
        for (let s = 1; s <= 3; s += 1) {
          const f = fractions[prev] + ((fractions[i] - fractions[prev]) * s) / 4;
          push(x - gap + gap * (s / 4), sample(keys[i], f));
        }
        push(x, colors[i]);
      } else if (keys[i] === "ultra") {
        // The override: the family color runs up to the notch, then the lane
        // is violet from the notch onward.
        push(x - gap * 0.5 - 0.008, colors[prev]);
        push(x - gap * 0.5 + 0.008, "#5b2fd6");
        push(x - gap * 0.2, "#8b5cff");
        push(x, colors[i]);
      } else if (keys[i] === "pro") {
        push(x - gap * 0.6, colors[prev]);
        push(x - gap * 0.25, mix(colors[prev], "#ffe9b0", 0.6));
        push(x, colors[i]);
      } else if (keys[prev] === "instant") {
        // Graphite warming into the family's darkest tone.
        push(x - gap * 0.55, colors[prev]);
        push(x - gap * 0.2, mix(colors[prev], sample(keys[i], 0), 0.6));
        push(x, colors[i]);
      } else {
        // Family change in a mixed rail: short, deliberate seam.
        push(x - gap * 0.5 - 0.012, colors[prev]);
        push(x - gap * 0.5 + 0.012, colors[i]);
        push(x, colors[i]);
      }
    }
    const cssStops = points.map(([x, c]) => `${c} ${(x * 100).toFixed(2)}%`).join(", ");
    return { css: `linear-gradient(90deg, ${cssStops})`, colors, first: colors[0], last: colors[n - 1] };
  }

  function stopColor(stop) {
    if (stop.special && SPECIAL_COLOR[stop.special]) {
      if (stop.special === "max") return sample(resolve(stop), 1);
      return SPECIAL_COLOR[stop.special];
    }
    return sample(resolve(stop), EFFORT_FRACTION[stop.effort] ?? 0.5);
  }

  ns.palette = { RAMPS, SPECIAL_COLOR, EFFORT_FRACTION, resolve, ramp, sample, accent, css, rail, stopColor, mix, rgba };
})();
