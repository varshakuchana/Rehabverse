// A playback-only guard for delayed browser recognition results. It does not
// start, stop, or replace SpeechRecognition and never blocks manual Start.
const playing = new Set<symbol>();
let ignoreUntil = 0;
export function beginNovaAudio() {
  const token = Symbol("nova-audio");
  playing.add(token);
  return () => {
    if (playing.delete(token)) ignoreUntil = Date.now() + 1200;
  };
}
export function novaAudioBlocksVoiceStart() {
  return playing.size > 0 || Date.now() < ignoreUntil;
}
