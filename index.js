var Istanbul = require('istanbul');
var through = require('through2');
var minimatch = require("minimatch");

function instrument(options) {
  var filesPattern = options.files || '**/*.js';
  var excludePattern = options.exclude || '';
  var instrumenter = new Istanbul.Instrumenter(options);

  function transform(file) {
    // If if doesnt match the pattern dont instrument it
    if (!minimatch(file, filesPattern) || minimatch(file, excludePattern))
      return through();

    var data = '';
    return through(function(buf, enc, next) {
      data += buf;
      next();
    }, function(next) {
      var self = this;
      instrumenter.instrument(data, file, function(err, code) {
        if (!err) {
          // Inject __converage__ var
          self.push(code);
          self.push('console.log("__coverage__=\'" + JSON.stringify(__coverage__) + "\';");')
        } else {
          self.emit('error', err);
        }
        next();
      });
    });
  }

  return transform;
};

function writeReports(options) {
  var collector = new Istanbul.Collector();
  var reports = options.reports || [];
  delete(options.reports);

  var data = '';
  return through(function(buf, enc, next) {
    data += buf;
    next();
  }, function(next) {
    var re = /__coverage__='([^;]*)';\n/gi,
        match = re.exec(data),
        coverageStr;

    // Variable not found
    if (!match || !match[1])
      return next('mochify-istanbul: ERROR: __coverage__ variable not found in the bundle. Maybe not files instrumented');

    // Clean up the stream
    this.push(data.replace(re,''));

    // match[1] contains JSON.stringify(__coverage__)
    collector.add(JSON.parse(match[1]));

    // Add reports
    [].concat(reports).forEach(function (reportType) {
      Istanbul.Report
        .create(reportType, Object.create(options))
        .writeReport(collector, true);
    });

    next();
  });
}

module.exports = function (options) {
  // Force variable name
  options.instrumenter = options.instrumenter || {};
  options.reporter = options.reporter || {};
  options.instrumenter.variable = '__coverage__';

  return function (b, opts) {
    b.transform(instrument(options.instrumenter));
    b.pipeline.get('wrap').push(writeReports(options.reporter));
  }
}
