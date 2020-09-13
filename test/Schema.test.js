"use strict";

const assert = require('assert');
const lib = require('..');

const Schema = lib.Schema;

describe('Schema', function(){
	// id argument
	it('new Schema() with invalid URI', function(){
		assert.throws(function(){
			new lib.Schema(true, { type: 'string' });
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /Expected `id` to be a string/);
			return true;
		});
		assert.throws(function(){
			// Space in id
			new lib.Schema(' http://example.com/', { type: 'string' });
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /Illegal character in `id`/);
			return true;
		});
	});
	// schema argument: set keywords
	it('new Schema() with invalid allOf', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				allOf: {},
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /Expected .allOf. to be an array/);
			return true;
		});
	});
	it('new Schema() with invalid anyOf', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				anyOf: {},
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /Expected .anyOf. to be an array/);
			return true;
		});
	});
	it('new Schema() with invalid oneOf', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				oneOf: {},
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /Expected .oneOf. to be an array/);
			return true;
		});
	});
	it('new Schema() with invalid oneOf', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				oneOf: {},
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /Expected .oneOf. to be an array/);
			return true;
		});
	});
	it('new Schema() with invalid `not`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				not: 1,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /Expected .not. to be a schema/);
			return true;
		});
	});
	// type keyword
	// TODO test $id, $schema
	it('new Schema() with invalid `type`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				type: 1,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /Unexpected value for .type. keyword/);
			return true;
		});
	});
	it('new Schema() with unknown `type`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				type: 'foo',
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /Unknown "type"/);
			return true;
		});
	});
	// object keywords
	it('new Schema() with invalid `required`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				required: 1,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /required/);
			assert.match(err.message, /array/);
			return true;
		});
	});
	it('new Schema() with invalid `properties`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				properties: [],
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /properties/);
			assert.match(err.message, /object/);
			return true;
		});
	});
	it('new Schema() with invalid `patternProperties`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				patternProperties: [],
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /patternProperties/);
			assert.match(err.message, /object/);
			return true;
		});
	});
	it('new Schema() with invalid `additionalProperties`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				additionalProperties: [],
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /additionalProperties/);
			assert.match(err.message, /object/);
			return true;
		});
	});
	it('new Schema() with invalid `unevaluatedProperties`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				unevaluatedProperties: [],
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /unevaluatedProperties/);
			assert.match(err.message, /object/);
			return true;
		});
	});
	it('new Schema() with invalid `minProperties`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				minProperties: [],
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /minProperties/);
			assert.match(err.message, /non-negative integer/);
			return true;
		});
	});
	it('new Schema() with invalid `maxProperties`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				maxProperties: [],
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /maxProperties/);
			assert.match(err.message, /non-negative integer/);
			return true;
		});
	});
	// array keywords
	it('new Schema() with invalid `items`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				items: null,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /items/);
			assert.match(err.message, /schema or array of schemas/);
			return true;
		});
	});
	it('new Schema() with invalid `minItems`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				minItems: [],
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /minItems/);
			assert.match(err.message, /non-negative integer/);
			return true;
		});
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				minItems: 0.5,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /minItems/);
			assert.match(err.message, /non-negative integer/);
			return true;
		});
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				minItems: -1,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /minItems/);
			assert.match(err.message, /non-negative integer/);
			return true;
		});
	});
	it('new Schema() with invalid `maxItems`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				maxItems: [],
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /maxItems/);
			assert.match(err.message, /non-negative integer/);
			return true;
		});
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				maxItems: 0.5,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /maxItems/);
			assert.match(err.message, /non-negative integer/);
			return true;
		});
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				maxItems: -1,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /maxItems/);
			assert.match(err.message, /non-negative integer/);
			return true;
		});
	});
	// string keywords
	it('new Schema() with invalid `minLength`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				minLength: [],
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /minLength/);
			assert.match(err.message, /non-negative integer/);
			return true;
		});
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				minLength: 0.5,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /minLength/);
			assert.match(err.message, /non-negative integer/);
			return true;
		});
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				minLength: -1,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /minLength/);
			assert.match(err.message, /non-negative integer/);
			return true;
		});
	});
	it('new Schema() with invalid `maxLength`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				maxLength: [],
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /maxLength/);
			assert.match(err.message, /non-negative integer/);
			return true;
		});
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				maxLength: 0.5,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /maxLength/);
			assert.match(err.message, /non-negative integer/);
			return true;
		});
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				maxLength: -1,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /maxLength/);
			assert.match(err.message, /non-negative integer/);
			return true;
		});
	});
	it('new Schema() with invalid `pattern`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				pattern: [],
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /pattern/);
			assert.match(err.message, /string/);
			return true;
		});
	});
	// number keywords
	it('new Schema() with invalid `minimum`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				minimum: [],
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /minimum/);
			assert.match(err.message, /number/);
			return true;
		});
	});
	it('new Schema() with invalid `maximum`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				maximum: [],
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /maximum/);
			assert.match(err.message, /number/);
			return true;
		});
	});
	it('new Schema() with invalid `exclusiveMinimum`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				exclusiveMinimum: [],
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /exclusiveMinimum/);
			assert.match(err.message, /number/);
			return true;
		});
	});
	it('new Schema() with invalid `exclusiveMaximum`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				exclusiveMaximum: [],
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /exclusiveMaximum/);
			assert.match(err.message, /number/);
			return true;
		});
	});
	it('new Schema() with invalid `multipleOf`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				multipleOf: [],
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /multipleOf/);
			assert.match(err.message, /positive number/);
			return true;
		});
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				multipleOf: -1,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /multipleOf/);
			assert.match(err.message, /positive number/);
			return true;
		});
	});
	// general keywords
	it('new Schema() with invalid `enum`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				enum: null,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /enum/);
			assert.match(err.message, /array/);
			return true;
		});
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				enum: {},
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /enum/);
			assert.match(err.message, /array/);
			return true;
		});
	});
	it('new Schema() with invalid `if`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				if: null,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /if/);
			assert.match(err.message, /schema/);
			return true;
		});
	});
	it('new Schema() with invalid `then`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				then: null,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /then/);
			assert.match(err.message, /schema/);
			return true;
		});
	});
	it('new Schema() with invalid `else`', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				else: null,
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /else/);
			assert.match(err.message, /schema/);
			return true;
		});
	});

	// properties
	it('Schema#subschemas, Schema#allSubschemas', function(){
		var registry = new lib.Schema('http://example.com/schema.json', {
			properties: {
				"id": {
					type: "array",
					items: { type: "string", minimum: 0 },
				},
			},
		});
		assert.strictEqual(registry.subschemas.length, 1);
		assert.strictEqual(registry.subschemas[0].type, 'array');
		assert.strictEqual(registry.allSubschemas.length, 2);
		assert.strictEqual(registry.allSubschemas[0].type, 'array');
		assert.strictEqual(registry.allSubschemas[1].type, 'string');
	});
	it('Schema#references, Schema#allReferences', function(){
		var registry = new lib.Schema('http://example.com/schema.json', {
			$ref: "#root",
			properties: {
				"id": {
					type: "array",
					items: { $ref: "#item" },
				},
			},
			$defs: {
				"root": {
					$anchor: "root",
					minProperties: 1,
				},
				"items": {
					$anchor: "items",
					type: "string",
					minimum: 0,
				},
			},
		});
		assert.strictEqual(registry.references.length, 1);
		assert.strictEqual(registry.references[0], 'http://example.com/schema.json#root');
		assert.strictEqual(registry.allReferences.length, 2);
		assert.strictEqual(registry.allReferences[0], 'http://example.com/schema.json#root');
		assert.strictEqual(registry.allReferences[1], 'http://example.com/schema.json#item');
	});
	it('Schema#unknown', function(){
		var registry = new lib.Schema('http://example.com/schema.json', {
			type: "string",
			foo: "baz",
		});
		assert.strictEqual(registry.unknown.length, 1);
		assert.strictEqual(registry.unknown[0], 'foo');
	});
});
