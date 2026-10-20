import type { FetchFunction } from '@nuclearplayer/plugin-sdk';

import { AuthClient, BROWSER_HEADERS } from './auth';

const PATHFINDER_URL = 'https://api-partner.spotify.com/pathfinder/v2/query';
const PLAYLIST_URI_PREFIX = 'spotify:playlist:';
const PLAYLIST_HOSTNAME = 'open.spotify.com';

export const isPlaylistUrl = (url: string): boolean => {
  try {
    if (url.startsWith(PLAYLIST_URI_PREFIX)) {
      return true;
    }
    const parsed = new URL(url);
    return (
      parsed.hostname === PLAYLIST_HOSTNAME &&
      parsed.pathname.startsWith('/playlist/') &&
      parsed.pathname.length > '/playlist/'.length
    );
  } catch {
    return false;
  }
};

export const extractPlaylistId = (url: string): string => {
  if (url.startsWith(PLAYLIST_URI_PREFIX)) {
    return url.slice(PLAYLIST_URI_PREFIX.length).split('?')[0];
  }
  const parsed = new URL(url);
  const id = parsed.pathname.split('/').filter(Boolean)[1];
  return id ?? '';
};

export const toPlaylistUri = (url: string): string =>
  `${PLAYLIST_URI_PREFIX}${extractPlaylistId(url)}`;

const OPERATION_HASHES = {
  fetchPlaylist: 'e578eda4f77aae54294a48eac85e2a42ddb203faf6ea12b3fddaec5aa32918a3',
} as const;

type OperationName = keyof typeof OPERATION_HASHES;

export type SpotifyTrackProfile = {
  uri: string;
  profile: { name: string };
};

export type SpotifyTrackData = {
  __typename: string;
  uri: string;
  name: string;
  trackDuration: { totalMilliseconds: number };
  albumOfTrack?: {
    name: string;
    coverArt?: { sources: Array<{ url: string; width?: number | null; height?: number | null }> };
  };
  artists?: { items: SpotifyTrackProfile[] };
};

export type SpotifyPlaylistV2 = {
  __typename?: string;
  uri: string;
  name: string;
  description: string;
  images?: { items: Array<{ sources?: Array<{ url: string }> }> };
  content: {
    totalCount: number;
    items: Array<{
      uid: string;
      addedAt: { isoString: string };
      item: { __typename: string; data: SpotifyTrackData };
    }>;
  };
};

type PathfinderPlaylistResponse = {
  data?: { playlistV2?: SpotifyPlaylistV2 };
};

export class PlaylistClient {
  constructor(
    private readonly auth: AuthClient,
    private readonly fetch: FetchFunction,
  ) {}

  async fetchPlaylist(playlistUri: string, pageSize = 100): Promise<SpotifyPlaylistV2> {
    const response = await this.pathfinderQuery<PathfinderPlaylistResponse>(
      'fetchPlaylist',
      { uri: playlistUri, offset: 0, limit: pageSize },
    );
    const playlist = response.data?.playlistV2;
    if (!playlist) {
      throw new Error('Playlist not found (private playlists are not supported)');
    }
    if ((playlist as { __typename?: string }).__typename === 'GenericError') {
      throw new Error('Playlist not found — check that the link is public and correct');
    }

    while (playlist.content.items.length < playlist.content.totalCount) {
      const nextOffset = playlist.content.items.length;
      const nextPage = await this.pathfinderQuery<PathfinderPlaylistResponse>(
        'fetchPlaylist',
        { uri: playlistUri, offset: nextOffset, limit: pageSize },
      );
      const next = nextPage.data?.playlistV2;
      if (!next) break;
      playlist.content.items.push(...next.content.items);
    }

    return playlist;
  }

  private async pathfinderQuery<T>(
    operationName: OperationName,
    variables: Record<string, unknown>,
  ): Promise<T> {
    const token = await this.auth.getAccessToken();
    const body = JSON.stringify({
      operationName,
      variables,
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: OPERATION_HASHES[operationName],
        },
      },
    });

    const response = await this.fetch(PATHFINDER_URL, {
      method: 'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const json = (await response.json()) as T & { errors?: unknown };
    if ((json as { errors?: unknown }).errors) {
      throw new Error('Spotify API returned errors');
    }
    return json;
  }
}
