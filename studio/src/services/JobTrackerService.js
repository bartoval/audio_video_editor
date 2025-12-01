// @ts-check

/**
 * @typedef {Object} TrackedJob
 * @property {string} jobId
 * @property {string} type - Job type: 'stems', 'transcribe', 'ai-music', 'scene-detect'
 * @property {string} audioId - Library audio ID (empty for ai-music)
 * @property {string} filename - Original filename for download
 * @property {string} [title] - Job title (for ai-music placeholders)
 * @property {number} audioDurationMs - Audio duration in ms (for ETA)
 * @property {number} createdAt - Timestamp
 */

import { downloadFromUrl } from '../lib';
import { JOB_TRACKER, TOAST_DURATION } from '../config/ui';
import { EVENT, LABEL } from '../config/constants';
import { AI_MUSIC } from '../config/routes';
import * as EventService from './EventService';
import * as apiService from './api';
import { aiMusicStore, uiStore } from '../store';

const { STORAGE_KEY } = JOB_TRACKER;

/** @type {Map<string, TrackedJob>} */
const jobs = new Map();

/** @type {(() => void) | null} */
let sseUnsubscribe = null;

/** @type {(() => void) | null} */
let connectedUnsubscribe = null;

const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
      const parsed = JSON.parse(stored);
      parsed.forEach(job => jobs.set(job.jobId, job));
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
 * @param {Object} data - SSE payload with transcription result
 */
const handleTranscriptionCompleted = (job, data) => {
  uiStore.actions.pushToast({
    type: 'success',
    msg: `${LABEL.TRANSCRIPTION_READY}: ${job.filename}`,
    timeHide: TOAST_DURATION.long
  });

  EventService.emitLocal(EVENT.TRANSCRIPTION_READY, {
    audioId: job.audioId,
    jobId: job.jobId,
    result: {
      text: data.text,
      segments: data.segments,
      language: data.language,
      duration: data.duration
    }
  });
};

/**
 * @param {TrackedJob} job
 * @param {Object} data - SSE payload with saved tracks
 */
const handleAiMusicCompleted = (job, data) => {
  uiStore.actions.pushToast({
    type: 'success',
    msg: `${LABEL.AI_MUSIC_READY}: ${job.filename}`,
    timeHide: TOAST_DURATION.long
  });

  aiMusicStore.actions.setComplete(data.tracks || []);

  EventService.emitLocal(EVENT.AI_MUSIC_COMPLETE, {
    tracks: data.tracks || [],
    savedByBackend: true
  });
};

/**
 * @param {TrackedJob} job
 * @param {string} errorMsg
 */
const handleAiMusicFailed = (job, errorMsg) => {
  uiStore.actions.pushToast({
    type: 'error',
    msg: `${LABEL.AI_MUSIC_FAILED}: ${job.filename}`,
    details: errorMsg,
    timeHide: TOAST_DURATION.long
  });

  aiMusicStore.actions.setError(errorMsg);

  EventService.emitLocal(EVENT.AI_MUSIC_ERROR, { error: errorMsg });
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
  if (job.type === 'ai-music') {
    handleAiMusicFailed(job, error);

    return;
  }

  const failLabels = {
    transcribe: LABEL.TRANSCRIPTION_FAILED,
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
 * @param {{ type: string, jobId: string, audioId?: string, status: string, error?: string, tracks?: Array }} data
 */
const handleSseJobCompleted = data => {
  const { jobId, status, error } = data;
  const job = jobs.get(jobId);

  if (!job) {
    return;
  }

  if (status === 'completed') {
    if (job.type === 'transcribe') {
      handleTranscriptionCompleted(job, data);
    } else if (job.type === 'ai-music') {
      handleAiMusicCompleted(job, data);
    } else if (job.type === 'scene-detect') {
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
 * Check pending ai-music job status on SSE reconnect
 * @param {TrackedJob} job
 */
const checkAiMusicJobStatus = async job => {
  try {
    const response = await fetch(AI_MUSIC.job(job.jobId));

    if (!response.ok) {
      if (response.status === 404) {
        handleAiMusicFailed(job, 'Job expired');
        removeJob(job.jobId);
      }

      return;
    }

    const data = await response.json();

    if (data.status === 'complete' && data.savedTracks?.length > 0) {
      handleAiMusicCompleted(job, { tracks: data.savedTracks });
      removeJob(job.jobId);
    } else if (data.status === 'error') {
      handleAiMusicFailed(job, data.error || 'Generation failed');
      removeJob(job.jobId);
    }
  } catch {
    // Network error, will retry on next reconnect
  }
};

/**
 * Handle SSE reconnection: check pending ai-music jobs
 */
/** @type {boolean} */
let placeholdersRestored = false;

/**
 * Handle SSE reconnection: restore placeholders on first connect, check pending jobs
 */
const handleReconnect = () => {
  if (!placeholdersRestored) {
    placeholdersRestored = true;

    const pendingAiMusic = Array.from(jobs.values()).filter(job => job.type === 'ai-music');

    for (const job of pendingAiMusic) {
      EventService.emitLocal(EVENT.AI_MUSIC_GENERATING, {
        title: job.title || job.filename || null,
        trackCount: 2
      });
    }
  }

  const pendingAiMusic = Array.from(jobs.values()).filter(job => job.type === 'ai-music');

  for (const job of pendingAiMusic) {
    checkAiMusicJobStatus(job);
  }
};

/**
 * Initialize JobTrackerService - load pending jobs and subscribe to SSE
 */
export const init = () => {
  loadFromStorage();
  sseUnsubscribe = EventService.on('job:completed', handleSseJobCompleted);
  connectedUnsubscribe = EventService.on('connected', handleReconnect);
  emitCountChanged();
};

/**
 * Track a new job
 * @param {string} jobId
 * @param {{ type: string, audioId: string, filename: string, title?: string, audioDurationMs?: number }} metadata
 */
export const track = (jobId, metadata) => {
  const job = {
    jobId,
    type: metadata.type,
    audioId: metadata.audioId,
    filename: metadata.filename,
    title: metadata.title || null,
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

  if (connectedUnsubscribe) {
    connectedUnsubscribe();
    connectedUnsubscribe = null;
  }
};
