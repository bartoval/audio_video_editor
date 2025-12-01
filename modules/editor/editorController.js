let fs = require('fs'),
  url = require('url'),
  path = require('path'),
  child = require('child_process'),
  http = require('http'),
  probe = require('node-ffprobe');
const { ROOT_PATH, EDITOR_PROJECTS } = require('../../config/paths');
// GET META INFO FROM MEDIA FILES
//enables media extension filter
const mediaType = {
  video: {
    '.mp4': true,
    '.webm': true,
  },
  audio: {
    '.mp3': true,
    '.wav': false
  }
};

let results = {
    video: [],
    music: []
  },
  publicHost = '',
  uploadFolder = '',
  /** *************************************************************************************
   *
   *                                        Private routines
   *
   ***************************************************************************************/
  /**
   * log function for ffmpeg library
   * @param ffmpeg
   */
  ffmpegLog = ffmpeg => {
    ffmpeg.stderr.on('data', (data) => {
      //  console.log(data.toString());
    });
    ffmpeg.stderr.on('end', () => {
      console.log('process has been created successfully');
    });

    ffmpeg.stderr.on('exit', () => {
      // console.log('child process exited');
    });

    ffmpeg.stderr.on('close', () => {
      // console.log('process closed');
    });
  },
  /**
   *
   * @param resourcesDir
   * @returns {boolean}
   */
  createDir = resourcesDir => {
    fs.mkdirSync(resourcesDir);
    return true;
  },
  /**
   * Utility to convert time expressed in second to min:sec.ms
   * @param time
   * @returns {string}
   */
  convertDurationToDigitalClock = time => { // seconds
    let sec = ~~time % 60,
      min = ~~(time / 60) % 60;
    time = ~~(time * 1000) % 100;
    sec = sec < 10 ? '0' + sec.toFixed(0) : sec.toFixed(0);
    min = min < 10 ? '0' + min.toFixed(0) : min.toFixed(0);
    time = time < 10 ? '0' + time.toFixed(0) : time.toFixed(0);
    return min + ':' + sec + '.' + time;
  },
  a = 0;
/**
 * Extract meta info from audio and video files
 * @param dir
 * @param done //callback
 */
getMediaInfo = (dir, done) => {
  // console.log('search in directory ' + dir);
  fs.readdir(dir, (err, list) => {
    if (err) return done(err);
    let pending = list.length;

    if (!pending) return done(null);
    list.forEach((fileOld) => {
      let file = dir + fileOld;
      fs.stat(fileOld, (err, stat) => {

        if (stat && stat.isDirectory()) {
          getMediaInfo(file, () => {
            if (!--pending) done(null);
          });
        } else {
          let ext = path.extname(file);
          //    genre = ['ambient', 'electro', 'motion', 'jazz', 'pop', 'relax', 'folk', 'abstract', 'funk'];
          if (mediaType.video[ext] === true || mediaType.audio[ext] === true) {
            /*           a++;
             console.log('ffmpeg -y -i ' + file + ' -acodec copy -vn -metadata title="Sample track ' + a + '" ' + dir + 'z' + fileOld);
             // let cmd = 'ffmpeg -y -i ' + file + ' -acodec copy -vn -metadata title="Sample track ' + a + '" -metadata genre="' + genre[Math.random() * 9] + '" ' + dir + 'z' + fileOld;
             let cmd = 'ffmpeg -y -i ' + file + ' ' + dir + fileOld.split('.')[0] + '.wav';

             child.exec(cmd, () => {
             console.log(a)
             });*/
            probe(file, (err, meta) => {
              // global meta info media
              let metadata = {
                id: meta.filename,
                name: meta.metadata.title === undefined ? meta.filename.split('.')[0] : meta.metadata.title,
                genre: meta.genre,
                duration: meta.format.duration * 1000, // ms
                durationFormatted: convertDurationToDigitalClock(meta.format.duration),
              };
              // meta info audio
              if (mediaType.audio[ext] === true) {
                metadata.channelLayout = meta.streams[0].channel_layout; // stereo or mono
                results.music.push(metadata);
              }
            })
          }
          if (!--pending) done(null);
        }
      });
    });
  });
};
/** *************************************************************************************
 *
 *                                        API
 *
 ***************************************************************************************/
/**
 * Initializes server uri, creates basic media folders and setup meta info data structures about audio and video
 */
exports.bootstrap = () => {
  const apiUrl = process.env.API_URL || 'http://localhost:8080';
  publicHost = apiUrl.endsWith('/') ? apiUrl : apiUrl + '/';
  uploadFolder = ROOT_PATH + EDITOR_PROJECTS;
};
exports.index = (req, res) => {
  let path = require('path');

  res.sendFile(path.join(__dirname, '../../public/studio/index.html'));
};
/**
 * Retrieves meta info gathering during the bootstrap phase of the server, about video and audio sorted by duration
 * @param req
 * @param res
 */
exports.metaInfoAudioList = (req, res) => {
  let uuid = req.params.uuid,
    projectDir = uploadFolder + '0/' + uuid + '/',
    file = projectDir + 'trackList.json';

  console.log('metaInfoAudioList for uuid:', uuid, 'file:', file);

  // Check if file exists
  if (!fs.existsSync(file)) {
    console.log('trackList.json not found for project:', uuid);

    return res.json({});
  }

  try {
    let metaInfoList = JSON.parse(fs.readFileSync(file).toString());

    console.log('Returning tracks:', Object.keys(metaInfoList.tracks || {}).length);
    res.json(metaInfoList.tracks || {});
  } catch (err) {
    console.error('Error reading trackList.json:', err);
    res.json({});
  }
};

/**
 * Retrieves meta data from video
 * @param req
 * @param res
 */
exports.metaInfoVideo = (req, res) => {
  let uuid = req.params.uuid,
    projectDir = uploadFolder + '0/' + uuid + '/',
    metadata = {},
    nameVideo = 'originalWithAudio.mp4',
    file = projectDir + nameVideo, // used by client to detect video uploaded without audio tracks
    isMuteVideo = true;

  probe(file, (err, meta) => {
    if (meta !== undefined) {
      meta.streams.forEach((elem) => {
        if (elem.codec_type === 'audio') { // checks video audio is present
          isMuteVideo = false;
        }
      });

      let aspectRatio = meta.streams[0].display_aspect_ratio;
      // Fallback to 16:9 if aspect ratio is invalid
      if (!aspectRatio || aspectRatio === '0:1' || aspectRatio === 'N/A') {
        // Calculate from width/height if available
        const width = meta.streams[0].width;
        const height = meta.streams[0].height;
        if (width && height) {
          // Simplify to common ratios or use raw values
          const ratio = width / height;
          if (Math.abs(ratio - 16/9) < 0.1) aspectRatio = '16:9';
          else if (Math.abs(ratio - 4/3) < 0.1) aspectRatio = '4:3';
          else aspectRatio = width + ':' + height;
        } else {
          aspectRatio = '16:9';
        }
      }
      metadata = {
        id: meta.filename,
        name: meta.metadata.title === undefined ? meta.filename : meta.metadata.title,
        duration: meta.format.duration * 1000, // ms
        durationFormatted: convertDurationToDigitalClock(meta.format.duration),
        displayAspectRatio: aspectRatio,
        isMuteVideo: isMuteVideo
      };
    }
    res.send(JSON.stringify(metadata));
  });
};

exports.video = (req, res) => {
  res.header("Cross-Origin-Resource-Policy", "cross-origin");

  let uuid = req.params.uuid,
    projectDir = uploadFolder + '0/' + uuid + '/',
    file = projectDir + 'resources/videoTracks/small.mp4',
    mimeType = 'video/mp4',
    fileStream = '';

  console.log('Editor video request:', file);
  console.log('File exists:', fs.existsSync(file));

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
exports.addAudio = (req, res) => {
  let metaInfo = req.body;
  let uuid = req.params.uuid,
    idTrack = req.params.id,
    projectDir = uploadFolder + '0/' + uuid + '/',
    file = projectDir + '/trackList.json',
    myTracks = JSON.parse(fs.readFileSync(file));
  myTracks.tracks[idTrack] = metaInfo;
  fs.writeFileSync(file, JSON.stringify(myTracks));
  res.send('ok');
};

exports.removeAudio = (req, res) => {
  let uuid = req.params.uuid,
    idTrack = req.params.id,
    projectDir = uploadFolder + '0/' + uuid + '/',
    file = projectDir + '/trackList.json',
    myTracks = JSON.parse(fs.readFileSync(file));
  delete myTracks.tracks[idTrack];
  fs.writeFileSync(file, JSON.stringify(myTracks));
  res.send('ok');
};
/**
 *
 * @param req
 * @param res
 */
exports.getAudio = (req, res) => {
  res.header("Cross-Origin-Resource-Policy", "cross-origin");

  let uuid = req.params.uuid,
    idTrack = req.params.id,
    projectDir = uploadFolder + '0/' + uuid + '/',
    file = projectDir + 'library/' + idTrack;

  res.set('Content-type', 'audio/mpeg');

  if (fs.existsSync(file)) {
    let fileStream = fs.createReadStream(file);
    fileStream.pipe(res);
  } else {
    file = projectDir + 'tmp/' + idTrack;

    if (fs.existsSync(file)) {
      let fileStream = fs.createReadStream(file);
      fileStream.pipe(res);
    } else {
      res.status(404).send('File not found');
    }
  }
};
/**
 * Performs stretch,pitch and cut operation on original files and retrieves a new media track
 * @param req
 * @param res
 */
exports.stretch = async (req, res) => {
  let content = '';

  req.on('data', body => {
    content += body;
  });

  req.on('end', async () => {
    const filename = Math.random() * 100000 + 1;

    try {
      const data = JSON.parse(content);
      const uuid = req.params.uuid;
      const projectDir = uploadFolder + '0/' + uuid + '/';
      const tmpDir = projectDir + 'tmp/';
      const src = data.idTrack === -1
        ? projectDir + '/resources/audioTracks/audio.wav'
        : projectDir + 'library/' + data.idTrack;

      // Check source file exists
      if (!fs.existsSync(src)) {
        console.error('[Stretch] Source file not found:', src);

        return res.status(404).json({ error: 'Source file not found' });
      }

      // Step 1: Extract/trim audio to WAV
      const trimCmd = `ffmpeg -y -i "${src}" -ss ${data.startTime} -t ${data.duration} "${tmpDir}${filename}.wav"`;
      console.log('[Stretch] Step 1:', trimCmd);

      await execPromise(trimCmd);

      // Step 2: Apply rubberband stretch/pitch
      const stretchCmd = `rubberband -t ${data.stretchFactor} -p ${data.pitchValue} "${tmpDir}${filename}.wav" "${tmpDir}${filename}_edited.wav"`;
      console.log('[Stretch] Step 2:', stretchCmd);

      await execPromise(stretchCmd);

      // Check rubberband output exists
      if (!fs.existsSync(`${tmpDir}${filename}_edited.wav`)) {
        throw new Error('Rubberband failed to create output file');
      }

      // Step 3: Convert to MP3
      const mp3Cmd = `ffmpeg -y -i "${tmpDir}${filename}_edited.wav" -codec:a libmp3lame -qscale:a 3 "${tmpDir}${filename}.mp3"`;
      console.log('[Stretch] Step 3:', mp3Cmd);

      await execPromise(mp3Cmd);

      // Check final MP3 exists
      if (!fs.existsSync(`${tmpDir}${filename}.mp3`)) {
        throw new Error('FFmpeg failed to create MP3 file');
      }

      // Cleanup temp files
      fs.unlink(`${tmpDir}${filename}_edited.wav`, () => {});
      fs.unlink(`${tmpDir}${filename}.wav`, () => {});

      console.log('[Stretch] Success:', filename + '.mp3');

      res.json({
        idTrack: filename + '.mp3',
        src: publicHost + 'editor/audio/' + uuid + '/' + filename + '.mp3',
        path: uploadFolder + '0/' + uuid + '/tmp/' + filename + '.mp3'
      });

    } catch (error) {
      console.error('[Stretch] Error:', error.message);

      // Cleanup on error
      fs.unlink(`${tmpDir}${filename}.wav`, () => {});
      fs.unlink(`${tmpDir}${filename}_edited.wav`, () => {});
      fs.unlink(`${tmpDir}${filename}.mp3`, () => {});

      res.status(500).json({ error: 'Stretch failed', message: error.message });
    }
  });
};
/**
 * Removes tmp file created during stretch api call
 * @param req
 * @param res
 */
exports.stretchAck = (req, res) => {
  let uuid = req.params.uuid,
    idTrack = req.params.id,
    projectDir = uploadFolder + '0/' + uuid + '/',
    tmpDir = projectDir + 'tmp/',
    file = tmpDir + idTrack,
    src = file;
  fs.unlink(src, err => {
    if ((err)) console.log(err);
    res.send(JSON.stringify({res: 'ok'}));
  });
};
/**
 * Retrieve a backup of the project from file (json)
 * @param req
 * @param res
 */
exports.load = (req, res) => {
  let uuid = req.params.uuid,
    projectDir = uploadFolder + '0/' + uuid + '/',
    savedDir = projectDir + '/saved/',
    path = savedDir + 'backup.json',
    content = '{}';
  if (fs.existsSync(path)) {
    content = fs.readFileSync(path, 'utf8', (err) => {
      if (err) console.log(err);
    });
  }
  res.send(content);
};
/**
 * Store info from the current project
 * @param req
 * @param res
 */
exports.backup = (req, res) => {
  let content = '';
  req.on('data', body => {
    content += body
  });
  req.on('end', () => {
    let uuid = req.params.uuid,
      projectDir = uploadFolder + '0/' + uuid + '/',
      savedDir = projectDir + '/saved/',
      stream = fs.createWriteStream(savedDir + 'backup.json', {flags: 'w', encoding: 'utf-8'});
    stream.once('open', () => {
      stream.write(content);
      stream.end();
      console.log('close stream');
    });
    stream.on('error', (err) => {
      console.log(err);
    });
    stream.on('finish', () => {
      console.log('stream finished');
    });
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write(JSON.stringify({res: 'ok'}));
    res.end();
  });
};
/**
 * Retrieve an online version of the project
 * @param req
 * @param res
 */

// Helper to execute a command and return a promise
const execPromise = (cmd) => {
  return new Promise((resolve, reject) => {
    console.log('[exec]', cmd.substring(0, 100) + '...');
    const proc = child.exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('[exec error]', error.message);
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
    proc.stderr.on('data', () => {});
  });
};

exports.export = (req, res) => {
  console.log('start export');
  let content = '';

  const fileNameVideo = 'out.mp4';
  const filenameAudio = 'out.mp3';

  const setStretch = (elem, index, publishedDir) => {
    return `rubberband --ignore-clipping -t ${elem.stretchFactor} -p ${elem.pitch} "${publishedDir}out${index}.wav" "${publishedDir}outZ${index}.wav"`;
  };

  const setTrim = elem => {
    console.log('cut ' + elem.isCut + ' with start ' + elem.startTimeBuffer + ' and duration ' + elem.durationTimeBuffer);

    return elem.isCut === true ? `-ss ${elem.startTimeBuffer} -t ${elem.durationTimeBuffer} ` : '';
  };

  const setDelay = elem => {
    const startTime = (elem.startTime * (1 / elem.stretchFactor)) * 1000;

    return `adelay="${startTime}|${startTime}"`;
  };

  const setPan = elem => {
    const gain = 1 - Math.abs(elem.panValue);
    const c0 = elem.panValue > 0 ? gain + '*c0' : 'c0';
    const c1 = elem.panValue < 0 ? gain + '*c1' : 'c1';

    return `pan="stereo|FL<${c0}|FR<${c1}"`;
  };

  const setVolume = (elem, duration) => {
    const numCurves = elem.volumeValues.length;
    if (numCurves === 0) {
      return 'volume=0.5';
    }

    // When track is trimmed, volume curve timestamps need to be adjusted
    // relative to the trimmed start time
    const trimOffset = elem.isCut === true ? (elem.startTimeBuffer || 0) : 0;

    let cmd = '"';
    for (let j = 0; j < numCurves; j++) {
      const curve = elem.volumeValues[j];
      const numTimes = curve.data.times.length;
      const lastT1 = Math.max(0, curve.data.times[numTimes - 1] - trimOffset);
      const lastT2Raw = j < numCurves - 1 ? elem.volumeValues[j + 1].data.times[0] : duration;
      const lastT2 = Math.max(0, lastT2Raw - trimOffset);
      const lastValue = curve.data.values[numTimes - 1];

      const firstTime = Math.max(0, curve.data.times[0] - trimOffset);
      if (j === 0 && firstTime > 0) {
        cmd += `volume=0.5:eval=frame:enable='between(t,0,${firstTime})',`;
      }

      for (let i = 0; i < numTimes - 1; i++) {
        const t1 = Math.max(0, curve.data.times[i] - trimOffset).toFixed(5);
        const t2 = Math.max(0, curve.data.times[i + 1] - trimOffset).toFixed(5);
        const value = curve.data.values[i].toFixed(5);

        // Skip segments that are entirely before the trim point
        if (parseFloat(t2) <= 0) continue;

        cmd += `volume=${value}:eval=frame:enable='between(t,${t1},${t2})',`;
      }

      cmd += `volume=${lastValue}:eval=frame:enable='between(t,${lastT1},${lastT2})'`;
      if (j < numCurves - 1) cmd += ',';
    }
    cmd += '"';

    return cmd;
  };

  req.on('data', body => {
    content += body;
  });

  req.on('end', async () => {
    try {
      const data = JSON.parse(content);
      const uuid = req.params.uuid;
      const projectDir = `${uploadFolder}0/${uuid}/`;
      const publishedDir = `${projectDir}published/`;
      const publishedLink = `/api/studio/published/${uuid}`;
      const libraryDir = `${projectDir}library/`;
      const video = `${projectDir}resources/videoTracks/original.mp4`;
      const duration = data.duration;
      const files = [];

      // Process each track: ffmpeg decode -> rubberband stretch
      const processTrack = async (elem, index) => {
        const src = elem.idTrack === -1
          ? `${projectDir}resources/audioTracks/audio.wav`
          : `${libraryDir}${elem.idTrack}`;

        const outFile = `${publishedDir}out${index}.wav`;
        const outFileZ = `${publishedDir}outZ${index}.wav`;

        // Build ffmpeg command
        let cmd = 'ffmpeg -y ';
        cmd += setTrim(elem);
        cmd += `-i "${src}" `;
        cmd += '-filter:a ';
        cmd += setVolume(elem, duration);
        if (elem.startTime > 0) cmd += ',' + setDelay(elem);
        if (elem.panValue !== 0) cmd += ',' + setPan(elem);
        cmd += ` "${outFile}"`;

        console.log(`[Track ${index}] Decoding: ${src}`);
        await execPromise(cmd);
        files.push(outFile);

        // Apply rubberband stretch/pitch
        const stretchCmd = setStretch(elem, index, publishedDir);
        console.log(`[Track ${index}] Stretching with rubberband`);
        await execPromise(stretchCmd);
        files.push(outFileZ);

        console.log(`[Track ${index}] Done`);
      };

      // Process all tracks in parallel
      console.log(`Processing ${data.tracks.length} tracks...`);
      await Promise.all(data.tracks.map((elem, index) => processTrack(elem, index)));

      // Mix all processed tracks
      console.log('Mixing audio tracks...');
      let mixCmd = 'ffmpeg -y';
      for (let i = 0; i < data.tracks.length; i++) {
        mixCmd += ` -i "${publishedDir}outZ${i}.wav"`;
      }
      mixCmd += ` -t ${duration} -filter_complex "amix=inputs=${data.tracks.length}:dropout_transition=${duration},volume=${data.tracks.length}[out]" -map "[out]" "${publishedDir}${filenameAudio}"`;
      await execPromise(mixCmd);
      files.push(`${publishedDir}${filenameAudio}`);

      // Combine video with mixed audio
      console.log('Creating final video...');
      const videoCmd = `ffmpeg -y -i "${video}" -i "${publishedDir}${filenameAudio}" -t ${duration} -vcodec copy -acodec copy -map 0:v -map 1:a "${publishedDir}${fileNameVideo}"`;
      await execPromise(videoCmd);

      console.log(`Video created: ${publishedDir}${fileNameVideo}`);

      // Cleanup temporary files
      for (const filename of files) {
        fs.unlink(filename, err => {
          if (err) console.log('Cleanup error:', err.message);
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write(JSON.stringify({ res: publishedLink }));
      res.end();

    } catch (error) {
      console.error('Export failed:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.write(JSON.stringify({ error: 'Export failed', message: error.message }));
      res.end();
    }
  });
};
exports.thumbs = (req, res) => {
  res.header("Cross-Origin-Resource-Policy", "cross-origin");

  let uuid = req.params.uuid,
    projectDir = uploadFolder + '0/' + uuid + '/',
    filename = req.params.filename,
    file = projectDir + '/thumbs/' + filename;
  if (fs.existsSync(file)) {
    let fileStream = fs.createReadStream(file);
    res.set({
      'Content-Type': 'image/png',
    });
    fileStream.pipe(res);
    res.on('close', () => {
      if (fileStream) {
        fileStream.unpipe(this);
        /*   if (this.fileStream.fd) {
         fs.close(this.fileStream.fd);
         }*/
      }
    });
  } else {
    res.status(404).send("File not found.");
  }
};

/**
 * Generate a single thumbnail at a specific timestamp
 * Uses cache to avoid regenerating the same frame
 * @param req - params: uuid, time (in seconds)
 * @param res
 */
exports.thumb = (req, res) => {
  res.header("Cross-Origin-Resource-Policy", "cross-origin");

  const uuid = req.params.uuid;
  const time = parseFloat(req.params.time);

  if (isNaN(time) || time < 0) {
    return res.status(400).send("Invalid time parameter");
  }

  const projectDir = uploadFolder + '0/' + uuid + '/';
  const videoFile = projectDir + 'resources/videoTracks/original.mp4';
  const cacheDir = projectDir + 'thumbs/cache/';
  const cacheFile = cacheDir + `thumb_${time.toFixed(2)}.webp`;

  // Check if video exists
  if (!fs.existsSync(videoFile)) {
    return res.status(404).send("Video not found");
  }

  // Create cache directory if it doesn't exist
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // Check cache first
  if (fs.existsSync(cacheFile)) {
    res.set({
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000' // 1 year cache
    });

    return fs.createReadStream(cacheFile).pipe(res);
  }

  // Generate thumb with ffmpeg
  const cmd = `ffmpeg -ss ${time} -i "${videoFile}" -vframes 1 -vf "scale=-1:180" -f webp -y "${cacheFile}"`;

  child.exec(cmd, (err) => {
    if (err) {
      console.error('Thumb generation error:', err);

      return res.status(500).send("Error generating thumbnail");
    }

    if (fs.existsSync(cacheFile)) {
      res.set({
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000'
      });
      fs.createReadStream(cacheFile).pipe(res);
    } else {
      res.status(500).send("Thumbnail generation failed");
    }
  });
};
/**
 * Delete video and associated audio track from project
 * @param req
 * @param res
 */
exports.deleteVideo = (req, res) => {
  let uuid = req.params.uuid,
    projectDir = uploadFolder + '0/' + uuid + '/',
    resourcesDir = projectDir + 'resources/',
    filesToDelete = [
      projectDir + 'originalWithAudio.mp4',
      resourcesDir + 'videoTracks/original.mp4',
      resourcesDir + 'videoTracks/small.mp4',
      resourcesDir + 'audioTracks/audio.wav'
    ];

  let deletedCount = 0;
  let errors = [];

  filesToDelete.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
        deletedCount++;
        console.log('Deleted:', file);
      } catch (err) {
        errors.push(file);
        console.error('Error deleting:', file, err);
      }
    }
  });

  // Also delete thumbs directory contents
  let thumbsDir = projectDir + 'thumbs/';
  if (fs.existsSync(thumbsDir)) {
    try {
      let thumbFiles = fs.readdirSync(thumbsDir);
      thumbFiles.forEach(file => {
        fs.unlinkSync(thumbsDir + file);
      });
      console.log('Deleted thumbs directory contents');
    } catch (err) {
      console.error('Error deleting thumbs:', err);
    }
  }

  if (errors.length > 0) {
    res.status(500).json({ status: 'error', errors: errors });
  } else {
    res.json({ status: 'deleted', count: deletedCount });
  }
};

exports.published = (req, res) => {
  res.header("Cross-Origin-Resource-Policy", "cross-origin");

  let uuid = req.params.uuid,
    projectDir = uploadFolder + '0/' + uuid + '/',
    file = projectDir + 'published/out.mp4',
    mimeType = 'video/mp4',
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

      console.log('bytes ' + start + '-' + end + '/' + total);
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