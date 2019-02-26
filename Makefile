
NODEJS ?= node
BROWSERIFY ?= node_modules/.bin/browserify

DOC_TARGET = doc
DOC_BUILD = \
	$(DOC_TARGET)/theme.css \
	$(DOC_TARGET)/JSONSchemaParse.js \
	$(DOC_TARGET)/index.html \

all: $(DOC_BUILD)

$(DOC_TARGET)/JSONSchemaParse.js: index.js
	$(BROWSERIFY) -e $< -s JSONSchemaParse > $@

test:
	$(NODEJS) runner.js

.PHONY: all test
