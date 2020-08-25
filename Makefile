
NODEJS ?= node
BROWSERIFY ?= node_modules/.bin/browserify
CODEMIRROR ?= node_modules/codemirror

DOC_BUILD = \
	docs/app.bundle.js \
	docs/codemirror.css \
	docs/lint.css \
	# docs/theme.css \
	# docs/index.xhtml \
	# docs/lint.xhtml \

TARGETS = $(DOC_BUILD)

all: $(DOC_BUILD)

clean:

docs/app.bundle.js: docs/app.src.js
	$(BROWSERIFY) -e $< > $@

docs/codemirror.css: $(CODEMIRROR)/lib/codemirror.css
	cp $< $@

docs/lint.css: $(CODEMIRROR)/addon/lint/lint.css
	cp $< $@

test:
	$(NODEJS) runner.js

clean:
	rm -f $(TARGETS)

.PHONY: all test clean
