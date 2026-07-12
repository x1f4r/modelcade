# Modelcade 1.4.10 release QA

## Capability contract

- Chat and Work choices are rebuilt from ChatGPT's enabled native menu items on every open. A visible subscription label is never treated as an entitlement source.
- Full and compact Work remove Ultra when ChatGPT's General switch is off or native Sol cannot confirm the Ultra option.
- Unknown, restricted, one-choice, and logged-out surfaces use ChatGPT's native fallback instead of rendering unavailable choices.
- Ultra entry is verified in the order Sol → High → Ultra. Exiting through a visible compact stop applies that stop; pulling the lever off restores the remembered model at High. Fast/Standard is preserved and reverified.
- The Ultra setting mirror uses an obfuscated local account/workspace scope key derived from available interface metadata. Original account, plan, route, and workspace values are not stored.

## Interaction checks

- Control-Shift-M opens and closes Modelcade without exposing ChatGPT's native picker while Modelcade is enabled. Turning Modelcade off restores the native shortcut and selector.
- Compact Work model scrolling, effort dragging, direct stop selection, Fast toggling, and Ultra entry/exit were exercised against the live ChatGPT surface.
- Full Work model/effort dragging and Ultra were exercised against the live ChatGPT surface.
- Compact and full Chat were exercised from Instant through Pro, including direct jumps across the 5.5-to-Sol corner.
- The white puck and progressive gradient share one path-distance value and remain concentric at every stop.
- The fixed lane never scales or bounces; only the fill and fused puck/cap assembly animate.

## Settings and sound

- Personalization exposes Use Modelcade picker, Compact picker, Sounds, Ultra sound effects, and Slot-machine jackpot.
- Defaults are Sounds on, Ultra sound effects on, and Slot-machine jackpot off.
- Disabling the master stops scheduled audio. Disabling Ultra sound effects falls back to the ordinary effort click.
- Preferences synchronize across open ChatGPT tabs through Chrome local extension storage.

## Release verification

- `node --check content-script.js`
- Manifest V3 parsing and runtime-reference validation
- `git diff --check`
- 16, 32, 48, and 128 pixel icon validation
- Chrome Web Store screenshots validated as true 1280 × 800 PNG files
- Runtime ZIP allowlist inspection and archive test
- Public-tree scan for secrets, identifiers, raw QA captures, and source recordings

Final verified live state before packaging: Modelcade on, compact mode restored, slot-machine jackpot off, no native menu left visible.
