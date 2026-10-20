import type { NuclearPluginAPI, PlaylistProvider } from '@nuclearplayer/plugin-sdk';

import { PROVIDER_ID, PROVIDER_NAME } from './config';
import { AuthClient } from './auth';
import {
  PlaylistClient,
  extractPlaylistId,
  isPlaylistUrl,
  toPlaylistUri,
} from './client';
import { mapSpotifyPlaylist } from './mappers';

export const createPlaylistProvider = (
  api: NuclearPluginAPI,
): PlaylistProvider => {
  const client = new PlaylistClient(new AuthClient(api.Http.fetch), api.Http.fetch);

  return {
    id: PROVIDER_ID,
    kind: 'playlists',
    name: PROVIDER_NAME,
    matchesUrl: isPlaylistUrl,
    async fetchPlaylistByUrl(url: string) {
      const playlistId = extractPlaylistId(url);
      const spotify = await client.fetchPlaylist(toPlaylistUri(url));
      return mapSpotifyPlaylist(spotify, url);
    },
  };
};
