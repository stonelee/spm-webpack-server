#!/usr/bin/env node

'use strict';

require('gnode');
var program = require('commander');
var log = require('spm-log');
var spmArgv = require('spm-argv');
var extend = require('extend');
var Server = require('./index');
var path = require('path');
var join = path.join;
var fs = require('fs');
var existsSync = fs.existsSync;
var readFileSync = fs.readFileSync;

program
  .version(require('./package').version, '-v, --version')
  .option('-p, --port <port>', 'port')
  .option('--proxy', 'proxy with anyproxy')
  .option('--livereload', 'livereload')
  .option('--compress', 'build files with compress')
  .option('--weinre', 'weinre')
  .option('--https', 'https')
  .option('--verbose', 'show more logging')
  .parse(process.argv);

log.config(program);

var cwd = process.cwd();
var args = {
  cwd: cwd,
  debug: !program.compress,
  https: program.https,
  weinre: program.weinre,
  livereload: program.livereload,
  proxy: program.proxy,
  quiet: !program.verbose,
  port: program.port || 8000
};

var sw = require('spm-webpack');
var pkgFile = join(cwd, 'package.json');
if (existsSync(pkgFile)) {
  args.pkg = JSON.parse(readFileSync(pkgFile, 'utf-8'));
  args.pkg.spm.hash = false;
}
sw.build.getWebpackOpts(args, function(err, webpackOpts) {

  var spmArgs = extend(true, {}, {server:{devtool:'#source-map'}}, spmArgv(cwd,webpackOpts.pkg));
  webpackOpts.devtool = spmArgs.server.devtool;

  if (spmArgs.server.define) {
    for (var i=0; i<webpackOpts.plugins.length; i++) {
      var p = webpackOpts.plugins[i];
      if (p.definitions) {
        webpackOpts.plugins.splice(i, 1);
        break;
      }
    }
    webpackOpts.plugins.push(new sw.webpack.DefinePlugin(spmArgs.server.define));
  }

  isPortInUse(args.port, function() {
    log.error('error', 'port %s is in use', args.port);
  }, function() {
    var server = new Server(sw.webpack(webpackOpts), args);
    server.app.listen(args.port, function(err) {
      if(err) throw err;
      log.level = 'info';
      log.info('webserver', 'listened on', args.port);
    });
  });

});

function isPortInUse(port, error, success) {
  var conn = require('net').createServer();
  conn.unref();
  conn.on('error', error.bind(null, port));
  conn.listen(port, function() {
    conn.close(success.bind(null, null, conn.address().port));
  });
}
