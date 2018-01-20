
NODEJS ?= node

all:

test:
	$(NODEJS) runner.js

.PHONY: all test
