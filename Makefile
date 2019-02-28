
NODEJS ?= node
BROWSERIFY ?= node_modules/.bin/browserify

DOC_TARGET = doc
DOC_BUILD = \
	$(DOC_TARGET)/JSONSchemaParse.js \
	# $(DOC_TARGET)/theme.css \
	# $(DOC_TARGET)/index.xhtml \
	# $(DOC_TARGET)/lint.xhtml \

all: $(DOC_BUILD)

$(DOC_TARGET)/JSONSchemaParse.js: doc/app.src.js
	$(BROWSERIFY) -e $< -s JSONSchemaParse > $@

test:
	$(NODEJS) runner.js

clean:
	rm -f $(DOC_BUILD)

.PHONY: all test clean
