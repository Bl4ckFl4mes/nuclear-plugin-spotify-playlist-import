# Spotify Playlist Import (Nuclear Plugin)

Import PUBLIC Spotify playlists by URL into Nuclear — paste a
`open.spotify.com/playlist/...` link in **Playlists → Import → URL**.

## How it works
- Implements the `PlaylistProvider` capability (`matchesUrl` + `fetchPlaylistByUrl`)
- Uses Spotify's anonymous web-player token flow (TOTP-gated, no account/login required)
- Only PUBLIC playlists are supported (same as opening the link incognito)
- Tracks are mapped to Nuclear's Track model (artist/title/duration/artwork) and
  playable via any streaming provider (YouTube etc.)

## Credits
- Anonymous-token protocol reverse-engineered & maintained by the Nuclear Spotify
  metadata plugin (nukeop + xyloflake/spot-secrets-go).

## Legal
AGPL-3.0-only. Not affiliated with Spotify. Use responsibly.
