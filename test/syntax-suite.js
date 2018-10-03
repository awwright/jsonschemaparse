var assert = require('assert');

var fs = require('fs');
var stream = require('stream');

var SchemaRegistry = require('../index.js').SchemaRegistry;
var Schema = require('../index.js').Schema;
var Parser = require('../index.js').StreamParser;

var metaschemaObject = require('json-metaschema/draft-07-schema.json');

var syntaxTestDir = __dirname+'/vendor-syntax-suite/test_parsing';
var syntaxTestFilesPositive = fs.readdirSync(syntaxTestDir).filter(function(n){
	return n[0]=='y';
});
var syntaxTestFilesNegative = fs.readdirSync(syntaxTestDir).filter(function(n){
	return n[0]=='n';
});

describe('Syntax tests', function(){
	it('meta', function(){
		assert(syntaxTestFilesPositive.length);
		assert(syntaxTestFilesNegative.length);
	});
	syntaxTestFilesPositive.forEach(function(filename){
		var filepath = syntaxTestDir + '/' + filename;
		var label = 'Positive: '+filename;
		it(label + ' (UTF-8 buffer)', function(done){
			var error = null;
			var t = fs.createReadStream(filepath);
			var p = new Parser(null, {keepValue:true, charset:'UTF-8'});
			t.pipe(p);
			p.on('error', function(err){
				done(err);
			});
			p.on('finish', function(){
				assert(p.value!==undefined);
				if(!error) done();
			});
		});
		it(label + ' (UTF-8 each-character)', function(done){
			var error = null;
			var t = fs.readFile(filepath, function(err, data){
				var p = new Parser(null, {keepValue:true, charset:'UTF-8'});
				for(var i=0; i<data.length; i++){
					p.write(new Uint8Array([data[i]]));
				}
				p.end();
				p.on('finish', function(){
					assert(p.value!==undefined);
					if(!error) done();
				});
			});
		});
		it(label + ' (string)', function(done){
			var error = null;
			var t = fs.createReadStream(filepath, {encoding:'UTF-8'});
			var p = new Parser(null, {keepValue:true, charset:'string'});
			t.pipe(p);
			p.on('error', function(err){
				done(err);
			});
			p.on('finish', function(){
				assert(p.value!==undefined);
				if(!error) done();
			});
		});
	});
	syntaxTestFilesNegative.forEach(function(filename){
		var filepath = syntaxTestDir + '/' + filename;
		var label = 'Negative: '+filename ;
		it(label + ' (UTF-8 buffer)', function(done){
			//console.log('\n\n'+filepath);
			var error = null;
			var t = fs.createReadStream(filepath);
			var p = new Parser(null, {keepValue:true, charset:'UTF-8'});
			//t.pipe(p);
//			p.on('error', function(err){
//				console.log('error');
//				error = err;
//				done();
//			});
//			p.on('finish', function(){
//				console.log('finish');
//				assert(error);
//				if(!error) done();
//			});
			stream.pipeline(t, p, function(err){ done(!err); });
		});
		it(label + ' (string)', function(done){
			//console.log('\n\n'+filepath);
			var error = null;
			var t = fs.createReadStream(filepath, {encoding:'UTF-8'});
			var p = new Parser(null, {keepValue:true, charset:'string'});
//			t.pipe(p);
//			p.on('error', function(err){
//				//console.log('error');
//				error = err;
//				done();
//			});
//			p.on('finish', function(){
//				//console.log('finish');
//				assert(error);
//				if(!error) done();
//			});
			stream.pipeline(t, p, function(err){ done(!err); });
		});
	});
});
