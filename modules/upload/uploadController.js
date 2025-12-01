const { ROOT_PATH, EDITOR_PROJECTS } = require('../../config/paths');
const TMP_CHUNKS = '.tmp_chunks';

let
  fs = require('fs'),
  flow = require('../flow/flow-node.js')(TMP_CHUNKS),
  ffmpeg = require('fluent-ffmpeg'),
  probe = require('node-ffprobe'),
  child = require('child_process'),
  ACCESS_CONTROLL_ALLOW_ORIGIN = true;

/**
 *
 * @param time
 * @returns {string}
 */
let convertDurationToDigitalClock = time => { // seconds
    let sec = ~~time % 60,
      min = ~~(time / 60) % 60;
    time = ~~(time * 1000) % 100;
    sec = sec < 10 ? '0' + sec.toFixed(0) : sec.toFixed(0);
    min = min < 10 ? '0' + min.toFixed(0) : min.toFixed(0);
    time = time < 10 ? '0' + time.toFixed(0) : time.toFixed(0);
    return min + ':' + sec + '.' + time;
  },
  /**
   *
   * @param path
   */
  deleteFolderRecursive = function(path) {
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach(function(file) {
        let curPath = path + "/" + file;
        if (fs.lstatSync(curPath).isDirectory()) {
          deleteFolderRecursive(curPath);
        } else {
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  },
  /**
   *
   * @param dir
   * @returns {boolean}
   */
  createDir = dir => {
    fs.mkdirSync(dir);
    return true;
  },
  /**
   *
   * @param file
   * @param out
   * put
   */
  generateThumbs = (file, output, filename, num) => {
    const thumbHeight = 80;
    const webpQuality = 80;
    let ffmpeg0,
      cmd = `ffmpeg -i "${file}" -vf "fps=2,scale=-1:${thumbHeight},tile=${Math.ceil(num * 2)}x1" -quality ${webpQuality} "${output}0.01.webp"`;
    ffmpeg0 = child.exec(cmd, () => {
      console.log('thumbs generated');
    });
    cmd = `ffmpeg -i "${file}" -vf "fps=1,scale=-1:${thumbHeight},tile=${Math.ceil(num)}x1" -quality ${webpQuality} "${output}0.02.webp"`;
    child.exec(cmd, () => {
      console.log('thumbs generated');
    });
    cmd = `ffmpeg -i "${file}" -vf "fps=0.4,scale=-1:${thumbHeight},tile=${Math.ceil(num * 0.4)}x1" -quality ${webpQuality} "${output}0.05.webp"`;
    child.exec(cmd, () => {
      console.log('thumbs generated');
    });
    cmd = `ffmpeg -i "${file}" -vf "fps=0.2,scale=-1:${thumbHeight},tile=${Math.ceil(num * 0.2)}x1" -quality ${webpQuality} "${output}0.1.webp"`;
    child.exec(cmd, () => {
      console.log('thumbs generated');
    });
    ffmpeg0.stderr.on('data', (data) => {
      //  console.log(data.toString());
    });
    ffmpeg0.stderr.on('end', () => {
      console.log('process has been created successfully');
    });

    ffmpeg0.stderr.on('exit', () => {
      console.log('child process exited');
    });

    ffmpeg0.stderr.on('close', () => {
      console.log('process closed');
    });

    /*    cmd = 'ffmpeg  -ss 13 -i "' + file + '" -vf "fps=1/20,scale=200:200" "' + output + 'cover-'+filename + '"';
     ffmpeg0 = child.exec(cmd, () => {
     console.log('cover generated');
     });*/
  };

var USER_ID = '0';

// Track processed audio uploads to prevent duplicates from race conditions
var processedAudioUploads = new Set();

exports.isVideoConverted = (req, res) => {
  let uuid = req.params.uuid,
    dirProject = ROOT_PATH + EDITOR_PROJECTS + USER_ID + '/' + uuid,
    status = false,
    metadata = {};
  if (fs.existsSync(dirProject + '/info.json')) {
    let buffer = fs.readFileSync(dirProject + '/info.json').toString();
    metadata = JSON.parse(buffer).metadata;
    status = metadata.status;
  }
  res.status(200).send({status: status, metadata: metadata});
};

// SSE endpoint for conversion progress
exports.conversionStream = (req, res) => {
  let uuid = req.params.uuid,
    dirProject = ROOT_PATH + EDITOR_PROJECTS + USER_ID + '/' + uuid,
    timerId = null,
    closed = false;

  console.log('SSE connection opened for:', uuid);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const checkStatus = () => {
    if (closed) {
      return;
    }

    console.log('Checking conversion status for:', uuid);

    if (fs.existsSync(dirProject + '/info.json')) {
      let buffer = fs.readFileSync(dirProject + '/info.json').toString();
      let metadata = JSON.parse(buffer).metadata;

      console.log('Current status:', metadata.status);

      if (metadata.status === 'ready') {
        console.log('Conversion ready, sending SSE event');
        res.write(`data: ${JSON.stringify({ status: 'ready', metadata })}\n\n`);
        res.end();

        return;
      } else if (metadata.status === 'error') {
        console.log('Conversion error, sending SSE event');
        res.write(`data: ${JSON.stringify({ status: 'error', metadata })}\n\n`);
        res.end();

        return;
      }
    }

    // Still pending, check again
    timerId = setTimeout(checkStatus, 1000);
  };

  checkStatus();

  req.on('close', () => {
    console.log('SSE connection closed by client');
    closed = true;

    if (timerId) {
      clearTimeout(timerId);
    }
  });
};
exports.convertVideo = (req, res) => {
  let uuid = req.params.uuid,
    dirProject = ROOT_PATH + EDITOR_PROJECTS + USER_ID + '/' + uuid,
    file = dirProject + '/' + 'originalWithAudio.mp4',
    metadata = {},
    isMuteVideo = true;

  console.log('convertVideo called for:', file);
  console.log('File exists:', fs.existsSync(file));

  probe(file, (err, meta) => {
    if (err) {
      console.log('Probe error:', err);
    }
    if (meta !== undefined) {
      meta.streams.forEach((elem) => {
        if (elem.codec_type === 'audio') {
          isMuteVideo = false;
        }
      });
      metadata = {
        status: 'pending',
        id: meta.filename,
        name: meta.metadata.title === undefined ? meta.filename : meta.metadata.title,
        duration: meta.format.duration * 1000, // ms
        durationFormatted: convertDurationToDigitalClock(meta.format.duration),
        displayAspectRatio: meta.streams[0].display_aspect_ratio,
      };
      generateThumbs(file, dirProject + '/thumbs/', 'thumb-%d.png', meta.format.duration);

    }
    fs.writeFileSync(dirProject + '/info.json', JSON.stringify({
      metadata: metadata
    }));

    console.log('Video has audio:', !isMuteVideo);
    console.log('Starting ffmpeg conversion...');

    if (isMuteVideo === false) {
      ffmpeg(file)
        .output(dirProject + '/resources/videoTracks/original.mp4')
        .videoCodec('copy')
        .noAudio()
        .output(dirProject + '/resources/videoTracks/small.mp4')
        .videoCodec('libx264')
        .noAudio()
        .size('?x155')
        .output(dirProject + '/resources/audioTracks/audio.wav')
        .output(dirProject + '/resources/audioTracks/audio.mp3')
        .on('start', (commandLine) => {
          console.log('FFmpeg started with command:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('FFmpeg progress:', progress.percent, '%');
        })
        .on('error', (err) => {
          console.log('FFmpeg error: ' + err);
          metadata.status = 'error';
          fs.writeFileSync(dirProject + '/info.json', JSON.stringify({
            metadata: metadata
          }), () => {
            console.log('changed status info.json error')
          });
        })
        .on('end', () => {
          console.log('Processing finished !');
          metadata.status = 'ready';
          fs.writeFileSync(dirProject + '/info.json', JSON.stringify({
            metadata: metadata
          }));
        })
        .run();
    }
    else {
      ffmpeg(file)
        .output(dirProject + '/resources/videoTracks/original.mp4')
        .videoCodec('copy')
        .noAudio()
        .output(dirProject + '/resources/videoTracks/small.mp4')
        .videoCodec('libx264')
        .noAudio()
        .size('?x155')
        .on('start', function(commandLine) {
          console.log('FFmpeg started with command:', commandLine);
        })
        .on('progress', function(progress) {
          console.log('FFmpeg progress:', progress.percent, '%');
        })
        .on('error', function(err) {
          console.log('FFmpeg error: ' + err);
          metadata.status = 'error';
          fs.writeFileSync(dirProject + '/info.json', JSON.stringify({
            metadata: metadata
          }));
        })
        .on('end', function() {
          console.log('Processing finished !');
          metadata.status = 'ready';
          fs.writeFileSync(dirProject + '/info.json', JSON.stringify({
            metadata: metadata
          }));
        })
        .run();
    }
  });
  res.status(200).send();
};
/**
 * Upload chunks video when last chunk has been sent files and create the user environment
 * @param req
 * @param res
 */

exports.upload = (req, res) => {
  flow.post(req, (status, filename, original_filename, identifier, currentTestChunk, numberOfChunks) => {
    console.log('Flow status:', status, 'chunk:', currentTestChunk, '/', numberOfChunks);

    if (status === 'done') {
      let project = req.body.project_uuid,
        dirProject = ROOT_PATH + EDITOR_PROJECTS + USER_ID + '/' + project,
        file = dirProject + '/' + 'originalWithAudio.mp4';

      console.log('Upload complete, saving to:', file);

      if (!fs.existsSync(dirProject)) {
        fs.mkdirSync(dirProject, { recursive: true });
        console.log('Created project dir:', dirProject);
      }

      // Create resources subdirectories for ffmpeg output
      const videoTracksDir = dirProject + '/resources/videoTracks';
      const audioTracksDir = dirProject + '/resources/audioTracks';
      if (!fs.existsSync(videoTracksDir)) {
        fs.mkdirSync(videoTracksDir, { recursive: true });
        console.log('Created videoTracks dir:', videoTracksDir);
      }
      if (!fs.existsSync(audioTracksDir)) {
        fs.mkdirSync(audioTracksDir, { recursive: true });
        console.log('Created audioTracks dir:', audioTracksDir);
      }

      // delete previous thumb folder
      deleteFolderRecursive(dirProject + '/thumbs');
      if (!fs.existsSync(dirProject + '/thumbs')) {
        fs.mkdirSync(dirProject + '/thumbs');
      }

      // write metadata video
      fs.writeFileSync(dirProject + '/info.json', JSON.stringify({
        metadata: {status: 'pending'}
      }));

      // NOW create file stream after directories exist
      let fileStream = fs.createWriteStream(file);

      // finish stream
      flow.write(identifier, fileStream, {end: true});
      fileStream.on('finish', () => {
        console.log('File written successfully:', file);
        flow.clean(identifier);
        res.status(200).json({ status: 'complete', file: file });
      });
    } else if (status === 'partly_done') {
      res.status(200).json({ status: 'partly_done' });
    } else {
      res.status(200).json({ status: status });
    }
  });
};

exports.uploadOptions = (req, res) => {
  if (ACCESS_CONTROLL_ALLOW_ORIGIN) {
    res.header("Access-Control-Allow-Origin", "*");
  }
  res.status(200).send();
};

exports.download = (req, res) => {
  flow.write(req.params.identifier, res);
};
/**
 * Retrieves video uploaded
 * @param req
 * @param res
 * @returns {null}
 */
exports.video = (req, res) => {
  if (ACCESS_CONTROLL_ALLOW_ORIGIN) {
    res.header("Access-Control-Allow-Origin", "*");
  }
  let uuid = req.params.uuid,
    mimeType = 'video/mp4',
    file = ROOT_PATH + EDITOR_PROJECTS + USER_ID + '/' + uuid + '/resources/videoTracks/small.mp4',
    fileStream = '';
  if (fs.existsSync(file)) {
    if (req.headers.range) { // if (req.headers.range)
      let stats = fs.statSync(file),
        range = req.headers.range,
        parts = range.replace(/bytes=/, "").split("-"),

        partialstart = parts[0],
        partialend = parts[1],
        total = stats.size,
        start = parseInt(partialstart, 10),
        end = partialend ? parseInt(partialend, 10) : total - 1,
        chunksize = start >= end ? 0 : (end - start + 1);

      if (start >= total || end >= total) {
        // Indicate the acceptable range.
        res.status(416);
        res.set({
          'Content-Range': 'bytes */' + total // File size.
        });
        res.send({});
        return null;
      }

      res.status(206);
      res.set({
        'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': mimeType,
        'Cache-Control': 'none'
      });
      fileStream = fs.createReadStream(file, {start: start, end: end});
    } else {
      res.status(200);
      res.set({
        'Content-Type': mimeType
      });
      fileStream = fs.createReadStream(file)
    }
    fileStream.pipe(res);
    res.on('close', function() {
      console.log('response closed');
      /*if (fileStream) {
       fileStream.unpipe(this);
       if (this.fileStream.fd) {
       fs.close(this.fileStream.fd);
       }
       }*/
    });
  } else {
    res.status(404).send("File not found.");
  }
};
/**
 * Retrieves audio generates from video
 * @param req
 * @param res
 */
exports.audio = (req, res) => {
  let uuid = req.params.uuid,
    file = ROOT_PATH + EDITOR_PROJECTS + USER_ID + '/' + uuid + '/resources/audioTracks/audio.mp3';
  res.set('Content-type', 'audio/mpeg');  // mpeg mime => mp3 extension
  // CHUNKS REQUEST (for streaming)
  if (fs.existsSync(file)) {
    let fileStream = fs.createReadStream(file);
    fileStream.pipe(res);
    res.on('close', function() {
      console.log('response closed');
      if (res.fileStream) {
        res.fileStream.unpipe(this);
        if (this.fileStream.fd) {
          fs.close(this.fileStream.fd);
        }
      }
    });
  } else {
    res.status(404).send("File not found.");
  }
};

/**
 * Convert audio duration to digital clock format
 * @param time - duration in seconds
 * @returns {string}
 */
let convertAudioDuration = time => {
  let sec = ~~time % 60,
    min = ~~(time / 60) % 60;
  time = ~~(time * 1000) % 100;
  sec = sec < 10 ? '0' + sec.toFixed(0) : sec.toFixed(0);
  min = min < 10 ? '0' + min.toFixed(0) : min.toFixed(0);
  time = time < 10 ? '0' + time.toFixed(0) : time.toFixed(0);

  return min + ':' + sec + '.' + time;
};

/**
 * Upload audio files to the project library
 * Uses chunked upload (flow.js protocol)
 * @param req
 * @param res
 */
exports.uploadAudio = (req, res) => {
  flow.post(req, (status, filename, original_filename, identifier, currentTestChunk, numberOfChunks) => {
    console.log('Audio upload status:', status, 'chunk:', currentTestChunk, '/', numberOfChunks);

    if (status === 'done') {
      // Prevent duplicate processing due to race conditions with parallel uploads
      if (processedAudioUploads.has(identifier)) {
        console.log('Audio upload already processed, skipping:', identifier);
        res.status(200).json({ status: 'already_processed' });

        return;
      }
      processedAudioUploads.add(identifier);
      // Clean up old identifiers after 1 minute to prevent memory leak
      setTimeout(() => processedAudioUploads.delete(identifier), 60000);

      let project = req.body.project_uuid,
        dirProject = ROOT_PATH + EDITOR_PROJECTS + USER_ID + '/' + project,
        libraryDir = dirProject + '/library',
        trackListFile = dirProject + '/trackList.json';

      console.log('Audio upload complete, saving to:', libraryDir);

      // Create library directory if not exists
      if (!fs.existsSync(libraryDir)) {
        fs.mkdirSync(libraryDir, { recursive: true });
        console.log('Created library dir:', libraryDir);
      }

      // Generate unique filename to avoid collisions
      let ext = filename.split('.').pop(),
        baseName = filename.replace(/\.[^.]+$/, ''),
        uniqueId = Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        newFilename = baseName + '-' + uniqueId + '.' + ext,
        file = libraryDir + '/' + newFilename;

      // Create file stream and write chunks
      let fileStream = fs.createWriteStream(file);

      flow.write(identifier, fileStream, { end: true });
      fileStream.on('finish', () => {
        console.log('Audio file written:', file);
        flow.clean(identifier);

        // Extract metadata using ffprobe
        probe(file, (err, meta) => {
          // Get file size
          let fileSize = 0;
          try {
            const stats = fs.statSync(file);
            fileSize = stats.size;
          } catch (e) {
            console.error('Error getting file size:', e);
          }

          let audioMeta = {
            id: newFilename,
            name: baseName,
            duration: 0,
            durationFormatted: '00:00.00',
            channelLayout: 'stereo',
            sampleRate: 0,
            bitrate: 0,
            codec: '',
            format: ext.toLowerCase(),
            fileSize: fileSize
          };

          if (!err && meta && meta.format) {
            audioMeta.duration = meta.format.duration * 1000; // ms
            audioMeta.durationFormatted = convertAudioDuration(meta.format.duration);
            audioMeta.bitrate = Math.round((meta.format.bit_rate || 0) / 1000); // kbps

            if (meta.streams && meta.streams[0]) {
              const stream = meta.streams[0];
              audioMeta.channelLayout = stream.channel_layout || 'stereo';
              audioMeta.sampleRate = stream.sample_rate || 0;
              audioMeta.codec = stream.codec_name || '';
            }
          }

          // Update trackList.json
          let trackList = { tracks: {} };

          if (fs.existsSync(trackListFile)) {
            try {
              trackList = JSON.parse(fs.readFileSync(trackListFile).toString());
            } catch (e) {
              console.error('Error reading trackList.json:', e);
            }
          }

          trackList.tracks[newFilename] = audioMeta;
          fs.writeFileSync(trackListFile, JSON.stringify(trackList, null, 2));

          res.status(200).json({
            status: 'complete',
            file: newFilename,
            metadata: audioMeta
          });
        });
      });

      fileStream.on('error', (err) => {
        console.error('Error writing audio file:', err);
        flow.clean(identifier);
        res.status(500).json({ status: 'error', message: err.message });
      });
    } else if (status === 'partly_done') {
      res.status(200).json({ status: 'partly_done' });
    } else {
      res.status(200).json({ status: status });
    }
  });
};

/**
 * Get library audio file for playback
 * @param req
 * @param res
 */
exports.libraryAudio = (req, res) => {
  let uuid = req.params.uuid,
    filename = req.params.filename,
    file = ROOT_PATH + EDITOR_PROJECTS + USER_ID + '/' + uuid + '/library/' + filename;

  // Determine mime type based on extension
  let ext = filename.split('.').pop().toLowerCase(),
    mimeTypes = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac',
      'aac': 'audio/aac',
      'm4a': 'audio/mp4'
    },
    mimeType = mimeTypes[ext] || 'audio/mpeg';

  res.set('Content-type', mimeType);

  if (fs.existsSync(file)) {
    let fileStream = fs.createReadStream(file);
    fileStream.pipe(res);
    res.on('close', function() {
      if (res.fileStream) {
        res.fileStream.unpipe(this);
      }
    });
  } else {
    res.status(404).send("File not found.");
  }
};

/**
 * Delete audio file from library
 * @param req
 * @param res
 */
exports.deleteAudio = (req, res) => {
  let uuid = req.params.uuid,
    filename = req.params.filename,
    dirProject = ROOT_PATH + EDITOR_PROJECTS + USER_ID + '/' + uuid,
    libraryDir = dirProject + '/library',
    trackListFile = dirProject + '/trackList.json',
    file = libraryDir + '/' + filename;

  console.log('Deleting audio file:', file);

  // Check if file exists
  if (!fs.existsSync(file)) {
    res.status(404).json({ status: 'error', message: 'File not found' });

    return;
  }

  try {
    // Delete the file
    fs.unlinkSync(file);

    // Update trackList.json
    if (fs.existsSync(trackListFile)) {
      let trackList = JSON.parse(fs.readFileSync(trackListFile).toString());

      if (trackList.tracks && trackList.tracks[filename]) {
        delete trackList.tracks[filename];
        fs.writeFileSync(trackListFile, JSON.stringify(trackList, null, 2));
      }
    }

    console.log('Audio file deleted:', filename);
    res.status(200).json({ status: 'deleted', file: filename });
  } catch (err) {
    console.error('Error deleting audio file:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};
