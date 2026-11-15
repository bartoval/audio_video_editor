import { describe, it, expect, vi, afterEach } from 'vitest';
import * as JobTrackerService from '../JobTrackerService';
import * as EventService from '../EventService';
import { downloadFromUrl } from '../../lib';
import { JOB_TRACKER } from '../../config/ui';
import { EVENT } from '../../config/constants';

vi.mock('../../lib', () => ({ downloadFromUrl: vi.fn() }));
vi.mock('../api', () => ({ getStemsDownloadUrl: () => '/stems.zip' }));
vi.mock('../../store', () => ({ uiStore: { actions: { pushToast: vi.fn() } } }));

describe('JobTrackerService', () => {
  afterEach(() => {
    JobTrackerService.destroy();
    JobTrackerService.getJobs().forEach(job => JobTrackerService.untrack(job.jobId));
    localStorage.removeItem(JOB_TRACKER.STORAGE_KEY);
    vi.clearAllMocks();
  });

  it('ignores old transcription jobs and completes restored stems and scene jobs', () => {
    const pending = ['transcribe', 'stems', 'scene-detect'].map(type => ({
      jobId: type,
      type,
      audioId: 'audio',
      filename: 'song'
    }));
    localStorage.setItem(JOB_TRACKER.STORAGE_KEY, JSON.stringify(pending));
    const onScenes = vi.fn();
    const unsubscribe = EventService.on(EVENT.SCENE_DETECTION_READY, onScenes);

    try {
      JobTrackerService.init();
      expect(JobTrackerService.getJobs()).toEqual(pending.slice(1));

      EventService.emitLocal('job:completed', { jobId: 'transcribe', status: 'completed' });
      expect(downloadFromUrl).not.toHaveBeenCalled();

      EventService.emitLocal('job:completed', { jobId: 'stems', status: 'completed' });
      expect(downloadFromUrl).toHaveBeenCalledExactlyOnceWith('/stems.zip', 'song_stems.zip');

      const scenes = [{ time: 2, type: 'cut', score: 27 }];
      EventService.emitLocal('job:completed', {
        jobId: 'scene-detect',
        status: 'completed',
        scenes
      });
      expect(onScenes).toHaveBeenCalledWith({ jobId: 'scene-detect', scenes });
      expect(JobTrackerService.getJobs()).toEqual([]);
    } finally {
      unsubscribe();
    }
  });
});
