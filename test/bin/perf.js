#!/usr/bin/env node
"use strict";

const { StreamParser } = require('../..');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

if (process.argv.length !== 3){
	return console.error('Usage: perf.js filename');
}

const filename = path.resolve(process.cwd(), process.argv[2]);

var TEST = '- Parsing file ' + filename;
console.time(TEST);

var count = 0;
const parser = new StreamParser;

fs.createReadStream(filename).pipe(parser);
parser.once('error', function (error) {
	console.error('Error:', error);
	console.timeEnd(TEST);
	console.log('* Bytes parsed: ' + count);
	console.log('* Memory usage: ' + Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB');
});
parser.once('end', function () {
	console.timeEnd(TEST);
	console.log('* Bytes parsed: ' + count);
	console.log('* Memory usage: ' + Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB');
});
