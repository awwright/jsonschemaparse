#!/bin/sh
set -x
BUILDDIR=.gh-pages-build
TARGET_BRANCH=gh-pages
# Check out the current `master` branch in a new directory
test -f doc/index.xhtml || exit 1
git worktree add --detach $BUILDDIR master
pushd $BUILDDIR
# Build things (runs `make` in the doc/ directory)
make DOC_TARGET=doc BROWSERIFY=../node_modules/.bin/browserify CODEMIRROR=../node_modules/codemirror
# Add and commit the new tree to the $TARGET_BRANCH branch
git add -f doc/*
BUILD_ID=$(git commit-tree -p master -m 'gh-pages build' $(git write-tree --prefix=doc/))
popd
# Push that branch to the gh-publish remote
git worktree remove -f $BUILDDIR
git push -f gh-publish $BUILD_ID:$TARGET_BRANCH
