#!/bin/sh
set -x
BUILDDIR=.gh-pages-build
TARGET_BRANCH=gh-pages
# Check out the current `master` branch in a new directory
test -f docs/index.xhtml || exit 1
git worktree add --detach $BUILDDIR master
pushd $BUILDDIR
# Build things (runs `make` in the docs/ directory)
make DOC_TARGET=docs BROWSERIFY=../node_modules/.bin/browserify CODEMIRROR=../node_modules/codemirror
# Add and commit the new tree to the $TARGET_BRANCH branch
git add -f docs/*
BUILD_ID=$(git commit-tree -p master -m 'gh-pages build' $(git write-tree))
popd
# Push that branch to the gh-publish remote
git worktree remove -f $BUILDDIR
git push -f gh-publish $BUILD_ID:$TARGET_BRANCH
