
SHELL := /bin/bash
PATH  := ./node_modules/.bin:$(PATH)

SRC_FILES := $(shell find src -name '*.ts')

.PHONY: all
all: lib

.PHONY: test
test: node_modules
	tslint -p tsconfig.json -c tslint.json && \
	./test/cli.sh

.PHONY: lint
lint: node_modules
	tslint -p tsconfig.json -c tslint.json -t stylish --fix

lib: $(SRC_FILES) node_modules
	tsc -p tsconfig.json && \
	sed -i "" "1s/ts-node/node/" lib/cli.js && \
	rm lib/cli.d.ts && \
	VERSION="$$(node -p 'require("./package.json").version')"; \
	echo "module.exports = '$${VERSION}';" > lib/version.js && \
	touch lib

node_modules:
	npm ci && \
	touch node_modules

.PHONY: clean
clean:
	rm -rf lib/

.PHONY: distclean
distclean: clean
	rm -rf node_modules/
