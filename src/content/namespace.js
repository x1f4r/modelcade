// Content scripts listed in the manifest share one isolated world. Every module
// registers itself on this namespace instead of leaking globals into it.
globalThis.Modelcade = globalThis.Modelcade || {};
