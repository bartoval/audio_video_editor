# ADR 005 — File-Based Project Storage (No Database)

## Status

Accepted

## Context

Each workspace contains binary media (video, audio, thumbnails) alongside small JSON state files (project info, timeline, track list). A traditional database would handle JSON state well but would still need a filesystem or object storage for binary media.

The application is designed for single-node deployment (one server per studio instance). There is no multi-user concurrent editing — each workspace is owned by one user.

## Decision

Store everything on the filesystem (or object storage via the adapter pattern). No database dependency.

Project structure:
```
<ROOT>/projects/0/<uuid>/
  info.json                    # Project metadata
  state.json                   # Workspace state (timeline, config)
  trackList.json               # Audio track list
  resources/videoTracks/       # Video files (original, converted, small)
  resources/audioTracks/       # Audio files (uploaded, imported)
  library/                     # Audio library (user uploads)
  library/derived/             # Cached stretched audio
  thumbs/                      # Thumbnail tile sprites
  saved/                       # State backups
  published/                   # Export outputs
```

The workspace registry (`projects.json` at the root) is a flat JSON file listing all projects.

## Consequences

- Zero database setup — the application runs with Node.js and FFmpeg only
- Deployments are simple: a single directory contains all project data
- Backup and migration is a filesystem copy
- No query capability beyond listing projects; search would require a database
- Concurrent writes to the same JSON file could cause data loss (mitigated by single-user model)
- The `0/` prefix in the path is a legacy convention preserved for backward compatibility
