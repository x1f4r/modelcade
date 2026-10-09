// Settings popup. Reads and writes Modelcade.prefs; previews sounds through
// Modelcade.audio when it is available.
(() => {
  const ns = globalThis.Modelcade;
  const prefs = ns.prefs;
  const audio = ns.audio || null;
  const $ = (id) => document.getElementById(id);

  const app = $("app");
  const toggles = [...document.querySelectorAll("input[data-pref]")];
  const volume = $("volume");
  const seg = document.querySelector(".pp-seg");
  const segOptions = [...seg.querySelectorAll(".pp-seg__opt")];
  const preview = $("preview");
  let current = { ...prefs.DEFAULTS };
  let previewTimer = 0;

  function reflect(next) {
    current = next;
    for (const input of toggles) input.checked = Boolean(next[input.dataset.pref]);
    volume.value = String(next.volume);
    volume.style.setProperty("--pp-v", `${Math.round(next.volume * 100)}%`);
    seg.dataset.value = next.jackpot;
    for (const option of segOptions) option.setAttribute("aria-checked", option.dataset.jackpot === next.jackpot ? "true" : "false");
    app.dataset.enabled = String(next.enabled);
    app.dataset.sounds = String(next.sounds);
    app.dataset.effects = String(next.effects);
    audio?.configure?.({ sounds: next.sounds, volume: next.volume, jackpot: next.jackpot });
  }

  // Outside an extension (dev preview) there is no chrome.storage: keep state in memory.
  const hasStorage = typeof chrome !== "undefined" && Boolean(chrome.storage?.local);

  async function update(patch) {
    if (!hasStorage) { reflect(prefs.sanitize({ ...current, ...patch })); return; }
    reflect(await prefs.save(patch));
  }

  const play = (name, opts) => { try { audio?.unlock?.(); audio?.play?.(name, opts); } catch (_) { /* optional */ } };

  for (const input of toggles) {
    input.addEventListener("change", async () => {
      const key = input.dataset.pref;
      await update({ [key]: input.checked });
      if (key === "sounds" && input.checked) play("detent", { index: 3, count: 5 });
      if (key === "enabled") play(input.checked ? "open" : "close");
      if (key === "effects") play(input.checked ? "speed" : "detent", { level: 1, count: 2, index: 1, count: 5 });
    });
  }

  let volumeTimer = 0;
  volume.addEventListener("input", () => {
    const value = Number(volume.value);
    volume.style.setProperty("--pp-v", `${Math.round(value * 100)}%`);
    audio?.configure?.({ volume: value });
    clearTimeout(volumeTimer);
    volumeTimer = setTimeout(() => play("detent", { index: Math.round(value * 4), count: 5 }), 80);
  });
  volume.addEventListener("change", () => update({ volume: Number(volume.value) }));

  for (const option of segOptions) {
    option.addEventListener("click", async () => {
      if (option.dataset.jackpot === current.jackpot) return;
      await update({ jackpot: option.dataset.jackpot });
      play("model", { index: option.dataset.jackpot === "slot" ? 1 : 0, count: 2 });
    });
  }

  preview.addEventListener("click", () => {
    if (!audio) return;
    audio.unlock?.();
    audio.configure?.({ sounds: true, volume: current.volume, jackpot: current.jackpot });
    const payoff = audio.play("ultra", { style: current.jackpot }) || 900;
    preview.classList.add("is-playing");
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => preview.classList.remove("is-playing"), payoff + 600);
  });

  if (hasStorage) {
    prefs.load().then(reflect);
    prefs.subscribe(reflect);
  } else {
    reflect({ ...prefs.DEFAULTS });
  }
})();
