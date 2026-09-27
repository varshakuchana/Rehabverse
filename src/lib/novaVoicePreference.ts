import { DEMO_STORAGE_EVENT, readStored, writeStored } from "./demoStorage";
const KEY = "rehabverse-nova-voice-v1";
let memoryPreference: boolean | undefined;
export function getNovaVoicePreference() {
  return memoryPreference ?? readStored(KEY) === "true";
}
export function setNovaVoicePreference(enabled: boolean) {
  memoryPreference = enabled;
  try { writeStored(KEY, enabled); memoryPreference = undefined; }
  catch { window.dispatchEvent(new Event(DEMO_STORAGE_EVENT)); }
}
