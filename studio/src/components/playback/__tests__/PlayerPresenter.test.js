import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../Mediator', () => ({ default: { registerPlayer: vi.fn() } }));
vi.mock('../../../services/EventService', () => ({
  on: vi.fn(() => vi.fn()),
  emitLocal: vi.fn()
}));
vi.mock('../../../store', () => ({
  playbackStore: {
    subscribe: vi.fn(() => vi.fn()),
    getState: vi.fn(() => ({ isPlaying: false, time: 0, isLoopEnabled: false }))
  }
}));

import PlayerPresenter from '../PlayerPresenter';

describe('PlayerPresenter', () => {
  let player;

  beforeEach(() => {
    document.body.innerHTML = '<div class="studio-preview"></div>';
    player = new PlayerPresenter(document.querySelector('.studio-preview'));
  });

  afterEach(() => {
    player.destroy?.();
    document.body.innerHTML = '';
  });

  const timerText = () => document.querySelector('[data-ref="time"]').textContent;

  it('shows the initial time right away instead of the --:--.-- placeholder', () => {
    expect(timerText()).toBe('00:00.00');
  });

  it('updates the timer when the time changes', () => {
    player.setState({ currentTime: 65.5 });

    expect(timerText()).toBe('01:05.50');
  });
});
