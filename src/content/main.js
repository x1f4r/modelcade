// Wires Modelcade into ChatGPT: intercepts the composer's model control, opens
// the arcade panel, and applies every choice through the page bridge, which
// calls ChatGPT's own picker callbacks. The native menu is never opened unless
// Modelcade has nothing useful to show or the user Alt-clicks the control.
(() => {
  "use strict";
  const ns = globalThis.Modelcade;
  if (ns.started) return;
  ns.started = true;

  const TRIGGER_SELECTOR = 'button[data-codex-intelligence-trigger="true"], form button[aria-label="Select ChatGPT model"]';
  const REQUEST_TIMEOUT = 4000;

  let prefs = { ...ns.prefs.DEFAULTS };
  let prefsLoaded = false;
  let panel = null;
  let session = null; // { trigger, vm, placeFrame, observer, poll }
  let opening = null;
  let passthrough = false;
  let requestCounter = 0;
  const pending = new Map();

  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches
    || document.documentElement.dataset.reducedMotion === "true";

  // ----- Bridge client ---------------------------------------------------------

  document.addEventListener("modelcade:response", (event) => {
    let message;
    try {
      message = JSON.parse(event.detail);
    } catch (_) {
      return;
    }
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.ok) entry.resolve(message.result);
    else entry.reject(new Error(message.error || "Bridge error"));
  });

  function request(op, args = {}) {
    const id = `mc-${Date.now().toString(36)}-${(requestCounter += 1)}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Bridge did not answer ${op}.`));
      }, op === "snapshot" ? 600 : REQUEST_TIMEOUT);
      pending.set(id, { resolve, reject, timer });
      document.dispatchEvent(new CustomEvent("modelcade:request", { detail: JSON.stringify({ id, op, args }) }));
    });
  }

  // ----- Native trigger --------------------------------------------------------

  const isVisible = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  function findTrigger() {
    for (const candidate of document.querySelectorAll(TRIGGER_SELECTOR)) {
      if (isVisible(candidate)) return candidate;
    }
    return null;
  }

  const triggerFromEvent = (event) => {
    const target = event.target instanceof Element ? event.target.closest(TRIGGER_SELECTOR) : null;
    return target && isVisible(target) ? target : null;
  };

  // Opens ChatGPT's own menu, for surfaces Modelcade cannot improve on.
  function openNativeMenu(trigger) {
    const rect = trigger.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: 0,
      buttons: 1,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true
    };
    passthrough = true;
    try {
      trigger.dispatchEvent(new PointerEvent("pointerdown", init));
      trigger.dispatchEvent(new PointerEvent("pointerup", { ...init, buttons: 0 }));
    } finally {
      passthrough = false;
    }
  }

  function swallow(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function onTriggerPointer(event) {
    if (passthrough || !prefsLoaded || !prefs.enabled) return;
    const trigger = triggerFromEvent(event);
    if (!trigger) return;
    if (event.altKey) return; // Alt-click always reaches ChatGPT's own picker.
    if (event.type === "pointerdown" && event.button !== 0) return;
    swallow(event);
    if (event.type !== "pointerdown") return;
    if (panel) closePanel("trigger");
    else openPanel(trigger, { viaKeyboard: false });
  }

  function onKeydown(event) {
    if (passthrough || !prefsLoaded || !prefs.enabled || event.isComposing) return;
    if (event.key === "Escape" && panel) {
      swallow(event);
      closePanel("escape", { refocus: true });
      return;
    }
    const hotkey = event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey
      && (event.code === "KeyM" || event.key?.toLowerCase() === "m");
    const trigger = hotkey ? findTrigger() : triggerFromEvent(event);
    if (!trigger) return;
    const opensMenu = hotkey || ["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key);
    if (!opensMenu || event.altKey && !hotkey) return;
    swallow(event);
    if (event.repeat) return;
    if (panel) closePanel("toggle", { refocus: true });
    else openPanel(trigger, { viaKeyboard: true });
  }

  // Installed at document_start, before ChatGPT's listeners, so the native
  // shortcut and menu never see an event Modelcade handles.
  window.addEventListener("pointerdown", onTriggerPointer, true);
  window.addEventListener("pointerup", onTriggerPointer, true);
  window.addEventListener("click", onTriggerPointer, true);
  window.addEventListener("keydown", onKeydown, true);

  // ----- Panel lifecycle -------------------------------------------------------

  async function openPanel(trigger, { viaKeyboard }) {
    if (opening) return opening;
    opening = (async () => {
      let snapshot = null;
      try {
        snapshot = await request("snapshot");
      } catch (error) {
        console.debug("[Modelcade] bridge unavailable", error);
      }
      if (snapshot?.ok && snapshot.disabled) {
        // ChatGPT locks the picker while it is answering; so does Modelcade.
        ns.audio.unlock();
        ns.audio.play("deny");
        return;
      }
      const vm = ns.catalog.toViewModel(snapshot);
      if (!ns.catalog.isUseful(vm) || !trigger.isConnected) {
        if (trigger.isConnected) openNativeMenu(trigger);
        return;
      }
      ns.audio.unlock();
      ns.audio.play("open");
      panel = ns.createPanel({ onIntent: handleIntent, audio: ns.audio, getOptions: panelOptions });
      panel.mount(document.body);
      document.documentElement.classList.add("mc-picker-open");
      session = { trigger, vm, queue: Promise.resolve(), seq: { stop: 0, model: 0, tier: 0 }, pending: 0, lastIntent: 0 };
      panel.render(vm);
      place();
      watchSession();
      if (viaKeyboard) panel.focus();
    })().finally(() => {
      opening = null;
    });
    return opening;
  }

  function closePanel(reason = "system", { refocus = false } = {}) {
    if (!panel) return;
    const closing = panel;
    const trigger = session?.trigger;
    unwatchSession();
    document.documentElement.classList.remove("mc-picker-open");
    panel = null;
    session = null;
    if (reason !== "system") ns.audio.play("close");
    closing.destroy({ animate: reason !== "disabled" });
    if (refocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
  }

  const panelOptions = () => ({ effects: prefs.effects, reducedMotion: reducedMotion() });

  function render(vm) {
    if (!panel || !session) return;
    session.vm = vm;
    panel.render(vm);
  }

  async function refresh() {
    if (!session) return null;
    try {
      const snapshot = await request("snapshot");
      const vm = ns.catalog.toViewModel(snapshot, session?.vm);
      if (!vm) {
        closePanel("system");
        return null;
      }
      render(vm);
      return vm;
    } catch (_) {
      return null;
    }
  }

  // ----- Intents ---------------------------------------------------------------

  // Commands run one at a time in order; a newer intent of the same kind
  // supersedes one that has not started yet (latest wins while dragging fast).
  function enqueue(kind, run) {
    if (!session) return;
    const ticket = (session.seq[kind] += 1);
    const current = session;
    current.pending += 1;
    const superseded = () => session !== current || current.seq[kind] !== ticket;
    const result = current.queue.then(async () => {
      if (superseded()) return null;
      panel?.setBusy(true);
      try {
        const snapshot = await run();
        // A newer intent of the same kind is queued: showing this confirmation
        // would pull the puck back to a stop the user has already left.
        if (superseded()) return null;
        const vm = ns.catalog.toViewModel(snapshot, current.vm);
        if (vm) render(vm);
        return vm;
      } catch (error) {
        console.debug("[Modelcade]", error);
        if (superseded()) return null;
        ns.audio.play("deny");
        await refresh();
        panel?.flashError();
        return null;
      } finally {
        current.pending -= 1;
        if (session === current && current.pending === 0) panel?.setBusy(false);
      }
    });
    current.queue = result.catch(() => null);
    return result;
  }

  function handleIntent(intent) {
    if (!session) return;
    session.lastIntent = performance.now();
    const vm = session.vm;
    if (intent.type === "close") {
      closePanel("panel", { refocus: true });
      return;
    }
    if (intent.type === "stop") {
      const stop = vm.stops[intent.index];
      if (!stop) return;
      session.vm = { ...vm, stopIndex: intent.index };
      enqueue("stop", () => request("selectStop", { id: stop.id, label: stop.label }))?.then((confirmed) => {
        const landed = confirmed?.stops[confirmed.stopIndex];
        if (!panel || !landed || landed.label !== stop.label) return;
        celebrate(landed.special);
      });
      return;
    }
    if (intent.type === "model") {
      const model = vm.models.find((candidate) => candidate.id === intent.id);
      if (!model) return;
      session.vm = { ...vm, modelIndex: vm.models.indexOf(model) };
      enqueue("model", () => request("selectModel", { id: model.id }));
      return;
    }
    if (intent.type === "tier") {
      const tier = vm.tiers[intent.index];
      if (!tier) return;
      session.vm = { ...vm, tierIndex: intent.index };
      enqueue("tier", () => request("selectTier", { value: tier.value }));
    }
  }

  function celebrate(special) {
    if (!panel) return;
    if (special === "ultra") {
      const payoff = ns.audio.play("ultra");
      if (!prefs.effects) return;
      const target = panel;
      setTimeout(() => target === panel && panel.celebrate("ultra"), payoff || 0);
    } else if ((special === "max" || special === "pro") && prefs.effects) {
      panel.celebrate(special);
    }
  }

  // ----- Placement -------------------------------------------------------------

  function findComposer(trigger) {
    let best = null;
    for (let node = trigger.parentElement; node && node !== document.body; node = node.parentElement) {
      const rect = node.getBoundingClientRect();
      if (rect.width < 320 || rect.height < 40 || rect.width > window.innerWidth - 8) continue;
      const radius = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;
      const hasInput = Boolean(node.querySelector('textarea, [contenteditable="true"], [role="textbox"]'));
      if (hasInput && radius >= 8) return { element: node, rect, radius };
      if (hasInput && !best) best = { element: node, rect, radius };
    }
    return best;
  }

  function place() {
    if (!panel || !session) return;
    const trigger = session.trigger;
    if (!trigger.isConnected || !isVisible(trigger)) {
      closePanel("system");
      return;
    }
    const composer = findComposer(trigger) || { rect: trigger.getBoundingClientRect(), radius: 20 };
    const rect = composer.rect;
    const margin = 12;
    const gap = 8;
    const width = Math.round(Math.min(window.innerWidth - margin * 2, Math.max(300, Math.min(380, rect.width * 0.46))));
    const height = panel.element.offsetHeight || 140;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const direction = spaceBelow >= height + gap || spaceBelow >= spaceAbove ? "down" : "up";
    const left = Math.max(margin, Math.min(window.innerWidth - margin - width, rect.right - width));
    const top = direction === "down"
      ? Math.min(rect.bottom + gap, window.innerHeight - margin - height)
      : Math.max(margin, rect.top - gap - height);
    panel.place({ left: Math.round(left), top: Math.round(top), width, radius: Math.min(composer.radius || 20, 28), direction });
  }

  let placeFrame = 0;
  const schedulePlace = () => {
    if (placeFrame) return;
    placeFrame = requestAnimationFrame(() => {
      placeFrame = 0;
      place();
    });
  };

  function watchSession() {
    if (!session) return;
    const current = session;
    // ChatGPT may change the selection itself (shortcuts, other tabs, defaults).
    let refreshTimer = 0;
    current.observer = new MutationObserver(() => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        // Our own commands change the trigger too; only external changes
        // (another tab, a shortcut, ChatGPT itself) need a refresh.
        if (session === current && current.pending === 0 && performance.now() - current.lastIntent > 500) refresh();
      }, 60);
    });
    current.observer.observe(current.trigger, { attributes: true, subtree: true, characterData: true, childList: true });
    current.poll = setInterval(() => {
      if (session !== current) return;
      if (!current.trigger.isConnected || !isVisible(current.trigger) || findTrigger() !== current.trigger) closePanel("system");
      else schedulePlace();
    }, 400);
    current.resize = new ResizeObserver(schedulePlace);
    current.resize.observe(panel.element);
  }

  function unwatchSession() {
    if (!session) return;
    session.observer?.disconnect();
    session.resize?.disconnect();
    clearInterval(session.poll);
  }

  document.addEventListener("pointerdown", (event) => {
    if (!panel || passthrough) return;
    if (panel.element.contains(event.target) || session?.trigger.contains(event.target)) return;
    closePanel("outside");
  }, true);
  window.addEventListener("resize", schedulePlace);
  window.addEventListener("scroll", schedulePlace, true);
  window.addEventListener("pagehide", () => closePanel("system"));

  // ----- Preferences -----------------------------------------------------------

  function applyPrefs(next) {
    prefs = next;
    prefsLoaded = true;
    ns.audio.configure({ sounds: prefs.sounds, volume: prefs.volume, jackpot: prefs.jackpot });
    if (!prefs.enabled) closePanel("disabled");
  }

  ns.prefs.load().then(applyPrefs).catch(() => applyPrefs({ ...ns.prefs.DEFAULTS }));
  ns.prefs.subscribe(applyPrefs);
})();
