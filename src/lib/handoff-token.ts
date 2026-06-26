import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 60_000; // 60 second lifetime

export function mintHandoffToken(netId: string): string {
  const payload = JSON.stringify({ netId, exp: Date.now() + TTL_MS });
  const data = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", process.env.AUTH_SECRET!)
    .update(data)
    .digest("hex");
  return `${data}.${sig}`;
}

export function verifyHandoffToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;

  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expectedSig = createHmac("sha256", process.env.AUTH_SECRET!)
    .update(data)
    .digest("hex");

  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"))) {
      return null;
    }
  } catch {
    return null;
  }

  const payload = JSON.parse(Buffer.from(data, "base64url").toString());
  if (Date.now() > payload.exp) return null;

  return payload.netId as string;
}
