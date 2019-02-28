
NODEJS ?= node
BROWSERIFY ?= node_modules/.bin/browserify
CODEMIRROR ?= node_modules/codemirror

DOC_TARGET = doc
DOC_BUILD = \
	$(DOC_TARGET)/JSONSchemaParse.js \
	$(DOC_TARGET)/codemirror.css \
	$(DOC_TARGET)/lint.css \
	# $(DOC_TARGET)/theme.css \
	# $(DOC_TARGET)/index.xhtml \
	# $(DOC_TARGET)/lint.xhtml \

all: $(DOC_BUILD)

$(DOC_TARGET)/JSONSchemaParse.js: doc/app.src.js
	$(BROWSERIFY) -e $< > $@

$(DOC_TARGET)/codemirror.css: $(CODEMIRROR)/lib/codemirror.css
	cp $< $@

$(DOC_TARGET)/lint.css: $(CODEMIRROR)/addon/lint/lint.css
	cp $< $@

test:
	$(NODEJS) runner.js

clean:
	rm -f $(DOC_BUILD)

.PHONY: all test clean
