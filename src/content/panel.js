// The picker panel: a model drum beside a magnetic power rail. It renders a
// view model from Modelcade.catalog, emits intents, and never talks to ChatGPT
// itself. DOM is rebuilt only when the structure changes; selection changes
// animate the puck, trail and labels in place.
(() => {
  const ns = globalThis.Modelcade;

  const ROW_HEIGHT = 24;
  const PUCK_RADIUS = 16;
  const LANE_INSET = 20;
  const REVERT_WINDOW = 6000;
  const BOLT = "M11.913 21.413q-.576.675-1.5.7-.925.024-1.5-.625-.563-.651-.238-1.8L9.688 16H4.575q-.85 0-1.325-.488a1.68 1.68 0 0 1-.475-1.2q0-.712.463-1.274l8.9-10.563q.574-.675 1.5-.7.924-.025 1.487.625.575.65.25 1.8L14.313 8h5.112q.85 0 1.325.5.488.5.488 1.212 0 .7-.476 1.25z";
  const LANDING_SOUND = { max: "max", pro: "pro", instant: "instant", ultra: "ultraArm" };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function el(tag, className, attrs = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined) continue;
      if (key === "text") node.textContent = value;
      else node.setAttribute(key, value);
    }
    return node;
  }

  function svgBolt(className) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    if (className) svg.setAttribute("class", className);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", BOLT);
    path.setAttribute("fill", "currentColor");
    svg.appendChild(path);
    return svg;
  }

  // Display pieces of a model row: "Sol" + badge "6.1", "GPT" + badge "6", "Default".
  function rowParts(model) {
    if (model.family === "auto") return { name: "Default", badge: null };
    if (model.family === "prime") return { name: "GPT", badge: model.version };
    if (model.family === "unknown" || !model.version) return { name: model.name || model.label, badge: model.version };
    return { name: model.name, badge: model.version };
  }

  function groupLabel(stop) {
    if (stop.family === "prime" || stop.family === "instant") return stop.modelLabel || stop.modelName;
    return `${stop.modelVersion ? `${stop.modelVersion} ` : ""}${stop.modelName}`;
  }

  function structureKey(vm) {
    return [
      vm.surface,
      vm.models.map((m) => `${m.id}|${m.label}|${m.sub}`).join(","),
      vm.stops.map((s) => `${s.id}|${s.label}`).join(","),
      vm.tiers.map((t) => t.value).join(",")
    ].join("//");
  }

  function createPanel({ onIntent, audio, getOptions } = {}) {
    const emit = (intent) => { try { onIntent?.(intent); } catch (error) { console.error("[modelcade] intent failed", error); } };
    const play = (name, opts) => { try { audio?.play?.(name, opts); } catch (_) { /* audio is optional */ } };
    const unlock = () => { try { audio?.unlock?.(); } catch (_) { /* optional */ } };
    const options = () => {
      try { return { effects: true, reducedMotion: false, ...(getOptions?.() || {}) }; } catch (_) { return { effects: true, reducedMotion: false }; }
    };
    const osReduced = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
    const reducedMotion = () => Boolean(options().reducedMotion || osReduced?.matches);

    const controller = new AbortController();
    const signal = controller.signal;
    const timers = new Set();
    const after = (ms, fn) => {
      const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
      timers.add(id);
      return id;
    };

    const state = {
      vm: null,
      key: "",
      stopIndex: 0,
      modelIndex: 0,
      tierIndex: 0,
      recent: { stop: null, model: null, tier: null },
      drag: null,
      drumDrag: null,
      wheelAcc: 0,
      wheelCommit: 0,
      entered: false,
      destroyed: false,
      cancelFx: null,
      placedWidth: 0,
      rail: { colors: [], css: "" }
    };

    // ---- skeleton ----------------------------------------------------------
    const root = el("div", "mc-panel", { role: "group", "aria-label": "Model and power" });
    root.style.setProperty("--mc-row-h", `${ROW_HEIGHT}px`);
    root.style.setProperty("--mc-r", `${PUCK_RADIUS}px`);
    root.style.setProperty("--mc-inset", `${LANE_INSET}px`);

    const drum = el("div", "mc-drum", { role: "listbox", tabindex: "0", "aria-label": "Model", "aria-orientation": "vertical" });
    const drumTrack = el("div", "mc-drum__track");
    const drumWindow = el("i", "mc-drum__window", { "aria-hidden": "true" });
    drum.append(drumWindow, drumTrack);

    const rail = el("div", "mc-rail", { role: "slider", tabindex: "0", "aria-label": "Power", "aria-valuemin": "0", "aria-valuemax": "0", "aria-valuenow": "0" });
    const labels = el("div", "mc-labels", { "aria-hidden": "true" });
    const lane = el("div", "mc-lane", { "aria-hidden": "true" });
    const trail = el("div", "mc-trail");
    const puck = el("div", "mc-puck");
    const puckBody = el("div", "mc-puck__body");
    const glyph = el("span", "mc-puck__glyph");
    glyph.append(svgBolt("mc-puck__bolt"), svgBolt("mc-puck__bolt mc-puck__bolt--echo"));
    puckBody.append(glyph);
    puck.append(puckBody);
    const groups = el("div", "mc-groups", { "aria-hidden": "true" });
    const note = el("div", "mc-note", { "aria-hidden": "true" });
    rail.append(labels, lane, groups, note);

    const live = el("span", "mc-live", { "aria-live": "polite" });
    root.append(drum, rail, live);

    let rows = [];
    let labelNodes = [];
    let dotNodes = [];
    let groupNodes = [];

    const fraction = (i, n) => (n > 1 ? i / (n - 1) : 0.5);

    // ---- build -------------------------------------------------------------
    function build(vm) {
      drumTrack.replaceChildren();
      rows = vm.models.map((model, index) => {
        const row = el("div", "mc-model", { role: "option", id: `mc-model-${index}-${Math.random().toString(36).slice(2, 6)}`, "aria-selected": "false", "data-family": model.family });
        const parts = rowParts(model);
        const name = el("span", "mc-model__name", { text: parts.name });
        row.append(name);
        if (model.family === "auto") {
          const dots = el("span", "mc-model__set");
          const families = vm.models[vm.modelIndex]?.family === "auto" && vm.stops.length
            ? [...new Set(vm.stops.map((s) => s.family))]
            : ["luna", "sol", "astra"];
          for (const family of families.slice(0, 4)) {
            const dot = el("i");
            dot.style.background = ns.palette.accent(ns.palette.resolve({ family }));
            dots.append(dot);
          }
          row.append(dots);
        } else if (parts.badge) {
          row.append(el("span", "mc-model__ver", { text: parts.badge }));
        }
        if (model.sub) row.append(el("span", "mc-model__sub", { text: model.sub }));
        row.style.setProperty("--mc-row-color", ns.palette.accent(ns.palette.resolve(model)));
        row.dataset.index = String(index);
        drumTrack.append(row);
        return row;
      });
      drum.hidden = vm.models.length === 0;
      drumTrack.style.setProperty("--mc-rows", String(vm.models.length));

      const n = vm.stops.length;
      labels.replaceChildren();
      lane.replaceChildren();
      groups.replaceChildren();
      labelNodes = vm.stops.map((stop, i) => {
        const node = el("span", "mc-label", { text: stop.short, "data-special": stop.special || null });
        node.style.setProperty("--mc-i", String(fraction(i, n)));
        labels.append(node);
        return node;
      });
      dotNodes = vm.stops.map((stop, i) => {
        const dot = el("i", "mc-dot", { "data-special": stop.special || null });
        dot.style.setProperty("--mc-i", String(fraction(i, n)));
        if (i > 0 && stop.special === "ultra") {
          const notch = el("i", "mc-notch");
          notch.style.setProperty("--mc-i", String(fraction(i, n) - 0.5 / Math.max(1, n - 1)));
          lane.append(notch);
        }
        lane.append(dot);
        return dot;
      });
      lane.append(trail, puck);
      lane.dataset.count = String(n);

      groupNodes = [];
      if (vm.stops.some((s) => s.modelChanges)) {
        let start = 0;
        for (let i = 1; i <= n; i += 1) {
          if (i === n || vm.stops[i].modelChanges) {
            const stop = vm.stops[start];
            const node = el("span", "mc-group", { text: groupLabel(stop) });
            node.style.setProperty("--mc-a", String(fraction(start, n)));
            node.style.setProperty("--mc-b", String(fraction(i - 1, n)));
            node.style.setProperty("--mc-group-color", ns.palette.accent(ns.palette.resolve(stop)));
            node.dataset.from = String(start);
            node.dataset.to = String(i - 1);
            groups.append(node);
            groupNodes.push(node);
            start = i;
          }
        }
      }
      groups.hidden = groupNodes.length === 0;

      state.rail = ns.palette.rail(vm.stops);
      applyGradient(state.rail);

      rail.setAttribute("aria-valuemax", String(Math.max(0, n - 1)));
      root.dataset.surface = vm.surface;
      root.dataset.drum = vm.models.length ? "true" : "false";
      applyWidth();
    }

    // Natural width grows with the stop count; place() may ask for more, never less.
    function applyWidth() {
      const natural = clamp(196 + (state.vm?.stops.length || 5) * 32, 300, 380);
      const width = Math.min(Math.max(natural, state.placedWidth || 0), 380, document.documentElement.clientWidth - 16);
      root.style.width = `${Math.round(width)}px`;
    }

    function applyGradient({ css, first, last }) {
      trail.style.backgroundImage = `${css}, linear-gradient(${last}, ${last})`;
      trail.style.backgroundColor = first;
    }

    // ---- update --------------------------------------------------------------
    function paintStop(index, { preview = false } = {}) {
      const vm = state.vm;
      const stop = vm.stops[index];
      if (!stop) return;
      const color = state.rail.colors[index] || ns.palette.stopColor(stop);
      lane.style.setProperty("--mc-t", String(fraction(index, vm.stops.length)));
      root.style.setProperty("--mc-stop", color);
      root.dataset.special = stop.special || "";
      labelNodes.forEach((node, i) => node.classList.toggle("is-active", i === index));
      dotNodes.forEach((node, i) => {
        node.classList.toggle("is-active", i === index);
        node.classList.toggle("is-passed", i < index);
      });
      groupNodes.forEach((node) => node.classList.toggle("is-active", index >= Number(node.dataset.from) && index <= Number(node.dataset.to)));
      if (!preview) {
        rail.setAttribute("aria-valuenow", String(index));
        rail.setAttribute("aria-valuetext", valueText(index));
      }
    }

    function valueText(index) {
      const vm = state.vm;
      const stop = vm.stops[index];
      const model = stop?.modelLabel || vm.models[state.modelIndex]?.label || "";
      const tier = vm.hasSpeed ? vm.tiers[state.tierIndex]?.label : "";
      return [model, stop?.label, tier].filter(Boolean).join(", ");
    }

    function paintModel(index, { preview = false } = {}) {
      const vm = state.vm;
      drumTrack.style.setProperty("--mc-row", String(index));
      rows.forEach((row, i) => {
        row.classList.toggle("is-selected", i === index);
        row.setAttribute("aria-selected", i === index ? "true" : "false");
        row.style.setProperty("--mc-dist", String(Math.abs(i - index)));
      });
      if (rows[index]) drum.setAttribute("aria-activedescendant", rows[index].id);
      const model = vm.models[index];
      if (model) root.style.setProperty("--mc-model", ns.palette.accent(ns.palette.resolve(model)));
      if (preview && model) {
        // Tint the rail with the previewed family until the real stops arrive.
        const key = ns.palette.resolve(model);
        const ramp = ns.palette.ramp(key);
        applyGradient({ css: ns.palette.css(key), first: ramp[0][1], last: ramp[ramp.length - 1][1] });
        root.style.setProperty("--mc-stop", ns.palette.sample(key, ns.palette.EFFORT_FRACTION[vm.stops[state.stopIndex]?.effort] ?? 0.6));
      }
    }

    function paintTier(index) {
      const vm = state.vm;
      const tier = vm.tiers[index];
      const value = tier?.value || "standard";
      puck.dataset.tier = value;
      root.dataset.speed = vm.hasSpeed ? "true" : "false";
      rail.setAttribute("aria-valuetext", valueText(state.stopIndex));
    }

    function shake() {
      root.classList.remove("is-shaking");
      void root.offsetWidth;
      root.classList.add("is-shaking");
      after(420, () => root.classList.remove("is-shaking"));
    }

    function liquid(kind) {
      lane.classList.remove("is-liquid-x", "is-liquid-y");
      void lane.offsetWidth;
      lane.classList.add(kind === "y" ? "is-liquid-y" : "is-liquid-x");
      after(420, () => lane.classList.remove("is-liquid-x", "is-liquid-y"));
    }

    function render(vm) {
      if (state.destroyed || !vm) return;
      const now = performance.now();
      const previous = state.vm;
      state.vm = vm;
      const key = structureKey(vm);
      const rebuilt = key !== state.key;
      if (rebuilt) {
        state.key = key;
        build(vm);
      }

      root.dataset.theme = vm.theme;
      root.dataset.stopsLocked = vm.stopsLocked ? "true" : "false";
      root.dataset.modelLocked = vm.modelLocked ? "true" : "false";
      rail.setAttribute("aria-disabled", vm.stopsLocked ? "true" : "false");
      drum.setAttribute("aria-disabled", vm.modelLocked ? "true" : "false");
      if (vm.busy !== undefined) root.dataset.busy = vm.busy ? "true" : "false";
      root.dataset.reduced = reducedMotion() ? "true" : "false";

      // A new vm that contradicts a move we just showed is a revert: go back
      // with a shake. A vm that confirms the move keeps the watch open, since
      // an optimistic confirmation may still be followed by a revert.
      const reverted = (kind, shown, incoming) => {
        const recent = state.recent[kind];
        if (!recent) return false;
        if (now - recent.at >= REVERT_WINDOW) { state.recent[kind] = null; return false; }
        if (incoming === recent.index) return false;
        state.recent[kind] = null;
        return shown === recent.index;
      };
      let didRevert = false;
      if (rebuilt) state.recent.stop = null; // stops are a different set now; nothing to compare
      if (reverted("stop", state.stopIndex, vm.stopIndex)) didRevert = true;
      if (reverted("model", state.modelIndex, vm.modelIndex)) didRevert = true;
      if (reverted("tier", state.tierIndex, vm.tierIndex)) didRevert = true;

      const stopChanged = rebuilt || vm.stopIndex !== state.stopIndex;
      const modelChanged = rebuilt || vm.modelIndex !== state.modelIndex;
      const tierChanged = rebuilt || vm.tierIndex !== state.tierIndex;
      state.stopIndex = vm.stopIndex;
      state.modelIndex = vm.modelIndex;
      state.tierIndex = vm.tierIndex;

      if (!state.drag) paintStop(state.stopIndex);
      else paintStop(state.drag.preview, { preview: true });
      if (!state.drumDrag) paintModel(state.modelIndex);
      paintTier(state.tierIndex);
      if (rebuilt) applyGradient(state.rail);

      if (didRevert) {
        shake();
        liquid(modelChanged && !stopChanged ? "y" : "x");
      } else if (previous && !rebuilt && (stopChanged || modelChanged)) {
        liquid(modelChanged && !stopChanged ? "y" : "x");
      }
      if (vm.error) flashError(typeof vm.error === "string" ? vm.error : "");
    }

    // ---- rail geometry ----------------------------------------------------------
    function laneMetrics() {
      const rect = lane.getBoundingClientRect();
      const span = Math.max(1, rect.width - LANE_INSET * 2);
      return { rect, span, centerX: (i) => rect.left + LANE_INSET + span * fraction(i, state.vm.stops.length) };
    }

    function indexAt(clientX, metrics) {
      const n = state.vm.stops.length;
      if (n < 2) return 0;
      const t = (clientX - metrics.rect.left - LANE_INSET) / metrics.span;
      return clamp(Math.round(t * (n - 1)), 0, n - 1);
    }

    // ---- commits -------------------------------------------------------------------
    function commitStop(index, { viaKey = false } = {}) {
      const vm = state.vm;
      if (!vm || index === state.stopIndex || !vm.stops[index]) return;
      const stop = vm.stops[index];
      if (viaKey) play("detent", { index, count: vm.stops.length, special: stop.special });
      state.stopIndex = index;
      state.recent.stop = { index, at: performance.now() };
      paintStop(index);
      liquid("x");
      if (stop.special && LANDING_SOUND[stop.special]) play(LANDING_SOUND[stop.special], { index, count: vm.stops.length });
      emit({ type: "stop", index });
    }

    function commitModel(index) {
      const vm = state.vm;
      if (!vm || !vm.models[index]) return;
      state.modelIndex = index;
      state.recent.model = { index, at: performance.now() };
      paintModel(index, { preview: true });
      liquid("y");
      emit({ type: "model", id: vm.models[index].id });
    }

    function cycleTier() {
      const vm = state.vm;
      if (!vm?.hasSpeed) return;
      const index = (state.tierIndex + 1) % vm.tiers.length;
      state.tierIndex = index;
      state.recent.tier = { index, at: performance.now() };
      play("speed", { level: index, count: vm.tiers.length });
      paintTier(index);
      puck.classList.remove("is-tapped");
      void puck.offsetWidth;
      puck.classList.add("is-tapped");
      after(360, () => puck.classList.remove("is-tapped"));
      live.textContent = vm.tiers[index]?.label || "";
      emit({ type: "tier", index });
    }

    function deny() {
      play("deny");
      shake();
    }

    // ---- rail pointer -----------------------------------------------------------------
    let raf = 0;
    let pendingMove = null;

    function previewStop(index) {
      const drag = state.drag;
      if (!drag || index === drag.preview) return;
      const vm = state.vm;
      lane.dataset.dir = index > drag.preview ? "right" : "left";
      drag.preview = index;
      paintStop(index, { preview: true });
      play("detent", { index, count: vm.stops.length, special: vm.stops[index].special });
    }

    // Focus rings are for keyboard users; pointer presses focus the rail from
    // script, which Chrome would otherwise also report as :focus-visible.
    root.addEventListener("pointerdown", () => { root.dataset.input = "pointer"; }, { capture: true, signal });
    root.addEventListener("keydown", () => { root.dataset.input = "keyboard"; }, { capture: true, signal });

    rail.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      unlock();
      const vm = state.vm;
      if (!vm) return;
      event.preventDefault();
      rail.focus({ preventScroll: true });
      if (vm.stopsLocked) { deny(); return; }
      const metrics = laneMetrics();
      const onPuck = Math.abs(event.clientX - metrics.centerX(state.stopIndex)) <= PUCK_RADIUS + 4
        && event.clientY >= metrics.rect.top - 6 && event.clientY <= metrics.rect.bottom + 6;
      state.drag = { id: event.pointerId, startX: event.clientX, moved: false, onPuck, preview: state.stopIndex, metrics };
      try { rail.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
      if (!onPuck) {
        lane.classList.add("is-dragging");
        previewStop(indexAt(event.clientX, metrics));
      }
    }, { signal });

    rail.addEventListener("pointermove", (event) => {
      const drag = state.drag;
      if (!drag || event.pointerId !== drag.id) {
        hoverPuck(event);
        return;
      }
      pendingMove = event.clientX;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          const d = state.drag;
          if (!d || pendingMove === null) return;
          if (!d.moved && Math.abs(pendingMove - d.startX) > 3) {
            d.moved = true;
            lane.classList.add("is-dragging");
          }
          if (d.moved || !d.onPuck) previewStop(indexAt(pendingMove, d.metrics));
        });
      }
    }, { signal });

    function endDrag(event, cancelled) {
      const drag = state.drag;
      if (!drag || (event && event.pointerId !== drag.id)) return;
      state.drag = null;
      lane.classList.remove("is-dragging");
      lane.dataset.dir = "";
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      try { rail.releasePointerCapture(drag.id); } catch (_) { /* ignore */ }
      if (cancelled) { paintStop(state.stopIndex); return; }
      if (drag.onPuck && !drag.moved) {
        if (state.vm.hasSpeed) cycleTier();
        return;
      }
      if (drag.preview !== state.stopIndex) commitStop(drag.preview);
      else paintStop(state.stopIndex);
    }

    rail.addEventListener("pointerup", (event) => endDrag(event, false), { signal });
    rail.addEventListener("pointercancel", (event) => endDrag(event, true), { signal });
    rail.addEventListener("lostpointercapture", (event) => { if (state.drag && event.pointerId === state.drag.id) endDrag(event, true); }, { signal });

    function hoverPuck(event) {
      const vm = state.vm;
      if (!vm || !vm.hasSpeed || vm.stopsLocked) { lane.dataset.puckHover = "false"; return; }
      const metrics = laneMetrics();
      const near = Math.abs(event.clientX - metrics.centerX(state.stopIndex)) <= PUCK_RADIUS + 2
        && event.clientY >= metrics.rect.top - 4 && event.clientY <= metrics.rect.bottom + 4;
      lane.dataset.puckHover = near ? "true" : "false";
    }
    rail.addEventListener("pointerleave", () => { lane.dataset.puckHover = "false"; }, { signal });

    rail.addEventListener("keydown", (event) => {
      const vm = state.vm;
      if (!vm) return;
      const n = vm.stops.length;
      let target = null;
      switch (event.key) {
        case "ArrowRight": case "ArrowUp": target = state.stopIndex + 1; break;
        case "ArrowLeft": case "ArrowDown": target = state.stopIndex - 1; break;
        case "Home": target = 0; break;
        case "End": target = n - 1; break;
        case "Enter": case " ":
          event.preventDefault();
          unlock();
          if (vm.hasSpeed) cycleTier();
          return;
        default: return;
      }
      event.preventDefault();
      unlock();
      if (vm.stopsLocked) { deny(); return; }
      target = clamp(target, 0, n - 1);
      if (target === state.stopIndex) return;
      lane.dataset.dir = target > state.stopIndex ? "right" : "left";
      commitStop(target, { viaKey: true });
    }, { signal });

    // ---- drum ----------------------------------------------------------------------------
    function previewModel(index, drag) {
      const vm = state.vm;
      index = clamp(index, 0, vm.models.length - 1);
      if (index === drag.preview) return;
      drag.preview = index;
      drumTrack.style.setProperty("--mc-row", String(index));
      rows.forEach((row, i) => {
        row.classList.toggle("is-selected", i === index);
        row.style.setProperty("--mc-dist", String(Math.abs(i - index)));
      });
      play("model", { index, count: vm.models.length });
    }

    drum.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      unlock();
      const vm = state.vm;
      if (!vm) return;
      event.preventDefault();
      drum.focus({ preventScroll: true });
      if (vm.modelLocked) { deny(); return; }
      state.drumDrag = { id: event.pointerId, startY: event.clientY, startIndex: state.modelIndex, preview: state.modelIndex, moved: false, target: event.target };
      try { drum.setPointerCapture(event.pointerId); } catch (_) { /* ignore */ }
    }, { signal });

    drum.addEventListener("pointermove", (event) => {
      const drag = state.drumDrag;
      if (!drag || event.pointerId !== drag.id) return;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.abs(dy) > 4) { drag.moved = true; drum.classList.add("is-dragging"); }
      if (!drag.moved) return;
      previewModel(drag.startIndex - Math.round(dy / ROW_HEIGHT), drag);
    }, { signal });

    function endDrumDrag(event, cancelled) {
      const drag = state.drumDrag;
      if (!drag || (event && event.pointerId !== drag.id)) return;
      state.drumDrag = null;
      drum.classList.remove("is-dragging");
      try { drum.releasePointerCapture(drag.id); } catch (_) { /* ignore */ }
      if (cancelled) { paintModel(state.modelIndex); return; }
      if (!drag.moved) {
        const row = drag.target instanceof Element ? drag.target.closest(".mc-model") : null;
        const index = row ? Number(row.dataset.index) : state.modelIndex;
        if (index !== state.modelIndex) { play("model", { index, count: state.vm.models.length }); commitModel(index); }
        return;
      }
      if (drag.preview !== state.modelIndex) commitModel(drag.preview);
      else paintModel(state.modelIndex);
    }

    drum.addEventListener("pointerup", (event) => endDrumDrag(event, false), { signal });
    drum.addEventListener("pointercancel", (event) => endDrumDrag(event, true), { signal });
    drum.addEventListener("lostpointercapture", (event) => { if (state.drumDrag && event.pointerId === state.drumDrag.id) endDrumDrag(event, true); }, { signal });

    drum.addEventListener("wheel", (event) => {
      const vm = state.vm;
      if (!vm) return;
      event.preventDefault();
      if (vm.modelLocked) return;
      unlock();
      state.wheelAcc += event.deltaY;
      if (Math.abs(state.wheelAcc) < 28) return;
      const step = Math.sign(state.wheelAcc);
      state.wheelAcc = 0;
      const next = clamp(state.modelIndex + step, 0, vm.models.length - 1);
      if (next === state.modelIndex) return;
      play("model", { index: next, count: vm.models.length });
      state.modelIndex = next;
      paintModel(next, { preview: true });
      clearTimeout(state.wheelCommit);
      timers.delete(state.wheelCommit);
      state.wheelCommit = after(170, () => {
        state.recent.model = { index: state.modelIndex, at: performance.now() };
        liquid("y");
        emit({ type: "model", id: vm.models[state.modelIndex].id });
      });
    }, { signal, passive: false });

    drum.addEventListener("keydown", (event) => {
      const vm = state.vm;
      if (!vm) return;
      let target = null;
      switch (event.key) {
        case "ArrowUp": target = state.modelIndex - 1; break;
        case "ArrowDown": target = state.modelIndex + 1; break;
        case "Home": target = 0; break;
        case "End": target = vm.models.length - 1; break;
        default: return;
      }
      event.preventDefault();
      unlock();
      if (vm.modelLocked) { deny(); return; }
      target = clamp(target, 0, vm.models.length - 1);
      if (target === state.modelIndex) return;
      play("model", { index: target, count: vm.models.length });
      commitModel(target);
    }, { signal });

    root.addEventListener("keydown", () => unlock(), { signal, once: true });

    // ---- public API ------------------------------------------------------------------------
    function mount(parent = document.body) {
      if (state.destroyed) return;
      if (!root.isConnected) parent.appendChild(root);
      if (!state.entered) {
        state.entered = true;
        root.classList.add("mc-panel--enter");
        root.addEventListener("animationend", () => root.classList.remove("mc-panel--enter"), { once: true, signal });
        after(600, () => root.classList.remove("mc-panel--enter"));
        play("open");
      }
    }

    // left/top/width describe the panel's own box as computed by main.js: top is
    // the panel's top edge in both directions; the panel keeps its right edge at
    // left + width and grows leftward if it needs more room than width allows.
    // direction only steers the transform origin and entrance animation.
    function place({ left = 0, top = 0, width = 0, radius = 20, direction = "down" } = {}) {
      const vw = document.documentElement.clientWidth;
      state.placedWidth = Number(width) || 0;
      applyWidth();
      const panelWidth = parseFloat(root.style.width) || 0;
      root.dataset.direction = direction === "up" ? "up" : "down";
      root.style.left = "auto";
      root.style.right = `${Math.max(8, Math.round(vw - (left + (state.placedWidth || panelWidth))))}px`;
      root.style.top = `${Math.max(8, Math.round(top))}px`;
      root.style.setProperty("--mc-radius", `${clamp(Number(radius) || 20, 10, 28)}px`);
    }

    function celebrate(kind = "ultra") {
      if (state.destroyed) return;
      const opts = options();
      root.classList.remove("is-celebrating");
      void root.offsetWidth;
      root.dataset.celebration = kind;
      root.classList.add("is-celebrating");
      after(1300, () => root.classList.remove("is-celebrating"));
      if (opts.effects === false || !ns.fx) return;
      const rect = puck.getBoundingClientRect();
      state.cancelFx?.();
      state.cancelFx = ns.fx.burst({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, kind, reducedMotion: reducedMotion() });
    }

    function setBusy(busy) {
      root.dataset.busy = busy ? "true" : "false";
    }

    function flashError(message) {
      shake();
      root.classList.remove("is-error");
      void root.offsetWidth;
      root.classList.add("is-error");
      after(700, () => root.classList.remove("is-error"));
      if (message) {
        note.textContent = message;
        note.classList.add("is-visible");
        after(2200, () => note.classList.remove("is-visible"));
      }
    }

    function focus() {
      rail.focus({ preventScroll: true });
    }

    function destroy({ animate = true } = {}) {
      if (state.destroyed) return Promise.resolve();
      state.destroyed = true;
      controller.abort();
      for (const id of timers) clearTimeout(id);
      timers.clear();
      if (raf) cancelAnimationFrame(raf);
      state.cancelFx?.();
      play("close");
      const remove = () => root.remove();
      if (!animate || !root.isConnected || reducedMotion()) { remove(); return Promise.resolve(); }
      return new Promise((resolve) => {
        root.classList.remove("mc-panel--enter");
        root.classList.add("mc-panel--leave");
        const done = () => { remove(); resolve(); };
        root.addEventListener("animationend", done, { once: true });
        setTimeout(done, 260);
      });
    }

    return { element: root, mount, place, render, celebrate, setBusy, flashError, focus, destroy };
  }

  ns.createPanel = createPanel;
})();
