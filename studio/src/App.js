/**
 * Created by valerio bartolini.
 */
import './style.css';
import Timer from './components/timer/Timer';
import Media from './components/media/Container';
import Navigator from './components/timeline/Navigator';
import Video from './components/video/Video';
import Player from './components/player/Player';
import Notificator from './components/notificator/Notificator';
import Resizer from './components/resizer/Resizer';
import Menu from './components/menu/Menu';
import Mediator from 'Mediator';
import Config from 'Config';
import Project from 'Project/Main';

class App {
  /**
   *
   * @param config
   * @returns {boolean}
   */
  init(config = undefined) {
    config && Config.setRemotePath(config);

    const root = document.querySelector('.studio'),
      url = Config.getVideoSrc();
    new Notificator(root);

    // Check WASM support
    if (!Config.isWasmSupported()) {
      console.warn('[App] SharedArrayBuffer not available.');
      console.warn('[App] To enable WASM, serve with headers:');
      console.warn('  Cross-Origin-Opener-Policy: same-origin');
      console.warn('  Cross-Origin-Embedder-Policy: require-corp');
      Config.setWasmEnabled(false);
    } else {
      console.log('[App] WASM support detected, FFmpeg WASM available');
    }

    // install components
    new Media(root.querySelector('.studio-library .library'));
    new Video(root.querySelector('.studio-preview'));
    new Player(root.querySelector('.studio-preview')); // Player controls now inside video preview
    new Navigator(root.querySelector('.studio-timeline'));
    new Menu(root.querySelector('.studio-header .container-fluid'));
    new Resizer(root.querySelector('.studio-resizer'));
    new Timer();
    // Auto-load saved project data (same as pressing "load" button in menu)
    const projectService = new Project();
    projectService.load()
      .then(response => {
        const isEmpty = Object.keys(response).length === 0;

        if (!isEmpty) {
          // Load video with full project data (tracks, scenes, etc.)
          Mediator.onLoadVideo(response.video, response);
          console.log('[App] Project loaded automatically');
        } else {
          // No saved project, just load video from URL
          url !== '' && Mediator.onLoadVideo(url).then(() => {
            console.log('[App] Video loaded (no saved project)');
          }).catch(err => {
            console.log(err);
          });
        }
      })
      .catch(err => {
        console.log('[App] No saved project found, loading video only:', err);
        // Fallback: load video from URL
        url !== '' && Mediator.onLoadVideo(url).then(() => {
          // console.log('video loaded');
        }).catch(err2 => {
          console.log(err2);
        });
      });

    return true;
  }

  /*  test() {
   let audioContextInstance = new AudioContext(),
   source = 'resources/audioTracks/alarm.wav',
   ext = source.split('.')[1],
   node = {url: '', buff: ''}, pos = -1, isHeader = true, pointer = 0, start = 0, playTime = null,
   // mp3 = false,
   chunks = [],
   socket = new WebSocket(Config.getSocketUrl()),
   syncStream = node0 => {
   let buf8 = new Uint8Array(node0.buf), i, b;
   buf8.indexOf = Array.prototype.indexOf;
   i = node0.sync;
   b = buf8;
   isHeader = true;
   while (isHeader === true) {
   node0.retry++;
   i = b.indexOf(0xFF, i);
   if (i === -1 || (b[i + 1] & 0xE0) === 0xE0) {
   isHeader = false;
   }
   i++;
   }
   if (i !== -1) {
   let tmp = node0.buf.slice(i);
   delete node0.buf;
   node0.buf = null; // there it returns copy => clean!
   node0.buf = tmp;
   node0.sync = i;
   return true;
   }
   return false;
   },
   decode = (node0, pos0) => {
   audioContextInstance.decodeAudioData(node0.buf,
   (decoded) => {
   chunks[pos0] = {data: decoded, pos: pos0};
   },
   () => { // only on error attempt to sync on frame boundary
   if (syncStream(node0)) decode(node0);
   });
   },
   play = setInterval(() => {
   pointer === chunks.length && clearInterval(play);
   for (let i = pointer; i < chunks.length; i++) {
   let buffer = chunks[i],
   sourceBuffer = '';
   if (buffer !== undefined && buffer.data !== null) {
   playTime = playTime === null ? audioContextInstance.currentTime : playTime;
   sourceBuffer = audioContextInstance.createBufferSource();
   sourceBuffer.buffer = buffer.data;
   console.log(buffer.data.duration);
   sourceBuffer.connect(audioContextInstance.destination);
   sourceBuffer.start(playTime + start);
   start += buffer.data.duration;
   pointer = i + 1;
   buffer.data = null;
   chunks[i].data = null;
   }
   else {
   break;
   }
   }
   }, 2000);
   socket.binaryType = 'arraybuffer';
   socket.onopen = () => {
   socket.send(source);
   };
   socket.onmessage = buff => {
   let data = buff.data;
   if (ext === 'wav') {
   let chunk = new Uint8Array(buff.data),
   wav = new Uint8Array(44 + chunk.length),
   view = new DataView(wav.buffer);
   view.setUint32(0, 1380533830, false); // RIFF identifier 'RIFF'
   view.setUint32(4, 36 + chunk.length, true); // file length minus RIFF identifier length and file description length
   view.setUint32(8, 1463899717, false); // RIFF type 'WAVE'
   view.setUint32(12, 1718449184, false); // format chunk identifier 'fmt '
   view.setUint32(16, 16, true); // format chunk length
   view.setUint16(20, 1, true); // sample format (raw)
   view.setUint16(22, 2, true); // channel count
   view.setUint32(24, 44100, true); // sample rate
   view.setUint32(28, 44100 * 2 * 2, true); // byte rate (sample rate * block align)
   view.setUint16(32, 2 * 2, true); // block align (channel count * bytes per sample)
   view.setUint16(34, 16, true); // bits per sample
   view.setUint32(36, 1684108385, false); // data chunk identifier 'data'
   view.setUint32(40, chunk.length, true); // data chunk length
   wav.set(chunk, 44); // 44 offset header bytes
   data = wav.buffer;
   }
   node.buf = data;
   node.sync = 0;
   node.retry = 0;
   pos++;
   node.pos = pos;
   decode(node, pos);
   };
   socket.onerror = (error) => {
   console.log('WebSocket error: ' + error);
   };
   socket.onclose = () => {
   console.log('WebSocket closed');
   };
   }*/
}

document.addEventListener('DOMContentLoaded', async () => {
  const pathParts = window.location.pathname.split('/');
  const studioIndex = pathParts.indexOf('studio');
  const uuid = studioIndex !== -1 && pathParts[studioIndex + 1] ? pathParts[studioIndex + 1] : null;

  if (!uuid) {
    try {
      const response = await fetch(Config.getApiUrl() + 'api/projects');
      const projects = await response.json();

      if (projects.length > 0) {
        window.location.href = `/studio/${projects[0].uuid}`;

        return;
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  }

  const config = {
    userId: '0',
    uuid: uuid || '0'
  };

  new App().init(config);
});

export default App;
