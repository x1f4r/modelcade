# Modelcade 2.0.0 release QA

Verified live on chatgpt.com (Plus account, Helium 0.18 / Chromium 155) with real pointer and keyboard input, plus the fixture harness for Pro-only states.

## Bridge

- Clicks, Enter/Space and Control-Shift-M on the composer control open Modelcade; ChatGPT's own menu never mounts (0 native menus across every run). Alt-click opens ChatGPT's own menu.
- Work: all 8 models plus Default mode, Light → Max (GPT-5.5 Light → Extra High), Standard/Fast. Chat: GPT-6, GPT-5.6 Sol, GPT-5.5 with Instant / Medium / High.
- Every change is verified against ChatGPT's state, committed like ChatGPT's menu commits on close, and confirmed stable before success is reported. Effort, model, Default mode and speed persist across reloads.
- ChatGPT occasionally ignores a model call right after a commit; the bridge retries an unconfirmed call (up to 4 times).
- A stop chosen while a model switch is still applying follows its label to the new model's stops.
- Matches native behavior: on reload ChatGPT upgrades GPT-6 Sol to GPT-6.1 Sol (same with ChatGPT's own menu).

## Interaction

- Rapid input lands on the last choice: Left/Right jitter at 40 ms, End/Home bursts, fast full-rail drags, and 6-step drum bursts.
- Superseded confirmations are not rendered and the trigger observer pauses while commands are in flight, so the puck never snaps back to a stop the user has left.
- The panel opens below the composer on new chats and above it in conversations; ChatGPT's hover tooltip is hidden while it is open.
- Focus rings show for keyboard use only. The Fast bolt is crisp when Fast is on; the faint bolt is only a hover hint while Standard.
- Popup: turning Modelcade off hands clicks straight to ChatGPT's own menu; turning it on restores the picker.

## Sound

Every instrument renders without errors or aliasing (offline render, Chrome). Peaks at volume 0.7: detents and model clicks about −30 dBFS, speed −27, Max −18, Pro −16, Ultra lever −10, jackpots −11 to −12.

## Not verifiable on this account

Ultra, Ultrafast, Chat Extra High and Pro need a Pro plan. They are covered by fixtures (dev/fixtures.js) in the harness and follow the same bridge path as the verified stops and tiers.

## Release checks

- `node scripts/check.mjs`: syntax, manifest and popup references, catalog against all fixtures
- `scripts/package.sh`: runtime-only ZIP, archive test
