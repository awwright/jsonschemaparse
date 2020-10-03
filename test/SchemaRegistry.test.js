"use strict";

const assert = require('assert');
const lib = require('..');

const SchemaRegistry = lib.SchemaRegistry;

describe('SchemaRegistry', function(){
	it('SchemaRegistry#import', function(){
		var registry = new SchemaRegistry;
		const a1 = registry.import('http://localhost/a.json', {});
		assert(a1 instanceof lib.Schema);
		// Importing the same definition will return the previous instance
		const a2 = registry.import('http://localhost/a.json', {});
		assert.strictEqual(a1, a2);
	});
	it('SchemaRegistry#getUnresolved', function(){
		var registry = new SchemaRegistry;
		registry.import('http://localhost/a.json', {
			additionalProperties: { $ref: 'b.json' },
		});
		assert(registry.getUnresolved().indexOf('http://localhost/b.json') >= 0);
		assert(registry.seen.has('http://localhost/b.json'));
		registry.import('http://localhost/b.json', {
			type: 'string',
		});
		assert(registry.getUnresolved().indexOf('http://localhost/b.json') === -1);
		assert(registry.seen.has('http://localhost/b.json'));
	});
});
