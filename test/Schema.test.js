"use strict";

const assert = require('assert');
const lib = require('..');

const Schema = lib.Schema;

describe('Schema', function(){
	it('Schema#unknown', function(){
		var registry = new lib.Schema('http://example.com/schema.json', {
			type: "string",
			foo: "baz",
		});
		assert.strictEqual(registry.unknown.length, 1);
		assert.strictEqual(registry.unknown[0], 'foo');
	});
});
