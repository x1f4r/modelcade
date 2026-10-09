// Standalone harness: fake composer, fixture switcher, simulated bridge.
(() => {
  const ns = globalThis.Modelcade;
  const fixtures = window.MODELCADE_FIXTURES;
  const $ = (id) => document.getElementById(id);
  const log = $("log");
  const logs = [];
  const note = (text) => {
    logs.unshift(text);
    log.textContent = logs.slice(0, 3).join("   ·   ");
  };

  if (!ns.audio) {
    ns.audio = {
      play: (name, opts) => note(`♪ ${name}${opts ? " " + JSON.stringify(opts) : ""}`),
      unlock: () => {}
    };
  }

  const fixtureSelect = $("fixture");
  for (const key of Object.keys(fixtures)) fixtureSelect.append(new Option(key, key));

  const params = new URLSearchParams(location.search);
  let snapshot = null;
  let panel = null;
  let vm = null;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function applyTheme() {
    const theme = $("theme").value;
    document.documentElement.dataset.theme = theme;
    if (snapshot) snapshot.theme = theme;
  }

  function placePanel() {
    if (!panel) return;
    // Same geometry as main.js: the panel's own box, right-aligned to the composer.
    const rect = $("composer").getBoundingClientRect();
    const direction = $("direction").value;
    const width = Math.round(Math.max(300, Math.min(380, rect.width * 0.46)));
    const height = panel.element.offsetHeight || 94;
    panel.place({
      left: Math.round(rect.right - width),
      top: Math.round(direction === "up" ? rect.top - 8 - height : rect.bottom + 8),
      width,
      radius: 28,
      direction
    });
    $("page").classList.toggle("at-bottom", direction === "up");
  }

  function syncTrigger() {
    if (!vm) return;
    const stop = vm.stops[vm.stopIndex];
    $("trigger-model").textContent = (vm.tierIndex > 0 ? "⚡ " : "") + (stop?.modelLabel || vm.models[vm.modelIndex]?.label || "");
    $("trigger-effort").textContent = stop?.label || "";
    $("hero").textContent = vm.surface === "work" ? "What should we work on?" : "Where should we begin?";
  }

  function render() {
    vm = ns.catalog.toViewModel(snapshot, vm);
    panel.render(vm);
    syncTrigger();
  }

  function openPanel() {
    panel?.destroy({ animate: false });
    panel = ns.createPanel({
      onIntent: handleIntent,
      audio: ns.audio,
      getOptions: () => ({ effects: $("effects").checked, reducedMotion: $("reduced").checked })
    });
    window.panel = panel;
    render();
    placePanel();
    panel.mount();
  }

  function loadFixture(key) {
    snapshot = clone(fixtures[key]);
    // ?stop=<index>&tier=<index> preselect a state for screenshots.
    if (params.has("stop") && snapshot.stops[Number(params.get("stop"))]) snapshot.selectedStopId = snapshot.stops[Number(params.get("stop"))].id;
    if (params.has("tier") && snapshot.tiers[Number(params.get("tier"))]) snapshot.selectedTier = snapshot.tiers[Number(params.get("tier"))].value;
    $("theme").value = snapshot.theme || "light";
    applyTheme();
    openPanel();
  }

  // Derive a plausible stop list for a model the fixture has no stops for.
  function stopsFor(modelOption) {
    if (!modelOption) return snapshot.stops;
    if (modelOption.id === "default") return clone(fixtures.workDefault.stops);
    const base = clone(fixtures.workPlus.stops);
    const slug = `gpt-${modelOption.id.toLowerCase().replace(/\s+/g, "-")}-wm`;
    for (const stop of base) {
      stop.id = `${slug}:${stop.id.split(":")[1]}`;
      stop.model = slug;
      stop.modelLabel = modelOption.label;
    }
    if (snapshot.tiers?.length > 2) {
      base.push({ id: `${slug}:ultra`, model: slug, modelLabel: modelOption.label, effort: "ultra", label: "Ultra", isMaximum: true, index: base.length });
    }
    return base;
  }

  function handleIntent(intent) {
    note(`→ ${JSON.stringify(intent)}`);
    if (intent.type === "close") { panel.destroy({ animate: true }); return; }
    const before = clone(snapshot);
    panel.setBusy(true);
    setTimeout(() => {
      panel.setBusy(false);
      if ($("fail").checked) {
        snapshot = before;
        render();
        panel.flashError();
        ns.audio.play("deny");
        return;
      }
      if (intent.type === "stop") {
        const stop = snapshot.stops[intent.index];
        if (stop) snapshot.selectedStopId = stop.id;
        if (stop?.effort === "ultra") setTimeout(() => { ns.audio.play("ultra"); panel.celebrate("ultra"); }, 80);
        else if (stop?.effort === "max") panel.celebrate("max");
        else if (/pro/i.test(stop?.label || "")) panel.celebrate("pro");
      } else if (intent.type === "model") {
        if (snapshot.defaultModel) snapshot.defaultModel.selected = intent.id === "default";
        for (const model of snapshot.models) model.selected = model.id === intent.id;
        const chosen = intent.id === "default" ? { id: "default" } : snapshot.models.find((m) => m.id === intent.id);
        if (snapshot.surface === "work") {
          const effort = snapshot.selectedStopId.split(":")[1];
          snapshot.stops = stopsFor(chosen);
          const same = snapshot.stops.find((s) => s.id.endsWith(`:${effort}`));
          snapshot.selectedStopId = (same || snapshot.stops[Math.min(1, snapshot.stops.length - 1)]).id;
        }
      } else if (intent.type === "tier") {
        snapshot.selectedTier = snapshot.tiers[intent.index]?.value ?? null;
      }
      render();
    }, 120);
  }

  fixtureSelect.addEventListener("change", () => loadFixture(fixtureSelect.value));
  $("theme").addEventListener("change", () => { applyTheme(); render(); });
  $("direction").addEventListener("change", placePanel);
  $("celebrate").addEventListener("click", () => { ns.audio.play("ultra"); panel.celebrate("ultra"); });
  $("celebrate-max").addEventListener("click", () => panel.celebrate("max"));
  $("celebrate-pro").addEventListener("click", () => panel.celebrate("pro"));
  $("reopen").addEventListener("click", openPanel);
  $("trigger").addEventListener("click", openPanel);
  window.addEventListener("resize", placePanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel) panel.destroy({ animate: true });
  });

  const initial = params.get("fixture") && fixtures[params.get("fixture")] ? params.get("fixture") : "workPlus";
  fixtureSelect.value = initial;
  if (params.get("direction") === "up") $("direction").value = "up";
  loadFixture(initial);
  if (params.get("theme")) { $("theme").value = params.get("theme"); applyTheme(); render(); }
})();
