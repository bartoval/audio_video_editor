import { TRACKS } from '../../../../../constants';
import { getPosXFromTime } from '../../../../../lib';
import { Zone } from '../../../../core/zones';

const { MIN_CUT_DURATION_FALLBACK } = TRACKS;

export default class CutZoneController extends Zone {
  constructor(config, $parent) {
    super(config, $parent);
    this.render($parent);
  }

  setStart(start) {
    super.setStart(start);
  }

  setDuration(duration) {
    super.setDuration(duration);
  }

  /** Show the cut zone preview */
  show(startTime, duration) {
    this.setStart(startTime);
    this.setDuration(Math.abs(duration) || MIN_CUT_DURATION_FALLBACK);
    this.#updatePosition();
    this.getRoot().classList.add('visible');
  }

  /** Hide the cut zone preview */
  hide() {
    this.getRoot().classList.remove('visible');
    this.setStart(0);
    this.setDuration(0);
  }

  /** Update the cut zone position during mouse move */
  update(startTime, duration) {
    const actualStart = duration >= 0 ? startTime : startTime + duration;
    const actualDuration = Math.abs(duration) || MIN_CUT_DURATION_FALLBACK;

    this.setStart(actualStart);
    this.setDuration(actualDuration);
    this.#updatePosition();
  }

  /** Update DOM position */
  #updatePosition() {
    const left = getPosXFromTime(this.getStart());
    const width = getPosXFromTime(this.getDuration());
    const $root = this.getRoot();

    $root.style.left = `${left}px`;
    $root.style.width = `${width}px`;
  }

  render() {
    this.getRoot().classList.add('cut-zone');
  }
}
