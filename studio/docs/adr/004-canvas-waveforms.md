# ADR 004 — Canvas for waveform rendering (no SVG)

## Status

Accepted

## Context

Each audio track displays a waveform that must:

- Render thousands of data points per visible region
- Redraw on zoom, scroll, and resize at 60fps
- Support multiple tracks visible simultaneously (10+ tracks common)
- Stay responsive during playback (RAF loop already running)

SVG would create thousands of DOM elements per track, causing layout thrashing and high memory usage. At typical zoom levels a single track waveform has 2000-5000 visible sample points.

## Decision

Render waveforms on `<canvas>` elements using a tile-based system. A Web Worker (`WaveformTileService`) pre-computes waveform data, and the main thread draws only the visible tiles.

## Consequences

- Consistent 60fps rendering regardless of zoom level or track count
- Memory efficient — only visible tiles are drawn, off-screen tiles are discarded
- No DOM elements per sample point — zero layout cost
- Canvas content is not accessible to screen readers (mitigated with `aria-label` on track containers)
- Pixel-level drawing requires manual hit testing for interactions (handled by track controllers)
