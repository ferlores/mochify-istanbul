mochify-istanbul
=====================

Add istanbul coverage to the [mochify.js](https://github.com/mantoni/mochify.js) pipeline.

## Install

```
$ npm install mochify mochify-istanbul
```

## Usage

```javascript
var mochify = require('mochify');
var istanbul = require('mochify-istanbul');

va b = mochify('path/to/your/file', mochifyOpts)
  .plugin(istanbul({
    // Intrumenter options
    exclude: '**/test/**/*',
    // Reporter options
    reports: ['text', 'cobertura', 'json']
  }))
  .bundle();
```

## Options
There are only two options specific to this module, all the rest options are passed directly to the reporters

### ```options.exclude = '<glob pattern>'```
Files to exclude for the instrumenter

### ```options.reports = ['<report type>']```
Array of reports to generate. Check [istanbul](https://github.com/gotwarlost/istanbul) for a updated list of reports

## Compatibility
 - Node >= 0.10
 - v0.x, v1.0
    - Mochify 2.x
        - Browserify 6.x
        - Mocha 2.x
        - Istanbul 0.x

## Run tests
Clone the repo and run ```npm install && npm test```
