var fs = require('fs');
var path = require('path');
var { ROOT_PATH } = require('../../config/paths');

var DATA_FILE = path.join(ROOT_PATH, 'data', 'projects.json');

// Ensure data directory exists
function ensureDataDir() {
  var dir = path.dirname(DATA_FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Load all projects from JSON file
function loadProjects() {
  ensureDataDir();

  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }

  try {
    var data = fs.readFileSync(DATA_FILE, 'utf8');

    return JSON.parse(data);
  } catch (err) {
    console.error('Error loading projects:', err);

    return [];
  }
}

// Save all projects to JSON file
function saveProjects(projects) {
  ensureDataDir();

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2));

    return true;
  } catch (err) {
    console.error('Error saving projects:', err);

    return false;
  }
}

// Project "model" with bookshelf-like API for compatibility
var Project = {
  // Fetch all projects, optionally filtered
  fetchAll: function(options) {
    var projects = loadProjects();
    var { where, orderBy } = options || {};

    if (where) {
      projects = projects.filter(function(p) {
        return Object.keys(where).every(function(key) {
          return p[key] === where[key];
        });
      });
    }

    if (orderBy) {
      var { column, direction } = orderBy;
      projects.sort(function(a, b) {
        if (direction === 'DESC') {
          return a[column] < b[column] ? 1 : -1;
        }

        return a[column] > b[column] ? 1 : -1;
      });
    }

    return Promise.resolve(projects);
  },

  // Fetch single project by criteria
  fetch: function(where) {
    var projects = loadProjects();
    var project = projects.find(function(p) {
      return Object.keys(where).every(function(key) {
        return p[key] === where[key];
      });
    });

    return Promise.resolve(project || null);
  },

  // Create new project
  create: function(data) {
    var projects = loadProjects();
    var now = new Date().toISOString();
    var project = {
      ...data,
      created_at: now,
      updated_at: now
    };
    projects.push(project);
    saveProjects(projects);

    return Promise.resolve(project);
  },

  // Delete project by uuid
  destroy: function(uuid) {
    var projects = loadProjects();
    var index = projects.findIndex(function(p) {
      return p.uuid === uuid;
    });

    if (index !== -1) {
      projects.splice(index, 1);
      saveProjects(projects);

      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }
};

module.exports = Project;
