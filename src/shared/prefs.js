// Preferences shared by the content script and the popup.
(() => {
  const ns = (globalThis.Modelcade = globalThis.Modelcade || {});
  const KEY = "modelcade";
  const LEGACY_KEY = "reasoningPowerPicker";

  const DEFAULTS = Object.freeze({
    enabled: true,
    sounds: true,
    volume: 0.7,
    effects: true,
    jackpot: "arcade" // "arcade" | "slot"
  });

  function sanitize(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      enabled: source.enabled !== false,
      sounds: source.sounds !== false,
      volume: Number.isFinite(source.volume) ? Math.min(1, Math.max(0, source.volume)) : DEFAULTS.volume,
      effects: source.effects !== false,
      jackpot: source.jackpot === "slot" ? "slot" : "arcade"
    };
  }

  // 1.x stored an obfuscated per-account Ultra mirror next to its toggles. 2.0 reads
  // capabilities straight from ChatGPT, so only the toggles carry over and the old
  // record is deleted.
  async function migrate(stored) {
    const legacy = stored[LEGACY_KEY];
    if (!legacy || stored[KEY]) return null;
    const next = sanitize({
      enabled: legacy.pickerEnabled !== false,
      sounds: legacy.soundsEnabled !== false,
      effects: legacy.ultraSoundEnabled !== false,
      jackpot: legacy.slotJackpot ? "slot" : "arcade"
    });
    await chrome.storage.local.set({ [KEY]: next });
    await chrome.storage.local.remove(LEGACY_KEY);
    return next;
  }

  async function load() {
    const stored = await chrome.storage.local.get([KEY, LEGACY_KEY]);
    return (await migrate(stored)) || sanitize(stored[KEY]);
  }

  async function save(patch) {
    const current = await load();
    const next = sanitize({ ...current, ...patch });
    await chrome.storage.local.set({ [KEY]: next });
    return next;
  }

  function subscribe(listener) {
    const handler = (changes, area) => {
      if (area === "local" && changes[KEY]) listener(sanitize(changes[KEY].newValue));
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }

  ns.prefs = { KEY, DEFAULTS, load, save, subscribe, sanitize };
})();
