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
	it('type: boolean', function(){
	});
	it('type: string', function(){
	});
});

