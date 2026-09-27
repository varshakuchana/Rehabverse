export function shouldSubmitNovaKey(key: string, shiftKey: boolean, isComposing = false) {
  return key === "Enter" && !shiftKey && !isComposing;
}

export function finalSpeechQuestion(transcript: string, isFinal = true) {
  const text = transcript.trim().slice(0, 600);
  return isFinal && text ? text : null;
}

export function shouldAutoSpeakNova(voiceEnabled: boolean, responseText: string) {
  return voiceEnabled && responseText.trim().length > 0;
}
