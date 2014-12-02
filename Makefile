SHELL := /bin/bash

.PHONY: test

all: test

install:
	rm -rf node_modules
	npm i

test:
	npm run lint
	npm test