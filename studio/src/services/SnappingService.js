// @ts-check

/**
 * SnappingService v2 - targeted, deterministic snapping
 *
 * Principles:
 * - Target model: { time, posX, type, trackId?, label?, priority }
 * - Cache per drag with spatial buckets for fast lookup (no O(n) scans)
 * - Context decides which target types are considered (grid/playhead/markers/tracks)
 * - Priority ordering: track-start/end > marker > playhead > grid
 */

import { getPosXFromTime } from '../lib/utils/scale.js';
import { SNAP } from '../config/constants.js';
import playbackStore from '../store/playbackStore.js';
import workspaceStore from '../store/workspaceStore.js';
import scaleManager from './ScaleManager.js';

const PRIORITY = {
  'track-start': 3,
  'track-end': 3,
  marker: 2,
  playhead: 1,
  grid: 0
};

const DEFAULT_CONTEXT = {
  allowGridSnap: true,
  allowTracks: true,
  allowMarkers: true,
  allowPlayhead: true,
  visibleRange: null,
  excludeTrackId: null,
  tolerance: SNAP.BASE_TOLERANCE
};

// Bucket size in pixels for spatial indexing
const BUCKET_SIZE_PX = 120;

class SnappingService {
  #config = {
    modes: {
      grid: true,
      tracks: true,
      playhead: true,
      markers: true
    },
    gridInterval: SNAP.GRID_INTERVAL,
    baseTolerance: SNAP.BASE_TOLERANCE,
    toleranceMax: SNAP.TOLERANCE_MAX,
    hysteresisMultiplier: SNAP.HYSTERESIS_MULTIPLIER,
    beatSnap: false,
    beatsPerBar: SNAP.BEATS_PER_BAR
  };

  #snapTargets = new Map();
  #lastSnapInfo = null;
  #listeners = new Set();
  #isDragging = false;
  #cachedTargets = null;
  #bucketIndex = null;
  #currentlySnapped = false;
  #snappedTarget = null;
  #lastContext = { ...DEFAULT_CONTEXT };

  constructor() {
    this.#subscribeToScaleChanges();
  }

  #subscribeToScaleChanges() {
    scaleManager.onChange(() => {
      if (this.#isDragging) {
        this.#invalidateCache();
      }
    });
  }

  #invalidateCache() {
    this.#cachedTargets = null;
    this.#bucketIndex = null;
    this.#currentlySnapped = false;
    this.#snappedTarget = null;
  }

  /**
   * Snap position to nearest target
   * @param {number} posX - Position in pixels
   * @param {Object} context - Context overrides (allowGridSnap, allowTracks, allowMarkers, allowPlayhead, visibleRange, excludeTrackId, tolerance)
   * @returns {number} Snapped position (posX) or original posX if no snap
   */
  snap(posX, context = {}) {
    const mergedContext = { ...DEFAULT_CONTEXT, ...context };
    const tolerance = mergedContext.tolerance ?? this.#config.baseTolerance;
    const cache =
      this.#isDragging && this.#cachedTargets
        ? { targets: this.#cachedTargets, buckets: this.#bucketIndex }
        : this.#buildTargets(mergedContext);

    const snapTarget = this.#findClosestSnapTarget(posX, cache, tolerance);

    if (this.#currentlySnapped && this.#snappedTarget) {
      const exitTolerance = tolerance * this.#config.hysteresisMultiplier;
      const snappedPosX = this.#snappedTarget.posX;
      const distanceFromSnap = Math.abs(posX - snappedPosX);

      if (distanceFromSnap < exitTolerance) {
        this.#lastSnapInfo = this.#snappedTarget;
        return snappedPosX;
      }

      this.#currentlySnapped = false;
      this.#snappedTarget = null;
    }

    if (snapTarget) {
      this.#lastSnapInfo = snapTarget;
      this.#currentlySnapped = true;
      this.#snappedTarget = snapTarget;
      return snapTarget.posX;
    }

    this.#lastSnapInfo = null;
    this.#currentlySnapped = false;
    this.#snappedTarget = null;

    return posX;
  }

  /**
   * Begin drag operation - build cache for context
   * @param {Object} context - see DEFAULT_CONTEXT
   */
  beginDrag(context = {}) {
    this.#isDragging = true;
    this.#currentlySnapped = false;
    this.#snappedTarget = null;
    this.#lastContext = { ...DEFAULT_CONTEXT, ...context };
    const cache = this.#buildTargets(this.#lastContext);
    this.#cachedTargets = cache.targets;
    this.#bucketIndex = cache.buckets;
  }

  /**
   * End drag operation - clear cache
   */
  endDrag() {
    this.#isDragging = false;
    this.#cachedTargets = null;
    this.#bucketIndex = null;
    this.#currentlySnapped = false;
    this.#snappedTarget = null;
  }

  /** Build targets + bucket index for the given context */
  #buildTargets(context) {
    const targets = this.#addPosXToTargets(this.#collectAllSnapTargets(context));
    const buckets = new Map();

    for (const target of targets) {
      const bucket = Math.floor(target.posX / BUCKET_SIZE_PX);
      if (!buckets.has(bucket)) {
        buckets.set(bucket, []);
      }
      buckets.get(bucket).push(target);
    }

    return { targets, buckets };
  }

  /** Find closest snap target using buckets and priority */
  #findClosestSnapTarget(posX, cache, tolerance) {
    const buckets = cache.buckets;
    if (!buckets || buckets.size === 0) {
      return null;
    }

    const currentBucket = Math.floor(posX / BUCKET_SIZE_PX);
    const span = Math.ceil(tolerance / BUCKET_SIZE_PX) + 1;
    const candidates = [];

    for (let i = currentBucket - span; i <= currentBucket + span; i++) {
      const bucketItems = buckets.get(i);
      if (bucketItems) {
        candidates.push(...bucketItems);
      }
    }

    let closest = null;
    let minDistance = Infinity;

    for (const target of candidates) {
      const distance = Math.abs(target.posX - posX);
      const targetPriority = PRIORITY[target.type] ?? 0;

      if (distance > tolerance) {
        continue;
      }

      if (
        distance < minDistance ||
        (Math.abs(distance - minDistance) < 0.0001 &&
          closest &&
          targetPriority > (PRIORITY[closest.type] ?? 0))
      ) {
        minDistance = distance;
        closest = target;
      }
    }

    return closest;
  }

  /** Add posX to targets (called once when building cache) */
  #addPosXToTargets(targets) {
    return targets.map(target => ({
      ...target,
      posX: getPosXFromTime(target.time)
    }));
  }

  /** Collect all snap targets based on active modes and context filters */
  #collectAllSnapTargets(context) {
    const targets = [];
    const { modes } = this.#config;
    const {
      excludeTrackId,
      visibleRange,
      allowGridSnap = true,
      allowTracks = true,
      allowMarkers = true,
      allowPlayhead = true
    } = context;

    if (allowGridSnap && modes.grid && visibleRange) {
      targets.push(...this.#calculateGridSnaps(visibleRange.start, visibleRange.end));
    }

    if (allowPlayhead && modes.playhead) {
      const playheadTime = playbackStore.getState().time;
      targets.push({
        time: playheadTime,
        type: 'playhead',
        label: 'Playhead'
      });
    }

    if (allowTracks && modes.tracks) {
      const trackSnaps = this.#snapTargets.get('tracks') || [];
      targets.push(...trackSnaps.filter(snap => snap.trackId !== excludeTrackId));
    }

    if (allowMarkers && modes.markers) {
      const markerSnaps = this.#snapTargets.get('markers') || [];
      targets.push(...markerSnaps);
    }

    return targets;
  }

  /** Calculate grid snap points */
  #calculateGridSnaps(startTime, endTime) {
    const baseInterval = this.#config.beatSnap
      ? this.#calculateBeatInterval()
      : this.#config.gridInterval;

    const visibleDuration = endTime - startTime;
    const interval = this.#getAdaptiveGridInterval(baseInterval, visibleDuration);

    const snaps = [];
    const visibleStart = Math.max(0, startTime);
    const visibleEnd = endTime;

    let time = Math.floor(visibleStart / interval) * interval;
    const maxSnaps = 120;
    let count = 0;

    while (time <= visibleEnd && count < maxSnaps) {
      snaps.push({
        time,
        type: 'grid',
        label: this.#formatGridLabel(time)
      });
      time += interval;
      count++;
    }

    return snaps;
  }

  /** Adaptive grid interval to avoid too many points when zoomed out */
  #getAdaptiveGridInterval(baseInterval, visibleDuration) {
    const maxTargetPoints = 80;
    const estimatedPoints = visibleDuration / baseInterval;

    if (estimatedPoints <= maxTargetPoints) {
      return baseInterval;
    }

    const multiplier = Math.ceil(estimatedPoints / maxTargetPoints);

    return baseInterval * multiplier;
  }

  /** Calculate beat-based interval */
  #calculateBeatInterval() {
    const { bpm } = workspaceStore.getState().config;
    const secondsPerBeat = 60 / (bpm || 120);
    const beatsPerSnap = this.#config.beatsPerBar;
    return secondsPerBeat * beatsPerSnap;
  }

  /** Format time for grid labels */
  #formatGridLabel(time) {
    const sec = ~~time % 60;
    const min = ~~(time / 60) % 60;
    const pad = num => num.toString().padStart(2, '0');
    return `${pad(min)}:${pad(sec)}`;
  }

  // Public API for registering targets and configuration

  registerSnapPoints(category, points) {
    this.#snapTargets.set(category, points);
    this.#invalidateCache();
  }

  clearSnapPoints(category) {
    this.#snapTargets.delete(category);
    this.#invalidateCache();
  }

  getLastSnapInfo() {
    return this.#lastSnapInfo;
  }

  setMode(mode, enabled) {
    if (Object.hasOwn(this.#config.modes, mode)) {
      this.#config.modes[mode] = enabled;
      this.#notifyListeners();
      this.#invalidateCache();
    }
  }

  isModeEnabled(mode) {
    return this.#config.modes[mode] || false;
  }

  setGridInterval(seconds) {
    this.#config.gridInterval = Math.max(0.1, Math.min(10, seconds));
    this.#notifyListeners();
    this.#invalidateCache();
  }

  getGridInterval() {
    return this.#config.gridInterval;
  }

  setTolerance(pixels) {
    this.#config.baseTolerance = Math.max(5, Math.min(50, pixels));
    this.#notifyListeners();
    this.#invalidateCache();
  }

  getTolerance() {
    return this.#config.baseTolerance;
  }

  setBeatSnap(enabled) {
    this.#config.beatSnap = enabled;
    this.#notifyListeners();
    this.#invalidateCache();
  }

  isBeatSnapEnabled() {
    return this.#config.beatSnap;
  }

  setBeatsPerBar(beats) {
    this.#config.beatsPerBar = Math.max(1, Math.min(16, beats));
    this.#notifyListeners();
    this.#invalidateCache();
  }

  getConfig() {
    return { ...this.#config };
  }

  onChange(callback) {
    this.#listeners.add(callback);
    return () => this.#listeners.delete(callback);
  }

  #notifyListeners() {
    const config = this.getConfig();
    this.#listeners.forEach(listener => {
      try {
        listener(config);
      } catch (error) {
        console.error('[SnappingService] Listener error:', error);
      }
    });
  }
}

const snappingService = new SnappingService();

export default snappingService;
