import { MARGIN, SCRUBBER_LINE_OFFSET } from '../../../../config/ui';
import { SCROLL_MODE, TIMELINE } from '../../../../config/constants';
import { applyTransform3d, getTimeFromPosX, View, getNavigatorX } from '../../../../lib';
import SnappingService from '../../../../services/SnappingService';

/** Scrubber indicator with drag functionality */
export default class ScrubberView extends View {
  #$scrubberContainer = null;
  #$button = null;
  #$line = null;
  #$cursorContainer = null;
  #$cursorLine = null;
  #posX = 0;
  #isScrolling = false;
  #isPlaying = false;
  #wasPlayingBeforeDrag = false;
  #validLeft = null;
  #validRight = null;
  #rulerView = null;
  #navigatorEl = null;
  #onMove = null;
  #onStart = null;
  #onStop = null;

  constructor($parent, rulerView, callbacks = {}) {
    super($parent);
    this.#rulerView = rulerView;
    this.#onMove = callbacks.onMove || (() => {});
    this.#onStart = callbacks.onStart || (() => {});
    this.#onStop = callbacks.onStop || (() => {});

    this.mount();
  }

  render() {
    this.$node = document.createElement('div');
    this.$node.className = 'progress-bar-container';

    this.#$scrubberContainer = document.createElement('div');
    this.#$scrubberContainer.className = 'scrubber-container';

    this.#$button = document.createElement('div');
    this.#$button.className = 'scrubber-button';
    this.#$button.dataset.testid = 'scrubber-handle';
    this.#$button.setAttribute('role', 'slider');
    this.#$button.setAttribute('aria-label', 'Timeline scrubber');
    this.#$button.setAttribute('aria-valuemin', '0');
    this.#$button.setAttribute('tabindex', '0');

    this.#$line = document.createElement('div');
    this.#$line.className = 'line';

    this.#$cursorContainer = document.createElement('div');
    this.#$cursorContainer.className = 'cursor-container';

    this.#$cursorLine = document.createElement('div');
    this.#$cursorLine.className = 'cursor-line-bar';

    this.#$scrubberContainer.appendChild(this.#$button);
    this.#$scrubberContainer.appendChild(this.#$line);
    this.#$cursorContainer.appendChild(this.#$cursorLine);
    this.$node.appendChild(this.#$scrubberContainer);
    this.$node.appendChild(this.#$cursorContainer);
    this.$parent.appendChild(this.$node);
  }

  onMount() {
    this.#$button.addEventListener('contextmenu', this.#handleContextMenu);
    this.#$button.addEventListener('mousedown', this.#handleMouseDown);
    this.#$line.addEventListener('contextmenu', this.#handleContextMenu);
    this.#$line.addEventListener('mousedown', this.#handleMouseDown);
  }

  init() {
    const range = this.#rulerView.getRange();
    this.#validLeft = range.left;
    this.#validRight = range.right;
    this.#redraw();
    this.#moveTo(0);

    this.#navigatorEl = this.$parent.closest('.navigator');

    if (this.#navigatorEl) {
      this.#navigatorEl.addEventListener('mouseenter', this.#handleCursorEnter);
      this.#navigatorEl.addEventListener('mouseleave', this.#handleCursorLeave);
      this.#navigatorEl.addEventListener('mousemove', this.#handleCursorMove);
    }
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

    if (TIMELINE.SCROLL_MODE === SCROLL_MODE.PAGE_FLIP) {
      return this.#updateFramePageFlip(preciseFrame);
    }

    return this.#updateFrameContinuous(posX, preciseFrame, frame);
  }

  #updateFrameContinuous(posX, preciseFrame, frame) {
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

  #updateFramePageFlip(preciseFrame) {
    const viewportWidth = this.#rulerView.getWidth();
    const newPosX = this.#posX + preciseFrame;

    if (newPosX > viewportWidth) {
      this.#rulerView.updateFrame(viewportWidth);
      this.#posX = newPosX - viewportWidth;
    } else {
      this.#posX = newPosX;
    }

    applyTransform3d(this.#$scrubberContainer, this.#posX, 0, 0);

    return true;
  }

  #getPositionFromEvent(event) {
    let posRel = getNavigatorX(event, this.#navigatorEl);
    const leftPosX = this.#rulerView.getPosX();
    const maxWidth = this.#rulerView.getWidth();

    posRel = posRel <= 0 ? 0 : posRel;
    posRel = posRel >= maxWidth ? maxWidth : posRel;

    const posX = posRel + leftPosX;

    return { posRel, posX, leftPosX, maxWidth };
  }

  #handleContextMenu = event => {
    event.preventDefault();

    return false;
  };

  #handleMouseDown = event => {
    event.preventDefault();
    event.stopPropagation();
    this.#wasPlayingBeforeDrag = this.#isPlaying;
    this.#isPlaying = false;
    this.#onStop();

    if (event.target === this.#$line) {
      this.#handleMouseMove(event);
    }

    document.addEventListener('mousemove', this.#handleMouseMove, false);
    document.addEventListener('mouseup', this.#handleMouseUp, false);
  };

  #handleMouseMove = event => {
    const { posRel, posX, leftPosX, maxWidth } = this.#getPositionFromEvent(event);

    const snappedPosX = SnappingService.snap(posX, {
      visibleRange: {
        start: getTimeFromPosX(leftPosX),
        end: getTimeFromPosX(leftPosX + maxWidth)
      }
    });

    if (this.#isScrolling === false && posRel % maxWidth === 0) {
      this.#isScrolling = true;
      this.#posX = snappedPosX - this.#rulerView.getPosX();
      this.#scrollTo(snappedPosX);
    } else {
      if (this.#posX % maxWidth !== 0) {
        this.#isScrolling = false;
      }

      this.#moveTo(snappedPosX);
    }
  };

  #handleMouseUp = event => {
    document.removeEventListener('mousemove', this.#handleMouseMove, false);
    document.removeEventListener('mouseup', this.#handleMouseUp, false);

    const { posX } = this.#getPositionFromEvent(event);
    this.#isScrolling = false;
    this.#onMove(getTimeFromPosX(posX));

    if (this.#wasPlayingBeforeDrag) {
      this.#onStart();
    }
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
        this.#onMove(getTimeFromPosX(posX));
      }

      this.#moveTo(posX);
    };

    window.requestAnimationFrame(scroll);
  }

  #redraw() {
    const maxWidth = this.#rulerView.getMaxWidth();
    this.$node.setAttribute('max', maxWidth);
    this.$node.style.width = maxWidth + MARGIN + 'px';
    const lineHeight =
      document.querySelector('.timeline').offsetHeight - SCRUBBER_LINE_OFFSET + 'px';
    this.#$line.style.height = lineHeight;
    this.#$cursorLine.style.height = lineHeight;
  }

  #moveTo(posX) {
    posX = posX - this.#rulerView.getPosX();
    const max = this.$node.getAttribute('max');
    posX = max < posX ? max : posX;

    applyTransform3d(this.#$scrubberContainer, posX, 0, 0);

    this.#posX = parseFloat(posX);

    return true;
  }

  #handleCursorEnter = () => {
    this.#$cursorContainer.classList.add('visible');
  };

  #handleCursorLeave = () => {
    this.#$cursorContainer.classList.remove('visible');
  };

  #handleCursorMove = event => {
    const mouseX = getNavigatorX(event, this.#navigatorEl);
    const rulerPosX = this.#rulerView.getPosX();
    const absolutePosX = mouseX + rulerPosX;

    if (absolutePosX < 0) {
      return;
    }

    applyTransform3d(this.#$cursorContainer, mouseX, 0, 0);
  };

  onDestroy() {
    this.#$button?.removeEventListener('contextmenu', this.#handleContextMenu);
    this.#$button?.removeEventListener('mousedown', this.#handleMouseDown);
    this.#$line?.removeEventListener('contextmenu', this.#handleContextMenu);
    this.#$line?.removeEventListener('mousedown', this.#handleMouseDown);

    this.#navigatorEl?.removeEventListener('mouseenter', this.#handleCursorEnter);
    this.#navigatorEl?.removeEventListener('mouseleave', this.#handleCursorLeave);
    this.#navigatorEl?.removeEventListener('mousemove', this.#handleCursorMove);

    document.removeEventListener('mousemove', this.#handleMouseMove);
    document.removeEventListener('mouseup', this.#handleMouseUp);

    super.onDestroy();
  }
}
