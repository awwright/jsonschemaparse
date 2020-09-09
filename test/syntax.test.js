"use strict";

const assert = require('assert');
const lib = require('..');

describe('syntax tests', function(){
	it('type: object', function(){
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
	it('type: array', function(){
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
	it('type: string', function(){
		// valid
		assert.strictEqual(lib.parse('"\\"\\\\/\\b\\f\\n\\r"'), "\"\\/\b\f\n\r");
		assert.throws(function(){
			lib.parse('" 1234');
		}, function(err){
			assert(err instanceof lib.SyntaxError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 7);
			assert.match(err.message, /Unexpected end of document/);
			return true;
		});
	});
	it('type: number', function(){
		// valid
		assert.strictEqual(lib.parse('-0.0420e-2'), -0.00042);
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
});

