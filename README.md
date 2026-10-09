# Modelcade

A playful arcade picker for ChatGPT's models, reasoning power, and speed. Click ChatGPT's own model control in the composer (or press **Control-Shift-M**) and Modelcade opens in its place. Every choice is applied through ChatGPT's own picker, so what you pick is exactly what ChatGPT saves.

<p align="center">
  <img src="assets/brand/modelcade-mark.svg" width="112" alt="Modelcade logo">
</p>

Modelcade is an independent project and is not affiliated with or endorsed by OpenAI. ChatGPT is a trademark of OpenAI.

## What's new in 2.0

ChatGPT replaced its model menus with a model list, a per-model **Power** slider, and speed tiers. Modelcade 2.0 is rebuilt around that design:

- **Invisible by construction.** 1.x drove ChatGPT's menus in the background and hid them while it worked. 2.0 reads the picker's state directly and calls the same callbacks ChatGPT's menu uses. The native menu never opens, so nothing flickers, animates, or leaks.
- **Whatever your account has.** Models, power stops, Max, Ultra, Pro, Instant, Fast, and Ultrafast all come from ChatGPT at the moment you open the picker. New models appear without an update, and choices your plan doesn't include never show.
- **Default mode.** Work's recommended mixed set (for example Luna High → 6.1 Sol Light/Medium → Astra Light/Medium) shows each stop in its own model's colors.
- **New sound engine.** Musical detents that rise along the rail and pan with the puck, wooden model clicks, a speed whoosh, a Max power-up, a Pro chime, the Ultra lever and jackpot (arcade or slot machine), all synthesized locally through a small generated room reverb.
- **Settings live in the toolbar popup**: on/off, sounds and volume, celebrations, jackpot style.
- **Leaner privacy.** No account or workspace metadata is read anymore, and the 1.x per-account Ultra mirror is deleted on upgrade.

## Using it

- **Model**: scroll, drag, click, or use Up/Down on the model wheel.
- **Power**: drag the puck, click a stop, or use Left/Right/Home/End. The puck snaps magnetically; it never rests between stops.
- **Speed**: tap the selected puck (or press Enter/Space on the rail) to cycle Standard → Fast → Ultrafast, where your account offers them.
- **Close**: Escape, click outside, or click the composer control again.
- **ChatGPT's own picker**: Alt-click the composer control, or turn Modelcade off in its popup.

When ChatGPT offers fewer than two choices (for example while logged out), the click goes straight to ChatGPT's own menu.

## How it works

```
manifest.json
src/page/bridge.js        ChatGPT's page world: reads picker state, calls its callbacks
src/content/
  namespace.js            shared isolated-world namespace
  catalog.js              native snapshot → view model (models, stops, tiers, families)
  audio.js                Web Audio sound engine
  palette.js              model-family palettes
  panel.js, fx.js         the picker UI and celebrations
  main.js                 trigger interception, hotkey, bridge client, placement
src/shared/prefs.js       settings shared with the popup
src/popup/                toolbar popup
src/styles/panel.css      picker styles (all classes prefixed mc-)
dev/harness.html          fixture-driven UI harness (not shipped)
scripts/check.mjs         release checks
scripts/package.sh        builds the store ZIP from the runtime allowlist
```

The bridge locates ChatGPT's picker component from the composer control and exposes four operations over DOM events: `snapshot`, `selectStop`, `selectModel`, and `selectTier`. Each change is verified against ChatGPT's state and then committed the way ChatGPT's menu commits on close, so it persists across reloads. If ChatGPT restructures its picker so the bridge cannot find it, Modelcade steps aside and ChatGPT's own menu opens instead.

## Palette basis

- **Sol** runs from deep amber through orange and gold to near-white, after the Sun's broad visible output.
- **Terra** gives about 71% of its trail to ocean blues, matching NASA's estimate of Earth's ocean cover, then moves through land and vegetation to cloud and ice.
- **Luna** follows NASA's description of a dark-gray basalt surface with subtle titanium-blue and warm mineral variation, brightening into highland stone.
- **Astra** is stellar: deep indigo through violet to starlight white.

Sources: [NASA Earth facts](https://science.nasa.gov/earth/facts/), [NASA Moonlight](https://science.nasa.gov/moon/moonlight/), [NASA Color of the Moon](https://science.nasa.gov/photojournal/color-of-the-moon/), and [NASA Visible Light](https://science.nasa.gov/ems/09_visiblelight/).

## Privacy

Modelcade runs only on `https://chatgpt.com/*`, makes no network requests, uses no API key, and does not read conversations, cookies, or account details. It stores only its own settings. Read the full [privacy policy](PRIVACY.md).

## Install

1. Open `chrome://extensions` (or your Chromium browser's equivalent).
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this folder.
4. Reload ChatGPT.

`scripts/package.sh` builds the store ZIP containing only the runtime files.

## Development

- `node scripts/check.mjs` checks syntax and manifest references, and runs the catalog against the captured fixtures in `dev/fixtures.js`.
- Open `dev/harness.html` in a browser to work on the panel against those fixtures in light and dark themes, without ChatGPT.
