"use strict";

var Istanbul = require('istanbul');
var through = require('through2');
var minimatch = require("minimatch");

function simpleClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function simpleOmit(obj, props) {
  var cloned = simpleClone(obj);

  props.forEach(function (prop) {
    if (cloned[prop]) {
      delete cloned[prop];
    }
  });

  return cloned;
}

function instrument(options) {
  var excludePattern = options.exclude ? [].concat(options.exclude) : [''];
  var instrumenter = new Istanbul.Instrumenter();

  function transform(file) {
    // If if doesnt match the pattern dont instrument it
    var matchResult = [];

    excludePattern.forEach(function (pattern) {
      var match = minimatch(file, pattern);
      if (match) {
        matchResult.push(match);
      }
    });

    if (matchResult.length) {
      return through();
    }

    var data = '';
    return through(function (buf, enc, next) {
      /*jslint unparam: true */
      data += buf;
      next();
    }, function (next) {
      var self = this;
      instrumenter.instrument(data, file, function (err, code) {
        if (!err) {
          // Inject __converage__ var
          self.push(code);
          self.push('after(function(){console.log(' +
            '"__coverage__=\'" + JSON.stringify(__coverage__) + "\';");});');
        } else {
          self.emit('error', err);
        }
        next();
      });
    });
  }

  return transform;
}

function writeReports(options) {
  var collector = new Istanbul.Collector();
  var report = options.report || [];
  delete options.report;

  var data = '';
  return through(function (buf, enc, next) {
    /*jslint unparam: true */
    data += buf;
    next();
  }, function (next) {
    /*jslint regexp: true */
    var re = /__coverage__='([^;]*)';\n/gi,
      match = re.exec(data),
      coverage;

    // Clean up the stream
    this.push(data.replace(re, ''));

    // match[1] contains JSON.stringify(__coverage__)
    coverage = match ? JSON.parse(match[1]) || {} : {};

    collector.add(coverage);

    // Add report
    [].concat(report).forEach(function (reportType) {
      Istanbul.Report
        .create(reportType, simpleClone(options))
        .writeReport(collector, true);
    });

    next();
  });
}

module.exports = function (b, opts) {
  var reporterOptions = simpleOmit(opts, ['exclude']);

  b.transform(instrument(opts));
  b.pipeline.get('wrap').push(writeReports(reporterOptions));
};
