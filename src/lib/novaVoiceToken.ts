import { createHmac, timingSafeEqual } from "node:crypto";
function secret() { return process.env.ELEVENLABS_API_KEY; }
export function signNovaVoice(text: string): string | undefined {
  const key = secret();
  if (!key) return undefined;
  const expiry = Date.now() + 5 * 60 * 1000;
  return `${expiry}.${createHmac("sha256", key).update(`${expiry}:${text}`).digest("hex")}`;
}
export function verifyNovaVoice(text: string, token: unknown) {
  const key = secret();
  if (!key || typeof token !== "string" || !/^\d{13}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expiry, signature] = token.split(".");
  if (+expiry < Date.now() || +expiry > Date.now() + 300000) return false;
  const expected = createHmac("sha256", key).update(`${expiry}:${text}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
