"use strict";

const assert = require('assert');
const lib = require('..');

describe('parseInfo(text)', function(){
	it('parseInfo(text)', function(){
		const ret = lib.parseInfo('"string"');
		assert.strictEqual(ret.value, "string");
		assert.strictEqual(ret.lineNumber, 0);
		assert.strictEqual(ret.characters, 8);
	});
});

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

describe('parseInfo(text, schema)', function(){
	const schema = new lib.Schema('http://example.com/', { type: 'string' });
	it('parse valid', function(){
		const res = lib.parseInfo('""', schema);
		assert.strictEqual(res.value, "");
		assert.strictEqual(res.errors.length, 0);
	});
	it('parse well-formed invalid', function(){
		const res = lib.parseInfo('true', schema);
		assert.strictEqual(res.value, true);
		assert.strictEqual(res.errors.length, 1);
	});
	it('parse non-well-formed', function(){
		assert.throws(function(){
			lib.parseInfo('"', schema);
		}, function(err){
			assert(err instanceof lib.SyntaxError);
			assert.match(err.message, /Unexpected end of document/);
			return true;
		});
	});
	it('forgetting Schema instance generates error', function(){
		assert.throws(function(){
			lib.parseInfo('true', { type: "string" });
		}, function(err){
			assert.match(err.message, /Use the "schema" option for passing a schema/);
			return true;
		});
		assert.throws(function(){
			lib.parseInfo('true', { $id: 'http://example.com/', minLength: 0 });
		}, function(err){
			assert.match(err.message, /Use the "schema" option for passing a schema/);
			return true;
		});
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
	const schemaObject = {
		"type": "array",
		"items": {
			"type": "object",
			"properties": {
				"_id": { "type": "string" },
			},
		},
	};
	it('parseInfo(text, {schema}) requires a schema', function(){
		const text = '[ { "_id": "1" } ]';
		assert.throws(function(){
			lib.parseInfo(text, {schema:[]});
		}, function(err){
			assert.match(err.message, /schema must be instance of Schema/);
			return true;
		});
	});
	it('parseInfo(text, {schema}) (fail)', function(){
		const schema = new lib.Schema('_:root', schemaObject);
		const text = '[ { "_id": "1" } ]';
		const parse = lib.parseInfo(text, {parseAnnotations:true, parseInfo:true, schema:schema});
		assert.strictEqual(parse.errors.length, 0);
	});
	it('parseInfo(text, {schema}) (pass)', function(){
		const schema = new lib.Schema('_:root', schemaObject);
		const text = '[ { "_id": 1 } ]';
		const parse = lib.parseInfo(text, {parseAnnotations:true, parseInfo:true, schema:schema});
		assert.strictEqual(parse.errors.length, 1);
	});
});

describe('parseInfo(text, {parseInfo})', function(){
	it('parseInfo(text, {}) (default)');
	it('parseInfo(text, {parseInfo: false}) (disabled)');
	it('parseInfo(text, {parseInfo: true}) (enabled)');
});
