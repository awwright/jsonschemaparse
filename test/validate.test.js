"use strict";

const assert = require('assert');
const lib = require('..');

// The JSON Schema test suite verifies that the valid/invalid behavior is correct, but not much else
// These tests ensure the error messages and other metadata is correct

describe('validate tests', function(){
	// Boolean schemas
	it('true', function(){
		const schema = new lib.Schema('http://example.com/schema', true);
		assert.deepStrictEqual(lib.parse('"a"', schema), "a");
	});
	it('true', function(){
		const schema = new lib.Schema('http://example.com/schema', false);
		assert.throws(function(){
			lib.parse('1', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			// err.keyword should be `false` or something
			return true;
		});
	});
	// set keywords
	it('allOf', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			allOf: [
				{ type: ['number', 'string'] },
				{ type: ['string'] },
			],
		});
		assert.deepStrictEqual(lib.parse('"a"', schema), "a");
		assert.throws(function(){
			lib.parse('1', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			// err.keyword is not 'allOf', but 'type' here
			return true;
		});
	});
	it('anyOf', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			anyOf: [
				{ type: ['number'] },
				{ type: ['string'] },
			],
		});
		assert.deepStrictEqual(lib.parse('"a"', schema), "a");
		assert.deepStrictEqual(lib.parse('1', schema), 1);
		assert.throws(function(){
			lib.parse('true', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'anyOf');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			return true;
		});
	});
	it('oneOf', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			oneOf: [
				{ type: ['number'] },
				{ type: ['string'] },
			],
		});
		assert.deepStrictEqual(lib.parse('"a"', schema), "a");
		assert.deepStrictEqual(lib.parse('1', schema), 1);
		assert.throws(function(){
			lib.parse('true', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'oneOf');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			return true;
		});
	});
	it('not', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			not: { type: ['number'] },
		});
		assert.deepStrictEqual(lib.parse('"a"', schema), "a");
		assert.throws(function(){
			lib.parse('1', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'not');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			return true;
		});
	});
	// type keyword
	it('type: object', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			type: 'object',
		});
		assert.deepStrictEqual(lib.parse('{ "a": 1, "b": "2" }', schema), { "a": 1, "b": "2" });
		assert.throws(function(){
			lib.parse('[]', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'type');
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
			assert.strictEqual(err.keyword, 'type');
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
			assert.strictEqual(err.keyword, 'type');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			assert.match(err.message, /expected/);
			return true;
		});
	});
	// Objects
	it('required', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			required: ['a'],
		});
		assert.deepStrictEqual(lib.parse('{"a":"foo"}', schema), {"a":"foo"});
		assert.deepStrictEqual(lib.parse('1', schema), 1);
		assert.throws(function(){
			lib.parse('{"b":"foo"}', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'required');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			return true;
		});
	});
	it('properties', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			properties: {
				'foo': { type: 'string' },
			},
		});
		assert.deepStrictEqual(lib.parse('{"foo": "string"}', schema), {"foo": "string"});
		assert.deepStrictEqual(lib.parse('{"bar": 2}', schema), {"bar": 2});
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('{"foo": 2}', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'type');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 6);
			return true;
		});
	});
	it('patternProperties', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			patternProperties: {
				'^/': { type: 'string' },
			},
		});
		assert.deepStrictEqual(lib.parse('{"/foo": "string"}', schema), {"/foo": "string"});
		assert.deepStrictEqual(lib.parse('{"foo": 2}', schema), {"foo": 2});
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('{"/foo": 2}', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'type');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 7);
			return true;
		});
	});
	it('additionalProperties', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			additionalProperties: { type: 'string' },
		});
		assert.deepStrictEqual(lib.parse('{"foo": "string"}', schema), {"foo": "string"});
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('{"foo": 2}', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'type');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 6);
			return true;
		});
	});
	it('unevaluatedProperties', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			unevaluatedProperties: { type: 'string' },
		});
		assert.deepStrictEqual(lib.parse('{"foo": "string"}', schema), {"foo": "string"});
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('{"foo": 2}', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'type');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 6);
			return true;
		});
	});
	it('minProperties', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			minProperties: 1,
		});
		assert.deepStrictEqual(lib.parse('{"foo": "string"}', schema), {"foo": "string"});
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('{}', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'minProperties');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			return true;
		});
	});
	it('maxProperties', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			maxProperties: 1,
		});
		assert.deepStrictEqual(lib.parse('{"foo": "string"}', schema), {"foo": "string"});
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('{"a":1, "b":2}', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'maxProperties');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			return true;
		});
	});
	// Array
	it('additionalItems', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			items: [ { type: 'number' } ],
			additionalItems: { type: 'string' },
		});
		assert.deepStrictEqual(lib.parse('[2, "string"]', schema), [2, "string"]);
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('[2, 2]', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'type');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 4);
			return true;
		});
	});
	it('minItems', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			minItems: 1,
		});
		assert.deepStrictEqual(lib.parse('[2]', schema), [2]);
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('[]', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'minItems');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			return true;
		});
	});
	it('maxItems', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			maxItems: 1,
		});
		assert.deepStrictEqual(lib.parse('[1]', schema), [1]);
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('[1, 2]', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'maxItems');
			assert.strictEqual(err.position.line, 0);
			// FIXME this should be the item that went over
			// assert.strictEqual(err.position.column, 0);
			return true;
		});
	});
	// String
	it('minLength', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			minLength: 1,
		});
		assert.deepStrictEqual(lib.parse('"2"', schema), "2");
		assert.deepStrictEqual(lib.parse('"🐲"', schema), "🐲");
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('""', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'minLength');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			assert.match(err.message, /too short/);
			return true;
		});
	});
	it('maxLength', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			maxLength: 1,
		});
		assert.deepStrictEqual(lib.parse('"🐲"', schema), "🐲");
		assert.deepStrictEqual(lib.parse('"\\uD83D\\uDC32"', schema), "🐲");
		assert.deepStrictEqual(lib.parse('"1"', schema), "1");
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('"12"', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'maxLength');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			assert.match(err.message, /too long/);
			return true;
		});
		assert.throws(function(){
			lib.parse('"🐉🐲"', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'maxLength');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			assert.match(err.message, /too long/);
			return true;
		});
	});
	it('pattern', function(){
		const schema = new lib.Schema('http://example.com/schema', {
			pattern: "^/",
		});
		assert.deepStrictEqual(lib.parse('"/12"', schema), "/12");
		assert.strictEqual(lib.parse('null', schema), null);
		assert.throws(function(){
			lib.parse('"12"', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.strictEqual(err.keyword, 'pattern');
			assert.strictEqual(err.position.line, 0);
			return true;
		});
	});
	// Numbers
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
			assert.strictEqual(err.keyword, 'minimum');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			// assert.match(err.message, /minimum/);
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
			assert.strictEqual(err.keyword, 'exclusiveMinimum');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			// assert.match(err.message, /exclusiveMinimum/);
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
			assert.strictEqual(err.keyword, 'maximum');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			// assert.match(err.message, /maximum/);
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
			assert.strictEqual(err.keyword, 'exclusiveMaximum');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			// assert.match(err.message, /exclusiveMaximum/);
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
			assert.strictEqual(err.keyword, 'multipleOf');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			assert.match(err.message, /not multiple of/);
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
			assert.strictEqual(err.keyword, 'enum');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			assert.match(err.message, /does not match one of the enumerated values/);
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
			assert.strictEqual(err.keyword, 'const');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 8);
			assert.match(err.message, /const/);
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
			assert.strictEqual(err.keyword, 'const');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 1);
			assert.match(err.message, /const/);
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
			assert.strictEqual(err.keyword, 'const');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			assert.match(err.message, /string/);
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
			assert.strictEqual(err.keyword, 'const');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			assert.match(err.message, /const/);
			assert.match(err.message, /number/);
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
			assert.strictEqual(err.keyword, 'const');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			assert.match(err.message, /const/);
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
			assert.strictEqual(err.keyword, 'const');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			assert.match(err.message, /Expected null/);
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
			assert.strictEqual(err.keyword, 'enum');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 0);
			// TODO test for some message like `(because type=="string")`
			// assert.match(err.message, /does not match one of the value/);
			return true;
		});
	});
});

