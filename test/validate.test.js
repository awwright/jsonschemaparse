"use strict";

const assert = require('assert');
const lib = require('..');

describe('validate tests', function(){
	it('type: object', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			type: 'object',
		});
		assert.deepStrictEqual(lib.parse('{ "a": 1, "b": "2" }', schema), { "a": 1, "b": "2" });
		assert.throws(function(){
			lib.parse('[]', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			assert.match(err.message, /expected/);
			return true;
		});
	});
	it('type: array', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			type: 'array',
		});
		assert.deepStrictEqual(lib.parse('[ 1, 2 ]', schema), [ 1, 2 ]);
		assert.throws(function(){
			lib.parse('true', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			assert.match(err.message, /expected/);
			return true;
		});
	});
	it('type: boolean', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			type: 'boolean',
		});
		assert.strictEqual(lib.parse('true', schema), true);
	});
	it('type: string', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			type: 'string',
		});
		assert.strictEqual(lib.parse('"true"', schema), "true");
	});
});

