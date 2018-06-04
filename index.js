'use strict';

var resolve = require('resolve');
var through = require('through2');
var minimatch = require('minimatch');
var combine = require('stream-combiner2');
var split = require('split2');
var _ = require('lodash');
var fspath = require('path');
var fs = require('fs');

function matchesPatterns(patterns, input) {
  var matchResult = _.compact(_.map(patterns, function (pattern) {
    return minimatch(input, pattern);
  }));
  return matchResult.length > 0;
}

function walkDirSync(rootDir, options) {
  var processed = new Set();
  var dirs = [rootDir];
  var result = [];
  options = options || {};

  for (var i = 0; i < dirs.length; ++i) {
    var parentPath = dirs[i];
    fs.readdirSync(parentPath).map(function(subPath) {
      return fspath.join(parentPath, subPath);
    }).forEach(function (fullPath) {
      var realFullPath = fs.realpathSync(fullPath);
      if (processed.has(realFullPath)) {
        return;
      }

      processed.add(realFullPath);

      if (fs.statSync(fullPath).isDirectory()) {
        dirs.push(fullPath);
        return;
      }

      // Include file by default
      var includeInResult = true;

      if (options.include) {
        // Exclude non-matched file that should be included
        if (!matchesPatterns(options.include, fullPath)) {
          includeInResult = false;
        }
      }

      if (options.exclude) {
        // Exclude matched file that should be excluded
        if (matchesPatterns(options.exclude, fullPath)) {
          includeInResult = false;
        }
      }

      if (includeInResult) {
        result.push(fullPath);
      }
    });
  }

  return result;
}

function getAllSources(options) {
  if (!options.all) {
    return [];
  }
  return walkDirSync(options.root, {include: options.include, exclude: options.exclude});
}

function filterFiles(options, files) {
  return function (file) {
    // Instrument file by default
    files[file] = true;

    if (options.include) {
      // Do not instrument non-matched file that should be included
      if (!matchesPatterns(options.include, file)) {
        files[file] = false;
      }
    }

    if (options.exclude) {
      // Do not instrument matched file that should be excluded
      if (matchesPatterns(options.exclude, file)) {
        files[file] = false;
      }
    }

    return through();
  };
}

function instrument(options, files) {
  var Instrumenter = require(resolve.sync(options.instrumenter, {basedir: __dirname}));
  var instrumenter = new Instrumenter.Instrumenter();
  var captured = false;

  return through.obj(function(row, enc, next) {
    if (!files[row.file]) {
      this.push(row);
      next();
      return;
    }
    var self = this;
    instrumenter.instrument(row.source, row.file, function(err, code) {
      if (err) {
        self.emit('error', err);
        next();
        return;
      }
      row.source = code;
      // Inject __converage__ var
      if (!captured) {
        captured = true;
        row.source += 'after(function(){console.log("__coverage__=\'" + JSON.stringify(__coverage__) + "\';");});';
      }
      self.push(row);
      next();
    });
  });
}

var report = [];

function writeReports(options) {
  var Instrumenter = require(resolve.sync(options.instrumenter, {basedir: __dirname}));
  var collector = new Instrumenter.Collector();

  if (options.report) {
    report = options.report;
    delete options.report;
  }

  var data = '';
  var coverageRe = /__coverage__='([^;]*)';/gi;
  var skippedPreviousLine = false;
  var extractCoverage = through(function(buf, enc, next) {
    data += buf;
    if (!coverageRe.test(buf.toString())) {
      if (!skippedPreviousLine) this.push(buf);
      skippedPreviousLine = false;
    } else {
      skippedPreviousLine = true;
    }
    next();
  }, function(next) {
    var re = /__coverage__='([^;]*)';(\r\n?|\n)/gi;
    var match;
    // capture all the matches, there might be multiple
    while (match = re.exec(data)) {
      // match[1] contains JSON.stringify(__coverage__)
      collector.add(JSON.parse(match[1]));
    }

    // Add report
    [].concat(report).forEach(function (reportType) {
      Instrumenter.Report
        .create(reportType, _.clone(options))
        .writeReport(collector, true);
    });
    next();
  });
  return combine(split(/(\r?\n)/), extractCoverage);
}

module.exports = function (b, opts) {
  opts = _.extend({
    instrumenter: 'istanbul',
  }, opts);

  opts.include = opts.include ? [].concat(opts.include) : null,
  opts.exclude = opts.exclude ? [].concat(opts.exclude) : null,
  opts.all = !!opts.all;
  opts.root = opts.root ? fspath.resolve(opts.root) : process.cwd();

  var reporterOptions = _.omit(opts, 'include', 'exclude', 'all', 'root');
  var files = {};
  function apply() {
    b.add(getAllSources(opts));
    b.pipeline.get('pack').unshift(instrument(opts, files));
    b.pipeline.get('wrap').push(writeReports(reporterOptions));
  }

  b.transform(filterFiles(opts, files));
  b.on('reset', apply);
  apply();
};
