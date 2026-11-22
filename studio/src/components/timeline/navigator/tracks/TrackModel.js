import { ZoneModel } from '../../../core/zones';

/**
 * TrackModel - extends ZoneModel with audio-specific state
 *
 * Manages:
 * - Audio reference (idTrack)
 * - Pitch shifting
 * - Cut buffer boundaries
 * - Visibility state for the volume editor (pan is set from the Inspector)
 * - Available commands
 */
export default class TrackModel extends ZoneModel {
  constructor(config) {
    const { id, track, cut, transform } = config;
    const { idTrack, label, durationTime } = track;
    const { startTimeCut, durationTimeCut, isCut } = cut;
    const { stretchFactor, pitch, gain } = transform;

    super({ id, ...track });

    this.set('idTrack', idTrack);
    this.set('label', label);
    this.set('pitch', pitch);
    this.set('gain', gain ?? 1);
    this.set('isCut', isCut);
    this.set('startTimeCut', startTimeCut);
    this.set('durationTimeCut', durationTimeCut || durationTime);
    this.set('originalDuration', durationTime);
    this.set('stretchFactor', stretchFactor);
    this.set('volumeVisible', false);
    this.set('commands', {
      back: false,
      forward: false,
      cut: false,
      copy: false,
      volume: false,
      remove: false,
      pitch: false
    });
  }

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

  getGain() {
    return this.get('gain');
  }

  setGain(value) {
    const clamped = Math.max(0, Math.min(1, parseFloat(value) || 1));
    this.set('gain', clamped);

    return clamped;
  }

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

  isVolumeVisible() {
    return this.get('volumeVisible');
  }

  setVolumeVisible(visible) {
    this.set('volumeVisible', visible);

    return this;
  }

  getCommands() {
    return this.get('commands');
  }

  setCommand(name, value) {
    const commands = { ...this.get('commands'), [name]: value };
    this.set('commands', commands);

    return this;
  }
}
