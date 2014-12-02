/*global it, describe, beforeEach */
'use strict';

var fs = require('fs');
var path = require('path');
var mochify = require('mochify');
var assert = require('assert');
var through = require('through2');
var rimraf = require('rimraf');
var istanbul = require('../');

var phantomjsPath = path.resolve('node_modules/.bin/phantomjs');
var defaultOutputJSON = path.resolve('./coverage-final.json');
var defaultOutputXML = path.resolve('./cobertura-coverage.xml');

var out;
var output;

function validateOutput(validator) {
  return function (err) {
    var report;

    if (err) {
      return validator(err);
    }

    // Forces reload of the json file
    delete require.cache[defaultOutputJSON];

    assert.doesNotThrow(function () {
      report = require(defaultOutputJSON);
    }, 'coverage file not found or invalid');

    assert.ok(fs.existsSync(defaultOutputXML), 'cobertura file not found');
    if (validator) {
      validator(report);
    }
  };
}

function createTestInstance(testFile, opts) {
  // For debugging
  // var debugOutput = require('fs').createWriteStream('./tmp.txt');

  return mochify(testFile, {
    output: output,
    // output: debugOutput, // for debugging
    reporter: 'tap'
  }).plugin(istanbul, opts);
}

function resetOutput() {
  out = '';
  output = through(function (chunk, enc, next) {
    /*jslint unparam: true */
    out += chunk;
    next();
  });
}

describe('Basic', function () {
  this.timeout(5000);

  beforeEach(function () {
    resetOutput();
    rimraf.sync(defaultOutputJSON);
    rimraf.sync(defaultOutputXML);
  });

  it('should instrument the code and run report', function (done) {
    createTestInstance('./test/fixtures/pass-100.js', {
      report: ['json', 'cobertura']
    }).bundle(validateOutput(function (report) {
      var keys = Object.keys(report);

      assert.equal(keys.length, 1, 'more than one file instrumented');
      assert.equal(path.basename(keys[0]), 'pass-100.js',
        'wrong file instrumented');
      done();
    }));
  });

  it('should report 50% coverage', function (done) {
    createTestInstance('./test/fixtures/pass-50.js', {
      report: ['json', 'cobertura']
    }).bundle(validateOutput(function (report) {
      var expectedResult = require('./fixtures/coverage-pass-50.json');
      var keys = Object.keys(report);

      assert.equal(keys.length, 1, 'more than one file instrumented');
      assert.equal(path.basename(keys[0]), 'pass-50.js',
        'wrong file instrumented');

      assert.deepEqual(report[keys[0]].s, expectedResult.s,
        'statement reported count dont match');
      assert.deepEqual(report[keys[0]].b, expectedResult.b,
        'branch reported count dont match');
      assert.deepEqual(report[keys[0]].f, expectedResult.f,
        'function reported count dont match');
      done();
    }));
  });

  it('should not fail if test fails', function (done) {
    createTestInstance('./test/fixtures/fail-50.js', {
      report: ['json', 'cobertura']
    }).bundle(validateOutput(function (report) {
      var keys = Object.keys(report);

      assert.equal(keys.length, 1, 'more than one file instrumented');
      assert.equal(path.basename(keys[0]), 'fail-50.js',
        'wrong file instrumented');
      done();
    }));
  });

  it('should not modify the output of mochify', function (done) {
    var testFile = './test/fixtures/pass-100.js';
    var firstOut;

    createTestInstance(testFile, {
      report: ['json']
    }).bundle(function () {
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
    });
  });

  it('should not instrument the exclude the pattern', function (done) {
    createTestInstance('./test/fixtures/pass-ignore-case.js', {
      exclude: '**/ignored*.js',
      report: ['json', 'cobertura']
    }).bundle(validateOutput(function (report) {
      var keys = Object.keys(report);

      assert.equal(keys.length, 1, 'more than one file instrumented');
      assert.equal(path.basename(keys[0]), 'pass-ignore-case.js',
        'wrong file instrumented');
      done();
    }));
  });

  it('should not instrument the exclude the patterns', function (done) {
    createTestInstance('./test/fixtures/pass-ignore-case.js', {
      exclude: ['**/ignored.js', '**/ignored2.js'],
      report: ['json', 'cobertura']
    }).bundle(validateOutput(function (report) {
      var keys = Object.keys(report);

      assert.equal(keys.length, 1, 'more than one file instrumented');
      assert.equal(path.basename(keys[0]), 'pass-ignore-case.js',
        'wrong file instrumented');
      done();
    }));
  });

  it('should not fail if no instrumented files', function (done) {
    createTestInstance('./test/fixtures/pass-ignore-case.js', {
      exclude: '**/*',
      report: ['json', 'cobertura']
    }).bundle(validateOutput(function (report) {
      assert.deepEqual(report, {}, 'some files were instrumented');
      done();
    }));
  });
});
