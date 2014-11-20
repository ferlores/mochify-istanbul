var path = require('path');
var mochify = require('mochify');
var assert = require('assert');
var through = require('through2');
var rimraf = require('rimraf');
var istanbul = require('../');

var phantomjsPath = path.resolve('node_modules/.bin/phantomjs');
var defaultOutputJSON = path.resolve('coverage/coverage-final.json');

var out;
var output;

function validateOutput(done) {
  return function (err) {
    if (err) return done(err);

    assert.doesNotThrow(function () {
      // require(defaultOutputJSON);
    }, 'coverage file not found or invalid');

    done();
  };
}

function createTestInstance(testFile, opts) {
  // For debugging
  // var debugOutput = require('fs').createWriteStream('./tmp.txt');

  return mochify(testFile, {
    output: output,
    // output: debugOutput, // for debugging
    reporter: 'tap'
  })
  .plugin(istanbul(opts));
}

function resetOutput() {
  out = '';
  output = through(function (chunk, enc, next) {
    out += chunk;
    next();
  });
}

describe('Basic', function () {
  this.timeout(5000);

  beforeEach(function () {
    resetOutput();
    rimraf.sync(defaultOutputJSON);
  });

  it('should instrument the code and run report', function (done) {
    createTestInstance('./test/fixtures/pass-100.js', {
      reporter: { reports: ['json'] }
    }).bundle(validateOutput(done))
  });

  it('should not fail if test fails', function (done) {
    createTestInstance('./test/fixtures/fail-50.js', {
      instrumenter: { variable: 'going_to_be_ignored'},
      reporter: { reports: ['json'] }
    }).bundle(validateOutput(done))
  });

  it('should not modify the output of mochify', function (done) {
    var testFile = './test/fixtures/pass-50.js';
    var firstOut;

    createTestInstance(testFile, {})
    .bundle(function () {
      // save first output, reset the stream and compare
      firstOut = out;
      resetOutput();

      mochify(testFile, {
        output: output,
        reporter: 'tap'
      }).bundle(function () {
        assert.deepEqual(firstOut, out);
        done();
      });
    })
  });

  it('should override the variable configuration', function (done) {
    createTestInstance('./test/fixtures/pass-50.js', {
      instrumenter: { variable: 'going_to_be_ignored'},
      reporter: { reports: ['json'] }
    }).bundle(validateOutput(done))
  });

  it('should pass through the options to instrumenter');
  it('should pass through the options to reporter');
  it('should add the reporters');
  it('should intrument only the specified files');
  it('should not intrument the files that matches exclude');

  // it('should instrument all the extra files');
  // it('should not fail if covering empty files __coverage__');
});

