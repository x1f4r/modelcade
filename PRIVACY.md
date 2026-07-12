# Modelcade privacy policy

Last updated: July 12, 2026

Modelcade is an independent browser extension that changes how ChatGPT's existing model and reasoning controls are presented. It runs locally in the browser and delegates selections to controls already provided by ChatGPT. Modelcade is not affiliated with or endorsed by OpenAI.

## Data Modelcade processes

Modelcade processes the minimum ChatGPT interface information needed to find and operate the native model, effort, Ultra, speed, and extension-settings controls. This includes the labels and availability states of those controls. To keep the Ultra preference separated between signed-in accounts and workspaces, it derives an obfuscated local scope key from available account identifier or profile-descriptor, plan, route, and workspace-label interface metadata. The original values are not stored or transmitted by Modelcade.

Modelcade does not intentionally read, store, or transmit chat messages, prompts, responses, uploaded files, cookies, passwords, payment information, or API keys.

## Data Modelcade stores

Modelcade uses Chrome's local extension storage for interface preferences and the minimum state needed to keep the picker consistent. Stored values may include:

- whether Modelcade is enabled;
- whether compact mode is enabled;
- sound and Ultra-sound preferences;
- whether the optional slot-machine jackpot is enabled;
- the last Standard/Fast state;
- the remembered base effort and model used around Ultra mode; and
- a boolean mirror of the native Ultra setting, keyed by the locally derived account/workspace scope key.

This information stays on the user's device. Modelcade has no analytics, advertising, telemetry, remote code, or extension-operated server, and it does not sell or share data.

## Permissions

- `storage` stores the local preferences described above.
- Access to `https://chatgpt.com/*` lets the content script render the picker and delegate choices to ChatGPT's existing controls. Modelcade does not run on other websites.

## Retention and deletion

Preferences remain in Chrome's extension storage until they are overwritten, Chrome removes them, or the extension is uninstalled. Uninstalling Modelcade deletes its extension storage. Users can also disable the custom picker at any time in ChatGPT under **Personalization → Modelcade → Use Modelcade picker**.

## Security and changes

Modelcade minimizes data by keeping all processing local and requesting only the permissions needed for its single purpose. Material changes to this policy will be documented in this file and dated above.

Modelcade complies with the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data/), including its Limited Use requirements. Data processed by Modelcade is used only to provide and maintain the user-facing picker. It is not used for advertising, creditworthiness, lending, sale, or transfer to third parties, and it is not made available for humans to read except when required for security, legal compliance, or user-requested support.

## Contact

Questions about this policy can be opened in the Modelcade GitHub repository: <https://github.com/x1f4r/modelcade/issues>.
