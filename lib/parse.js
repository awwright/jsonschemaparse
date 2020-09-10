
"use strict";
const stream = require('stream');
const util = require('util');

const { Schema, ValidateLayer } = require('./schema.js');

// Named constants with unique integer values
const C = {};
// Tokenizer States
var VOID    = C.VOID    = 11;
var VALUE   = C.VALUE   = 12;
var OBJECT1 = C.OBJECT1 = 21;
var OBJECT2 = C.OBJECT2 = 22;
var OBJECT3 = C.OBJECT3 = 23;
var OBJECT4 = C.OBJECT4 = 24;
var OBJECT5 = C.OBJECT5 = 25;
var OBJECT6 = C.OBJECT6 = 26;
var ARRAY1  = C.ARRAY1  = 31;
var ARRAY2  = C.ARRAY2  = 32;
var ARRAY3  = C.ARRAY3  = 33;
var ARRAY4  = C.ARRAY4  = 34;
var TRUE1   = C.TRUE1   = 41;
var TRUE2   = C.TRUE2   = 42;
var TRUE3   = C.TRUE3   = 43;
var FALSE1  = C.FALSE1	= 51;
var FALSE2  = C.FALSE2	= 52;
var FALSE3  = C.FALSE3	= 53;
var FALSE4  = C.FALSE4	= 54;
var NULL1   = C.NULL1   = 61;
var NULL2   = C.NULL2   = 62;
var NULL3   = C.NULL3   = 63;
var NUMBER1 = C.NUMBER1 = 71;
var NUMBER2 = C.NUMBER2 = 72;
var NUMBER3 = C.NUMBER3 = 73;
var NUMBER4 = C.NUMBER4 = 74;
var NUMBER5 = C.NUMBER5 = 75;
var NUMBER6 = C.NUMBER6 = 76;
var NUMBER7 = C.NUMBER7 = 77;
var NUMBER8 = C.NUMBER8 = 78;
var STRING1 = C.STRING1 = 81;
var STRING2 = C.STRING2 = 82;
var STRING3 = C.STRING3 = 83;
var STRING4 = C.STRING4 = 84;
var STRING5 = C.STRING5 = 85;
var STRING6 = C.STRING6 = 86;
var UTF8_2 = C.UTF8_2 = 92;
var UTF8_3 = C.UTF8_3 = 93;
var UTF8_4 = C.UTF8_4 = 94;

const promiseRef = typeof Symbol==='function' ? Symbol('_promiseRef') : '_promiseRef';
const promiseDone = typeof Symbol==='function' ? Symbol('_promiseDone') : '_promiseDone';
const promiseError = typeof Symbol==='function' ? Symbol('_promiseError') : '_promiseError';

const matchString = /^([ !#-[\]-\uFFFF]|\\u([a-fA-F0-9]{4})|\\["\\/bfnrt])*/;
const escapeSequence = /\\u([a-fA-F0-9]{4})|\\(.)/g;
const escapeReplacements = {
	// "\/bfnrt
	'"':'"', "\\":"\\", '/':'/',
	'b':'\b', 'f':'\f', 'n':'\n', 'r':'\r', 't':'\t',
};

var tokenNames = [];
Object.keys(C).forEach(function(name){
	tokenNames[C[name]] = name;
});
function toknam(code) {
	return tokenNames[code] || code;
}
function collapseArray(arr, cb){
	var res = [];
	for(var i=0; i<arr.length; i++) cb(arr[i], i).forEach(function(v){ res.push(v); });
	return res;
}

function isUint8Array(v){
	if(util.type && util.types.isUint8Array) return util.type.Uint8Array(v);
	if(v instanceof Uint8Array) return true;
}

module.exports.parse = JSONparse;
function JSONparse(text, options){
	if(options===undefined){
		options = {};
	}else if(typeof options==='function'){
		options = {reviver: options};
	}else if(options instanceof Schema){
		options = {schema: options};
	}
	// Blank defaults; override the three parse* options if they exist
	const opts = Object.assign({}, options, {
		parseValue: true,
		parseAnnotations: false,
		parseInfo: false,
	});
	const parser = new StreamParser(opts);
	parser.parse(text);
	if(parser.errors && parser.errors.length){
		throw parser.errors[0];
	}
	return parser.value;
}

module.exports.parseInfo = parseInfo;
function parseInfo(text, options){
	if(options===undefined){
		options = {};
	}else if(typeof options==='function'){
		options = {reviver: options};
	}else if(options instanceof Schema){
		options = {schema: options};
	}
	const defaults = {
		parseValue: true,
		parseAnnotations: true,
		parseInfo: true,
	};
	const opts = Object.assign(defaults, options);
	const parser = new StreamParser(opts);
	parser.parse(text);
	return parser;
}

const SyntaxError = require('./error.js').SyntaxError;

module.exports.StreamParser = StreamParser;
function StreamParser(options) {
	const self = this;
	if (!(this instanceof StreamParser)) return new StreamParser(options);

	stream.Writable.call(this, {
		decodeStrings: false,
	});

	if(!options) options = {};
	// Try and detect silly people passing a schema object as options
	if(options.$id || options.$schema || options.type){
		throw new Error('Use the "schema" option for passing a schema');
	}

	self[promiseDone] = function(v){ self[promiseRef] = Promise.resolve(v); return self[promiseRef]; };
	self[promiseError] = function(v){ self[promiseRef] = Promise.reject(v); return self[promiseRef]; };

	// Configurable parsing options
	// Store parsed value in `this.value`?
	this.parseValue = 'parseValue' in options ? options.parseValue : false;
	// dunno what this is
	this.key = false;

	// Configurable parsing options
	this.maxKeyLength = options.maxKeyLength || null;
	this.maxStringLength = options.maxStringLength || null;
	this.maxNumberLength = options.maxNumberLength || null;
	this.maxItems = options.maxItems || null;
	this.maxProperties = options.maxProperties || null;
	this.bigNumber = options.bigNumber || 'default';
	this.trailingComma = false;
	this.multipleValue = false;

	var schema = options.schema || null;
	if(schema){
		if(typeof schema==='object' && (Object.getPrototypeOf(schema)===Object.prototype || Object.getPrototypeOf(schema)===null)){
			schema = new Schema('vnd.schema:', schema);
		}
		if(!(schema instanceof Schema)){
			throw new Error('schema must be instance of Schema');
		}
	}

	// Line number tracking
	this.charset = 'charset' in options ? options.charset : 'UTF-8';
	this.characters = 0;
	this.lineNumber = 0;
	this.lineOffset = 0;
	this.codepointStart = 0;

	// Object stack stuff
	this.stack = [];

	// JSON Schema info collection
	this.errors = [];
	this.throw = options.throw;
	this.annotations = options.parseAnnotations ? [] : null;

	// for parsing
	this.value = undefined;

	// for string parsing
	this.buffer = undefined; // string data
	this.unicode = undefined; // unicode escapes

	// Begin creating stack
	// Allow trailing whitespace at the end of the document
	this.push(VOID, '');
	// Start parsing a value
	this.push(VALUE, '', schema && schema.validate(this));
}
util.inherits(StreamParser, stream.Writable);

StreamParser.prototype.event = function (name, value) {
	this.emit(name, this.layer, value);
};

StreamParser.prototype.charError = function (block, i, expecting) {
	var actual = block[i];
	if(typeof actual==='number') actual=String.fromCharCode(actual);
	this.emitError(new SyntaxError(
		"Unexpected "
			+ JSON.stringify(actual)
			+ " at line " + this.lineNumber + ':' + (this.characters-this.lineOffset)
			+ " in state " + toknam(this.layer.state)
			+  ( expecting ? (" expecting one of: " + expecting) : '' ),
		this.layer.path,
		{line:this.lineNumber, column:this.characters-this.lineOffset, characters:this.characters, i:i},
		expecting,
		actual
	));
};

StreamParser.prototype.emitError = function (err, additional) {
	this.errors.push(err);
	if(additional){
		additional.forEach(function(v){ this.errors.push(v); });
	}
	if(this[promiseRef]) this[promiseError](err);
	else throw err;
};

Object.defineProperty(StreamParser.prototype, 'done', {
	get: function(){
		const self = this;
		self[promiseRef] = self[promiseRef] || new Promise(function promiseBody(done, error){
			self[promiseDone] = function(v){ done(v); };
			self[promiseError] = function(v){ error(v); };
		});
		return self[promiseRef];
	},
});

StreamParser.prototype.push = function push(state, k, validator) {
	if(validator) validator.forEach(function(v){
		if(!(v instanceof ValidateLayer)) throw new Error('NOT A VALIDATOR');
	});
	var path = this.layer && this.layer.path || '';
	this.layer = {
		state: state,
		//path: k ? this.layer.path.concat(k) : (this.layer&&this.layer.path),
		path: k ? path+'/'+k : path,
		key: null, // true if an object key
		parseValue: this.parseValue,
		value: undefined,
		beginChar: this.characters,
		beginLine: this.lineNumber,
		beginColumn: this.characters-this.lineOffset,
		endChar: null,
		endLine: null,
		endColumn: null,
		length: 0,
		maxLength: null, // setting to be mindful of memory usage
		validator: validator || [],
	};
	this.stack.push(this.layer);
};

//StreamParser.prototype.pushKey = function pushKey(k){
//	var list = this.layer.validator || [];
//	if(!Array.isArray(list)) throw new Error('Expected array');
//	var result = collapseArray(list.map(function(validator){
//		return validator.getKeySchema(k);
//	}));
//	return this.push(k, result);
//}

StreamParser.prototype.pushProperty = function pushProperty(key) {
	var list = this.layer.validator || [];
	if(!Array.isArray(list)) throw new Error('Assert: Expected array');
	if(this.layer.maxLength && this.layer.length > this.layer.maxLength){
		const err = new SyntaxError(
			"Too many properties in object"
				+ " at line " + this.lineNumber + ':' + (this.characters-this.lineOffset)
				+ " in state " + toknam(this.layer.state),
			this.layer.path,
			{line:this.lineNumber, column:this.characters-this.lineOffset}
		);
		this.emitError(err);
	}
	var result = collapseArray(list, function(validator){
		return validator.initProperty(key);
	});
	return this.push(VALUE, key, result);
};

StreamParser.prototype.pushItem = function pushItem(k) {
	var list = this.layer.validator || [];
	if(!Array.isArray(list)) throw new Error('Expected array');
	if(this.layer.maxLength && this.layer.length >= this.layer.maxLength){
		const err = new SyntaxError(
			"Too many items in array"
				+ " at line " + this.lineNumber + ':' + (this.characters-this.lineOffset)
				+ " in state " + toknam(this.layer.state),
			this.layer.path,
			{line:this.lineNumber, column:this.characters-this.lineOffset}
		);
		this.emitError(err);
	}
	var result = collapseArray(list, function(validator){
		return validator.initItem(k);
	});
	return this.push(VALUE, k, result);
};



StreamParser.prototype.pop = function pop(){
	var self = this;
	var layer = self.stack.pop();
	layer.endChar = self.characters;
	layer.endLine = self.lineNumber;
	layer.endColumn = self.characters-self.lineOffset;
	self.validateInstance(function(s){ return s.finish(layer); });
	if(layer.parseValue) self.value = layer.value;
	self.layer = self.stack[this.stack.length-1];
	return layer;
};

StreamParser.prototype.validateInstance = function validateInstance(cb) {
	var self = this;
	if(!self.layer.validator) return;
	if(!Array.isArray(self.layer.validator)) throw new Error('Expected array this.layer.validator');
	self.layer.validator.forEach(function(validator){
		cb(validator);
	});
};

StreamParser.prototype._transform = StreamParser.prototype._write = function (block, encoding, callback) {
	try {
		this.parseBlock(block);
	}catch(e){
		if(callback) return void callback(e);
		throw e;
	}
	if(callback) callback();
};

StreamParser.prototype._flush = StreamParser.prototype._final = function _flush(callback) {
	try {
		this.eof();
	}catch(e){
		return void callback(e);
	}
	callback();
};

StreamParser.prototype.parse = function parse(block){
	this.parseBlock(block);
	this.eof();
};

StreamParser.prototype.parseBlock = function parseBlock(block){
	const isByte = Buffer.isBuffer(block) || isUint8Array(block);
	//const isShort = false; // UTF-16
	//const isLong = false; // UTF-32
	const isStr = typeof block==="string";
	if(isByte){
		if(this.charset==='string'){
			throw new Error('Expected arguments[0] `block` to be a string');
		}else if(this.charset!=='ASCII' && this.charset!=='UTF-8'){
			throw new Error('Unknown `charset`, expected "ASCII" or "UTF-8"');
		}
	}else if(!isStr){
		throw new Error('Assert: Unknown block type');
	}
	var chrcode = 0;
	for (var i = 0; i < block.length; i++, this.characters++) {
		chrcode = isStr ? block.charCodeAt(i) : block[i] ;
		if(typeof chrcode !== 'number') throw new Error('Assert: Expected numeric codepoint value');
		// Verify UTF-16 surrogate pairs
		if(isStr && chrcode>=0xD800 && chrcode<=0xDFFF){
			if(chrcode<0xDC00){
				// This is a UTF-16 high (first) surrogate
				if(this.utf16_high) this.charError(block, i, 'UTF-16-low-surrogate');
				this.utf16_high = chrcode;
				// continue execution since we're decoding to UTF-16 anyways
			}else{
				// This is a UTF-16 low (second) surrogate
				// var utf16_high = this.utf16_high;
				this.utf16_high = null;
			}
		}else if(isByte && this.charset==='ASCII' && chrcode>=0x80){
			throw new Error('Unexpected high-byte character');
		}
		this.codepointStart = i;
		switch (this.layer.state) {
		case VOID:
			// For end of document where only whitespace is allowed
			switch (chrcode) {
			case 0x0a:
				this.lineOffset = this.characters;
				this.lineNumber++;
				// fall through
			case 0x09:
			case 0x0d:
			case 0x20:
				continue; // whitespace, ignore
			}
			this.charError(block, i, "\\s");
			break;
		case VALUE:
			switch (chrcode) {
			case 0x0a:
				this.lineOffset = i;
				this.lineNumber++;
				// fall through
			case 0x09:
			case 0x0d:
			case 0x20:
				continue; // whitespace, ignore
			case 0x7b: // `{`
				this.startObject();
				this.layer.state = OBJECT1;
				if(this.layer.parseValue) this.layer.value = {};
				continue;
			case 0x5b: // `[`
				this.startArray();
				this.layer.state = ARRAY1;
				if(this.layer.parseValue) this.layer.value = [];
				continue;
			case 0x74: // `t`
				this.startBoolean();
				this.layer.state = TRUE1;
				continue;
			case 0x66: // `f`
				this.startBoolean();
				this.layer.state = FALSE1;
				continue;
			case 0x6e: // `n`
				this.layer.state = NULL1;
				this.startNull();
				continue;
			case 0x22: // `"`
				// Start parsing a string
				this.startBuffer(block, i);
				this.layer.state = STRING1;
				this.startString();
				continue;
			case 0x2d: // `-`
				this.layer.state = NUMBER1;
				this.startBuffer(block, i);
				this.appendCodepoint(chrcode);
				this.startNumber();
				continue;
			case 0x30: // `0`
				this.layer.state = NUMBER2;
				this.startBuffer(block, i);
				this.appendCodepoint(chrcode);
				this.startNumber();
				continue;
			case 0x31: // `1`
			case 0x32: // `2`
			case 0x33: // `3`
			case 0x34: // `4`
			case 0x35: // `5`
			case 0x36: // `6`
			case 0x37: // `7`
			case 0x38: // `8`
			case 0x39: // `9`
				this.layer.state = NUMBER3;
				this.buffer = String.fromCharCode(chrcode);
				this.startNumber();
				continue;
			}
			this.charError(block, i, '[ { true false null " - 0-9');
			break;
		case OBJECT1:
			// Opened a curly brace, expecting a closing curly brace or a key
			if(this.maxProperties && this.layer.maxLength===null) this.layer.maxLength = this.maxProperties;
			switch (chrcode) {
			case 0x0a:
				this.lineOffset = i;
				this.lineNumber++;
				// fall through
			case 0x09:
			case 0x0d:
			case 0x20:
				continue; // whitespace, ignore
			case 0x22: // `"`
				// Start parsing a keyword name
				this.startBuffer(block, i);
				// When the new layer (created next) pops, be in the "finished parsing key" state
				this.layer.state = OBJECT2;
				// Parse the next characters as a new value
				this.push(STRING1);
				this.layer.parseValue = true;
				this.layer.key = true;
				if(this.maxKeyLength) this.layer.maxLength = this.maxKeyLength;
				continue;
			case 0x7d: // `}`
				this.endObject();
				continue;
			}
			this.charError(block, i, '" }');
			break;
		case OBJECT2:
			// Process parsed key
			// the endKey method will have already been called by the just-popped layer
			this.layer.key = this.buffer;
			this.layer.state = OBJECT3;
			// fall through to OBJECT3
		case OBJECT3:
			// Stored state of key, expecting a colon
			switch (chrcode) {
			case 0x0a:
				this.lineOffset = i;
				this.lineNumber++;
				// fall through
			case 0x09:
			case 0x0d:
			case 0x20:
				continue; // whitespace, ignore
			case 0x3a: // `:`
				// Once property value is parsed, we'll return to OBJECT4
				this.layer.state = OBJECT4;
				// But first, parse the next characters as a new value
				this.layer.length++;
				this.pushProperty(this.layer.key);
				continue;
			}
			this.charError(block, i, ':');
			break;
		case OBJECT4:
			// Process parsed value
			if(this.layer.parseValue) this.layer.value[this.layer.key] = this.value;
			this.layer.state = OBJECT5;
			// fall through to OBJECT5
		case OBJECT5:
			// Parsed a value, expecting a comma or closing curly brace
			switch (chrcode) {
			case 0x0a:
				this.lineOffset = i;
				this.lineNumber++;
				// fall through
			case 0x09:
			case 0x0d:
			case 0x20:
				continue; // whitespace, ignore
			case 0x2c: // `,`
				this.layer.key = this.layer.length;
				this.layer.state = OBJECT6;
				continue;
			case 0x7d: // `}`
				this.endObject();
				continue;
			}
			this.charError(block, i, ', }');
			break;
		case OBJECT6:
			// Parsed a comma, now expecting a string
			switch (chrcode) {
			case 0x0a:
				this.lineOffset = i;
				this.lineNumber++;
				// fall through
			case 0x09:
			case 0x0d:
			case 0x20:
				continue; // whitespace, ignore
			case 0x22: // `"`
				// Start parsing a keyword name
				this.startBuffer(block, i);
				// When the new layer (created next) pops, be in the "finished parsing key" state
				this.layer.state = OBJECT2;
				// Parse the next characters as a new value
				this.push(STRING1);
				this.layer.parseValue = true;
				this.layer.key = true;
				continue;
			}
			this.charError(block, i, '"');
			break;
		case ARRAY1:
			// Finished reading open-array, expecting close-array or value
			if(this.maxItems && this.layer.maxLength===null) this.layer.maxLength = this.maxItems;
			switch (chrcode) {
			case 0x0a:
				this.lineOffset = i;
				this.lineNumber++;
				// fall through
			case 0x09:
			case 0x0d:
			case 0x20:
				continue; // whitespace, ignore
			case 0x5d: // `]`
				this.endArray();
				continue;
			// If none of this, then it's starting a new value
			case 0x7b: // `{`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.startObject();
				this.layer.state = OBJECT1;
				if(this.layer.parseValue) this.layer.value = {};
				continue;
			case 0x5b: // `[`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.startArray();
				this.layer.state = ARRAY1;
				if(this.layer.parseValue) this.layer.value = [];
				continue;
			case 0x74: // `t`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.startBoolean();
				this.layer.state = TRUE1;
				continue;
			case 0x66: // `f`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.startBoolean();
				this.layer.state = FALSE1;
				continue;
			case 0x6e: // `n`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.layer.state = NULL1;
				this.startNull();
				continue;
			case 0x22: // `"`
				// Start parsing a string
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.startBuffer(block, i);
				this.layer.state = STRING1;
				this.startString();
				continue;
			case 0x2d: // `-`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.layer.state = NUMBER1;
				this.startBuffer(block, i);
				this.appendCodepoint(chrcode);
				this.startNumber();
				continue;
			case 0x30: // `0`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.layer.state = NUMBER2;
				this.startBuffer(block, i);
				this.appendCodepoint(chrcode);
				this.startNumber();
				continue;
			case 0x31: // `1`
			case 0x32: // `2`
			case 0x33: // `3`
			case 0x34: // `4`
			case 0x35: // `5`
			case 0x36: // `6`
			case 0x37: // `7`
			case 0x38: // `8`
			case 0x39: // `9`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.layer.state = NUMBER3;
				this.startBuffer(block, i);
				this.appendCodepoint(chrcode);
				this.startNumber();
				continue;
			}
			this.charError(block, i, '] { [ true false null " - 0-9');
			break;
		case ARRAY2:
			// push item to array value
			if(this.layer.parseValue) this.layer.value[this.layer.length] = this.value;
			this.layer.length++;
			this.layer.state = ARRAY3;
			// fall through to next state
		case ARRAY3:
			// Finished reading an array item, now expecting a close array or comma
			switch (chrcode) {
			case 0x0a:
				this.lineOffset = i;
				this.lineNumber++;
				// fall through
			case 0x09:
			case 0x0d:
			case 0x20:
				continue; // whitespace, ignore
			case 0x5d: // `]`
				this.endArray();
				continue;
			case 0x2c: // `,`
				this.layer.state = ARRAY4;
				continue;
			}
			this.charError(block, i, '] ,');
			break;
		case ARRAY4:
			// Finished reading comma, expecting value
			switch(chrcode){
			case 0x0a:
				this.lineOffset = i;
				this.lineNumber++;
				// fall through
			case 0x09:
			case 0x0d:
			case 0x20:
				// whitespace, ignore
				continue;
			// If none of this, then it's starting a new value
			case 0x7b: // `{`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.startObject();
				this.layer.state = OBJECT1;
				if(this.layer.parseValue) this.layer.value = {};
				continue;
			case 0x5b: // `[`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.startArray();
				this.layer.state = ARRAY1;
				if(this.layer.parseValue) this.layer.value = [];
				continue;
			case 0x74: // `t`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.startBoolean();
				this.layer.state = TRUE1;
				continue;
			case 0x66: // `f`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.startBoolean();
				this.layer.state = FALSE1;
				continue;
			case 0x6e: // `n`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.layer.state = NULL1;
				this.startNull();
				continue;
			case 0x22: // `"`
				// Start parsing a string
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.startBuffer(block, i);
				this.layer.state = STRING1;
				this.startString();
				continue;
			case 0x2d: // `-`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.layer.state = NUMBER1;
				this.startBuffer(block, i);
				this.appendCodepoint(chrcode);
				this.startNumber();
				continue;
			case 0x30: // `0`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.layer.state = NUMBER2;
				this.startBuffer(block, i);
				this.appendCodepoint(chrcode);
				this.startNumber();
				continue;
			case 0x31: // `1`
			case 0x32: // `2`
			case 0x33: // `3`
			case 0x34: // `4`
			case 0x35: // `5`
			case 0x36: // `6`
			case 0x37: // `7`
			case 0x38: // `8`
			case 0x39: // `9`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.layer.state = NUMBER3;
				this.startBuffer(block, i);
				this.appendCodepoint(chrcode);
				this.startNumber();
				continue;
			}
			this.charError(block, i, 'VALUE ]');
			break;
		case NUMBER1:
			// after minus
			// expecting a digit
			this.appendCodepoint(chrcode);
			switch(chrcode){
			case 0x30: // `0`
				this.layer.state = NUMBER2;
				continue;
			case 0x31: // `1`
			case 0x32: // `2`
			case 0x33: // `3`
			case 0x34: // `4`
			case 0x35: // `5`
			case 0x36: // `6`
			case 0x37: // `7`
			case 0x38: // `8`
			case 0x39: // `9`
				this.layer.state = NUMBER3;
				continue;
			}
			this.charError(block, i, "0-9");
			break;
		case NUMBER2:
			// after initial zero
			if(this.maxNumberLength && this.layer.maxLength===null) this.layer.maxLength = this.maxNumberLength;
			// expecting a decimal or exponent
			switch (chrcode) {
			case 0x2e: // `.`
				this.appendCodepoint(chrcode);
				this.layer.state = NUMBER4;
				continue;
			case 0x65: // `e`
			case 0x45: // `E`
				this.appendCodepoint(chrcode);
				this.layer.state = NUMBER6;
				continue;
			}
			i--, this.characters--; // this character is not a number
			this.endNumber();
			continue;
		case NUMBER3:
			// After digit (before period)
			if(this.maxNumberLength && this.layer.maxLength===null) this.layer.maxLength = this.maxNumberLength;
			switch (chrcode) {
			case 0x2e: // .
				this.layer.state = NUMBER4;
				this.appendCodepoint(chrcode);
				continue;
			case 0x65: // `e`
			case 0x45: // `E`
				this.layer.state = NUMBER6;
				this.appendCodepoint(chrcode);
				continue;
			case 0x30: // `0`
			case 0x31: // `1`
			case 0x32: // `2`
			case 0x33: // `3`
			case 0x34: // `4`
			case 0x35: // `5`
			case 0x36: // `6`
			case 0x37: // `7`
			case 0x38: // `8`
			case 0x39: // `9`
				this.appendCodepoint(chrcode);
				continue;
			}
			i--, this.characters--; // this character is not a number
			this.endNumber();
			continue;
		case NUMBER4: // After period
			if (chrcode>=0x30 && chrcode<=0x39) { // 0-9
				this.appendCodepoint(chrcode);
				this.layer.state = NUMBER5;
				continue;
			}
			this.charError(block, i, '0-9');
			break;
		case NUMBER5: // * After digit (after period)
			if (chrcode>=0x30 && chrcode<=0x39) { // 0-9
				this.appendCodepoint(chrcode);
				continue;
			}
			if (chrcode === 0x65 || chrcode === 0x45) { // E/e
				this.appendCodepoint(chrcode);
				this.layer.state = NUMBER6;
				continue;
			}
			// FIXME what if we're at the first character of the incoming block?
			i--, this.characters--; // this character is not a number, rewind
			this.endNumber();
			continue;
		case NUMBER6:
			// After e/E
			if (chrcode === 0x2b || chrcode === 0x2d) { // +/-
				this.appendCodepoint(chrcode);
				this.layer.state = NUMBER7;
				continue;
			}
			if (chrcode>=0x30 && chrcode<=0x39) {
				this.appendCodepoint(chrcode);
				this.layer.state = NUMBER8;
				continue;
			}
			this.charError(block, i, '+ - 0-9');
			break;
		case NUMBER7: // After +/-
			this.appendCodepoint(chrcode);
			if (chrcode>=0x30 && chrcode<=0x39) { // 0-9
				this.layer.state = NUMBER8;
				continue;
			}
			this.charError(block, i, '0-9');
			break;
		case NUMBER8:
			// * After digit (after +/-)
			if (chrcode>=0x30 && chrcode<=0x39) { // 0-9
				this.appendCodepoint(chrcode);
				continue;
			}
			i--, this.characters--; // this character is not a number
			this.endNumber();
			continue;
		case TRUE1:
			if (chrcode === 0x72) { // r
				this.layer.state = TRUE2;
				continue;
			}
			this.charError(block, i, 'r');
			break;
		case TRUE2:
			if (chrcode === 0x75) { // u
				this.layer.state = TRUE3;
				continue;
			}
			this.charError(block, i, 'u');
			break;
		case TRUE3:
			if (chrcode === 0x65) { // e
				this.layer.state = VOID;
				if(this.layer.parseValue) this.layer.value = true;
				this.endBoolean(true);
				continue;
			}
			this.charError(block, i, 'e');
			break;
		case FALSE1:
			if (chrcode === 0x61) { // a
				this.layer.state = FALSE2;
				continue;
			}
			this.charError(block, i, 'a');
			break;
		case FALSE2:
			if (chrcode === 0x6c) { // l
				this.layer.state = FALSE3;
				continue;
			}
			this.charError(block, i, 'l');
			break;
		case FALSE3:
			if (chrcode === 0x73) { // s
				this.layer.state = FALSE4;
				continue;
			}
			this.charError(block, i, 's');
			break;
		case FALSE4:
			if (chrcode === 0x65) { // e
				this.layer.state = VOID;
				if(this.layer.parseValue) this.layer.value = false;
				this.endBoolean(false);
				continue;
			}
			this.charError(block, i, 'e');
			break;
		case NULL1:
			if (chrcode === 0x75) { // u
				this.layer.state = NULL2;
				continue;
			}
			this.charError(block, i, 'u');
			break;
		case NULL2:
			if (chrcode === 0x6c) { // l
				this.layer.state = NULL3;
				continue;
			}
			this.charError(block, i, 'l');
			break;
		case NULL3:
			if (chrcode === 0x6c) { // l
				this.layer.state = VOID;
				if(this.layer.parseValue) this.layer.value = null;
				this.endNull();
				continue;
			}
			this.charError(block, i, 'l');
			break;
		case STRING1: // After open quote
			if(this.maxStringLength && this.layer.maxLength===null){
				// If this.layer.maxLength is null, set it now
				// (it will be set while parsing keys, if this.maxKeyLength is set)
				this.layer.maxLength = this.maxStringLength;
			}
			if(isStr){
				// When possible, just power through the whole buffer right now
				const stringParts = block.slice(i).match(matchString);
				if(stringParts && stringParts[0]){
					this.appendBuffer(stringParts[0].replace(escapeSequence, function (sequence, unicode4, escapedChar) {
						var charCode;
						if (unicode4) {
							charCode = parseInt(unicode4, 16);
							return String.fromCharCode(charCode);
						} else {
							var replacement = escapeReplacements[escapedChar];
							if (!replacement) throw new Error('Assert: unknown escape character');
							return replacement;
						}
					}));
					// console.log(`Read ${stringParts[0].length} characters into ${v.length} at once "${v}"`);
					i += stringParts[0].length;
					this.characters += stringParts[0].length;
					chrcode = isStr ? block.charCodeAt(i) : block[i] ;
					if(i >= block.length) continue;
				}
			}
			switch (chrcode) {
			case 0x22: // `"`
				if(this.layer.parseValue) this.layer.value = this.readBuffer(block, i);
				if(this.layer.key) this.endKey();
				else this.endString();
				continue;
			case 0x5c: // `\`
				this.layer.state = STRING2;
				continue;
			}
			// UTF-8 decoding
			if (this.charset==='UTF-8' && chrcode>=0b11000000 && chrcode<=0b11110111) {
				this.unicode = [chrcode];
				// State counts upward... for two-byte sequence, jump to UTF8_4 state, etc.
				/**/ if(chrcode>=0b11110000) this.layer.state = UTF8_2;
				else if(chrcode>=0b11100000) this.layer.state = UTF8_3;
				else if(chrcode>=0b11000000) this.layer.state = UTF8_4;
				else if(chrcode>=0b10000000) this.charError(block, i, 'Unexpected UTF-8 continuation character');
				continue;
			}
			if (chrcode >= 0x20) {
				this.appendCodepoint(chrcode);
				continue;
			}
			this.charError(block, i);
			break;
		case STRING2: // After backslash
			switch (chrcode) {
			case 0x22: this.appendCodepoint("\"".charCodeAt()); this.layer.state = STRING1; continue;
			case 0x5c: this.appendCodepoint("\\".charCodeAt()); this.layer.state = STRING1; continue;
			case 0x2f: this.appendCodepoint("/".charCodeAt()); this.layer.state = STRING1; continue;
			case 0x62: this.appendCodepoint("\b".charCodeAt()); this.layer.state = STRING1; continue;
			case 0x66: this.appendCodepoint("\f".charCodeAt()); this.layer.state = STRING1; continue;
			case 0x6e: this.appendCodepoint("\n".charCodeAt()); this.layer.state = STRING1; continue;
			case 0x72: this.appendCodepoint("\r".charCodeAt()); this.layer.state = STRING1; continue;
			case 0x74: this.appendCodepoint("\t".charCodeAt()); this.layer.state = STRING1; continue;
			case 0x75: this.unicode = ""; this.layer.state = STRING3; continue;
			}
			this.charError(block, i, "\" \\ / b f n r t u");
			break;
		case STRING3:
		case STRING4:
		case STRING5:
		case STRING6:
			// unicode hex codes
			// 0-9 A-F a-f
			if ((chrcode>=0x30 && chrcode<=0x39) || (chrcode>=0x41 && chrcode <= 0x46) || (chrcode>=0x61 && chrcode<=0x66)) {
				this.unicode += String.fromCharCode(chrcode);
				if (this.layer.state++ === STRING6) {
					this.appendCodepoint(parseInt(this.unicode, 16));
					this.unicode = undefined;
					this.layer.state = STRING1;
				}
				continue;
			}
			this.charError(block, i, '0-9 A-F a-f');
			break;
		case UTF8_2:
		case UTF8_3:
		case UTF8_4:
			if (chrcode>=0x80 && chrcode<=0xC0) {
				this.unicode.push(chrcode);
				if (this.layer.state++ === UTF8_4) {
					var utf32 = 0;
					switch(this.unicode.length){
					case 2:
						utf32 = ((this.unicode[0]&0b11111)<<6) | (this.unicode[1]&0x3f);
						if(utf32 < 0x0080) this.charError(block, i); // Overlong codepoint
						break;
					case 3:
						utf32 = ((this.unicode[0]&0b1111)<<12) | ((this.unicode[1]&0x3f)<<6) | (this.unicode[2]&0x3f);
						if(utf32 < 0x0800) this.charError(block, i); // Overlong codepoint
						break;
					case 4:
						utf32 = ((this.unicode[0]&0b111)<<18) | ((this.unicode[1]&0x3f)<<12) | ((this.unicode[2]&0x3f)<<6) | (this.unicode[3]&0x3f);
						if(utf32 < 0x10000) this.charError(block, i); // Overlong codepoint
						break;
					}
					this.appendCodepoint(utf32);
					this.unicode = undefined;
					this.layer.state = STRING1;
				}
				continue;
			}
			this.charError(block, i, 'UTF-8 continuation character');
		}
	}
};

StreamParser.prototype.startObject = function startObject(){
	var self = this;
	self.validateInstance(function(s){ return s.startObject(self.layer); });
	self.event('startObject');
};

StreamParser.prototype.endObject = function endObject(){
	var self = this;
	self.event('endObject');
	self.validateInstance(function(s){ return s.endObject(self.layer); });
	self.pop();
};

StreamParser.prototype.startArray = function startArray(){
	var self = this;
	self.validateInstance(function(s){ return s.startArray(self.layer); });
	self.event('startArray');
};

StreamParser.prototype.endArray = function endArray(){
	var self = this;
	self.event('endArray');
	self.validateInstance(function(s){ return s.endArray(self.layer); });
	self.pop();
};

StreamParser.prototype.startNumber = function startNumber(){
	var self = this;
	self.validateInstance(function(s){ return s.startNumber(self.layer); });
};

StreamParser.prototype.endNumber = function endNumber(){
	switch (this.layer.state) {
	case NUMBER2: // * After initial zero
		this.layer.state = VOID;
		this.onNumber(NUMBER2);
		break;
	case NUMBER3: // * After digit (before period)
		this.layer.state = VOID;
		this.onNumber(NUMBER3);
		break;
	case NUMBER5: // * After digit (after period)
		this.layer.state = VOID;
		this.onNumber(NUMBER5);
		break;
	case NUMBER8: // * After digit (after +/-)
		this.layer.state = VOID;
		this.onNumber(NUMBER8);
		break;
	}
};

StreamParser.prototype.onNumber = function onNumber(endstate){
	const self = this;
	const buf = self.buffer;
	const value = JSON.parse(buf);
	if(typeof value!=='number') throw new Error('Assert: number must be a number');
	if(self.layer.parseValue){
		if(this.bigNumber==='default'){
			return goodCase();
		}
		// Most of this is logic to determine if the number is too big to represent in an ECMAScript IEEE binary64 number.
		if(endstate===NUMBER8){
			// While splitting, strip out the + if it exists
			const [m, n] = value.split(/e\+?/i);
			// value, decimal, magnitude
			if(n.length>3){
				return badCase();
			}
			const n_v = JSON.parse(n);
			if(n_v>307){
				return badCase();
			}
			const m_d = m.indexOf('.') + 1;
			const m_m = (m_d ? m_d-1 : m.length) + n_v; // should be equal to floor(log10(abs(number)))
			if(m_d===0 && m_m<16){
				// Number is an integer less than 1e16
				// The MAX_SAFE_INTEGER is ~9e16, far higher than a 32-bit integer
				// Good
				return goodCase();
			}
			// decimal form
			// Count digits, but ignore minus sign and decimal point
			const precision = (m.length) - (m[0]==='-' ? 1 : 0) - (m.indexOf('.') ? 1 : 0);
			if(precision<16){
				return goodCase();
			}else{
				return badCase();
			}
		}else{
			// decimal form
			const precision = (buf.length) - (buf[0]==='-' ? 1 : 0) - (buf.indexOf('.') ? 1 : 0);
			if(precision<16){
				return goodCase();
			}else{
				return badCase();
			}
		}
	}
	function goodCase(){
		self.layer.value = value;
		self.event('number', value);
		self.validateInstance(function(s){ return s.endNumber(self.layer, value); });
		return void self.pop();
	}
	function badCase(){
		if(self.bigNumber==='error'){
			const err = new SyntaxError(
				"Number too precise "
					+ " at line " + self.lineNumber + ':' + (self.characters-self.lineOffset)
					+ " in state " + toknam(self.layer.state),
				self.layer.path,
				{line:self.lineNumber, column:self.characters-self.lineOffset}
			);
			this.emitError(err);
		}else if(self.bigNumber==='json'){
			self.layer.value = self.buffer;
		}else{
			// if(self.bigNumber==='default'){
			self.layer.value = value;
		}
		self.event('number', value);
		self.validateInstance(function(s){ return s.endNumber(self.layer, value); });
		return void self.pop();
	}
	self.event('number', value);
	self.validateInstance(function(s){ return s.endNumber(self.layer, value); });
	self.pop();
};

StreamParser.prototype.startKey = function startKey(){
	// Not much to do here
};

StreamParser.prototype.endKey = function endKey(){
	var key = this.buffer;
	this.event('key', key);
	//this.validateInstance(function(s){ return s.endPropertyName(key); });
	this.pop();
	this.validateInstance(function(s){ return s.endKey(key); });
};

StreamParser.prototype.startString = function startString(){
	var self = this;
	self.validateInstance(function(s){ return s.startString(self.layer); });
};

StreamParser.prototype.startBuffer = function startBuffer(block, i) {
	this.blockOffset = i;
	this.buffer = "";
};

StreamParser.prototype.appendBuffer = function appendBuffer(v){
	if(typeof v !== 'string') throw new TypeError('Assertion');
	this.buffer += v;
	const surrogatePairs = v.match(/[\uD800-\uDBFF]/g);
	this.layer.length += surrogatePairs ? (v.length - surrogatePairs.length) : v.length ;
	if(this.layer.maxLength && this.layer.length > this.layer.maxLength){
		const err = new SyntaxError(
			"String too long"
				+ " at line " + this.lineNumber + ':' + (this.characters-this.lineOffset)
				+ " in state " + toknam(this.layer.state),
			this.layer.path,
			{line:this.lineNumber, column:this.characters-this.lineOffset}
		);
		this.emitError(err);
	}
};

StreamParser.prototype.readBuffer = function readBuffer(block, i) {
	// return this.buffer + block.slice(this.stringStart, i);
	return this.buffer;
};

StreamParser.prototype.appendCodepoint = function appendCodepoint(chrcode){
	if(chrcode>=0x10000){
		// Compute and append UTF-16 surrogate pair
		this.buffer +=
			String.fromCharCode(((chrcode-0x10000)>>10) + 0xD800)
			+ String.fromCharCode(((chrcode-0x10000)&0x3ff) + 0xDC00);
		this.layer.length++;
	}else{
		this.buffer += String.fromCharCode(chrcode);
		// Only increment if the character completes a code point
		// i.e. exclude high surrogates
		if(chrcode<0xD800 || chrcode>0xDBFF) this.layer.length++;
	}
	if(this.layer.maxLength && this.layer.length > this.layer.maxLength){
		const err = new SyntaxError(
			"String too long"
				+ " at line " + this.lineNumber + ':' + (this.characters-this.lineOffset)
				+ " in state " + toknam(this.layer.state),
			this.layer.path,
			{line:this.lineNumber, column:this.characters-this.lineOffset}
		);
		this.emitError(err);
	}
};

StreamParser.prototype.endString = function endString(){
	this.event('string', this.buffer);
	var self = this;
	self.validateInstance(function(s){ return s.endString(self.layer, self.buffer); });
	this.pop();
};

StreamParser.prototype.startBoolean = function startBoolean(){
	var self = this;
	self.validateInstance(function(s){ return s.startBoolean(self.layer); });
};

StreamParser.prototype.endBoolean = function endBoolean(value){
	var self = this;
	this.event('boolean', value);
	self.validateInstance(function(s){ return s.endBoolean(self.layer, value); });
	this.pop();
};

StreamParser.prototype.startNull = function startNull(){
	var self = this;
	self.validateInstance(function(s){ return s.startNull(self.layer); });
};

StreamParser.prototype.endNull = function endNull(){
	this.event('null', this.value);
	this.pop();
};

StreamParser.prototype.eof = function eof() {
	switch (this.layer.state) {
	case NUMBER1:
	case NUMBER2:
	case NUMBER3:
	case NUMBER4:
	case NUMBER5:
	case NUMBER6:
	case NUMBER7:
	case NUMBER8:
		this.endNumber();
		break;
	}
	// EOF is only expected in a VOID, which is stack element 0
	if(this.stack.length>1){
		const err = new SyntaxError(
			'Unexpected end of document while parsing '+toknam(this.layer.state),
			this.layer.path,
			{line:this.lineNumber, column:this.characters-this.lineOffset},
			'', // FIXME provide an expected character set here
			'EOF'
		);
		this._emitEnd(err);
	}else{
		this._emitEnd();
	}
};

StreamParser.prototype._emitEnd = function emitEnd(err){
	if(err){
		this.emitError(err);
	}else{
		if(this[promiseRef]) this[promiseDone](this);
		this.emit('end');
	}
};
