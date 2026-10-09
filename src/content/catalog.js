// Turns the bridge's raw snapshot of ChatGPT's picker into the view model the
// panel renders. Nothing here is hardcoded to a model list: names, stops, and
// speed tiers come from whatever ChatGPT currently offers this account.
(() => {
  const ns = globalThis.Modelcade;

  const SHORT_EFFORTS = {
    none: "Instant",
    minimal: "Min",
    low: "Light",
    medium: "Med",
    high: "High",
    xhigh: "X-High",
    max: "Max",
    ultra: "Ultra",
    persistent: "Persist"
  };
  const SHORT_LABELS = { "Extra High": "X-High", Medium: "Med", Minimal: "Min", Persistent: "Persist" };
  const FAMILIES = ["sol", "terra", "luna", "astra"];

  // "GPT-6.1 Sol", "6.1 Sol", "GPT-6", "5.6", "GPT-6 Astra", "Default" …
  function parseModelLabel(label) {
    const text = String(label || "").trim();
    const match = text.match(/^(?:GPT[-\s]?)?(\d+(?:\.\d+)?)(?:\s+(.+))?$/i);
    const version = match ? match[1] : null;
    const variant = match ? (match[2] || "").trim() : text;
    const lower = variant.toLowerCase();
    const family = FAMILIES.find((name) => lower === name || lower.startsWith(`${name} `)) || (version ? "prime" : "unknown");
    const name = family === "prime" ? `GPT-${version}` : variant || text;
    return { version, family, name: name || text };
  }

  function effortKey(stop) {
    const effort = String(stop.effort || "").toLowerCase();
    if (/pro/i.test(stop.label) || /(^|-)pro($|-|:)/i.test(stop.model || "")) return "pro";
    if (effort === "none" || /instant/i.test(stop.label) || /instant/i.test(stop.model || "")) return "instant";
    return effort || String(stop.label || "").toLowerCase();
  }

  const SPECIAL = new Set(["instant", "max", "ultra", "pro", "persistent"]);

  function toViewModel(snapshot, previous = null) {
    if (!snapshot?.ok) return null;
    const models = [];
    if (snapshot.defaultModel) {
      models.push({
        id: "default",
        label: "Default",
        name: "Default",
        version: null,
        family: "auto",
        sub: "Recommended set",
        selected: Boolean(snapshot.defaultModel.selected),
        isDefault: true
      });
    }
    for (const option of snapshot.models || []) {
      if (option.disabled) continue;
      const parsed = parseModelLabel(option.label);
      models.push({
        id: option.id,
        label: option.label,
        name: parsed.name,
        version: parsed.version,
        family: parsed.family,
        sub: option.sub || "",
        selected: Boolean(option.selected),
        isDefault: false
      });
    }

    const rawStops = snapshot.stops || [];
    const stops = rawStops.map((stop, index) => {
      const parsed = parseModelLabel(stop.modelLabel);
      const key = effortKey(stop);
      const previousModel = index > 0 ? rawStops[index - 1].modelLabel : stop.modelLabel;
      return {
        id: stop.id,
        index,
        effort: key,
        label: stop.label || SHORT_EFFORTS[key] || key,
        short: SHORT_LABELS[stop.label] || SHORT_EFFORTS[key] || stop.label || key,
        modelLabel: stop.modelLabel || "",
        modelName: parsed.name,
        modelVersion: parsed.version,
        family: key === "pro" ? "astra" : key === "instant" ? "instant" : parsed.family,
        special: SPECIAL.has(key) ? key : null,
        isMaximum: Boolean(stop.isMaximum),
        modelChanges: index > 0 && previousModel !== stop.modelLabel
      };
    });

    const tiers = (snapshot.tiers || []).map((tier) => ({
      value: tier.value ?? null,
      label: tier.label || (tier.value ? String(tier.value) : "Standard"),
      icon: tier.icon || null,
      multiplier: tier.multiplier ?? null
    }));

    const stopIndex = Math.max(0, stops.findIndex((stop) => stop.id === snapshot.selectedStopId));
    const modelIndex = Math.max(0, models.findIndex((model) => model.selected));
    const tierIndex = Math.max(0, tiers.findIndex((tier) => tier.value === (snapshot.selectedTier ?? null)));

    return {
      surface: snapshot.surface || (rawStops.some((stop) => /-wm(?::|$)/.test(stop.id || "")) ? "work" : "chat"),
      theme: snapshot.theme === "dark" ? "dark" : "light",
      models,
      modelIndex,
      modelLocked: Boolean(snapshot.modelSelectionDisabled) || models.length < 2,
      stops,
      stopIndex,
      stopsLocked: Boolean(snapshot.powerSelectionDisabled),
      tiers,
      tierIndex,
      hasSpeed: tiers.length > 1,
      busy: previous?.busy || false,
      error: null
    };
  }

  // A picker is worth replacing only when it offers a real choice.
  function isUseful(viewModel) {
    if (!viewModel) return false;
    return viewModel.stops.length > 1 || viewModel.models.length > 1 || viewModel.hasSpeed;
  }

  ns.catalog = { toViewModel, isUseful, parseModelLabel };
})();
