
SHELL := /bin/bash
PATH  := ./node_modules/.bin:$(PATH)

.PHONY: all
all: lib

.PHONY: test
test: lint
	./test/cli.sh

.PHONY: lint
lint: node_modules
	tslint -p tsconfig.json -c tslint.json -t stylish --fix

.PHONY: lib
lib: node_modules
	tsc -p tsconfig.json
	sed -i "" "1s/ts-node/node/" lib/cli.js
	rm lib/cli.d.ts

node_modules:
	npm install

.PHONY: clean
clean:
	rm -rf lib/

.PHONY: distclean
distclean: clean
	rm -rf node_modules/
