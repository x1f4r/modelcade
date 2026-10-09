// Runs in ChatGPT's own JavaScript world. It reads the state of ChatGPT's model
// picker component and calls the same callbacks the native menu uses, so a
// choice is applied without opening, animating, or hiding the native menu.
//
// The isolated content script talks to it over DOM CustomEvents carrying JSON
// strings. The bridge never touches conversation content, cookies, or the network.
(() => {
  "use strict";
  if (window.__modelcadeBridge) return;
  window.__modelcadeBridge = true;

  const VERSION = 2;
  const TRIGGER_SELECTOR = 'button[data-codex-intelligence-trigger="true"], form button[aria-label="Select ChatGPT model"]';

  const findTrigger = () => {
    for (const candidate of document.querySelectorAll(TRIGGER_SELECTOR)) {
      const rect = candidate.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return candidate;
    }
    return null;
  };

  const fiberOf = (element) => {
    const key = element && Object.keys(element).find((name) => name.startsWith("__reactFiber$"));
    return key ? element[key] : null;
  };

  const isOwnerProps = (props) => Boolean(
    props
    && Array.isArray(props.powerSelections)
    && typeof props.onSelectPower === "function"
    && props.modelListConfig
  );

  // Props are read fresh on every call: React replaces them on each render and
  // the callbacks close over the latest picker state.
  function findOwner() {
    const trigger = findTrigger();
    let fiber = fiberOf(trigger);
    for (let depth = 0; fiber && depth < 80; depth += 1, fiber = fiber.return) {
      if (isOwnerProps(fiber.memoizedProps)) return { trigger, props: fiber.memoizedProps };
    }
    return { trigger, props: null };
  }

  const textOf = (node) => {
    if (node == null || node === false) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(textOf).join("");
    if (typeof node === "object") {
      if (typeof node.defaultMessage === "string") return node.defaultMessage;
      if (node.props) return textOf(node.props.children);
    }
    return "";
  };

  function surfaceOf(props) {
    if (props.powerSelections.some((stop) => /-wm(?::|$)/.test(String(stop.id || stop.model || "")))) return "work";
    const pressed = [...document.querySelectorAll("button[aria-pressed='true']")]
      .map((button) => button.textContent.trim().toLowerCase())
      .find((text) => text === "chat" || text === "work");
    return pressed || "chat";
  }

  function snapshot() {
    const { trigger, props } = findOwner();
    if (!trigger) return { ok: false, reason: "no-trigger", version: VERSION };
    if (!props) return { ok: false, reason: "no-owner", version: VERSION };
    const config = props.modelListConfig || {};
    const theme = document.documentElement.dataset.theme
      || (document.documentElement.classList.contains("dark") ? "dark" : "light");
    return {
      ok: true,
      version: VERSION,
      surface: surfaceOf(props),
      theme,
      open: Boolean(props.open),
      disabled: Boolean(props.disabled),
      explicit: Boolean(props.isExplicitModelSelection),
      modelSelectionDisabled: Boolean(props.modelSelectionDisabled),
      powerSelectionDisabled: Boolean(props.powerSelectionDisabled),
      defaultModel: config.defaultOption && typeof config.defaultOption.onSelect === "function"
        ? { selected: Boolean(config.defaultOption.selected) }
        : null,
      models: (config.options || []).map((option) => ({
        id: String(option.id),
        label: textOf(option.label),
        sub: textOf(option.subText),
        selected: Boolean(option.selected),
        disabled: Boolean(option.disabled) || typeof option.onSelect !== "function"
      })),
      stops: props.powerSelections.map((stop, index) => ({
        id: String(stop.id),
        model: String(stop.model || ""),
        modelLabel: textOf(stop.modelLabel),
        effort: String(stop.reasoningEffort || ""),
        label: textOf(stop.sliderLabel) || textOf(stop.labels?.effort),
        isMaximum: Boolean(stop.isMaximum),
        index: Number.isFinite(stop.powerSettingIndex) ? stop.powerSettingIndex : index
      })),
      selectedStopId: props.selectedPowerSelection ? String(props.selectedPowerSelection.id) : null,
      tiers: (props.serviceTierOptions || []).map((tier) => ({
        value: tier.value ?? null,
        label: textOf(tier.label),
        description: textOf(tier.description),
        icon: tier.iconKind || null,
        multiplier: tier.speedMultiplier ?? null
      })),
      selectedTier: props.selectedServiceTier ?? null
    };
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function until(test, timeout = 2500) {
    const started = performance.now();
    while (performance.now() - started < timeout) {
      const current = snapshot();
      if (current.ok && test(current)) return current;
      await sleep(25);
    }
    throw new Error("ChatGPT did not confirm the change in time.");
  }

  // The native menu persists a choice when it closes: onOpenChange(false) saves
  // the pending selection as the composer's default. Mirror that after every
  // change so a reload keeps what the user picked. Closing an already-closed
  // menu is otherwise a no-op.
  async function commit(verify) {
    await sleep(0);
    const { props } = findOwner();
    if (props && !props.open && typeof props.onOpenChange === "function") props.onOpenChange(false);
    // The save settles asynchronously; report success only once the choice has
    // held for a few polls, so a following change cannot race it.
    const started = performance.now();
    let steady = 0;
    while (performance.now() - started < 1500) {
      await sleep(25);
      const current = snapshot();
      steady = current.ok && verify(current) ? steady + 1 : 0;
      if (steady >= 4) return current;
    }
    throw new Error("ChatGPT did not keep the change.");
  }

  // Calls a picker callback with fresh props and waits for ChatGPT to reflect
  // it. Right after a commit ChatGPT occasionally drops the next model call, so
  // an unconfirmed call is retried before giving up.
  async function apply(invoke, verify) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { props } = findOwner();
      if (!props) throw new Error("Picker unavailable.");
      invoke(props);
      try {
        await until(verify, 350);
      } catch (_) {
        continue;
      }
      return commit(verify);
    }
    throw new Error("ChatGPT did not accept the change.");
  }

  const ops = {
    snapshot: async () => snapshot(),

    async selectStop({ id: requestedId, label }) {
      const { props } = findOwner();
      if (!props) throw new Error("Picker unavailable.");
      if (props.powerSelectionDisabled) throw new Error("Power selection is disabled.");
      // A stop chosen while a model switch was still applying names the old
      // model's stop; follow it to the stop with the same label on the new model.
      const byId = props.powerSelections.find((candidate) => String(candidate.id) === requestedId);
      const byLabel = !byId && label
        ? props.powerSelections.find((candidate) => (textOf(candidate.sliderLabel) || textOf(candidate.labels?.effort)) === label)
        : null;
      const match = byId || byLabel;
      if (!match) throw new Error("That stop is no longer offered.");
      const id = String(match.id);
      if (props.selectedPowerSelection && String(props.selectedPowerSelection.id) === id) return snapshot();
      return apply(
        (current) => {
          const stop = current.powerSelections.find((candidate) => String(candidate.id) === id);
          if (!stop) throw new Error("That stop is no longer offered.");
          current.onSelectPower(stop);
        },
        (state) => state.selectedStopId === id
      );
    },

    async selectModel({ id }) {
      const { props } = findOwner();
      if (!props) throw new Error("Picker unavailable.");
      if (props.modelSelectionDisabled) throw new Error("Model selection is disabled.");
      const config = props.modelListConfig || {};
      if (id === "default") {
        if (!config.defaultOption) throw new Error("Default is not offered.");
        if (config.defaultOption.selected) return snapshot();
        return apply(
          (current) => current.modelListConfig.defaultOption.onSelect(),
          (state) => Boolean(state.defaultModel?.selected)
        );
      }
      const option = (config.options || []).find((candidate) => String(candidate.id) === id);
      if (!option || option.disabled) throw new Error("That model is not available.");
      if (option.selected) return snapshot();
      return apply(
        (current) => {
          const fresh = (current.modelListConfig.options || []).find((candidate) => String(candidate.id) === id);
          if (!fresh || fresh.disabled) throw new Error("That model is not available.");
          fresh.onSelect();
        },
        (state) => state.models.some((model) => model.id === id && model.selected)
      );
    },

    async selectTier({ value }) {
      const { props } = findOwner();
      if (!props || typeof props.onSelectServiceTier !== "function") throw new Error("Speed is unavailable.");
      const target = value ?? null;
      if (!(props.serviceTierOptions || []).some((candidate) => (candidate.value ?? null) === target)) throw new Error("That speed is not offered.");
      if ((props.selectedServiceTier ?? null) === target) return snapshot();
      return apply(
        (current) => current.onSelectServiceTier(target),
        (state) => (state.selectedTier ?? null) === target
      );
    }
  };

  document.addEventListener("modelcade:request", async (event) => {
    let message;
    try {
      message = JSON.parse(event.detail);
    } catch (_) {
      return;
    }
    const reply = (payload) => document.dispatchEvent(new CustomEvent("modelcade:response", {
      detail: JSON.stringify({ id: message.id, ...payload })
    }));
    const op = ops[message.op];
    if (!op) {
      reply({ ok: false, error: `Unknown operation ${message.op}` });
      return;
    }
    try {
      reply({ ok: true, result: await op(message.args || {}) });
    } catch (error) {
      reply({ ok: false, error: String(error?.message || error) });
    }
  });

  document.dispatchEvent(new CustomEvent("modelcade:bridge-ready", { detail: String(VERSION) }));
})();
