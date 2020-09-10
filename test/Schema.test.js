"use strict";

const assert = require('assert');
const lib = require('..');

const Schema = lib.Schema;

describe('Schema', function(){
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
			assert.match(err.message, /Illegal character in id/);
			return true;
		});
	});
	it('new Schema() with invalid allOf', function(){
		assert.throws(function(){
			new lib.Schema('http://example.com/schema.json', {
				allOf: {},
			});
		}, function(err){
			assert(err instanceof Error);
			assert.match(err.message, /Expected `allOf` to be an array/);
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
			assert.match(err.message, /Expected `anyOf` to be an array/);
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
			assert.match(err.message, /Expected `oneOf` to be an array/);
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
			assert.match(err.message, /Expected `oneOf` to be an array/);
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
			assert.match(err.message, /Expected `not` to be a schema/);
			return true;
		});
	});
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
	it('Schema#unknown', function(){
		var registry = new lib.Schema('http://example.com/schema.json', {
			type: "string",
			foo: "baz",
		});
		assert.strictEqual(registry.unknown.length, 1);
		assert.strictEqual(registry.unknown[0], 'foo');
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
