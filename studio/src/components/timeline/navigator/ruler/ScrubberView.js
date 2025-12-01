import { SLIDER_THUMB_WIDTH, MARGIN } from '../../../../config/ui';
import { Signals, applyTransform3d, getTimeFromPosX, View } from '../../../../lib';
import TimeTooltip from './TimeTooltip';

/** Scrubber indicator with drag functionality */
export default class ScrubberView extends View {
  #$button = null;
  #$line = null;
  #tooltip = null;
  #posX = 0;
  #isScrolling = false;
  #isPlaying = false;
  #parentLeft = 0;
  #validLeft = null;
  #validRight = null;
  #rulerView = null;

  onMove = new Signals.Signal();
  onStart = new Signals.Signal();
  onStop = new Signals.Signal();

  constructor($parent, rulerView) {
    super($parent);
    this.#rulerView = rulerView;
    this.mount();
  }

  template() {
    return `
      <div class="progress-bar-container">
        <div class="scrubber-container">
          <div data-ref="button" class="scrubber-button"></div>
          <div data-ref="line" class="line"></div>
        </div>
      </div>
    `;
  }

  render() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.template();
    this.$node = wrapper.firstElementChild;
    this.$parent.appendChild(this.$node);

    const $scrubberContainer = this.$node.querySelector('.scrubber-container');
    this.#$button = this.$node.querySelector('[data-ref="button"]');
    this.#$line = this.$node.querySelector('[data-ref="line"]');
    this.#tooltip = new TimeTooltip($scrubberContainer);

    // Insert tooltip before button
    $scrubberContainer.insertBefore(this.#tooltip.getElement(), this.#$button);
  }

  onMount() {
    this.#$button.addEventListener('contextmenu', this.#handleContextMenu);
    this.#$button.addEventListener('mousedown', this.#handleMouseDown);
    this.#$line.addEventListener('contextmenu', this.#handleContextMenu);
    this.#$line.addEventListener('mousedown', this.#handleMouseDown);
    this.#$line.addEventListener('mouseenter', this.#handleLineMouseEnter);
    this.#$line.addEventListener('mouseleave', this.#handleLineMouseLeave);
  }

  init() {
    const range = this.#rulerView.getRange();
    this.#validLeft = range.left;
    this.#validRight = range.right;
    this.#parentLeft = this.$node.parentElement.offsetLeft + SLIDER_THUMB_WIDTH / 2;
    this.#redraw();
    this.#moveTo(0);
  }

  zoom() {
    this.#redraw();
    const range = this.#rulerView.getRange();
    this.#validLeft = range.left;
    this.#validRight = range.right;
  }

  resize() {
    this.#redraw();
  }

  getPosX() {
    return this.#posX;
  }

  getAbsolutePosX() {
    return parseFloat(this.#posX + this.#rulerView.getPosX());
  }

  moveTo(posX, moveRuler = true) {
    this.#isPlaying = false;

    if (moveRuler) {
      this.#rulerView.moveTo(posX - (this.#posX - this.#validLeft));
    }

    this.#moveTo(posX);

    return true;
  }

  updateFrame(posX, preciseFrame, frame) {
    this.#isPlaying = true;
    const leftLimit = this.#validLeft;
    const rightLimit = this.#validRight;

    if (this.#posX - leftLimit <= 1 && this.#posX - leftLimit >= -1 && posX <= rightLimit) {
      return this.#rulerView.updateFrame(preciseFrame);
    }

    const leftPosX = this.#rulerView.getPosX();

    if (
      this.#posX - leftLimit > 0 &&
      this.#rulerView.getMaxWidth() - this.#rulerView.getWidth() > 0
    ) {
      this.#rulerView.updateFrame(frame);
    }

    return this.#moveTo(this.#posX + leftPosX + preciseFrame);
  }

  // ============================================================================
  // Private
  // ============================================================================

  #handleContextMenu = e => {
    e.preventDefault();

    return false;
  };

  #handleLineMouseEnter = () => {
    this.#tooltip.show(this.#posX + this.#rulerView.getPosX());
  };

  #handleLineMouseLeave = () => {
    this.#tooltip.hide();
  };

  #handleMouseDown = e => {
    e.preventDefault();
    e.stopPropagation();
    this.#isPlaying = false;
    this.onStop.dispatch();
    this.#handleMouseMove(e);
    document.addEventListener('mousemove', this.#handleMouseMove, false);
    document.addEventListener('mouseup', this.#handleMouseUp, false);
    this.#tooltip.show(this.#posX + this.#rulerView.getPosX());
  };

  #handleMouseMove = e => {
    let posRel = e.clientX - this.#parentLeft;
    const leftPosX = this.#rulerView.getPosX();
    const maxWidth = this.#rulerView.getWidth();
    posRel = posRel <= 0 ? 0 : posRel;
    posRel = posRel >= maxWidth ? maxWidth : posRel;
    let posX = posRel + leftPosX;

    if (this.#isScrolling === false && posRel % maxWidth === 0) {
      this.#isScrolling = true;
      this.#posX = posX - this.#rulerView.getPosX();
      this.#scrollTo(posX);
    } else {
      if (this.#posX % maxWidth !== 0) {
        this.#isScrolling = false;
      }

      this.#moveTo(posX);
    }

    const max = this.$node.getAttribute('max');
    posX = max < posX ? max : posX;
    this.#tooltip.show(posX);
  };

  #handleMouseUp = e => {
    document.removeEventListener('mousemove', this.#handleMouseMove, false);
    document.removeEventListener('mouseup', this.#handleMouseUp, false);
    let posRel = e.clientX - this.#parentLeft;
    const leftPosX = this.#rulerView.getPosX();
    const maxWidth = this.#rulerView.getWidth();
    posRel = posRel <= 0 ? 0 : posRel;
    posRel = posRel >= maxWidth ? maxWidth : posRel;
    const posX = posRel + leftPosX;
    this.#isScrolling = false;
    this.onMove.dispatch(getTimeFromPosX(posX));

    if (this.#isPlaying) {
      this.onStart.dispatch();
    }

    this.#tooltip.hide();
  };

  #scrollTo(posX) {
    const width = this.#rulerView.getWidth();

    const scroll = () => {
      if (
        this.#isScrolling === true &&
        posX > 0 &&
        posX < this.#validRight + this.#validLeft &&
        Math.round(this.#posX) % width === 0
      ) {
        window.requestAnimationFrame(scroll);

        if (Math.round(this.#posX) - width === 0) {
          this.#rulerView.updateFrame(3);
          posX = this.#rulerView.getPosX() + width;
        } else {
          this.#rulerView.updateFrame(-3);
          posX = this.#rulerView.getPosX();
        }

        this.#posX = posX - this.#rulerView.getPosX();
        this.onMove.dispatch(getTimeFromPosX(posX));
        this.#tooltip.show(posX);
      }

      this.#moveTo(posX);
    };

    window.requestAnimationFrame(scroll);
  }

  #redraw() {
    const maxWidth = this.#rulerView.getMaxWidth();
    this.$node.setAttribute('max', maxWidth);
    this.$node.style.width = maxWidth + MARGIN + 'px';
    this.#$line.style.height = document.querySelector('.timeline').offsetHeight - 50 + 'px';
  }

  #moveTo(posX) {
    posX = posX - this.#rulerView.getPosX();
    const max = this.$node.getAttribute('max');
    posX = max < posX ? max : posX;

    applyTransform3d(this.#$button, posX, 0, 0);
    applyTransform3d(this.#$line, posX, 0, 0);
    this.#tooltip.setPosition(posX);

    this.#posX = parseFloat(posX);

    return true;
  }
}
