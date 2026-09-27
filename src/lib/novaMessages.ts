// The same deterministic text is rendered by Nova and voiced by ElevenLabs.
// No uploaded HEP content or exercise names belong in this speech catalog.
export const novaMessages = {
  active: "Quest started. Move at a comfortable pace.",
  trackingLost: "I lost track of the movement. Return to your starting position.",
  complete: "Quest complete. You restored the garden.",
  guidedActive: "Take your time. Mark a movement when you have finished it, and pause whenever you like.",
  guidedComplete: "Quest complete! Your self-reported movements brought light to the garden. Thanks for exploring with me.",
} as const;
export const MAX_NOVA_TEXT_LENGTH = 300;
export function isSpeakableNovaText(text: string) {
  return (Object.values(novaMessages) as string[]).includes(text);
}
