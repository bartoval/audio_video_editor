export const formatBytes = bytes => {
  if (!bytes) {
    return '';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const formatSampleRate = rate => {
  if (!rate) {
    return '';
  }

  return `${(rate / 1000).toFixed(1)} kHz`;
};

export const formatBitrate = bitrate => {
  if (!bitrate) {
    return '';
  }

  return `${bitrate} kbps`;
};

export const formatDuration = seconds => {
  const totalSeconds = Math.floor(seconds);
  const sec = totalSeconds % 60;
  const min = Math.floor(totalSeconds / 60) % 60;
  const ms = Math.floor((seconds * 1000) % 1000);

  const pad2 = num => num.toString().padStart(2, '0');
  const pad3 = num => num.toString().padStart(3, '0');

  return `${pad2(min)}:${pad2(sec)}.${pad3(ms)}`;
};

export const buildMetaString = ({
  format,
  bitrate,
  sampleRate,
  channelLayout,
  channels,
  bitDepth
}) => {
  const formatUpper = format && format.toUpperCase();
  const derivedLayout =
    channelLayout ||
    (channels === 1 ? 'mono' : channels === 2 ? 'stereo' : channels ? `${channels}ch` : null);

  const parts = [
    formatUpper,
    bitDepth && `${bitDepth}-bit`,
    bitrate && formatBitrate(bitrate),
    sampleRate && formatSampleRate(sampleRate),
    derivedLayout
  ].filter(Boolean);

  return parts.join(' • ');
};

export const formatElapsedTime = ms => {
  const totalSeconds = Math.floor(ms / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
};

const STANDARD_RATIOS = [
  { width: 32, height: 9 },
  { width: 21, height: 9 },
  { width: 16, height: 9 },
  { width: 16, height: 10 },
  { width: 3, height: 2 },
  { width: 4, height: 3 },
  { width: 5, height: 4 },
  { width: 1, height: 1 },
  { width: 4, height: 5 },
  { width: 3, height: 4 },
  { width: 2, height: 3 },
  { width: 10, height: 16 },
  { width: 9, height: 16 },
  { width: 9, height: 21 }
];

const RATIO_TOLERANCE = 0.015;

const gcd = (valA, valB) => (valB === 0 ? valA : gcd(valB, valA % valB));

export const formatAspectRatio = ratio => {
  if (!ratio) {
    return '';
  }

  const [rawWidth, rawHeight] = ratio.split(':').map(Number);

  if (!rawWidth || !rawHeight) {
    return ratio;
  }

  const divisor = gcd(rawWidth, rawHeight);
  const simpleWidth = rawWidth / divisor;
  const simpleHeight = rawHeight / divisor;

  if (simpleWidth <= 100 && simpleHeight <= 100) {
    return `${simpleWidth}:${simpleHeight}`;
  }

  const decimal = rawWidth / rawHeight;

  for (const { width, height } of STANDARD_RATIOS) {
    if (Math.abs(decimal - width / height) < RATIO_TOLERANCE) {
      return `${width}:${height}`;
    }
  }

  return `${simpleWidth}:${simpleHeight}`;
};

/** Draw formatted time on a canvas element */
export const drawTimeOnCanvas = (canvas, time) => {
  const ctx = canvas.getContext('2d');
  const text = formatDuration(time);
  const computedStyle = window.getComputedStyle(canvas.parentElement);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = computedStyle.font;
  ctx.fillStyle = computedStyle.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
};
