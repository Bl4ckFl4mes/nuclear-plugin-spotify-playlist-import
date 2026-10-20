import type { FetchFunction } from '@nuclearplayer/plugin-sdk';

import {
  TOTP_LOCAL_PERIOD,
  TOTP_SERVER_PERIOD,
  decodeRemoteSecrets,
  generateTotp,
} from './totp';

const TOKEN_URL = 'https://open.spotify.com/api/token';
const SERVER_TIME_URL = 'https://open.spotify.com/api/server-time';
const REMOTE_SECRETS_URL =
  'https://raw.githubusercontent.com/xyloflake/spot-secrets-go/refs/heads/main/secrets/secretDict.json';
const REMOTE_SECRETS_CACHE_MS = 60 * 60 * 1000;
const MAX_SECRET_RETRIES = 5;

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_USER_AGENT,
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://open.spotify.com',
  Referer: 'https://open.spotify.com/',
};

type TokenResponse = {
  accessToken: string;
  accessTokenExpirationTimestampMs: number;
};

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

type RemoteSecretsCache = {
  data: Record<string, number[]>;
  fetchedAt: number;
};

export class AuthClient {
  private cachedToken: CachedToken | null = null;
  private cachedRemoteSecrets: RemoteSecretsCache | null = null;
  private failedSecretVersions: Set<number> = new Set();
  private pendingTokenRequest: Promise<string> | null = null;

  constructor(private readonly fetch: FetchFunction) {}

  async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      return this.cachedToken.accessToken;
    }
    if (!this.pendingTokenRequest) {
      this.pendingTokenRequest = this.fetchAccessToken().finally(() => {
        this.pendingTokenRequest = null;
      });
    }
    return this.pendingTokenRequest;
  }

  private async fetchAccessToken(retryCount = 0): Promise<string> {
    if (retryCount >= MAX_SECRET_RETRIES) {
      throw new Error('All TOTP secrets failed - unable to obtain access token');
    }

    const secrets = await this.getRemoteSecrets();
    const serverTimeMs = await this.getServerTime();
    const serverTimeSec = serverTimeMs > 1e12 ? Math.floor(serverTimeMs / 1000) : serverTimeMs;
    const localTimeSec = Math.floor(Date.now() / 1000);

    const versions = Object.keys(secrets)
      .map(Number)
      .sort((a, b) => b - a)
      .filter((v) => !this.failedSecretVersions.has(v));

    for (const version of versions) {
      const values = secrets[version.toString()];
      if (!values) continue;

      const hexSecret = decodeRemoteSecrets({ [version]: values })[0].hexSecret;
      const totpLocal = await generateTotp(hexSecret, localTimeSec, TOTP_LOCAL_PERIOD);
      const totpServer = await generateTotp(hexSecret, serverTimeSec, TOTP_SERVER_PERIOD);

      const url = new URL(TOKEN_URL);
      url.searchParams.set('reason', 'init');
      url.searchParams.set('productType', 'web-player');
      url.searchParams.set('totp', totpLocal);
      url.searchParams.set('totpVer', version.toString());
      url.searchParams.set('totpServer', totpServer);
      url.searchParams.set('cTime', localTimeSec.toString());
      url.searchParams.set('sTime', serverTimeSec.toString());

      const response = await this.fetch(url.toString(), {
        headers: BROWSER_HEADERS,
      });
      if (!response.ok) {
        this.failedSecretVersions.add(version);
        continue;
      }

      const data = (await response.json()) as TokenResponse;
      this.cachedToken = {
        accessToken: data.accessToken,
        expiresAt: data.accessTokenExpirationTimestampMs,
      };
      this.failedSecretVersions.clear();
      return data.accessToken;
    }

    return this.fetchAccessToken(retryCount + 1);
  }

  private async getRemoteSecrets(): Promise<Record<string, number[]>> {
    if (
      this.cachedRemoteSecrets &&
      Date.now() - this.cachedRemoteSecrets.fetchedAt < REMOTE_SECRETS_CACHE_MS
    ) {
      return this.cachedRemoteSecrets.data;
    }
    const response = await this.fetch(REMOTE_SECRETS_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch remote secrets: ${response.status}`);
    }
    const data = (await response.json()) as Record<string, number[]>;
    this.cachedRemoteSecrets = { data, fetchedAt: Date.now() };
    return data;
  }

  private async getServerTime(): Promise<number> {
    const response = await this.fetch(SERVER_TIME_URL, { headers: BROWSER_HEADERS });
    if (!response.ok) {
      throw new Error(`Failed to fetch server time: ${response.status}`);
    }
    const data = (await response.json()) as { serverTime: number };
    return data.serverTime;
  }
}
