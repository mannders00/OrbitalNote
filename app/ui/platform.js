export const macPlatform = /Mac|iPhone|iPad/.test(navigator.platform);
export const primaryModifier = event => macPlatform ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
