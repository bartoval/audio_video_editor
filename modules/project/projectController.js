var Project = require('./projectModel');
var { v4: uuidV4 } = require('uuid');
var fs = require('fs');
var { ROOT_PATH, EDITOR_PROJECTS } = require('../../config/paths');

var USER_ID = '0';

var deleteFolderRecursive = function(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function(file) {
      var curPath = path + "/" + file;

      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

var createProjectFolders = function(uuid) {
  var dir = ROOT_PATH + EDITOR_PROJECTS + USER_ID + '/' + uuid;

  if (!fs.existsSync(ROOT_PATH + EDITOR_PROJECTS + USER_ID)) {
    fs.mkdirSync(ROOT_PATH + EDITOR_PROJECTS + USER_ID, { recursive: true });
  }

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  if (!fs.existsSync(dir + '/thumbs')) {
    fs.mkdirSync(dir + '/thumbs');
  }

  if (!fs.existsSync(dir + '/tmp')) {
    fs.mkdirSync(dir + '/tmp');
  }

  if (!fs.existsSync(dir + '/saved')) {
    fs.mkdirSync(dir + '/saved');
  }

  if (!fs.existsSync(dir + '/published')) {
    fs.mkdirSync(dir + '/published');
  }

  if (!fs.existsSync(dir + '/resources')) {
    fs.mkdirSync(dir + '/resources');
  }

  if (!fs.existsSync(dir + '/resources/audioTracks')) {
    fs.mkdirSync(dir + '/resources/audioTracks');
  }

  if (!fs.existsSync(dir + '/resources/videoTracks')) {
    fs.mkdirSync(dir + '/resources/videoTracks');
  }

  fs.writeFileSync(dir + '/trackList.json', JSON.stringify({
    tracks: {}, filter: { name: '', sort: { duration: 'desc', name: 'desc' }, page: 1 }
  }));
};

exports.projectCover = function(req, res, next) {
  var uuid = req.params.uuid,
    dir = ROOT_PATH + EDITOR_PROJECTS + USER_ID + '/' + uuid,
    cover = dir + '/thumbs/cover-thumb-1.png';

  if (!fs.existsSync(cover)) {
    return res.status(404).send('Cover not found');
  }

  var filestream = fs.createReadStream(cover);

  filestream.on('error', function(err) {
    res.status(404).send('Cover not found');
  });

  res.set({ 'Content-Type': 'image/png' });
  filestream.pipe(res);
};

exports.projectDeleteApi = function(req, res, next) {
  var uuid = req.params.uuid,
    folder = ROOT_PATH + EDITOR_PROJECTS + USER_ID + '/' + uuid;

  if (fs.existsSync(folder)) {
    Project.destroy(uuid).then(function() {
      deleteFolderRecursive(folder);
      res.json({ success: true });
    }).catch(function(err) {
      console.log(err);
      res.status(500).json({ success: false, error: err.message });
    });
  } else {
    Project.destroy(uuid).then(function() {
      res.json({ success: true });
    }).catch(function(err) {
      res.status(500).json({ success: false, error: err.message });
    });
  }
};

exports.projectListApi = function(req, res, next) {
  Project.fetchAll({
    where: { user_uuid: USER_ID },
    orderBy: { column: 'created_at', direction: 'DESC' }
  }).then(function(projects) {
    if (projects.length === 0) {
      var uuid = uuidV4();

      return Project.create({
        uuid: uuid,
        user_uuid: USER_ID,
        title: 'Default'
      }).then(function() {
        createProjectFolders(uuid);
        console.log('Created default project:', uuid);

        return [{ uuid: uuid, title: 'Default', isVideoLoaded: false }];
      });
    }

    return projects.map(function(project) {
      var m = { ...project };
      var dir = ROOT_PATH + EDITOR_PROJECTS + USER_ID + '/' + m.uuid;
      m.isVideoLoaded = fs.existsSync(dir + '/resources/videoTracks/original.mp4');

      return { uuid: m.uuid, title: m.title, isVideoLoaded: m.isVideoLoaded };
    });
  }).then(function(p) {
    res.json(p);
  }).catch(function(err) {
    res.status(500).json({ error: err.message });
  });
};

exports.projectAddApi = function(req, res, next) {
  var title = req.body.title;

  if (!title || title.trim() === '') {
    return res.status(400).json({ success: false, error: 'Title cannot be blank' });
  }

  var uuid = uuidV4();

  Project.create({
    uuid: uuid,
    user_uuid: USER_ID,
    title: title
  }).then(function() {
    try {
      createProjectFolders(uuid);
      console.log('Project created:', uuid);
    } catch (fsErr) {
      console.error('Error creating project folders:', fsErr);
    }

    res.json({ success: true, uuid: uuid, title: title });
  }).catch(function(err) {
    console.error('Error saving project:', err);
    res.status(500).json({ success: false, error: err.message });
  });
};
