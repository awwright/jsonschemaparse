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
			var error = null;
			var t = fs.createReadStream(filepath);
			var p = new Parser(null, {keepValue:true, charset:'UTF-8'});
			t.pipe(p);
			p.on('error', function(err){
				done(err);
			});
			t.on('end', function(){
				assert(p.value!==undefined);
				if(!error) done();
			});
		});
	});
	syntaxTestFilesNegative.forEach(function(filename){
		var filepath = syntaxTestDir + '/' + filename;
		var label = filename + ' (UTF-8)';
		it(label, function(done){
			//console.log('\n\n'+filepath);
			var error = null;
			var t = fs.createReadStream(filepath);
			var p = new Parser(null, {keepValue:true, charset:'UTF-8'});
			t.pipe(p);
			p.on('error', function(err){
				//console.log('error');
				error = err;
				done();
			});
			t.on('end', function(){
				//console.log('finish');
				assert.ok(error);
				if(!error) done();
			});
		});

	});
});
