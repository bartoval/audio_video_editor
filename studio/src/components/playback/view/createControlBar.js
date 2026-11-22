/** ControlBar factory - orchestrates playback buttons, scrubber, and timer */
import { createElement } from '../../../lib';
import { createPlaybackButtons } from './createPlaybackButtons';
import { createScrubber } from './createScrubber';
import { createTimer } from './createTimer';

export function createControlBar($parent) {
  let handlers = {};
  let buttons = null;
  let scrubber = null;
  let timer = null;

  // Layout: scrubber across the full width, then [timecode | centered buttons | spacer]
  const $el = createElement('div', {
    className: 'transport w-100',
    html: `
      <div data-ref="scrubberRow" class="transport-scrubber"></div>
      <div data-ref="controls" class="transport-controls"></div>
    `,
    parent: $parent
  });

  const $controlsRow = $el.querySelector('[data-ref="controls"]');
  const $scrubberRow = $el.querySelector('[data-ref="scrubberRow"]');

  timer = createTimer($controlsRow);
  buttons = createPlaybackButtons($controlsRow);
  scrubber = createScrubber($scrubberRow);

  buttons.bind({
    onPlay: () => handlers.onPlay?.(),
    onPause: () => handlers.onPause?.(),
    onStop: () => handlers.onStop?.(),
    onRewind: () => handlers.onRewind?.(),
    onSkipBack: seconds => handlers.onSkipBack?.(seconds),
    onSkipForward: seconds => handlers.onSkipForward?.(seconds),
    onFastForward: () => handlers.onFastForward?.(),
    onMarkerPrevious: () => handlers.onMarkerPrevious?.(),
    onMarkerNext: () => handlers.onMarkerNext?.(),
    onLoopToggle: () => handlers.onLoopToggle?.()
  });

  scrubber.bind({
    onScrub: time => handlers.onScrub?.(time),
    onScrubbing: time => {
      timer.setState({ currentTime: time });
      handlers.onScrubbing?.(time);
    }
  });

  return {
    el: $el,

    bind(newHandlers) {
      handlers = newHandlers;
    },

    setState(state) {
      if (state.isPlaying !== undefined) {
        buttons.setState({ isPlaying: state.isPlaying });
      }

      if (state.currentTime !== undefined) {
        scrubber.setState({ currentTime: state.currentTime });
        timer.setState({ currentTime: state.currentTime });
      }

      if (state.duration !== undefined) {
        scrubber.setState({ duration: state.duration });
        timer.setState({ duration: state.duration });
      }

      if (state.aspectRatio !== undefined) {
        timer.setState({ aspectRatio: state.aspectRatio });
      }

      if (state.disabled !== undefined) {
        buttons.setState({ disabled: state.disabled });
        scrubber.setState({ disabled: state.disabled });
      }

      if (state.error !== undefined) {
        $el.classList.toggle('has-error', !!state.error);
      }

      if (state.hasMarkers !== undefined) {
        buttons.setState({ hasMarkers: state.hasMarkers });
      }

      if (state.isLoopActive !== undefined) {
        buttons.setState({ isLoopActive: state.isLoopActive });
      }
    },

    resize() {
      return scrubber.resize();
    },

    destroy() {
      buttons?.destroy();
      scrubber?.destroy();
      timer?.destroy();
      $el.remove();
    }
  };
}
