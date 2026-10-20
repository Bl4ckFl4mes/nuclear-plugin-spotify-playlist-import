// TOTP generation for Spotify's anonymous web-player token.
// Byte-for-byte compatible with NuclearPlayer/nuclear-plugin-something (AGPL-3.0).
type DecodedSecret = {
  hexSecret: string;
  version: number;
};

export const TOTP_LOCAL_PERIOD = 30;
export const TOTP_SERVER_PERIOD = 900;
const XOR_MODULO = 33;
const XOR_OFFSET = 9;
const TOTP_DIGITS = 6;

const xorDecodeToHex = (values: number[]): string => {
  const decoded = values.map(
    (value, index) => value ^ ((index % XOR_MODULO) + XOR_OFFSET),
  );
  const joined = decoded.join('');
  const utf8Bytes = new TextEncoder().encode(joined);
  return Array.from(utf8Bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const decodeStringSecret = (encoded: string): string =>
  xorDecodeToHex(encoded.split('').map((char) => char.charCodeAt(0)));

export const decodeIntArraySecret = (values: number[]): string =>
  xorDecodeToHex(values);

export const decodeRemoteSecrets = (
  remote: Record<string, number[]>,
): DecodedSecret[] =>
  Object.keys(remote)
    .map(Number)
    .sort((a, b) => b - a)
    .map((version) => ({
      hexSecret: decodeIntArraySecret(remote[version.toString()]),
      version,
    }));

const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let offset = 0; offset < hex.length; offset += 2) {
    bytes[offset / 2] = parseInt(hex.substring(offset, offset + 2), 16);
  }
  return bytes;
};

export const generateTotp = async (
  hexSecret: string,
  timeSec: number,
  period: number,
): Promise<string> => {
  const counter = Math.floor(timeSec / period);

  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setUint32(0, Math.floor(counter / 0x100000000));
  counterView.setUint32(4, counter >>> 0);

  const secretBytes = hexToBytes(hexSecret);
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, counterBuffer);
  const digest = new Uint8Array(signature);

  const truncationOffset = digest[digest.length - 1] & 0x0f;
  const truncated =
    ((digest[truncationOffset] & 0x7f) << 24) |
    ((digest[truncationOffset + 1] & 0xff) << 16) |
    ((digest[truncationOffset + 2] & 0xff) << 8) |
    (digest[truncationOffset + 3] & 0xff);

  const code = truncated % Math.pow(10, TOTP_DIGITS);
  return code.toString().padStart(TOTP_DIGITS, '0');
};
