"use strict";

const assert = require('assert');
const lib = require('..');

describe('parseInfo(text, {parseValue})', function(){
	it('parseInfo(text, {parseValue: false}) (disabled)', function(){
		const ret = lib.parseInfo('"string"', {parseValue: false});
		assert.strictEqual(ret.value, undefined);
	});
	it('parseInfo(text, {parseValue: true}) (enabled)', function(){
		const ret = lib.parseInfo('"string"', {parseValue: true});
		assert.strictEqual(ret.value, "string");
	});
});

describe('parseInfo(text, {parseAnnotations})', function(){
	it('parseInfo(text, {parseAnnotations: false}) (disabled)', function(){
		const schema = new lib.Schema('http://example.com/schema', {type:'string', title:'Label'});
		const ret = lib.parseInfo('"string"', {parseAnnotations: false, schema});
		assert.strictEqual(ret.errors.length, 0);
		assert.strictEqual(ret.annotations, null);
	});
	it('parseInfo(text, {parseAnnotations: true}) (enabled)', function(){
		const schema = new lib.Schema('http://example.com/schema', {type:'string', title:'Label'});
		const ret = lib.parseInfo('"string"', {parseAnnotations: true, schema});
		assert.strictEqual(ret.errors.length, 0);
		assert.strictEqual(ret.annotations.length, 1);
		assert.strictEqual(ret.annotations[0].keyword, "title");
		assert.strictEqual(ret.annotations[0].value, "Label");
	});
});

describe('parseInfo(text, {schema})', function(){
	it('parseInfo(text, {schema: 1}) (fail)', function(){
		const schemaObject = {
			"type": "array",
			"items": {
				"type": "object",
				"properties": {
					"_id": { "type": "string" },
				},
			},
		};
		const schema = new lib.Schema('_:root', schemaObject);
		const text = '[ { "_id": "1" } ]';
		const parse = lib.parseInfo(text, {parseAnnotations:true, parseInfo:true, schema:schema});
		assert.strictEqual(parse.errors.length, 0);
	});
	it('parseInfo(text, {schema: 1}) (pass)', function(){
		const schemaObject = {
			"type": "array",
			"items": {
				"type": "object",
				"properties": {
					"_id": { "type": "number" },
				},
			},
		};
		const schema = new lib.Schema('_:root', schemaObject);
		const text = '[ { "_id": "1" } ]';
		const parse = lib.parseInfo(text, {parseAnnotations:true, parseInfo:true, schema:schema});
		assert.strictEqual(parse.errors.length, 1);
	});
});

describe('parseInfo(text, {parseInfo})', function(){
	it('parseInfo(text, {}) (default)');
	it('parseInfo(text, {parseInfo: false}) (disabled)');
	it('parseInfo(text, {parseInfo: true}) (enabled)');
});
