// @ts-check

/**
 * @typedef {Object} TrackedJob
 * @property {string} jobId
 * @property {string} type - Job type: 'stems', 'scene-detect'
 * @property {string} audioId - Library audio ID
 * @property {string} filename - Original filename for download
 * @property {number} audioDurationMs - Audio duration in ms (for ETA)
 * @property {number} createdAt - Timestamp
 */

import { downloadFromUrl } from '../lib';
import { JOB_TRACKER, TOAST_DURATION } from '../config/ui';
import { EVENT, LABEL } from '../config/constants';
import * as EventService from './EventService';
import * as apiService from './api';
import { uiStore } from '../store';

const { STORAGE_KEY } = JOB_TRACKER;

/** @type {Map<string, TrackedJob>} */
const jobs = new Map();

/** @type {(() => void) | null} */
let sseUnsubscribe = null;

const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
      const parsed = JSON.parse(stored);
      parsed
        .filter(job => job.type === 'stems' || job.type === 'scene-detect')
        .forEach(job => jobs.set(job.jobId, job));
    }
  } catch {
    // Storage not available or corrupted
  }
};

const saveToStorage = () => {
  try {
    const jobsArray = Array.from(jobs.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobsArray));
  } catch {
    // Storage not available
  }
};

const emitCountChanged = () => {
  EventService.emitLocal(EVENT.JOB_COUNT_CHANGED, {
    count: jobs.size,
    jobs: Array.from(jobs.values())
  });
};

const removeJob = jobId => {
  jobs.delete(jobId);
  saveToStorage();
  emitCountChanged();
};

/**
 * @param {TrackedJob} job
 */
const handleStemsCompleted = job => {
  uiStore.actions.pushToast({
    type: 'success',
    msg: `${LABEL.STEMS_READY}: ${job.filename}`,
    timeHide: TOAST_DURATION.long
  });

  const downloadUrl = apiService.getStemsDownloadUrl(job.audioId, job.jobId);
  downloadFromUrl(downloadUrl, `${job.filename}_stems.zip`);

  EventService.emitLocal(EVENT.JOB_COMPLETED, {
    type: job.type,
    jobId: job.jobId,
    audioId: job.audioId
  });
};

/**
 * @param {TrackedJob} job
 * @param {Object} data - SSE payload with scene detection result
 */
const handleSceneDetectionCompleted = (job, data) => {
  uiStore.actions.pushToast({
    type: 'success',
    msg: LABEL.SCENE_DETECTION_READY,
    timeHide: TOAST_DURATION.long
  });

  EventService.emitLocal(EVENT.SCENE_DETECTION_READY, {
    jobId: job.jobId,
    scenes: data.scenes
  });
};

/**
 * @param {TrackedJob} job
 * @param {string} error
 */
const handleJobFailed = (job, error) => {
  const failLabels = {
    'scene-detect': LABEL.SCENE_DETECTION_FAILED,
    stems: LABEL.STEMS_FAILED
  };
  const failLabel = failLabels[job.type] || LABEL.STEMS_FAILED;

  uiStore.actions.pushToast({
    type: 'error',
    msg: `${failLabel}: ${job.filename}`,
    details: error,
    timeHide: TOAST_DURATION.long
  });

  EventService.emitLocal(EVENT.JOB_FAILED, {
    type: job.type,
    jobId: job.jobId,
    audioId: job.audioId,
    error
  });
};

/**
 * Handle SSE job:completed event from backend
 * @param {{ type: string, jobId: string, audioId?: string, status: string, error?: string }} data
 */
const handleSseJobCompleted = data => {
  const { jobId, status, error } = data;
  const job = jobs.get(jobId);

  if (!job) {
    return;
  }

  if (status === 'completed') {
    if (job.type === 'scene-detect') {
      handleSceneDetectionCompleted(job, data);
    } else {
      handleStemsCompleted(job);
    }
  } else if (status === 'failed') {
    handleJobFailed(job, error || 'Job failed');
  }

  removeJob(jobId);
};

/**
 * Initialize JobTrackerService - load pending jobs and subscribe to SSE
 */
export const init = () => {
  loadFromStorage();
  sseUnsubscribe = EventService.on('job:completed', handleSseJobCompleted);
  emitCountChanged();
};

/**
 * Track a new job
 * @param {string} jobId
 * @param {{ type: string, audioId: string, filename: string, audioDurationMs?: number }} metadata
 */
export const track = (jobId, metadata) => {
  const job = {
    jobId,
    type: metadata.type,
    audioId: metadata.audioId,
    filename: metadata.filename,
    audioDurationMs: metadata.audioDurationMs || 0,
    createdAt: Date.now()
  };

  jobs.set(jobId, job);
  saveToStorage();
  emitCountChanged();
};

/**
 * Stop tracking a job (e.g., user cancelled)
 * @param {string} jobId
 */
export const untrack = jobId => {
  removeJob(jobId);
};

/**
 * Check if a job is being tracked
 * @param {string} jobId
 * @returns {boolean}
 */
export const isTracking = jobId => jobs.has(jobId);

/**
 * Get all tracked jobs
 * @returns {TrackedJob[]}
 */
export const getJobs = () => Array.from(jobs.values());

/**
 * Get job count
 * @returns {number}
 */
export const getJobCount = () => jobs.size;

/**
 * Cleanup - unsubscribe from SSE
 */
export const destroy = () => {
  if (sseUnsubscribe) {
    sseUnsubscribe();
    sseUnsubscribe = null;
  }
};
