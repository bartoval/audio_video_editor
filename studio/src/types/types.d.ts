/**
 * Consolidated type definitions
 *
 * Usage in JS files:
 * // @ts-check
 * /** @type {import('./types/types').PlaybackState} *\/
 */

// ============================================================================
// Global Declarations
// ============================================================================

declare global {
  interface Window {
    /** Shared AudioContext instance */
    audioContextInstance: AudioContext;
  }
}

// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_AUTH_ENABLED?: string;
  readonly VITE_AUTH_URL?: string;
  readonly VITE_AUTH_CALLBACK_URL?: string;
  readonly VITE_AUTH_CLIENT_ID?: string;
  readonly VITE_AUTH_REALM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// ============================================================================
// Store Types
// ============================================================================

export type StateUpdater<T> = Partial<T> | ((prevState: T) => Partial<T> | undefined);
export type StoreSubscriber<T> = (newState: T) => void;
export type Unsubscribe = () => boolean;

export type ActionCreator<T, Args extends unknown[] = unknown[]> = (
  state: T,
  ...args: Args
) => Partial<T> | undefined;

export interface StoreOptions<T, A extends Record<string, ActionCreator<T>>> {
  actions?: A;
}

export interface Store<T, A extends Record<string, (...args: unknown[]) => void> = Record<string, never>> {
  getState: () => T;
  setState: (updater: StateUpdater<T>) => void;
  subscribe: (callback: StoreSubscriber<T>) => Unsubscribe;
  actions: A;
}

export interface TimeSlice {
  start: number;
  end: number;
}

export interface PlaybackState {
  duration: number;
  time: number;
  isPlaying: boolean;
  isLoopEnabled: boolean;
  timeSlice: TimeSlice;
  /** > 0 */
  speed: number;
}

export interface PlaybackActions {
  init: (duration: number) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  tick: (time: number) => void;
  setTimeSlice: (slice: TimeSlice) => void;
  resetTimeSlice: () => void;
  setSpeed: (speed: number) => void;
  toggleLoop: () => void;
  setLoopEnabled: (enabled: boolean) => void;
}

export type PlaybackStore = Store<PlaybackState, PlaybackActions>;

// ============================================================================
// Audio Types
// ============================================================================

export interface VolumePointData {
  times: Float32Array | number[];
  /** 0-1 */
  values: Float32Array | number[];
}

export interface VolumeSample {
  startTime: number;
  durationTime: number;
  data: VolumePointData;
}

export type VolumeEnvelope = VolumeSample[];

export interface VolumeConfig {
  volumeData?: VolumeEnvelope;
  /** 0-2, default 1 */
  gain?: number;
}

export interface AudioConfig {
  id: string | number;
  idTrack: string | number;
  isDerived?: boolean;
  startTime?: number;
  startTimeBuffer?: number;
  endTimeBuffer?: number;
  isCutBuffer?: boolean;
  /** -1 if not cut */
  start?: number;
  /** -1 if not cut */
  end?: number;
  buffer?: AudioBuffer;
  /** -1 to 1 */
  panValue?: number;
  volumeData?: VolumeEnvelope;
}

/** -1 (left) to 1 (right), 0 center */
export type PanValue = number;

// ============================================================================
// Track Types
// ============================================================================

export interface TrackFlatConfig {
  id: string;
  groupId?: string;
  idTrack: string | number;
  derivedId?: string;
  label?: string;
  startTime: number;
  durationTime: number;
  panValue?: PanValue;
  volumeValues?: VolumeEnvelope;
  volumePaths?: VolumePaths;
  /** 0.5 to 2.0 */
  stretchFactor?: number;
  pitch?: number;
  /** 0 to 2 */
  gain?: number;
  isCut?: boolean;
  startTimeCut?: number;
  durationTimeCut?: number;
  start?: number;
  end?: number;
  startTimeBuffer?: number;
  durationTimeBuffer?: number;
  path?: string;
  viewBox?: number;
  buffer?: AudioBuffer;
}

export interface BezierPathData {
  startX: number;
  startValue: number;
  startControlX: number;
  startControlValue: number;
  endX: number;
  endValue: number;
  endControlX: number;
  endControlValue: number;
  controlX: number;
  controlValue: number;
}

export interface VolumePaths {
  startPoints: string;
  endPoints: string;
  paths: BezierPathData[];
}

export interface ControllerConfig {
  id: string;
  /** 0.5 to 2.0 */
  stretchFactor?: number;
  panValue?: PanValue;
  volumePaths?: VolumePaths;
  path?: string;
  viewBox?: string;
}

export interface VolumeControllerCallbacks {
  onChangeVolume?: (volumeArray: VolumeEnvelope) => void;
}

export interface FadeHandlesConfig {
  id: string;
  duration: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface FadeChangeData {
  type: 'in' | 'out';
  fadeIn: number;
  fadeOut: number;
}

export interface FadeHandlesCallbacks {
  onFadeChange?: (data: FadeChangeData) => void;
}

export type DragOperation = 'move' | 'resize-left' | 'resize-right';

export interface DragContext {
  operation: DragOperation;
  startPosX: number;
  startTime: number;
  startDuration: number;
}

export interface TrackInfo {
  idTrack: string | number;
  derivedId?: string | null;
  label: string;
  startTime: number;
  durationTime: number;
  groupId?: string;
}

export interface AudioInfo {
  buffer?: AudioBuffer | null;
  panValue: number;
  volumeValues: VolumeEnvelope;
  volumePaths?: VolumePaths | null;
}

export interface CutInfo {
  start: number;
  end: number;
  startTimeCut: number;
  durationTimeCut: number;
  isCut: boolean;
  isCutBuffer?: boolean;
  startTimeBuffer?: number;
  endTimeBuffer?: number;
}

export interface TransformInfo {
  /** 0.5 to 2.0 */
  stretchFactor: number;
  pitch: number;
  /** 0 to 2 */
  gain: number;
}

export interface WaveformInfo {
  path?: string | null;
  viewBox?: number;
}

export interface TrackStructuredConfig {
  id: string;
  track: TrackInfo;
  audio: AudioInfo;
  cut: CutInfo;
  transform: TransformInfo;
  waveform: WaveformInfo;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface UserInfo {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  status: AuthStatus;
  user: UserInfo | null;
  error: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// ============================================================================
// Services Types
// ============================================================================

export type TileStatus = 'pending' | 'loading' | 'ready' | 'error';

export interface TileMetadata {
  status: TileStatus;
  data: Float32Array | null;
  timestamp: number;
  promise: Promise<Float32Array> | null;
}

export interface TileResult {
  tileIdx: number;
  tileStart: number;
  tileEnd: number;
  peaks: Float32Array;
}

export interface PersistOptions {
  key: string;
  fields?: string[] | null;
  debounce?: number;
}

// ============================================================================
// Utils Types
// ============================================================================

export interface DragCallbacks {
  onStart?: (event: MouseEvent, startX: number, startY: number) => void;
  onMove?: (event: MouseEvent, deltaX: number, deltaY: number, startX: number, startY: number) => void;
  onEnd?: (event: MouseEvent, deltaX: number, deltaY: number, wasDragged: boolean) => void;
}

export interface DragOptions {
  threshold?: number;
  usePointerCapture?: boolean;
  cursor?: string;
}

export interface WaveformPoint {
  x: number;
  y: number;
}

export interface DrawWaveformOptions {
  width: number;
  height: number;
  startIdx?: number;
  endIdx?: number;
  offsetX?: number;
  color?: string;
  lineWidth?: number;
  yScale?: number;
  clear?: boolean;
}

// ============================================================================
// Internal Instances
// ============================================================================
export type AudioInstance = import('../lib/audio/Audio').default;

export interface DrawWaveformWindowOptions {
  width: number;
  height: number;
  windowStart: number;
  windowEnd: number;
  dataStart?: number;
  dataEnd?: number;
  duration: number;
  color?: string;
  lineWidth?: number;
  yScale?: number;
}

export interface CreateWaveformSvgOptions {
  width: number;
  height: number;
  duration: number;
  color?: string;
  lineWidth?: number;
  yScale?: number;
  className?: string;
}

export interface GetWaveformPathDataOptions {
  width: number;
  height: number;
  duration: number;
  yScale?: number;
}
