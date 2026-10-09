// Picker snapshots captured from ChatGPT (Plus) plus synthetic Pro variants.
window.MODELCADE_FIXTURES = {
 "workPlus": {
  "ok": true,
  "version": 2,
  "surface": "work",
  "theme": "light",
  "open": false,
  "disabled": false,
  "explicit": true,
  "modelSelectionDisabled": false,
  "powerSelectionDisabled": false,
  "defaultModel": {
   "selected": false
  },
  "models": [
   {
    "id": "6.1 Sol",
    "label": "GPT-6.1 Sol",
    "sub": "",
    "selected": true,
    "disabled": false
   },
   {
    "id": "6 Astra",
    "label": "GPT-6 Astra",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "6 Sol",
    "label": "GPT-6 Sol",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "6 Luna",
    "label": "GPT-6 Luna",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.6 Sol",
    "label": "GPT-5.6 Sol",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.6 Terra",
    "label": "GPT-5.6 Terra",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.6 Luna",
    "label": "GPT-5.6 Luna",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.5",
    "label": "GPT-5.5",
    "sub": "Leaving on October 14",
    "selected": false,
    "disabled": false
   }
  ],
  "stops": [
   {
    "id": "gpt-6.1-sol-wm:min",
    "model": "gpt-6.1-sol-wm",
    "modelLabel": "GPT-6.1 Sol",
    "effort": "low",
    "label": "Light",
    "isMaximum": false,
    "index": 0
   },
   {
    "id": "gpt-6.1-sol-wm:standard",
    "model": "gpt-6.1-sol-wm",
    "modelLabel": "GPT-6.1 Sol",
    "effort": "medium",
    "label": "Medium",
    "isMaximum": false,
    "index": 1
   },
   {
    "id": "gpt-6.1-sol-wm:extended",
    "model": "gpt-6.1-sol-wm",
    "modelLabel": "GPT-6.1 Sol",
    "effort": "high",
    "label": "High",
    "isMaximum": false,
    "index": 2
   },
   {
    "id": "gpt-6.1-sol-wm:xhigh",
    "model": "gpt-6.1-sol-wm",
    "modelLabel": "GPT-6.1 Sol",
    "effort": "xhigh",
    "label": "Extra High",
    "isMaximum": false,
    "index": 3
   },
   {
    "id": "gpt-6.1-sol-wm:max",
    "model": "gpt-6.1-sol-wm",
    "modelLabel": "GPT-6.1 Sol",
    "effort": "max",
    "label": "Max",
    "isMaximum": false,
    "index": 4
   }
  ],
  "selectedStopId": "gpt-6.1-sol-wm:standard",
  "tiers": [
   {
    "value": null,
    "label": "Standard",
    "description": "Default speed",
    "icon": null,
    "multiplier": null
   },
   {
    "value": "fast",
    "label": "Fast",
    "description": "1.5x speed, increased usage",
    "icon": "fast",
    "multiplier": 1.5
   }
  ],
  "selectedTier": null
 },
 "chatPlus": {
  "ok": true,
  "version": 2,
  "open": false,
  "disabled": false,
  "modelSelectionDisabled": false,
  "powerSelectionDisabled": false,
  "surface": "chat",
  "theme": "light",
  "explicit": false,
  "defaultModel": null,
  "models": [
   {
    "id": "latest",
    "label": "GPT-6",
    "sub": "",
    "selected": true,
    "disabled": false
   },
   {
    "id": "5.6",
    "label": "GPT-5.6 Sol",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.5",
    "label": "GPT-5.5",
    "sub": "Leaving on October 14",
    "selected": false,
    "disabled": false
   }
  ],
  "stops": [
   {
    "id": "gpt-6:",
    "model": "gpt-6",
    "modelLabel": "GPT-6",
    "effort": "none",
    "label": "Instant",
    "isMaximum": false,
    "index": 0
   },
   {
    "id": "gpt-6-thinking:standard",
    "model": "gpt-6-thinking",
    "modelLabel": "GPT-6",
    "effort": "medium",
    "label": "Medium",
    "isMaximum": false,
    "index": 1
   },
   {
    "id": "gpt-6-thinking:extended",
    "model": "gpt-6-thinking",
    "modelLabel": "GPT-6",
    "effort": "high",
    "label": "High",
    "isMaximum": false,
    "index": 2
   }
  ],
  "selectedStopId": "gpt-6-thinking:standard",
  "tiers": [],
  "selectedTier": null
 },
 "chatPro": {
  "ok": true,
  "version": 2,
  "open": false,
  "disabled": false,
  "modelSelectionDisabled": false,
  "powerSelectionDisabled": false,
  "surface": "chat",
  "theme": "dark",
  "explicit": false,
  "defaultModel": null,
  "models": [
   {
    "id": "latest",
    "label": "GPT-6",
    "sub": "",
    "selected": true,
    "disabled": false
   },
   {
    "id": "5.6",
    "label": "GPT-5.6 Sol",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.5",
    "label": "GPT-5.5",
    "sub": "Leaving on October 14",
    "selected": false,
    "disabled": false
   }
  ],
  "stops": [
   {
    "id": "gpt-6:",
    "model": "gpt-6",
    "modelLabel": "GPT-6",
    "effort": "none",
    "label": "Instant",
    "isMaximum": false,
    "index": 0
   },
   {
    "id": "gpt-6-thinking:standard",
    "model": "gpt-6-thinking",
    "modelLabel": "GPT-6",
    "effort": "medium",
    "label": "Medium",
    "isMaximum": false,
    "index": 1
   },
   {
    "id": "gpt-6-thinking:extended",
    "model": "gpt-6-thinking",
    "modelLabel": "GPT-6",
    "effort": "high",
    "label": "High",
    "isMaximum": false,
    "index": 2
   },
   {
    "id": "gpt-6-thinking:xhigh",
    "model": "gpt-6-thinking",
    "modelLabel": "GPT-6",
    "effort": "xhigh",
    "label": "Extra High",
    "isMaximum": false,
    "index": 3
   },
   {
    "id": "gpt-6-pro:standard",
    "model": "gpt-6-pro",
    "modelLabel": "GPT-6",
    "effort": "high",
    "label": "Pro",
    "isMaximum": true,
    "index": 4
   }
  ],
  "selectedStopId": "gpt-6-pro:standard",
  "tiers": [],
  "selectedTier": null
 },
 "workDefault": {
  "ok": true,
  "version": 2,
  "surface": "work",
  "theme": "light",
  "open": false,
  "disabled": false,
  "explicit": false,
  "modelSelectionDisabled": false,
  "powerSelectionDisabled": false,
  "defaultModel": {
   "selected": true
  },
  "models": [
   {
    "id": "6.1 Sol",
    "label": "GPT-6.1 Sol",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "6 Astra",
    "label": "GPT-6 Astra",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "6 Sol",
    "label": "GPT-6 Sol",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "6 Luna",
    "label": "GPT-6 Luna",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.6 Sol",
    "label": "GPT-5.6 Sol",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.6 Terra",
    "label": "GPT-5.6 Terra",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.6 Luna",
    "label": "GPT-5.6 Luna",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.5",
    "label": "GPT-5.5",
    "sub": "Leaving on October 14",
    "selected": false,
    "disabled": false
   }
  ],
  "stops": [
   {
    "id": "gpt-6-luna-wm:extended",
    "model": "gpt-6-luna-wm",
    "modelLabel": "GPT-6 Luna",
    "effort": "high",
    "label": "High",
    "isMaximum": false,
    "index": 0
   },
   {
    "id": "gpt-6.1-sol-wm:min",
    "model": "gpt-6.1-sol-wm",
    "modelLabel": "GPT-6.1 Sol",
    "effort": "low",
    "label": "Light",
    "isMaximum": false,
    "index": 1
   },
   {
    "id": "gpt-6.1-sol-wm:standard",
    "model": "gpt-6.1-sol-wm",
    "modelLabel": "GPT-6.1 Sol",
    "effort": "medium",
    "label": "Medium",
    "isMaximum": false,
    "index": 2
   },
   {
    "id": "gpt-6-astra-wm:min",
    "model": "gpt-6-astra-wm",
    "modelLabel": "GPT-6 Astra",
    "effort": "low",
    "label": "Light",
    "isMaximum": false,
    "index": 3
   },
   {
    "id": "gpt-6-astra-wm:standard",
    "model": "gpt-6-astra-wm",
    "modelLabel": "GPT-6 Astra",
    "effort": "medium",
    "label": "Medium",
    "isMaximum": false,
    "index": 4
   }
  ],
  "selectedStopId": "gpt-6.1-sol-wm:standard",
  "tiers": [
   {
    "value": null,
    "label": "Standard",
    "description": "Default speed",
    "icon": null,
    "multiplier": null
   },
   {
    "value": "fast",
    "label": "Fast",
    "description": "1.5x speed, increased usage",
    "icon": "fast",
    "multiplier": 1.5
   }
  ],
  "selectedTier": null
 },
 "workPro": {
  "ok": true,
  "version": 2,
  "surface": "work",
  "theme": "dark",
  "open": false,
  "disabled": false,
  "explicit": true,
  "modelSelectionDisabled": false,
  "powerSelectionDisabled": false,
  "defaultModel": {
   "selected": false
  },
  "models": [
   {
    "id": "6.1 Sol",
    "label": "GPT-6.1 Sol",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "6 Astra",
    "label": "GPT-6 Astra",
    "sub": "",
    "selected": true,
    "disabled": false
   },
   {
    "id": "6 Sol",
    "label": "GPT-6 Sol",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "6 Luna",
    "label": "GPT-6 Luna",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.6 Sol",
    "label": "GPT-5.6 Sol",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.6 Terra",
    "label": "GPT-5.6 Terra",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.6 Luna",
    "label": "GPT-5.6 Luna",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.5",
    "label": "GPT-5.5",
    "sub": "Leaving on October 14",
    "selected": false,
    "disabled": false
   }
  ],
  "stops": [
   {
    "id": "gpt-6-astra-wm:min",
    "model": "gpt-6-astra-wm",
    "modelLabel": "GPT-6 Astra",
    "effort": "low",
    "label": "Light",
    "isMaximum": false,
    "index": 0
   },
   {
    "id": "gpt-6-astra-wm:standard",
    "model": "gpt-6-astra-wm",
    "modelLabel": "GPT-6 Astra",
    "effort": "medium",
    "label": "Medium",
    "isMaximum": false,
    "index": 1
   },
   {
    "id": "gpt-6-astra-wm:extended",
    "model": "gpt-6-astra-wm",
    "modelLabel": "GPT-6 Astra",
    "effort": "high",
    "label": "High",
    "isMaximum": false,
    "index": 2
   },
   {
    "id": "gpt-6-astra-wm:xhigh",
    "model": "gpt-6-astra-wm",
    "modelLabel": "GPT-6 Astra",
    "effort": "xhigh",
    "label": "Extra High",
    "isMaximum": false,
    "index": 3
   },
   {
    "id": "gpt-6-astra-wm:max",
    "model": "gpt-6-astra-wm",
    "modelLabel": "GPT-6 Astra",
    "effort": "max",
    "label": "Max",
    "isMaximum": false,
    "index": 4
   },
   {
    "id": "gpt-6-astra-wm:ultra",
    "model": "gpt-6-astra-wm",
    "modelLabel": "GPT-6 Astra",
    "effort": "ultra",
    "label": "Ultra",
    "isMaximum": true,
    "index": 5
   }
  ],
  "selectedStopId": "gpt-6-astra-wm:ultra",
  "tiers": [
   {
    "value": null,
    "label": "Standard",
    "description": "Default speed",
    "icon": null,
    "multiplier": null
   },
   {
    "value": "fast",
    "label": "Fast",
    "description": "1.5x speed, increased usage",
    "icon": "fast",
    "multiplier": 1.5
   },
   {
    "value": "ultrafast",
    "label": "Ultrafast",
    "description": "Fastest speed, highest usage",
    "icon": "ultrafast",
    "multiplier": 2.5
   }
  ],
  "selectedTier": "fast"
 },
 "workTerraDark": {
  "ok": true,
  "version": 2,
  "surface": "work",
  "theme": "dark",
  "open": false,
  "disabled": false,
  "explicit": true,
  "modelSelectionDisabled": false,
  "powerSelectionDisabled": false,
  "defaultModel": {
   "selected": false
  },
  "models": [
   {
    "id": "6.1 Sol",
    "label": "GPT-6.1 Sol",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "6 Astra",
    "label": "GPT-6 Astra",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "6 Sol",
    "label": "GPT-6 Sol",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "6 Luna",
    "label": "GPT-6 Luna",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.6 Sol",
    "label": "GPT-5.6 Sol",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.6 Terra",
    "label": "GPT-5.6 Terra",
    "sub": "",
    "selected": true,
    "disabled": false
   },
   {
    "id": "5.6 Luna",
    "label": "GPT-5.6 Luna",
    "sub": "",
    "selected": false,
    "disabled": false
   },
   {
    "id": "5.5",
    "label": "GPT-5.5",
    "sub": "Leaving on October 14",
    "selected": false,
    "disabled": false
   }
  ],
  "stops": [
   {
    "id": "gpt-5.6-terra-wm:min",
    "model": "gpt-5.6-terra-wm",
    "modelLabel": "GPT-5.6 Terra",
    "effort": "low",
    "label": "Light",
    "isMaximum": false,
    "index": 0
   },
   {
    "id": "gpt-5.6-terra-wm:standard",
    "model": "gpt-5.6-terra-wm",
    "modelLabel": "GPT-5.6 Terra",
    "effort": "medium",
    "label": "Medium",
    "isMaximum": false,
    "index": 1
   },
   {
    "id": "gpt-5.6-terra-wm:extended",
    "model": "gpt-5.6-terra-wm",
    "modelLabel": "GPT-5.6 Terra",
    "effort": "high",
    "label": "High",
    "isMaximum": false,
    "index": 2
   },
   {
    "id": "gpt-5.6-terra-wm:xhigh",
    "model": "gpt-5.6-terra-wm",
    "modelLabel": "GPT-5.6 Terra",
    "effort": "xhigh",
    "label": "Extra High",
    "isMaximum": false,
    "index": 3
   },
   {
    "id": "gpt-5.6-terra-wm:max",
    "model": "gpt-5.6-terra-wm",
    "modelLabel": "GPT-5.6 Terra",
    "effort": "max",
    "label": "Max",
    "isMaximum": false,
    "index": 4
   }
  ],
  "selectedStopId": "gpt-5.6-terra-wm:xhigh",
  "tiers": [
   {
    "value": null,
    "label": "Standard",
    "description": "Default speed",
    "icon": null,
    "multiplier": null
   },
   {
    "value": "fast",
    "label": "Fast",
    "description": "1.5x speed, increased usage",
    "icon": "fast",
    "multiplier": 1.5
   }
  ],
  "selectedTier": null
 }
};
