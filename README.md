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
    reporter: { reports: ['text', 'cobertura', 'json'] }
  }))
  .bundle();
```

## Compatibility
 - Node >= 0.10
 - v0.x
    - Mochify 2.x
        - Browserify 6.x
        - Mocha 2.x


## Run tests
Clone the repo and run ```npm install && npm test```
