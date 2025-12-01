import { ZoneModel } from '../../../core/zones';

/**
 * TrackModel - extends ZoneModel with audio-specific state
 *
 * Manages:
 * - Audio reference (idTrack)
 * - Pitch shifting
 * - Cut buffer boundaries
 * - Visibility states for volume/pan editors
 * - Available commands
 */
export default class TrackModel extends ZoneModel {
  constructor(config) {
    const { id, track, cut, transform } = config;
    const { idTrack, label, durationTime } = track;
    const { startTimeCut, durationTimeCut, isCut } = cut;
    const { stretchFactor, pitch } = transform;

    // Pass base config to ZoneModel
    super({ id, ...track });

    // Audio reference
    this.set('idTrack', idTrack);
    this.set('label', label);
    this.set('pitch', pitch);

    // Cut buffer state
    this.set('isCut', isCut);
    this.set('startTimeCut', startTimeCut);
    this.set('durationTimeCut', durationTimeCut || durationTime);
    this.set('originalDuration', durationTime);

    // Stretch factor for time compression/expansion
    this.set('stretchFactor', stretchFactor);

    // Visibility states
    this.set('volumeVisible', false);
    this.set('panVisible', false);

    // Available commands
    this.set('commands', {
      back: false,
      forward: false,
      cut: false,
      copy: false,
      volume: false,
      pan: false,
      remove: false,
      pitch: false
    });
  }

  // ============================================================================
  // Audio Properties
  // ============================================================================

  getIdTrack() {
    return this.get('idTrack');
  }

  getLabel() {
    return this.get('label');
  }

  setLabel(label) {
    this.set('label', label);

    return this;
  }

  getPitch() {
    return this.get('pitch');
  }

  setPitch(value) {
    this.set('pitch', parseFloat(value) || 0);

    return this;
  }

  // ============================================================================
  // Stretch Factor
  // ============================================================================

  getStretchFactor() {
    return this.get('stretchFactor');
  }

  setStretchFactor(factor) {
    const clamped = Math.max(0.5, Math.min(2.0, factor));
    this.set('stretchFactor', clamped);

    return clamped;
  }

  getOriginalDuration() {
    return this.get('originalDuration');
  }

  // ============================================================================
  // Cut Buffer
  // ============================================================================

  getIsCut() {
    return this.get('isCut');
  }

  setIsCut(value) {
    this.set('isCut', value);

    return this;
  }

  getStartTimeCut() {
    return this.get('startTimeCut');
  }

  setStartTimeCut(value) {
    this.set('startTimeCut', parseFloat(value) || 0);

    return this;
  }

  getDurationTimeCut() {
    return this.get('durationTimeCut');
  }

  setDurationTimeCut(value) {
    this.set('durationTimeCut', parseFloat(value) || 0);

    return this;
  }

  // ============================================================================
  // Visibility States
  // ============================================================================

  isVolumeVisible() {
    return this.get('volumeVisible');
  }

  setVolumeVisible(visible) {
    this.set('volumeVisible', visible);

    return this;
  }

  isPanVisible() {
    return this.get('panVisible');
  }

  setPanVisible(visible) {
    this.set('panVisible', visible);

    return this;
  }

  // ============================================================================
  // Commands
  // ============================================================================

  getCommands() {
    return this.get('commands');
  }

  setCommand(name, value) {
    const commands = { ...this.get('commands'), [name]: value };
    this.set('commands', commands);

    return this;
  }
}
