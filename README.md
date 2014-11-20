mochify-istanbul
=====================

Add istanbul coverage to the mochify pipeline

## Install

```
$ npm install mochify mochify-istanbul
```

## Usage

```
var browserifyBundle = mochify('path/to/your/file', mochifyOpts)
                        .plugin(istanbul({
                          reporter: { reports: ['text', 'cobertura', 'json'] }
                        }))
                        .bundle();
```

## Run tests
Clone the repo and run ```npm install && npm test```
