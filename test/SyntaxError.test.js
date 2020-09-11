"use strict";

const assert = require('assert');
const lib = require('..');

describe('SyntaxError', function(){
	it('SyntaxError', function(){
		assert.throws(function(){
			lib.parse('{ ,');
		}, function(err){
			assert(err instanceof lib.SyntaxError);
			assert.strictEqual(err.message, 'Unexpected "," at line 0:2 in state OBJECT1 expecting one of: " }');
			assert.strictEqual(err.position.line, 0);
			assert.strictEqual(err.position.column, 2);
			return true;
		});
	});
});
