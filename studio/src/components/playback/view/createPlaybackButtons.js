/** Playback buttons factory - play/pause/stop/skip controls */
import { createElement, createIconButton, togglePair } from '../../../lib';
import { PLAYBACK } from '../../../config/ui';

const { SKIP_SECONDS } = PLAYBACK;

export function createPlaybackButtons($parent) {
  let handlers = {};
  let isPlaying = false;
  let isLoopActive = false;
  let hasMarkers = false;

  const $container = createElement('div', {
    className: 'd-flex align-items-center gap-2',
    parent: $parent
  });

  const $el = createElement('div', {
    className: 'btn-group btn-group-lg',
    attrs: { role: 'group', 'aria-label': 'Playback controls' },
    parent: $container
  });

  const handleClick = callback => event => {
    event.preventDefault();
    event.stopPropagation();
    callback();
  };

  createIconButton({
    icon: 'skip-start-fill',
    title: 'Rewind to start',
    attrs: { 'aria-label': 'Rewind to start' },
    onClick: handleClick(() => handlers.onRewind?.()),
    parent: $el
  });

  createIconButton({
    icon: 'skip-backward-fill',
    title: `Skip back ${SKIP_SECONDS}s`,
    attrs: { 'aria-label': `Skip back ${SKIP_SECONDS} seconds` },
    onClick: handleClick(() => handlers.onSkipBack?.(SKIP_SECONDS)),
    parent: $el
  });

  const $playBtn = createIconButton({
    icon: 'play-fill',
    title: 'Play',
    attrs: { 'aria-label': 'Play' },
    onClick: handleClick(() => handlers.onPlay?.()),
    parent: $el
  });

  const $pauseBtn = createIconButton({
    icon: 'pause-fill',
    title: 'Pause',
    attrs: { 'aria-label': 'Pause' },
    onClick: handleClick(() => handlers.onPause?.()),
    parent: $el
  });
  $pauseBtn.classList.add('d-none');

  createIconButton({
    icon: 'stop-fill',
    title: 'Stop',
    attrs: { 'aria-label': 'Stop' },
    onClick: handleClick(() => handlers.onStop?.()),
    parent: $el
  });

  createIconButton({
    icon: 'skip-forward-fill',
    title: `Skip forward ${SKIP_SECONDS}s`,
    attrs: { 'aria-label': `Skip forward ${SKIP_SECONDS} seconds` },
    onClick: handleClick(() => handlers.onSkipForward?.(SKIP_SECONDS)),
    parent: $el
  });

  createIconButton({
    icon: 'skip-end-fill',
    title: 'Go to end',
    attrs: { 'aria-label': 'Go to end' },
    onClick: handleClick(() => handlers.onFastForward?.()),
    parent: $el
  });

  const $markerGroup = createElement('div', {
    className: 'btn-group btn-group-lg',
    attrs: { role: 'group', 'aria-label': 'Marker navigation' },
    parent: $container
  });

  const $prevMarkerBtn = createIconButton({
    icon: 'chevron-bar-left',
    title: 'Previous marker ([)',
    attrs: { 'aria-label': 'Previous marker', disabled: true },
    onClick: handleClick(() => handlers.onMarkerPrevious?.()),
    parent: $markerGroup
  });

  const $nextMarkerBtn = createIconButton({
    icon: 'chevron-bar-right',
    title: 'Next marker (])',
    attrs: { 'aria-label': 'Next marker', disabled: true },
    onClick: handleClick(() => handlers.onMarkerNext?.()),
    parent: $markerGroup
  });

  const $loopBtn = createIconButton({
    icon: 'repeat',
    title: 'Loop between markers (L)',
    attrs: { 'aria-label': 'Loop between markers', disabled: true },
    onClick: handleClick(() => handlers.onLoopToggle?.()),
    parent: $markerGroup
  });

  const updateMarkerButtons = () => {
    $prevMarkerBtn.disabled = !hasMarkers;
    $nextMarkerBtn.disabled = !hasMarkers;
    $loopBtn.disabled = !hasMarkers;
    $loopBtn.classList.toggle('active', isLoopActive);
  };

  const updateButtons = () => {
    if (isPlaying) {
      togglePair($pauseBtn, $playBtn);
    } else {
      togglePair($playBtn, $pauseBtn);
    }
  };

  return {
    el: $container,

    bind(newHandlers) {
      handlers = newHandlers;
    },

    setState(state) {
      if (state.isPlaying !== undefined) {
        isPlaying = state.isPlaying;
        updateButtons();
      }

      if (state.disabled !== undefined) {
        const buttons = $el.querySelectorAll('button');
        buttons.forEach(btn => {
          btn.disabled = state.disabled;
        });
      }

      if (state.hasMarkers !== undefined) {
        hasMarkers = state.hasMarkers;
        updateMarkerButtons();
      }

      if (state.isLoopActive !== undefined) {
        isLoopActive = state.isLoopActive;
        updateMarkerButtons();
      }
    },

    destroy() {
      $container.remove();
    }
  };
}
