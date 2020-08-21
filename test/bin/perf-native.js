#!/usr/bin/env node
"use strict";

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

fs.readFile(filename, 'UTF-8', function(fserr, data){
	if(fserr){
		assert.fail(fserr);
	}
	try {
		JSON.parse(data);
	}catch(err){
		console.error('Error:', err);
	}
	console.timeEnd(TEST);
	console.log('* Bytes parsed: ' + count);
	console.log('* Memory usage: ' + Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB');
});
