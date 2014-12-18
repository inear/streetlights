
var debug = require('debug');

debug.enable('*');
debug('app:')('debug is enabled');

var App = require('./app.js');


$(function() {
  var app = new App();
  app.init();
});

