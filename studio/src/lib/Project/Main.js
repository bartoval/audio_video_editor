import Config from 'Config';

export default class Main {
  constructor() {
  }

  /** Load project data */
  load() {
    return window.fetch(Config.getUrl('load'))
    .then(response => {
      return response.json();
    })
    .catch(() => {
      throw new Error('export failed');
    });
  }

  /** Save project backup */
  backup(config) {
    let body = JSON.stringify({
      video: config.video.src,
      scenes: config.navigator.scenes,
      tracks: config.navigator.tracks
    });

    return window.fetch(Config.getUrl('backup'),
      {
        method: 'POST',
        body: body
      })
    .then(response => {
      return response.json();
    })
    .catch(() => {
      throw new Error('export failed');
    });
  }

  /** Publish project for export */
  publish(config) {
    let body = JSON.stringify({
      duration: config.video.duration,
      video: config.video.src,
      tracks: config.navigator.tracks
    });

    return window.fetch(Config.getUrl('export'),
      {
        method: 'POST',
        body: body
      })
    .then(response => {
      return response.json();
    })
    .catch(() => {
      throw new Error('export failed');
    });
  }
}
