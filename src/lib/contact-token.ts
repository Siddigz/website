/*
 * Short-lived tokens for the email reveal. The page asks for a token, then
 * trades it for the address. A token is signed with a secret only the server
 * holds, so one cannot be made up, and it stops working after a minute, so a
 * saved one is no use to a harvester.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const TOKEN_LIFETIME_MS = 60_000;
const MAX_LENGTH = 200;

const sign = (secret: string, expiresAt: string, nonce: string) =>
  createHmac('sha256', secret).update(`${expiresAt}.${nonce}`).digest('base64url');

/** `${expiresAt}.${nonce}.${signature}` */
export function issueToken(secret: string, now: number): string {
  const expiresAt = String(now + TOKEN_LIFETIME_MS);
  const nonce = randomBytes(12).toString('base64url');
  return `${expiresAt}.${nonce}.${sign(secret, expiresAt, nonce)}`;
}

/** False for anything that is not a token this secret signed and that is still in date. Never throws. */
export function verifyToken(secret: string, token: unknown, now: number): boolean {
  if (!secret || typeof token !== 'string' || token.length > MAX_LENGTH) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expiresAt, nonce, signature] = parts as [string, string, string];
  if (!/^\d{1,16}$/.test(expiresAt) || !nonce || !signature) return false;
  const expected = Buffer.from(sign(secret, expiresAt, nonce));
  const given = Buffer.from(signature);
  // Compared in constant time, so the answer's timing says nothing about the signature.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  return now <= Number(expiresAt);
}
