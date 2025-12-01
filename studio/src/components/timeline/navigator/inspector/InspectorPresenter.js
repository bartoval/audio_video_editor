import { TRACK_ACTION } from '../../../../config/constants';
import * as ToolMode from '../../../../services/ToolMode';
import { getLibraryTrackUrl, getDerivedTrackUrl } from '../../../../services/workspace';
import uiStore from '../../../../store/uiStore';
import InspectorView from './InspectorView';

/** Orchestrates Inspector state, store subscriptions and playback */
export default class InspectorPresenter {
  #view = null;
  #isOpen = false;
  #selectedZone = null;
  #unsubscribeStore = null;
  #zoneStart = 0;
  #zoneEnd = 0;
  #isPlaying = false;
  #currentUrl = null;

  constructor($parent) {
    this.#view = new InspectorView($parent, {
      onClose: () => this.close(),
      onPitchPreview: value => this.#handlePitchPreview(value),
      onPitchChange: value => this.#handlePitchChange(value),
      onSpeedChange: value => this.#handleSpeedChange(value),
      onGainChange: value => this.#handleGainChange(value),
      onPanChange: value => this.#handlePanChange(value),
      onPlayClick: () => this.#handlePlayClick(),
      onSeek: time => this.#handleSeek(time),
      onTimeUpdate: time => this.#handleTimeUpdate(time),
      onPlayStateChange: isPlaying => this.#handlePlayStateChange(isPlaying)
    });

    this.#unsubscribeStore = uiStore.subscribe(() => this.#refresh());
  }

  toggle() {
    if (this.#isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.#isOpen = true;
    this.#view?.open();
  }

  close() {
    this.#isOpen = false;
    this.#view?.close();
    this.#view?.stopWaveform();
    this.#isPlaying = false;
  }

  isOpen() {
    return this.#isOpen;
  }

  set(tracksContainer) {
    const previousZone = this.#selectedZone;

    if (!tracksContainer) {
      this.#selectedZone = null;
    } else {
      this.#selectedZone = tracksContainer.getSelected?.() ?? null;
    }

    if (previousZone !== this.#selectedZone) {
      this.#view?.stopWaveform();
      this.#view?.setPlayState(false);
      this.#isPlaying = false;
      this.#currentUrl = null;
    }

    this.#updateView();
  }

  destroy() {
    this.#unsubscribeStore?.();
    this.#view?.destroy();
    this.#view = null;
  }

  #handlePitchPreview(value) {
    this.#view?.setPitchValue(value);
  }

  #handlePitchChange(value) {
    if (this.#selectedZone?.setPitch) {
      this.#selectedZone.setPitch(Number(value));

      if (this.#isPlaying) {
        this.#view?.stopWaveform();
        this.#isPlaying = false;
      }
    }
  }

  #handleSpeedChange(value) {
    const speed = Number(value) / 100;

    if (this.#selectedZone?.setSpeed) {
      const stretchFactor = speed > 0 ? 1 / speed : 1;
      this.#selectedZone.setSpeed(stretchFactor);
    }

    this.#view?.setWaveformPlaybackRate(speed);
  }

  #handleGainChange(value) {
    const gain = Number(value) / 100;

    if (this.#selectedZone?.setGain) {
      this.#selectedZone.setGain(gain);
    }
  }

  #handlePanChange(value) {
    const pan = Number(value) / 100;

    if (this.#selectedZone) {
      if (!ToolMode.isMode(TRACK_ACTION.PAN)) {
        ToolMode.activate(TRACK_ACTION.PAN);
        this.#selectedZone.panShow?.();
      }

      this.#selectedZone.setPan?.(pan);
    }
  }

  #handlePlayClick() {
    if (!this.#selectedZone) {
      return;
    }

    if (this.#isPlaying) {
      this.#view?.pauseWaveform();
    } else {
      this.#refreshSourceIfNeeded();
      this.#view?.playWaveform();
    }
  }

  #refreshSourceIfNeeded() {
    const blob = this.#selectedZone?.blob;
    if (!blob) return;

    const derivedId = blob.getDerivedId?.();
    const idTrack = blob.idTrack;
    const newUrl = derivedId ? getDerivedTrackUrl(derivedId) : getLibraryTrackUrl(idTrack);

    if (newUrl !== this.#currentUrl) {
      this.#currentUrl = newUrl;
      const duration = this.#zoneEnd - this.#zoneStart;
      this.#view?.setWaveformSource(newUrl, null, duration);
      this.#view?.seekWaveform(this.#zoneStart);
    }
  }

  #handleSeek(time) {
    const seekTime = this.#zoneStart + time;
    this.#view?.seekWaveform(seekTime);
  }

  #handleTimeUpdate(currentTime) {
    if (this.#zoneEnd > 0 && currentTime >= this.#zoneEnd) {
      this.#view?.stopWaveform();
      this.#isPlaying = false;
    }
  }

  #handlePlayStateChange(isPlaying) {
    this.#isPlaying = isPlaying;
    this.#view?.setPlayState(isPlaying);
  }

  #refresh() {
    if (this.#isOpen) {
      this.#updateView();
    }
  }

  async #updateView() {
    const hasSelection = this.#selectedZone !== null;

    if (hasSelection) {
      const pitch = this.#selectedZone.getPitch?.() ?? 0;
      const stretch = this.#selectedZone.getSpeed?.() ?? 1;
      const speedPercent = Math.round((1 / (stretch || 1)) * 100);
      const gain = this.#selectedZone.getGain?.() ?? 1;
      const gainPercent = Math.round(gain * 100);
      const pan = this.#selectedZone.getPan?.() ?? 0;

      const blob = this.#selectedZone.blob;
      const idTrack = blob?.idTrack;
      const derivedId = blob?.getDerivedId?.();

      this.#zoneStart = blob?.getStartTime?.() ?? 0;
      this.#zoneEnd = blob?.getEndTime?.() ?? 0;
      const duration = this.#zoneEnd - this.#zoneStart;

      const url = derivedId ? getDerivedTrackUrl(derivedId) : getLibraryTrackUrl(idTrack);
      this.#currentUrl = url;

      let waveformData = null;

      if (blob?.getWaveForm && duration > 0) {
        const scale = duration / 240;
        waveformData = await blob.getWaveForm(scale);
        waveformData = waveformData?.path || null;
      }

      this.#view?.setWaveformSource(url, waveformData, duration);
      this.#view?.seekWaveform(this.#zoneStart);

      this.#view?.setState({
        hasSelection: true,
        pitch,
        speed: speedPercent,
        gain: gainPercent,
        pan: Math.round(pan * 100),
        trackInfo: {
          label: this.#selectedZone.getLabel?.() ?? 'Unknown',
          duration: this.#selectedZone.getDuration?.() ?? 0,
          start: this.#selectedZone.getStart?.() ?? 0,
          end: this.#selectedZone.getEnd?.() ?? 0
        }
      });
    } else {
      this.#zoneStart = 0;
      this.#zoneEnd = 0;
      this.#currentUrl = null;
      this.#view?.clearWaveform();
      this.#view?.setState({
        hasSelection: false,
        pitch: 0,
        speed: 100,
        gain: 100,
        pan: 0,
        trackInfo: null
      });
    }
  }

}
