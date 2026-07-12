# Chrome Web Store listing

## Product details

**Name:** Modelcade

**Summary:** A playful, capability-aware model and reasoning picker that delegates every choice to ChatGPT's native controls.

**Category:** Productivity

**Language:** English

## Detailed description

Modelcade turns ChatGPT's model and reasoning controls into a fast magnetic picker without creating a separate ChatGPT client or using an API key.

Local data use: to provide capability-aware choices and keep Ultra preferences separate by account/workspace, Modelcade reads the relevant ChatGPT control labels and availability plus available account identifier or profile-descriptor, plan, route, and workspace-label interface metadata. Raw values stay on the device and are not stored or transmitted by Modelcade.

Open the picker from ChatGPT's unchanged composer control. Drag the white selector between valid reasoning levels, move between the models actually available to your account, or switch to the compact one-lane layout. In ChatGPT Work, clicking an already selected effort toggles the native Standard/Fast state. Ultra gets a deliberately excessive lever, particles, and optional synthesized sound effects.

Modelcade supports both Chat and Work:

- capability-aware choices based on ChatGPT's currently enabled native options;
- compact and full layouts;
- immediate magnetic snapping with keyboard support;
- Sol, Terra, and Luna model palettes in Work;
- Instant through Pro in Chat;
- Standard/Fast control where ChatGPT exposes it;
- account-aware Ultra availability;
- master sound, Ultra sound, and optional slot-jackpot controls; and
- a one-click fallback to ChatGPT's original selector.

Every selection is delegated to ChatGPT's own interface and then verified. Modelcade uses no OpenAI API key, has no analytics or remote code, and sends no data to an extension-operated server.

Modelcade is an independent project and is not affiliated with or endorsed by OpenAI. ChatGPT is a trademark of OpenAI.

## Single purpose

Present and operate ChatGPT's existing model, reasoning-effort, Ultra, and speed choices through a more expressive local interface.

## Permission justifications

**storage** — Persists local picker layout, sound preferences, Standard/Fast state, and the minimum remembered state needed around Ultra mode.

**Host access to `https://chatgpt.com/*`** — Renders the picker on ChatGPT and reads/operates the native model, effort, Ultra, speed, and extension-settings controls required to apply and verify the user's selection. It also reads available account identifier or profile-descriptor, plan, route, and workspace-label interface metadata solely to derive an obfuscated on-device scope key for the Ultra preference. The source values are not stored or transmitted by Modelcade.

**Remote code:** None.

## Privacy dashboard disclosure notes

- Website content: yes. Modelcade reads the labels, enabled states, and structure of the relevant ChatGPT controls.
- Personally identifiable information: declare if the dashboard classifies the locally processed account identifier or profile descriptor in this category.
- Web browsing activity: declare if the dashboard classifies the active ChatGPT route or workspace route in this category.
- All processing is local. Modelcade has no analytics, advertising, telemetry, extension-operated server, or data sale/sharing.
- Certify that usage complies with the Chrome Web Store User Data Policy, including Limited Use requirements.

## Reviewer instructions

1. Sign in to a ChatGPT account that exposes at least two native model or effort choices. Logged-out and one-choice surfaces intentionally use ChatGPT's native fallback.
2. Open ChatGPT Chat or Work and click the unchanged model/effort control in the composer, or press Control-Shift-M.
3. Select any available Modelcade stop and verify that ChatGPT's composer label updates to the same native model/effort.
4. In Work, click the already-selected puck to toggle native Standard/Fast where the account exposes Fast.
5. Open ChatGPT Settings → Personalization → Modelcade to switch between compact/full layouts, disable Modelcade, and configure Sounds, Ultra sound effects, or the optional slot-machine jackpot.
6. Work, Fast, Pro-only choices, and Ultra appear only when ChatGPT exposes them to the reviewer account. Ultra also requires ChatGPT's native General → Enable Ultra effort setting.

## URLs

- Homepage: <https://github.com/x1f4r/modelcade>
- Support: <https://github.com/x1f4r/modelcade/issues>
- Privacy policy: <https://github.com/x1f4r/modelcade/blob/main/PRIVACY.md>

## Distribution

Public, all supported regions, no paid features.
