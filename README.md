# Spotify Playlist Import (Nuclear Plugin)

Import PUBLIC Spotify playlists by URL into Nuclear — paste a
`open.spotify.com/playlist/...` link in **Playlists → Import → URL**.

## How it works
- Implements the `PlaylistProvider` capability (`matchesUrl` + `fetchPlaylistByUrl`)
- Uses Spotify's anonymous web-player token flow (TOTP-gated, no account/login required)
- Only PUBLIC playlists are supported (same as opening the link incognito)
- Tracks are mapped to Nuclear's Track model (artist/title/duration/artwork) and
  playable via any streaming provider (YouTube etc.)

## Credits & Attribution
- **Anonymous-token flow**: adapted from the official Nuclear Spotify metadata
  plugin (NuclearPlayer/nuclear-plugin-something, by nukeop + contributors, AGPL-3.0).
- **TOTP secrets source**: xyloflake/spot-secrets-go.
- This plugin is a derivative work under AGPL-3.0 — same license as the upstream
  code and the Nuclear player itself.

## Legal
AGPL-3.0-only. Not affiliated with Spotify. Use responsibly.
