export default (function Config() {
  // In production, use same origin (relative URLs). In dev, use VITE_API_URL or localhost
  const isDev = import.meta.env.DEV;
  const apiUrl = isDev
    ? (import.meta.env.VITE_API_URL || 'http://localhost:8080')
    : window.location.origin;

  let url = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/',
    prefix = 'api/studio/',
    userId = '0',
    uuid = '0',
    path = {
      metaInfoAudioList: prefix + 'audio/metaInfo/list',
      metaInfoVideo: prefix + 'metaInfoVideo',
      export: prefix + 'export',
      backup: prefix + 'backup',
      load: prefix + 'load',
      stretch: prefix + 'stretch',
      stretchAck: prefix + 'stretchAck'
    },
    /**
     * WASM Configuration
     * Controls whether to use FFmpeg WASM (browser-side) or server for audio processing
     */
    wasmEnabled = true,
    wasmLoaded = false,
    _isWasmSupported = () => typeof SharedArrayBuffer !== 'undefined' && window.crossOriginIsolated,
    _isWasmEnabled = () => wasmEnabled && _isWasmSupported(),
    _setWasmEnabled = value => { wasmEnabled = value; },
    _setWasmLoaded = value => { wasmLoaded = value; },
    _isWasmLoaded = () => wasmLoaded,
    /**
     * Variables
     * stores values like timeline margins, colors, ruler dimensions, video params...
     */
    sliderThumbWidth = 12, // width of indicator thumbs

    _getScaleMap = () => {
      return [
        {scale: 0.01, unit: 'seconds', line: 10, subLine: 5},
        {scale: 0.02, unit: 'seconds', line: 10, subLine: 5},
        {scale: 0.05, unit: 'seconds', line: 10, subLine: 5},
        {scale: 0.1, unit: 'seconds', line: 100, subLine: 5},
        {scale: 0.2, unit: 'seconds', line: 100, subLine: 5},
        {scale: 0.5, unit: 'seconds', line: 100, subLine: 5},
        {scale: 1.0, unit: 'seconds', line: 100, subLine: 5},
        {scale: 2.0, unit: 'seconds', line: 100, subLine: 5},
        {scale: 5.0, unit: 'seconds', line: 100, subLine: 5},
        {scale: 10.0, unit: 'seconds', line: 100, subLine: 5},
        {scale: 30.0, unit: 'seconds', line: 100, subLine: 5},
        {scale: 60.0, unit: 'minutes', line: 100, subLine: 5},
        {scale: 120.0, unit: 'minutes', line: 100, subLine: 5},
        {scale: 300.0, unit: 'minutes', line: 100, subLine: 5},
        {scale: 600.0, unit: 'minutes', line: 100, subLine: 5}
      ];
    },
    _getColorMap = () => {
      return [
        'rgba(189, 121, 0,1)',
        'rgba(27, 11, 26,1)',
        'rgba(153, 153, 0,1)',
        'rgba(102, 51, 0,1)',
        'rgba(153, 0, 0,1)',
        'rgba(67, 109, 67,1)',
        'rgba(153, 153, 204,1)',
        'rgba(153, 153, 153,1)',
        'rgba(153, 153, 255,1)',
        'rgba(204, 153, 255,1)',
        'rgba(255, 153, 255,1)',
        'rgba(255, 153, 204,1)',
        'rgba(224, 224, 224,1)',
        'rgba(102, 178, 255,1)',
        'rgba(59, 68, 101,1)',
        'rgba(153, 51, 255,1)'
      ];
    },
    /**
     * UI Constants
     * Bootstrap-compatible colors and styling values
     */
    ui = {
      // Scene colors (Bootstrap 5 palette)
      sceneColors: [
        '#0dcaf0', '#20c997', '#6f42c1', '#d63384', '#fd7e14',
        '#ffc107', '#198754', '#0d6efd', '#6610f2', '#dc3545'
      ],
      // Default/fallback color (Bootstrap secondary)
      defaultColor: '#6c757d',
      waveformColor: '#0dcaf0',
      // Button variants
      btnVariant: {
        primary: 'outline-info',
        secondary: 'outline-secondary'
      }
    },
    _getUI = () => ui,
    _getResizeBound = () => {
      return {
        minHeight: 155,
        defaultHeight: 350
      };
    },
    _getSliderThumbWidth = () => {
      return sliderThumbWidth;
    },
    _getMargin = () => {
      return sliderThumbWidth / 2;
    },
    _getCanvasUpBound = () => {
      return 32767;
    },
    _getUrl = (op = '') => {
      if (op !== '' && path[op] === undefined) {
        throw new Error('Missing configuration: route not exist for ' + op);
      }
      let route = op && path[op] ? path[op] : '';

      return url + route + '/' + uuid;
    },
    _getSocketUrl = () => {
      const wsUrl = apiUrl.replace(/^http/, 'ws');

      return wsUrl;
    },
    _setRemotePath = params => {
      userId = params.userId || 0;
      uuid = params.uuid || 0;
      return true;
    },
    _getUuid = () => {
      return uuid;
    },
    _getUserId = () => {
      return userId;
    },
    cacheBuster = Date.now(),
    _invalidateCache = () => {
      cacheBuster = Date.now();
    },
    _getVideoSrc = () => {
      return `${url}${prefix}video/${uuid}?t=${cacheBuster}`;
    },
    _getTrack = (id = -1) => {
      const base = id !== -1 ? `${url}${prefix}audio/${uuid}/${id}` : `${url}audio/${uuid}`;

      return `${base}?t=${cacheBuster}`;
    },
    _getLibraryTrack = (filename) => {
      return `${url}libraryAudio/${uuid}/${filename}`;
    },
    _getThumbsSrc = (filename) => {
      const base = `${url}${prefix}thumbs/${uuid}/thumbs/`;

      return filename ? `${base}${filename}?t=${cacheBuster}` : base;
    },
    _getSingleThumbSrc = (time) => {
      return `${url}${prefix}thumb/${uuid}/${time.toFixed(2)}`;
    };
  return {
    getScaleMap: _getScaleMap,
    getColorMap: _getColorMap,
    getUI: _getUI,
    getMargin: _getMargin,
    getResizeBound: _getResizeBound,
    getCanvasUpBound: _getCanvasUpBound,
    getSliderThumbWidth: _getSliderThumbWidth,
    getUrl: _getUrl,
    getSocketUrl: _getSocketUrl,
    setRemotePath: _setRemotePath,
    getVideoSrc: _getVideoSrc,
    getTrack: _getTrack,
    getLibraryTrack: _getLibraryTrack,
    getUuid: _getUuid,
    getUserId: _getUserId,
    getThumbsSrc: _getThumbsSrc,
    getSingleThumbSrc: _getSingleThumbSrc,
    getApiUrl: () => url,
    invalidateCache: _invalidateCache,
    isWasmSupported: _isWasmSupported,
    isWasmEnabled: _isWasmEnabled,
    setWasmEnabled: _setWasmEnabled,
    setWasmLoaded: _setWasmLoaded,
    isWasmLoaded: _isWasmLoaded
  };
})();

