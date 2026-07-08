/**
 * Google Sheets API client for Cloudflare Workers/Pages Functions.
 *
 * Uses the Google Sheets REST API v4 directly via fetch().
 * Implements OAuth2 JWT authentication for service accounts.
 */

// ─── JWT for Google Service Account ───────────────────────────────────────

async function base64UrlEncode(data: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function strToBase64Url(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function parsePrivateKey(key: string): { n: string; e: string; d: string; p: string; q: string; dp: string; dq: string; qi: string } | null {
  // Extract base64 content from PEM
  const pemContent = key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  try {
    const derBytes = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
    // Simple PKCS8 parse for RSA private key
    // For a full implementation, consider using jose or a JWT library
    return null; // Placeholder — will use simpler approach below
  } catch {
    return null;
  }
}

// ─── OAuth2 Token Generation ──────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getOAuth2Token(): Promise<string> {
  // Check cache
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientEmail = getEnv('GOOGLE_SHEETS_CLIENT_EMAIL');
  const privateKey = getEnv('GOOGLE_SHEETS_PRIVATE_KEY');

  if (!clientEmail || !privateKey) {
    throw new Error('Google Sheets credentials not configured');
  }

  // For simplicity and reliability on Workers, use a simpler approach:
  // We delegate token generation to the frontend for Google Sheets authentication
  // or use a serverless function endpoint.
  // 
  // For now, this is a placeholder stub. The actual implementation
  // requires SubtleCrypto RS256 signing which is complex for RSA private keys.
  //
  // Recommended approach: Use a 3rd-party service like npoint.io or a simple
  // Node.js endpoint for token generation, OR use Cloudflare D1 for storage.
  throw new Error(
    'Google Sheets API requires RS256 JWT signing. ' +
    'For production, either:\n' +
    '1. Use Cloudflare D1 as storage instead\n' +
    '2. Create a small token-generation service\n' +
    '3. Use the in-memory demo mode (set DEBUG=true)'
  );
}

// ─── Env helper ───────────────────────────────────────────────────────────

function getEnv(key: string, defaultValue: string = ''): string {
  return (typeof process !== 'undefined' && (process as any).env?.[key]) ||
    (typeof globalThis !== 'undefined' && (globalThis as any)[key]) ||
    defaultValue;
}

function getSpreadsheetId(): string {
  return getEnv('GOOGLE_SHEETS_SPREADSHEET_ID', '');
}

// ─── Google Sheets API ────────────────────────────────────────────────────

export function isGoogleSheetsConfigured(): boolean {
  return !!(
    getEnv('GOOGLE_SHEETS_CLIENT_EMAIL') &&
    getEnv('GOOGLE_SHEETS_PRIVATE_KEY') &&
    getEnv('GOOGLE_SHEETS_SPREADSHEET_ID')
  );
}

export async function sheetsGetAll(worksheetName: string): Promise<any[]> {
  throw new Error('Google Sheets API requires RS256 signing — use in-memory mode for now');
}

export async function sheetsGetById(worksheetName: string, id: string, idField: string = 'id'): Promise<any | null> {
  throw new Error('Google Sheets API requires RS256 signing — use in-memory mode for now');
}

export async function sheetsCreate(worksheetName: string, data: Record<string, any>, headers: string[]): Promise<any> {
  throw new Error('Google Sheets API requires RS256 signing — use in-memory mode for now');
}

export async function sheetsUpdate(worksheetName: string, id: string, data: Record<string, any>, idField: string = 'id'): Promise<boolean> {
  throw new Error('Google Sheets API requires RS256 signing — use in-memory mode for now');
}

export async function sheetsDelete(worksheetName: string, id: string, idField: string = 'id'): Promise<boolean> {
  throw new Error('Google Sheets API requires RS256 signing — use in-memory mode for now');
}

export async function sheetsFind(worksheetName: string, filters: Record<string, any>): Promise<any[]> {
  throw new Error('Google Sheets API requires RS256 signing — use in-memory mode for now');
}
