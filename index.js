'use strict';

var resolve = require('resolve');
var through = require('through2');
var minimatch = require("minimatch");
var _ = require('lodash');

function instrument(options) {
  var Instrumenter = require(resolve.sync(options.instrumenter, {basedir: process.cwd()}));
  var excludePattern = options.exclude ? [].concat(options.exclude) : [''];
  var instrumenter = new Instrumenter.Instrumenter();
  var captured = false;

  function transform(file) {
    // If if doesnt match the pattern dont instrument it
    var matchResult = _.compact(_.map(excludePattern, function (pattern) {
      return minimatch(file, pattern);
    }));

    if (matchResult.length)
      return through();

    var data = '';
    return through(function(buf, enc, next) {
      data += buf;
      next();
    }, function(next) {
      var self = this;
      instrumenter.instrument(data, file, function(err, code) {
        if (err) {
          self.emit('error', err);
          return next();
        }

        // Inject __converage__ var
        self.push(code);
        if (!captured) {
          captured = true;
          self.push('after(function(){console.log("__coverage__=\'" + JSON.stringify(__coverage__) + "\';");});');
        }

        next();
      });
    });
  }

  return transform;
}

var report = [];

function writeReports(options) {
  var Instrumenter = require(resolve.sync(options.instrumenter, {basedir: process.cwd()}));
  var collector = new Instrumenter.Collector();

  if (options.report) {
    report = options.report;
    delete(options.report);
  }

  var data = '';
  return through(function(buf, enc, next) {
    data += buf;
    next();
  }, function(next) {
    var re = /__coverage__='([^;]*)';\n/gi,
        match = re.exec(data),
        coverage;

    // Clean up the stream
    this.push(data.replace(re,''));

    // match[1] contains JSON.stringify(__coverage__)
    coverage = match ? JSON.parse(match[1]) || {} : {};

    collector.add(coverage);

    // Add report
    [].concat(report).forEach(function (reportType) {
      Instrumenter.Report
        .create(reportType, _.clone(options))
        .writeReport(collector, true);
    });

    next();
  });
}

module.exports = function (b, opts) {
  opts = _.extend({
    instrumenter: 'istanbul',
    exclude: ['**/node_modules/**', '**/test/**', '**/tests/**'],
    dir: './coverage',
  }, opts);
  var reporterOptions = _.omit(opts, 'exclude');

  function apply() {
    b.pipeline.get('wrap').push(writeReports(reporterOptions));
  }

  b.transform(instrument(opts));
  b.on('reset', apply);
  apply();
};
