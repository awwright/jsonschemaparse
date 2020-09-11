"use strict";

const assert = require('assert');
const lib = require('..');

describe('interface', function(){
	it('StreamParser', function(){
		assert(typeof lib.StreamParser === 'function');
	});
	it('parse', function(){
		assert(typeof lib.parse === 'function');
	});
	it('parseInfo', function(){
		assert(typeof lib.parseInfo === 'function');
	});
	it('SyntaxError', function(){
		assert(typeof lib.SyntaxError === 'function');
	});
	it('ValidationError', function(){
		assert(typeof lib.ValidationError === 'function');
	});
	it('Annotation', function(){
		assert(typeof lib.Annotation === 'function');
	});
	it('SchemaRegistry', function(){
		assert(typeof lib.SchemaRegistry === 'function');
	});
	it('Schema', function(){
		assert(typeof lib.Schema === 'function');
	});
});
