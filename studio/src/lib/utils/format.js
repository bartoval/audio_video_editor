export const formatBytes = (bytes) => {
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

export const formatSampleRate = (rate) => {
  if (!rate) {
    return '';
  }

  return `${(rate / 1000).toFixed(1)} kHz`;
};

export const formatBitrate = (bitrate) => {
  if (!bitrate) {
    return '';
  }

  return `${bitrate} kbps`;
};

export const formatDuration = (seconds) => {
  const sec = ~~seconds % 60;
  const min = ~~(seconds / 60) % 60;
  const ms = ~~(seconds * 1000) % 100;

  const padded = (num) => num.toString().padStart(2, '0');

  return `${padded(min)}:${padded(sec)}.${padded(ms)}`;
};

export const buildMetaString = ({ format, codec, bitrate, sampleRate, channelLayout }) => {
  const formatUpper = format && format.toUpperCase();
  const codecUpper = codec && codec.toUpperCase();

  const parts = [
    formatUpper,
    codecUpper !== formatUpper && codecUpper,
    bitrate && formatBitrate(bitrate),
    sampleRate && formatSampleRate(sampleRate),
    channelLayout
  ].filter(Boolean);

  return parts.join(' • ');
};
