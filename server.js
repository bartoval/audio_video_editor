var express = require('express');
var path = require('path');
var logger = require('morgan');
var compression = require('compression');
var bodyParser = require('body-parser');
var cors = require('cors');

var app = express();

app.use(cors());

app.use(function(req, res, next) {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

app.set('port', process.env.PORT || 8080);
app.use(express.static(__dirname + '/node_modules'));
app.use(compression());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/studio', function(req, res) {
  res.sendFile(path.join(__dirname, 'public/studio/index.html'));
});
app.get('/studio/*', function(req, res) {
  res.sendFile(path.join(__dirname, 'public/studio/index.html'));
});

app.get('/', function(req, res) {
  res.redirect('/studio');
});

var editorRouter = require('./modules/editor/routes').init(app);
var projectRouter = require('./modules/project/routes').init(app);
var uploadRouter = require('./modules/upload/routes').init(app);

if (app.get('env') === 'production') {
  app.use(function(err, req, res, next) {
    console.error(err.stack);
    res.sendStatus(err.status || 500);
  });
}

app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});

module.exports = app;
