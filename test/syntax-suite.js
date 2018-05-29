var assert = require('assert');

var fs = require('fs');

var SchemaRegistry = require('../index.js').SchemaRegistry;
var Schema = require('../index.js').Schema;
var Parser = require('../index.js').StreamParser;

var metaschemaObject = require('json-metaschema/draft-07-schema.json');

var syntaxTestDir = __dirname+'/syntax-suite/test_parsing';
var syntaxTestFilesPositive = fs.readdirSync(syntaxTestDir).filter(function(n){
	return n[0]=='y';
});
var syntaxTestFilesNegative = fs.readdirSync(syntaxTestDir).filter(function(n){
	return n[0]=='n';
});

describe('Syntax tests', function(){
	syntaxTestFilesPositive.forEach(function(filename){
		var filepath = syntaxTestDir + '/' + filename;
		var label = filename + ' (UTF-8)';
		it(label, function(done){
			var t = fs.createReadStream(filepath);
			var p = new Parser(null, {keepValue:true, charset:'UTF-8'});
			t.pipe(p);
			p.on('error', function(){
				assert.fail();
			});
			p.on('finish', function(){
				assert.ok(p.value);
				done();
			});
		});
	});
	syntaxTestFilesNegative.forEach(function(filename){
		var filepath = syntaxTestDir + '/' + filename;
		var label = filename + ' (UTF-8)';
		it(label, function(done){
			var t = fs.createReadStream(filepath);
			var p = new Parser(null, {keepValue:true, charset:'UTF-8'});
			t.pipe(p);
			var error = null;
			p.on('error', function(err){
				error = err;
			});
			p.on('finish', function(){
				assert.ok(error);
				done();
			});
		});

	});
});
