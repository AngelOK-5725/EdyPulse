/**
 * Authentication utilities for Cloudflare Pages Functions.
 * Ported from backend/app/core/security.py
 *
 * Uses Web Crypto API (SubtleCrypto) instead of Node.js crypto.
 */

import { UserRole } from './types';

// ─── Environment helpers ──────────────────────────────────────────────────

// Reads env vars from process.env (works with nodejs_compat flag in Cloudflare Workers)
function getEnv(key: string, defaultValue: string = ''): string {
  return (typeof process !== 'undefined' && (process as any).env?.[key]) || defaultValue;
}

function getBotToken(): string {
  return getEnv('TELEGRAM_BOT_TOKEN', '');
}

function getJwtSecret(): string {
  return getEnv('JWT_SECRET', 'edupulse-jwt-secret-change-in-production');
}

function getOwnerTelegramId(): number {
  return parseInt(getEnv('OWNER_TELEGRAM_ID', '0'), 10);
}

function isDebug(): boolean {
  return getEnv('DEBUG', '') === 'true';
}

// ─── HMAC-SHA256 for Telegram initData ────────────────────────────────────

async function hmacSha256(key: Uint8Array, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(message),
  );
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex;
}

// ─── Telegram initData Validation ─────────────────────────────────────────

function parseRawPairs(initData: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of initData.split('&')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx);
    const value = pair.slice(eqIdx + 1);
    result[key] = value; // Keep raw — no decode!
  }
  return result;
}

async function validateTelegramInitData(initData: string): Promise<Record<string, any> | null> {
  const botToken = getBotToken();
  if (!botToken) {
    if (!initData) return null;
    // Dev mode: parse and decode what we can
    const raw = parseRawPairs(initData);
    const decoded: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      decoded[k] = decodeURIComponent(v);
    }
    return decoded;
  }

  if (!initData) return null;

  try {
    const rawPairs = parseRawPairs(initData);
    const receivedHash = rawPairs['hash'];
    if (!receivedHash) return null;

    delete rawPairs['hash'];

    // Build data-check string from RAW values (sorted by key)
    const sortedKeys = Object.keys(rawPairs).sort();
    const dataCheckString = sortedKeys.map((k) => `${k}=${rawPairs[k]}`).join('\n');

    // HMAC-SHA256 with 'WebAppData' as key, then bot_token
    const secretKey = await hmacSha256(
      new TextEncoder().encode('WebAppData'),
      botToken,
    );
    const secretKeyBytes = new Uint8Array(
      secretKey.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
    );

    const computedHash = await hmacSha256(secretKeyBytes, dataCheckString);

    if (computedHash !== receivedHash) {
      return null;
    }

    // Decode values for usage
    const decoded: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawPairs)) {
      decoded[k] = decodeURIComponent(v);
    }
    return decoded;
  } catch (e) {
    console.error('Error validating Telegram init data:', e);
    return null;
  }
}

export async function extractUserFromInitData(initData: string): Promise<Record<string, any> | null> {
  const parsed = await validateTelegramInitData(initData);
  if (!parsed) return null;

  // Replay protection
  const authDateStr = parsed['auth_date'];
  const botToken = getBotToken();
  if (authDateStr && botToken) {
    const authDate = parseInt(authDateStr, 10);
    if (Date.now() / 1000 - authDate > 86400) {
      console.warn('Telegram init data is too old (replay attack?)');
      return null;
    }
  }

  const userRaw = parsed['user'];
  if (!userRaw) return null;

  try {
    const userData = typeof userRaw === 'string' ? JSON.parse(userRaw) : userRaw;
    return {
      telegram_id: userData.id,
      first_name: userData.first_name || '',
      last_name: userData.last_name || null,
      username: userData.username || null,
      photo_url: userData.photo_url || null,
    };
  } catch (e) {
    console.error('Error parsing Telegram user:', e);
    return null;
  }
}

// ─── JWT ───────────────────────────────────────────────────────────────────

// Simple base64url helpers
function base64urlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

async function hmacSha256Sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return base64urlEncode(new Uint8Array(sig));
}

export async function createAccessToken(
  telegramId: number,
  role: UserRole,
): Promise<string> {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(telegramId),
    role: role,
    iat: now,
    exp: now + 86400, // 24 hours
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSha256Sign(secret, `${headerB64}.${payloadB64}`);

  return `${headerB64}.${payloadB64}.${signature}`;
}

export async function decodeAccessToken(token: string): Promise<any | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const secret = getJwtSecret();
  const [headerB64, payloadB64, signatureB64] = parts;

  // Verify signature
  const expectedSig = await hmacSha256Sign(secret, `${headerB64}.${payloadB64}`);
  if (expectedSig !== signatureB64) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64)));
    // Check expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── AuthUser class ───────────────────────────────────────────────────────

export class AuthUser {
  constructor(
    public telegramId: number,
    public role: UserRole,
  ) {}

  isOwner(): boolean {
    return this.role === UserRole.OWNER;
  }

  isAdmin(): boolean {
    return this.role === UserRole.ADMIN || this.role === UserRole.OWNER;
  }

  isTester(): boolean {
    return this.role === UserRole.TESTER;
  }

  isAdminOrTester(): boolean {
    return [UserRole.ADMIN, UserRole.TESTER, UserRole.OWNER].includes(this.role);
  }
}

export async function getAuthUserFromRequest(request: Request): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    if (isDebug()) {
      return new AuthUser(0, UserRole.ADMIN);
    }
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  const payload = await decodeAccessToken(parts[1]);
  if (!payload) return null;

  const telegramId = parseInt(payload.sub || '0', 10);
  let role = UserRole.USER;
  if (Object.values(UserRole).includes(payload.role)) {
    role = payload.role as UserRole;
  }

  return new AuthUser(telegramId, role);
}

export function requireAdmin(user: AuthUser | null): user is AuthUser {
  if (!user || !user.isAdmin()) {
    return false;
  }
  return true;
}

export function requireOwner(user: AuthUser | null): user is AuthUser {
  if (!user || !user.isOwner()) {
    return false;
  }
  return true;
}

export { getOwnerTelegramId, getBotToken, UserRole };
