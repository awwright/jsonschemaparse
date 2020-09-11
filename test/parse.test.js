"use strict";

const assert = require('assert');
const lib = require('..');

describe('parse(text)', function(){
	it('parse true', function(){
		assert.strictEqual(lib.parse('true'), true);
	});
	it('parse false', function(){
		assert.strictEqual(lib.parse('false'), false);
	});
	it('parse null', function(){
		assert.strictEqual(lib.parse('null'), null);
	});
	it('parse escape characters', function(){
		const ret = lib.parse('"\\"\\\\\\/\\b\\f\\t\\r\\n"');
		assert.strictEqual(ret, "\"\\/\b\f\t\r\n");
	});
	it('parse invalid', function(){
		assert.throws(function(){
			lib.parse('tru');
		});
	});
});

describe('parse(text, reviver)', function(){
	it('parse valid');
});

describe('parse(text, schema)', function(){
	const schema = new lib.Schema('http://example.com/', { type: 'string' });
	it('parse valid', function(){
		const val = lib.parse('""', schema);
		assert.strictEqual(val, "");
	});
	it('parse well-formed invalid', function(){
		assert.throws(function(){
			lib.parse('[]', schema);
		}, function(err){
			assert(err instanceof lib.ValidationError);
			assert.match(err.message, /expected/);
			return true;
		});
	});
	it('parse non-well-formed', function(){
		assert.throws(function(){
			lib.parse('[', schema);
		}, function(err){
			assert(err instanceof lib.SyntaxError);
			assert.match(err.message, /expected/);
			return true;
		});
	});
});

describe('parse(text, options)', function(){
	it('parse(text, {schema: Schema}) (valid)', function(){
		const schema = new lib.Schema('http://example.com/', { type: 'string' });
		const text = '""';
		const v = lib.parse(text, {schema: schema});
		assert.strictEqual(v, "");
	});
	it('parse(text, {schema: Schema}) (invalid)', function(){
		const schema = new lib.Schema('http://example.com/', { type: 'string' });
		const text = '{}';
		assert.throws(function(){
			lib.parse(text, {schema: schema});
		});
	});
	it('parse(text, {schema: obj}) (valid)', function(){
		const schema = { type: 'string' };
		const text = '""';
		const v = lib.parse(text, {schema: schema});
		assert.strictEqual(v, "");
	});
	it('parse(text, {schema: obj}) (invalid)', function(){
		const schema = { type: 'string' };
		const text = '{}';
		assert.throws(function(){
			lib.parse(text, {schema: schema});
		});
	});
	it('parse(text, {invalid}) (invalid)', function(){
		const text = '{}';
		assert.throws(function(){
			lib.parse(text, {type: "string"});
		});
	});
	it('parse(text, {reviver}) (valid)');
	it('parse(text, {charset:ASCII}) (native string input)', function(){
		// A native string is already decoded, so this shouldn't trigger anything
		const val = lib.parse('"🐲"', {charset:'ASCII'});
		assert.strictEqual(val, "\uD83D\uDC32");
	});
	it('parse(text, {charset:ASCII}) (ASCII input)', function(){
		// Escapes are all cool
		const text = Buffer.from('"\\uD83D\\uDC32"', 'UTF-8');
		const val = lib.parse(text, {charset:'ASCII'});
		assert.strictEqual(val, "🐲");
	});
	it('parse(text, {charset:ASCII}) (UTF-8 input)', function(){
		// High-byte characters are not ASCII
		const text = Buffer.from('"🐲"', 'UTF-8');
		assert.throws(function(){
			lib.parse(text, {charset:'ASCII'});
		});
	});
	it('parse(text, {charset:UTF-8}) (UTF-8 input)', function(){
		// High-byte characters are not ASCII
		const text = Buffer.from('"🐲"', 'UTF-8');
		const val = lib.parse(text, {charset:'UTF-8'});
		assert.strictEqual(val, "🐲");
	});
	it('parse(text, {charset:UTF-8}) (invalid UTF-8)', function(){
		// High-byte characters are not ASCII
		// bytes are backwards
		const text = Buffer.from([0x22, 0xb2, 0x90, 0x9f, 0xf0, 0x22]);
		assert.throws(function(){
			lib.parse(text, {charset:'UTF-8'});
		});
	});
	it('parse(text, {charset:UTF-8}) (string input)', function(){
		// High-byte characters are not ASCII
		const text = '"🐲"';
		const val = lib.parse(text, {charset:'UTF-8'});
		assert.strictEqual(val, "🐲");
	});
	it('parse(text, {charset:UTF-8}) (invalid string)', function(){
		const text = '"🐲';
		assert.throws(function(){
			lib.parse(text, {charset:'UTF-8'});
		});
	});
});

describe('parse options', function(){
	it('parse({maxKeyLength})', function(){
		const options = {
			maxKeyLength: 4,
			maxStringLength: 1000,
		};
		assert.deepStrictEqual(lib.parse('{"0123": true}', options), {"0123": true});
		assert.throws(function(){
			lib.parse('{"01234": true}', options);
		}, function(err){
			assert(err instanceof lib.ResourceLimitError);
			assert.match(err.message, /String too long/);
			return true;
		});
	});
	it('parse({maxStringLength})', function(){
		const options = {
			maxKeyLength: 1000,
			maxStringLength: 5,
		};
		assert.deepStrictEqual(lib.parse('{"key": "short"}', options), {"key": "short"});
		assert.throws(function(){
			lib.parse('{"key": "long45"}', options);
		}, function(err){
			assert(err instanceof lib.ResourceLimitError);
			assert.match(err.message, /String too long/);
			return true;
		});
	});
	it('parse({maxNumberLength})', function(){
		const text = '{"key": 123456781234.0123}';
		const options = {
			maxKeyLength: 1000,
			maxStringLength: 1000,
			maxNumberLength: 10,
		};
		assert.throws(function(){
			lib.parse(text, options);
		}, function(err){
			assert(err instanceof lib.ResourceLimitError);
			// TODO this should be "Number too long"
			assert.match(err.message, /too long/);
			return true;
		});
	});
	it('parse({maxItems})', function(){
		const options = {
			maxItems: 4,
		};
		assert.deepStrictEqual(lib.parse('{ "a": [0, 1, 2, 3] }', options), { "a": [0, 1, 2, 3] });
		assert.throws(function(){
			lib.parse('{ "a": [0, 1, 2, 3, 4] }', options);
		}, function(err){
			assert(err instanceof lib.ResourceLimitError);
			assert.match(err.message, /Too many items in array/);
			return true;
		});
	});
	it('parse({maxProperties})', function(){
		const options = {
			maxProperties: 2,
		};
		assert.deepStrictEqual(lib.parse('[ { "a":1 } ]', options), [ { "a":1 } ]);
		assert.throws(function(){
			lib.parse('[ { "a":1, "b":2, "c":3 } ]', options);
		}, function(err){
			assert(err instanceof lib.ResourceLimitError);
			assert.match(err.message, /Too many properties in object/);
			return true;
		});
	});
	it('parse({maxUniqueItems})');
	it('parse({interoperable})');
	it('parse({bigNumber:json})', function(){
		const text = '123456789012345678';
		const options = {
			bigNumber: 'json',
		};
		const val = lib.parse(text, options);
		assert.strictEqual(val, text);
	});
	it('parse({bigNumber:error})', function(){
		const text = '123456789012345678';
		const options = {
			bigNumber: 'error',
		};
		assert.throws(function(){
			lib.parse(text, options);
		}, function(err){
			assert(err instanceof lib.ResourceLimitError);
			assert.match(err.message, /Number too precise/);
			return true;
		});
	});
	it('parse({bigNumber:function})');
	it('parse({bigNumber:fraction})');
	it('parse({niceNumber})');
});
