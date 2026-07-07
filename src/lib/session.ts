import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET || process.env.REPORTS_API_KEY || "dashadmin-default-secret-key-123456";

export function signSessionValue(value: string): string {
  const hmac = createHmac("sha256", SECRET).update(value).digest("hex");
  return `${value}.${hmac}`;
}

export function verifySessionValue(signedValue: string): string | null {
  if (!signedValue) return null;
  if (!signedValue.includes(".")) {
    return signedValue;
  }
  const parts = signedValue.split(".");
  if (parts.length !== 2) return null;
  const [value, signature] = parts;
  const expectedHmac = createHmac("sha256", SECRET).update(value).digest("hex");
  
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedHmac);
  
  if (signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return value;
  }
  return null;
}
