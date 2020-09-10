"use strict";

const assert = require('assert');
const lib = require('..');

describe('ValidationError', function(){
	it('ValidationError', function(){
		const p = lib.parseInfo('{}', {
			schema: {
				type: 'string',
			},
		});
		assert.strictEqual(p.errors.length, 1);
		const err = p.errors[0];
		assert.match(err+'', /Unexpected object: Expected string/);
		assert.strictEqual(err.message, 'Unexpected object: Expected string');
		assert.strictEqual(err.position.line, 0);
		assert.strictEqual(err.position.column, 0);
	});
});
