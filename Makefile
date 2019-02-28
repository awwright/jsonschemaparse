
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

BUILDDIR = .gh-pages-build
BUILD_BRANCH = gh-pages
gh-pages:
	git worktree add --detach $(BUILDDIR) master
	cd $(BUILDDIR) && make DOC_TARGET=doc BROWSERIFY=../node_modules/.bin/browserify CODEMIRROR=../node_modules/codemirror
	cd $(BUILDDIR) && git add -f doc/*
	cd $(BUILDDIR) && git branch -f $(BUILD_BRANCH) $(git commit-tree -p master -m 'gh-pages build' $(git write-tree --prefix=doc/))
	git worktree remove -f $(BUILDDIR)
	git push -f origin $(BUILD_BRANCH)

.PHONY: all test clean gh-pages
