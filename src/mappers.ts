import type {
  ArtworkSet,
  Playlist,
  PlaylistItem,
  Track,
} from '@nuclearplayer/plugin-sdk';

import type { SpotifyPlaylistV2, SpotifyTrackData } from './client';

const PROVIDER = 'spotify-playlist-import';

const toArtworkSet = (sources?: Array<{ url: string; width?: number | null; height?: number | null }>): ArtworkSet | undefined => {
  if (!sources || sources.length === 0) return undefined;
  return {
    items: sources.map((src) => ({
      url: src.url,
      width: src.width ?? undefined,
      height: src.height ?? undefined,
      purpose: 'thumbnail' as const,
    })),
  };
};

const playlistIdFromUri = (uri: string): string => uri.split(':').pop() ?? 'unknown';

const mapTrack = (data: SpotifyTrackData): Track => {
  const artists = (data.artists?.items ?? [])
    .map((a) => a.profile?.name)
    .filter((n): n is string => Boolean(n));

  return {
    title: data.name,
    artists: artists.map((name) => ({ name, roles: ['main'] })),
    durationMs: data.trackDuration?.totalMilliseconds,
    artwork: toArtworkSet(data.albumOfTrack?.coverArt?.sources),
    source: {
      provider: PROVIDER,
      id: data.uri,
      url: `https://open.spotify.com/track/${data.uri.split(':').pop() ?? ''}`,
    },
  };
};

export const mapSpotifyPlaylist = (
  spotify: SpotifyPlaylistV2,
  sourceUrl: string,
): Playlist => {
  const now = new Date().toISOString();
  const playlistId = playlistIdFromUri(spotify.uri);

  const items: PlaylistItem[] = spotify.content.items
    .filter((item) => {
      // Podcasts/lokale Dateien haben kein SpotifyTrackData-__typename
      return item.item?.data?.__typename === 'Track';
    })
    .map((item, index) => ({
      id: item.uid ?? `${playlistId}-${index}`,
      addedAtIso: item.addedAt?.isoString ?? now,
      track: mapTrack(item.item.data),
    }));

  return {
    id: `spotify-${playlistId}`,
    name: spotify.name,
    description: spotify.description || undefined,
    artwork: spotify.images?.items?.[0]?.sources
      ? { items: (spotify.images.items[0].sources ?? []).slice(0, 1).map((s) => ({ url: s.url, purpose: 'thumbnail' as const })) }
      : undefined,
    createdAtIso: now,
    lastModifiedIso: now,
    origin: {
      provider: PROVIDER,
      id: playlistId,
      url: sourceUrl,
    },
    isReadOnly: true,
    items,
  };
};
