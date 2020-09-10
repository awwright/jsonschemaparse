"use strict";

const assert = require('assert');
const lib = require('..');

function parseCharacters(json){
	const parser = new lib.StreamParser({parseValue: true});
	for(let i=0; i<json.length; i++){
		parser.parseBlock(json[i]);
	}
	parser.eof();
	return parser;
}

describe('syntax tests', function(){
	it('object', function(){
		assert.throws(function(){
			lib.parse('{ a: "b" } ');
		}, function(err){
			assert(err instanceof lib.SyntaxError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 2);
			assert.match(err.message, /Unexpected "a"/);
			return true;
		});
	});
	it('array', function(){
		assert.throws(function(){
			lib.parse('[,]');
		}, function(err){
			assert(err instanceof lib.SyntaxError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 1);
			assert.match(err.message, /Unexpected ","/);
			return true;
		});
	});
	it('string', function(){
		// valid
		const json = '"\\"\\\\\\/\\b\\f\\n\\r"';
		assert.strictEqual(lib.parse(json), "\"\\/\b\f\n\r");
		assert.strictEqual(parseCharacters(json).value, "\"\\/\b\f\n\r");
		assert.throws(function(){
			lib.parse('"1234');
		}, function(err){
			assert(err instanceof lib.SyntaxError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 6);
			assert.match(err.message, /Unexpected end of document/);
			return true;
		});
	});
	it('number', function(){
		// valid
		assert.strictEqual(lib.parse('-4.20e-3'), -0.0042);
		assert.throws(function(){
			lib.parse('.123');
		}, function(err){
			assert(err instanceof lib.SyntaxError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			assert.match(err.message, /Unexpected "."/);
			return true;
		});
	});
	it('boolean', function(){
		assert.throws(function(){
			lib.parse('tru ');
		}, function(err){
			assert(err instanceof lib.SyntaxError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 3);
			assert.match(err.message, /Unexpected " "/);
			return true;
		});
	});
});

