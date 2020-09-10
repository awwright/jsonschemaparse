"use strict";

const assert = require('assert');
const lib = require('..');

describe('Annotation', function(){
	it('Annotation', function(){
		const p = lib.parseInfo('{}', {
			schema: {
				title: 'Some Title',
				description: 'A longer description of how the value works.',
			},
		});
		assert.strictEqual(p.annotations.length, 2);
		const title = p.annotations[0];
		assert.strictEqual(title.value, 'Some Title');
		assert.strictEqual(title.position.line, 0);
		assert.strictEqual(title.position.column, 0);
		const desc = p.annotations[1];
		assert.strictEqual(desc.value, 'A longer description of how the value works.');
		assert.strictEqual(desc.position.line, 0);
		assert.strictEqual(desc.position.column, 0);
	});
});
