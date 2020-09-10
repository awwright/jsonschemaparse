"use strict";

const assert = require('assert');
const lib = require('..');

// The JSON Schema test suite verifies that the valid/invalid behavior is correct, but not much else
// These tests ensure the error messages and other metadata is correct

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
	it('type: integer or null', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			type: ['integer', 'null'],
		});
		assert.strictEqual(lib.parse('1', schema), 1);
		assert.strictEqual(lib.parse('null', schema), null);
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
	it('minimum', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			minimum: 0,
		});
		assert.strictEqual(lib.parse('0', schema), 0);
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('-1', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			// assert.match(err.message, /minimum/);
			assert.equal(err.keyword, 'minimum');
			return true;
		});
	});
	it('exclusiveMinimum', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			exclusiveMinimum: 0,
		});
		assert.strictEqual(lib.parse('1', schema), 1);
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('0', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			// assert.match(err.message, /exclusiveMinimum/);
			assert.equal(err.keyword, 'exclusiveMinimum');
			return true;
		});
	});
	it('maximum', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			maximum: 0,
		});
		assert.strictEqual(lib.parse('0', schema), 0);
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('1', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			// assert.match(err.message, /maximum/);
			assert.equal(err.keyword, 'maximum');
			return true;
		});
	});
	it('exclusiveMaximum', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			exclusiveMaximum: 0,
		});
		assert.strictEqual(lib.parse('-1', schema), -1);
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('0', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			// assert.match(err.message, /exclusiveMaximum/);
			assert.equal(err.keyword, 'exclusiveMaximum');
			return true;
		});
	});
	it('multipleOf', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			multipleOf: 2,
		});
		assert.strictEqual(lib.parse('0', schema), 0);
		assert.strictEqual(lib.parse('2', schema), 2);
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('1', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			assert.match(err.message, /not multiple of/);
			assert.equal(err.keyword, 'multipleOf');
			return true;
		});
	});
	it('enum', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			enum: [0, "1", [2], {"3":4}, true, null],
		});
		assert.strictEqual(lib.parse('0', schema), 0);
		assert.strictEqual(lib.parse('"1"', schema), "1");
		assert.deepStrictEqual(lib.parse('[2]', schema), [2]);
		assert.deepStrictEqual(lib.parse('{"3":4}', schema), {"3":4});
		assert.strictEqual(lib.parse('true', schema), true);
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('2', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			assert.match(err.message, /does not match one of the enumerated values/);
			assert.equal(err.keyword, 'enum');
			return true;
		});
	});
	it('const: object', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			const: { "type": "A" },
		});
		assert.deepStrictEqual(lib.parse('{ "type": "A" }', schema), { "type": "A" });
		assert.throws(function(){
			lib.parse('{ "type": "B" }', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 8);
			// assert.match(err.message, /does not match one of the value/);
			assert.equal(err.keyword, 'const');
			return true;
		});
	});
	it('const: array', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			const: [ 1 ],
		});
		assert.deepStrictEqual(lib.parse('[1]', schema), [ 1 ]);
		assert.throws(function(){
			lib.parse('[2]', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 1);
			// assert.match(err.message, /does not match one of the value/);
			assert.equal(err.keyword, 'const');
			return true;
		});
	});
	it('const: string', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			const: "A",
		});
		assert.strictEqual(lib.parse('"A"', schema), "A");
		assert.throws(function(){
			lib.parse('null', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			// assert.match(err.message, /does not match one of the value/);
			assert.equal(err.keyword, 'const');
			return true;
		});
	});
	it('const: number', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			const: 1,
		});
		assert.strictEqual(lib.parse('1', schema), 1);
		assert.throws(function(){
			lib.parse('2', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			// assert.match(err.message, /does not match one of the value/);
			assert.equal(err.keyword, 'const');
			return true;
		});
	});
	it('const: boolean', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			const: true,
		});
		assert.strictEqual(lib.parse('true', schema), true);
		assert.throws(function(){
			lib.parse('false', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			// assert.match(err.message, /does not match one of the value/);
			assert.equal(err.keyword, 'const');
			return true;
		});
	});
	it('const: null', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			const: null,
		});
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('false', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			// assert.match(err.message, /does not match one of the value/);
			assert.equal(err.keyword, 'const');
			return true;
		});
	});
	it('if/then/else', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			if: { type: "string" },
			then: { enum: [ "A", "B" ] },
			else: { minimum: 0 },
		});
		assert.strictEqual(lib.parse('"A"', schema), "A");
		assert.strictEqual(lib.parse('"B"', schema), "B");
		assert.strictEqual(lib.parse('1', schema), 1);
		assert.throws(function(){
			lib.parse('"C"', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			// TODO test for some message like `(because type=="string")`
			// assert.match(err.message, /does not match one of the value/);
			assert.equal(err.keyword, 'enum');
			return true;
		});
	});
});

