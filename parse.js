
"use strict";
const stream = require('stream');
const util = require('util');

var Schema = require('./schema.js');

// Named constants with unique integer values
var C = {};
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


module.exports.SyntaxError = SyntaxError;
function SyntaxError(message, propertyPath, position, expected, actual){
	this.message = message;
	this.path = propertyPath;
	this.position = position;
	this.expected = expected;
	this.actual = actual;
}



module.exports.StreamParser = StreamParser;
function StreamParser(schema, options) {
	if (!(this instanceof StreamParser)) return new StreamParser(options);
	stream.Writable.call(this, {
		decodeStrings: false,
	});

	if(!options) options = {};

	// Configurable parsing options
	// Store parsed value in `this.value`?
	this.keepValue = 'keepValue' in options ? options.keepValue : false;
	// dunno what this is
	this.key = false;
	// Allow trailing commas/comma terminated properties?
	this.trailingComma = false;
	this.multipleValue = false;

	if(schema){
		if(!(schema instanceof Schema.Schema)) throw new Error('schema must be instance of Schema');
	}

	// Line number tracking
	this.charset = 'charset' in options ? options.charset : 'ASCII';
	this.characters = 0;
	this.lineNumber = 0;
	this.lineOffset = 0;
	this.codepointStart = 0;

	// Object stack stuff
	this.stack = [];
	this.errors = [];

	// for parsing
	this.value = undefined;

	// for string parsing
	this.string = undefined; // string data
	this.unicode = undefined; // unicode escapes

	// For number parsing
	this.negative = undefined;
	this.magnatude = undefined;
	this.position = undefined;
	this.exponent = undefined;
	this.negativeExponent = undefined;

	// Begin creating stack
	// Allow trailing whitespace at the end of the document
	this.push('');
	this.layer.state = VOID;
	// Start parsing a value
	this.push('', schema && schema.validate(this.errors));
}
util.inherits(StreamParser, stream.Writable);

StreamParser.prototype.event = function (name, value) {
	this.emit(name, this.layer, value);

}

StreamParser.prototype.charError = function (buffer, i, expecting) {
	var actual = buffer[i];
	if(typeof actual==='number') actual=String.fromCharCode(actual);
	throw new SyntaxError(
		"Unexpected "
			+ JSON.stringify(actual)
			+ " at line " + this.lineNumber + ':' + (this.characters-this.lineOffset)
			+ " in state " + toknam(this.layer.state)
			+  ( expecting ? (" expecting one of: " + expecting) : '' ),
		this.layer.path,
		{line:this.lineNumber, column:this.characters-this.lineOffset},
		expecting,
		actual
	);
};

StreamParser.prototype.push = function push(k, validator) {
	if(validator) validator.forEach(function(v){
		if(!v.startNumber) throw new Error('NOT A VALIDATOR');
	});
	var path = this.layer && this.layer.path || '';
	this.layer = {
		state: VALUE,
		//path: k ? this.layer.path.concat(k) : (this.layer&&this.layer.path),
		path: k ? path+'/'+k : path,
		key: null,
		keepValue: this.keepValue,
		value: undefined,
		beginChar: this.characters,
		beginLine: this.lineNumber,
		beginColumn: this.characters-this.lineOffset,
		endChar: null,
		endLine: null,
		endColumn: null,
		length: 0,
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

StreamParser.prototype.pushProperty = function pushProperty(k) {
	var list = this.layer.validator || [];
	if(!Array.isArray(list)) throw new Error('Expected array');
	var result = collapseArray(list, function(validator){
		return validator.validateProperty(k);
	});
	return this.push(k, result);
}

StreamParser.prototype.pushItem = function pushItem(k) {
	var list = this.layer.validator || [];
	if(!Array.isArray(list)) throw new Error('Expected array');
	var result = collapseArray(list, function(validator){
		return validator.validateItem(k);
	});
	return this.push(k, result);
}



StreamParser.prototype.pop = function pop(){
	var self = this;
	var layer = self.stack.pop();
	layer.endChar = self.characters;
	layer.endLine = self.lineNumber;
	layer.endColumn = self.characters-self.lineOffset;
	self.validateInstance(function(s){ return s.finish(layer); });
	if(layer.keepValue) self.value = layer.value;
	self.layer = self.stack[this.stack.length-1];
	return layer;
}

StreamParser.prototype.validateInstance = function validateInstance(cb) {
	var self = this;
	if(!self.layer.validator) return;
	if(!Array.isArray(self.layer.validator)) throw new Error('Expected array this.layer.validator');
	self.layer.validator.forEach(function(validator){
		if(!validator.startNumber) console.error('NOT A VALIDATOR', validator);
		cb(validator);
	});
}

StreamParser.prototype._transform = StreamParser.prototype._write = function (buffer, encoding, callback) {
	try {
		this.parseBlock(buffer);
	}catch(e){
		if(callback) return void callback(e);
		throw e;
	}
	if(callback) callback();
}

StreamParser.prototype._flush = StreamParser.prototype._final = function _flush(callback) {
	try {
		this.eof();
	}catch(e){
		return void callback(e);
	}
	callback();
}

StreamParser.parse = function parse(schema, options, buffer){
	var parser = new StreamParser(schema, options);
	parser.keepValue = true;
	parser.parse(buffer);
	return parser;
}

StreamParser.prototype.parse = function parse(buffer){
	this.parseBlock(buffer);
	this.eof();
}

StreamParser.prototype.parseBlock = function parseBlock(buffer){
	if(this.charset==='string'){
		if(typeof buffer!=='string') throw new Error('Expected arguments[0] `buffer` to be a string');
	}else if(this.charset==='ASCII'){
		if(!Buffer.isBuffer(buffer)) throw new Error('Expected arguments[0] `buffer` to be a Buffer with ASCII data');
	}else if(this.charset==='UTF-8'){
		// TODO UTF-8 isn't actually supported yet
		if(!Buffer.isBuffer(buffer)) throw new Error('Expected arguments[0] `buffer` to be a Buffer with UTF-8 data');
	}else{
		throw new Error('Unknown encoding '+JSON.stringify(this.charset));
	}
	for (var i = 0; i < buffer.length; i++, this.characters++) {
		var chrcode = (typeof buffer==='string') ? buffer.charCodeAt(i) : buffer[i] ;
		if(typeof chrcode !== 'number') throw new Error('Expected numeric codepoint value');
		if(this.charset==='ASCII' && chrcode>=0x80) throw new Error('Unexpected high-byte character');
		// Verify UTF-16 surrogate pairs
		if(this.charset==='string' && chrcode>=0xD800 && chrcode<=0xDFFF){
			if(chrcode<0xDC00){
				// This is a UTF-16 high (first) surrogate
				if(this.utf16_high) this.charError(buffer, i, 'UTF-16-low-surrogate');
				this.utf16_high = chrcode;
				// continue execution since we're decoding to UTF-16 anyways
			}else{
				// This is a UTF-16 low (second) surrogate
				var utf16_high = this.utf16_high;
				this.utf16_high = null;
			}
		}
		this.codepointStart = i;
		switch (this.layer.state) {
		case VOID:
			// For end of document where only whitespace is allowed
			switch (chrcode) {
			case 0x0a:
				this.lineOffset = this.characters;
				this.lineNumber++;
			case 0x09:
			case 0x0d:
			case 0x20:
				continue; // whitespace, ignore
			}
			this.charError(buffer, i, "\\s");
		case VALUE:
			switch (chrcode) {
			case 0x0a:
				this.lineOffset = i;
				this.lineNumber++;
			case 0x09:
			case 0x0d:
			case 0x20:
				continue; // whitespace, ignore
			case 0x7b: // `{`
				this.startObject();
				this.layer.state = OBJECT1;
				if(this.layer.keepValue) this.layer.value = {};
				continue;
			case 0x5b: // `[`
				this.startArray();
				this.layer.state = ARRAY1;
				if(this.layer.keepValue) this.layer.value = [];
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
				this.string = "";
				this.layer.state = STRING1;
				this.startString();
				continue;
			case 0x2d: // `-`
				this.negative = true;
				this.layer.state = NUMBER1;
				this.string = "-";
				this.startNumber();
				continue;
			case 0x30: // `0`
				this.magnatude = 0;
				this.layer.state = NUMBER2;
				this.string = "0";
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
				this.magnatude = chrcode - 0x30;
				this.layer.state = NUMBER3;
				this.string = String.fromCharCode(chrcode);
				this.startNumber();
				continue;
			}
			this.charError(buffer, i, '[ { true false null " - 0-9');
		case OBJECT1:
			// Opened a curly brace, expecting a closing curly brace or a key
			switch (chrcode) {
			case 0x0a:
				this.lineOffset = i;
				this.lineNumber++;
			case 0x09:
			case 0x0d:
			case 0x20:
				continue; // whitespace, ignore
			case 0x22: // `"`
				// Start parsing a keyword name
				this.string = "";
				// When the new layer (created next) pops, be in the "finished parsing key" state
				this.layer.state = OBJECT2;
				// Parse the next characters as a new value
				this.push();
				this.layer.state = STRING1;
				this.layer.keepValue = true;
				this.layer.key = true;
				continue;
			case 0x7d: // `}`
				this.endObject();
				continue;
			}
			this.charError(buffer, i, '" }');
		case OBJECT2:
			// Process parsed key
			// the endKey method will have already been called by the just-popped layer
			this.layer.key = this.string;
			this.layer.state = OBJECT3;
			// pass to OBJECT3
		case OBJECT3:
			// Stored state of key, expecting a colon
			switch (chrcode) {
			case 0x0a:
				this.lineOffset = i;
				this.lineNumber++;
			case 0x09:
			case 0x0d:
			case 0x20:
				continue; // whitespace, ignore
			case 0x3a: // `:`
				// Once property value is parsed, we'll return to OBJECT4
				this.layer.state = OBJECT4;
				// But first, parse the next characters as a new value
				this.pushProperty(this.layer.key);
				continue;
			}
			this.charError(buffer, i, ':');
		case OBJECT4:
			// Process parsed value
			if(this.layer.keepValue) this.layer.value[this.layer.key] = this.value;
			this.layer.length++;
			this.layer.state = OBJECT5;
			// pass to OBJECT5
		case OBJECT5:
			// Parsed a value, expecting a comma or closing curly brace
			switch (chrcode) {
			case 0x0a:
				this.lineOffset = i;
				this.lineNumber++;
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
			this.charError(buffer, i, ', }');
		case OBJECT6:
			// Parsed a comma, now expecting a string
			switch (chrcode) {
			case 0x0a:
				this.lineOffset = i;
				this.lineNumber++;
			case 0x09:
			case 0x0d:
			case 0x20:
				continue; // whitespace, ignore
			case 0x22: // `"`
				// Start parsing a keyword name
				this.string = "";
				// When the new layer (created next) pops, be in the "finished parsing key" state
				this.layer.state = OBJECT2;
				// Parse the next characters as a new value
				this.push();
				this.layer.state = STRING1;
				this.layer.keepValue = true;
				this.layer.key = true;
				continue;
			}
			this.charError(buffer, i, '"');
		case ARRAY1:
			// Finished reading open-array, expecting close-array or value
			switch (chrcode) {
			case 0x0a:
				this.lineOffset = i;
				this.lineNumber++;
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
				if(this.layer.keepValue) this.layer.value = {};
				continue;
			case 0x5b: // `[`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.startArray();
				this.layer.state = ARRAY1;
				if(this.layer.keepValue) this.layer.value = [];
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
				this.string = "";
				this.layer.state = STRING1;
				this.startString();
				continue;
			case 0x2d: // `-`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.negative = true;
				this.layer.state = NUMBER1;
				this.string = "-";
				this.startNumber();
				continue;
			case 0x30: // `0`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.magnatude = 0;
				this.layer.state = NUMBER2;
				this.string = "0";
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
				this.magnatude = chrcode - 0x30;
				this.layer.state = NUMBER3;
				this.string = String.fromCharCode(chrcode);
				this.startNumber();
				continue;
			}
			this.charError(buffer, i, '] { [ true false null " - 0-9');
		case ARRAY2:
			// push item to array value
			if(this.layer.keepValue) this.layer.value[this.layer.length] = this.value;
			this.layer.length++;
			this.layer.state = ARRAY3;
			// fall to next state
		case ARRAY3:
			// Finished reading an array item, now expecting a close array or comma
			switch (chrcode) {
			case 0x0a:
				this.lineOffset = i;
				this.lineNumber++;
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
			this.charError(buffer, i, '] ,');
		case ARRAY4:
			// Finished reading comma, expecting value
			switch(chrcode){
			case 0x0a:
				this.lineOffset = i;
				this.lineNumber++;
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
				if(this.layer.keepValue) this.layer.value = {};
				continue;
			case 0x5b: // `[`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.startArray();
				this.layer.state = ARRAY1;
				if(this.layer.keepValue) this.layer.value = [];
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
				this.string = "";
				this.layer.state = STRING1;
				this.startString();
				continue;
			case 0x2d: // `-`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.negative = true;
				this.layer.state = NUMBER1;
				this.string = "-";
				this.startNumber();
				continue;
			case 0x30: // `0`
				this.layer.state = ARRAY2;
				this.pushItem(this.layer.length);
				this.magnatude = 0;
				this.layer.state = NUMBER2;
				this.string = "0";
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
				this.magnatude = chrcode - 0x30;
				this.layer.state = NUMBER3;
				this.string = String.fromCharCode(chrcode);
				this.startNumber();
				continue;
			}
			this.charError(buffer, i, 'VALUE ]');
		case NUMBER1:
			// after minus
			// expecting a digit
			this.string += String.fromCharCode(chrcode);
			switch(chrcode){
			case 0x30: // `0`
				this.string += "0";
				this.magnatude = 0;
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
				this.string += String.fromCharCode(chrcode);
				this.magnatude = chrcode - 0x30;
				this.layer.state = NUMBER3;
				continue;
			}
			this.charError(buffer, i, "0-9");
		case NUMBER2:
			// after initial zero
			// expecting a decimal or exponent
			switch (chrcode) {
			case 0x2e: // `.`
				this.string += String.fromCharCode(chrcode);
				this.position = 0.1;
				this.layer.state = NUMBER4;
				continue;
			case 0x65: // `e`
			case 0x45: // `E`
				this.string += String.fromCharCode(chrcode);
				this.exponent = 0;
				this.layer.state = NUMBER6;
				continue;
			}
			this.endNumber();
			i--, this.characters--; // this character is not a number
			continue;
		case NUMBER3: // * After digit (before period)
			this.string += String.fromCharCode(chrcode);
			switch (chrcode) {
			case 0x2e: // .
				this.position = 0.1;
				this.layer.state = NUMBER4;
				continue;
			case 0x65: // `e`
			case 0x45: // `E`
				this.exponent = 0;
				this.layer.state = NUMBER6;
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
				this.magnatude = this.magnatude * 10 + (chrcode - 0x30);
				continue;
			}
			this.endNumber();
			i--, this.characters--; // this character is not a number
			continue;
		case NUMBER4: // After period
			this.string += String.fromCharCode(chrcode);
			if (chrcode>=0x30 && chrcode<=0x39) { // 0-9
				this.magnatude += this.position * (chrcode - 0x30);
				this.position /= 10;
				this.layer.state = NUMBER5;
				continue;
			}
			this.charError(buffer, i, '0-9');
		case NUMBER5: // * After digit (after period)
			this.string += String.fromCharCode(chrcode);
			if (chrcode>=0x30 && chrcode<=0x39) { // 0-9
				this.magnatude += this.position * (chrcode - 0x30);
				this.position /= 10;
				continue;
			}
			if (chrcode === 0x65 || chrcode === 0x45) { // E/e
				this.exponent = 0;
				this.layer.state = NUMBER6;
				continue;
			}
			this.endNumber();
			// FIXME what if we're at the first character of the incoming block?
			i--, this.characters--; // this character is not a number, rewind
			continue;
		case NUMBER6:
			// After e/E
			this.string += String.fromCharCode(chrcode);
			if (chrcode === 0x2b || chrcode === 0x2d) { // +/-
				if (chrcode === 0x2d) { this.negativeExponent = true; }
				this.layer.state = NUMBER7;
				continue;
			}
			if (chrcode>=0x30 && chrcode<=0x39) {
				this.exponent = this.exponent * 10 + (chrcode - 0x30);
				this.layer.state = NUMBER8;
				continue;
			}
			this.charError(buffer, i, '+ - 0-9');
		case NUMBER7: // After +/-
			this.string += String.fromCharCode(chrcode);
			if (chrcode>=0x30 && chrcode<=0x39) { // 0-9
				this.exponent = this.exponent * 10 + (chrcode - 0x30);
				this.layer.state = NUMBER8;
				continue;
			}
			this.charError(buffer, i, '0-9');
		case NUMBER8:
			// * After digit (after +/-)
			this.string += String.fromCharCode(chrcode);
			if (chrcode>=0x30 && chrcode<=0x39) { // 0-9
				this.exponent = this.exponent * 10 + (chrcode - 0x30);
				continue;
			}
			this.endNumber();
			i--, this.characters--; // this character is not a number
			continue;
		case TRUE1:
			if (chrcode === 0x72) { // r
				this.layer.state = TRUE2;
				continue;
			}
			this.charError(buffer, i, 'r');
		case TRUE2:
			if (chrcode === 0x75) { // u
				this.layer.state = TRUE3;
				continue;
			}
			this.charError(buffer, i, 'u');
		case TRUE3:
			if (chrcode === 0x65) { // e
				this.layer.state = VOID;
				if(this.layer.keepValue) this.layer.value = true;
				this.endBoolean();
				continue;
			}
			this.charError(buffer, i, 'e');
		case FALSE1:
			if (chrcode === 0x61) { // a
				this.layer.state = FALSE2;
				continue;
			}
			this.charError(buffer, i, 'a');
		case FALSE2:
			if (chrcode === 0x6c) { // l
				this.layer.state = FALSE3;
				continue;
			}
			this.charError(buffer, i, 'l');
		case FALSE3:
			if (chrcode === 0x73) { // s
				this.layer.state = FALSE4;
				continue;
			}
			this.charError(buffer, i, 's');
		case FALSE4:
			if (chrcode === 0x65) { // e
				this.layer.state = VOID;
				if(this.layer.keepValue) this.layer.value = false;
				this.endBoolean();
				continue;
			}
			this.charError(buffer, i, 'e');
		case NULL1:
			if (chrcode === 0x75) { // u
				this.layer.state = NULL2;
				continue;
			}
			this.charError(buffer, i, 'u');
		case NULL2:
			if (chrcode === 0x6c) { // l
				this.layer.state = NULL3;
				continue;
			}
			this.charError(buffer, i, 'l');
		case NULL3:
			if (chrcode === 0x6c) { // l
				this.layer.state = VOID;
				if(this.layer.keepValue) this.layer.value = null;
				this.startNull();
				this.endNull();
				continue;
			}
			this.charError(buffer, i, 'l');
		case STRING1: // After open quote
			switch (chrcode) {
			case 0x22: // `"`
				if(this.layer.keepValue) this.layer.value = this.string;
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
				if(chrcode>=0b11110000) this.layer.state = UTF8_2;
				else if(chrcode>=0b11100000) this.layer.state = UTF8_3;
				else this.layer.state = UTF8_4;
				continue;
			}
			if (chrcode >= 0x20) {
				this.appendCodepoint(chrcode);
				continue;
			}
			this.charError(buffer, i);
		case STRING2: // After backslash
			switch (chrcode) {
			case 0x22: this.string += "\""; this.layer.length++; this.layer.state = STRING1; continue;
			case 0x5c: this.string += "\\"; this.layer.length++; this.layer.state = STRING1; continue;
			case 0x2f: this.string += "\/"; this.layer.length++; this.layer.state = STRING1; continue;
			case 0x62: this.string += "\b"; this.layer.length++; this.layer.state = STRING1; continue;
			case 0x66: this.string += "\f"; this.layer.length++; this.layer.state = STRING1; continue;
			case 0x6e: this.string += "\n"; this.layer.length++; this.layer.state = STRING1; continue;
			case 0x72: this.string += "\r"; this.layer.length++; this.layer.state = STRING1; continue;
			case 0x74: this.string += "\t"; this.layer.length++; this.layer.state = STRING1; continue;
			case 0x75: this.unicode = ""; this.layer.state = STRING3; continue;
			}
			this.charError(buffer, i, "\" \\ \/ b f n r t u");
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
			this.charError(buffer, i, '0-9 A-F a-f');
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
							if(utf32 < 0x0080) this.charError(buffer, i); // Overlong codepoint
							break;
						case 3:
							utf32 = ((this.unicode[0]&0b1111)<<12) | ((this.unicode[1]&0x3f)<<6) | (this.unicode[2]&0x3f);
							if(utf32 < 0x0800) this.charError(buffer, i); // Overlong codepoint
							break;
						case 4:
							utf32 = ((this.unicode[0]&0b111)<<18) | ((this.unicode[1]&0x3f)<<12) | ((this.unicode[2]&0x3f)<<6) | (this.unicode[3]&0x3f);
							if(utf32 < 0x10000) this.charError(buffer, i); // Overlong codepoint
							break;
					}
					this.appendCodepoint(utf32);
					this.unicode = undefined;
					this.layer.state = STRING1;
				}
				continue;
			}
			this.charError(buffer, i, 'UTF-8 continuation character');
		}
	}
};

StreamParser.prototype.startObject = function startObject(){
	var self = this;
	self.validateInstance(function(s){ return s.startObject(self.layer); });
	self.event('startObject');
}

StreamParser.prototype.endObject = function endObject(){
	var self = this;
	self.event('endObject');
	self.validateInstance(function(s){ return s.endObject(self.layer); });
	self.pop();
}

StreamParser.prototype.startArray = function startArray(){
	var self = this;
	self.validateInstance(function(s){ return s.startArray(self.layer); });
	self.event('startArray');
}

StreamParser.prototype.endArray = function endArray(){
	var self = this;
	self.event('endArray');
	self.validateInstance(function(s){ return s.endArray(self.layer); });
	self.pop();
}

StreamParser.prototype.startNumber = function startNumber(){
	var self = this;
	self.validateInstance(function(s){ return s.startNumber(self.layer); });
}

StreamParser.prototype.endNumber = function endNumber(){
	switch (this.layer.state) {
	case NUMBER2: // * After initial zero
		this.layer.state = VOID;
		this.magnatude = undefined;
		this.negative = undefined;
		this.onNumber(0, this.string);
		break;
	case NUMBER3: // * After digit (before period)
		this.layer.state = VOID;
		if (this.negative) {
			this.magnatude = -this.magnatude;
			this.negative = undefined;
		}
		this.onNumber(this.magnatude, this.string);
		this.magnatude = undefined;
		break;
	case NUMBER5: // * After digit (after period)
		this.layer.state = VOID;
		if (this.negative) {
			this.magnatude = -this.magnatude;
			this.negative = undefined;
		}
		this.onNumber(this.negative ? -this.magnatude : this.magnatude, this.string);
		this.magnatude = undefined;
		this.position = undefined;
		break;
	case NUMBER8: // * After digit (after +/-)
		if (this.negativeExponent) {
			this.exponent = -this.exponent;
			this.negativeExponent = undefined;
		}
		this.magnatude *= Math.pow(10, this.exponent);
		this.exponent = undefined;
		if (this.negative) {
			this.magnatude = -this.magnatude;
			this.negative = undefined;
		}
		this.layer.state = VOID;
		this.onNumber(this.magnatude, this.string);
		this.magnatude = undefined;
		break;
	}
}

StreamParser.prototype.onNumber = function onNumber(n, s){
	var self = this;
	if(self.layer.keepValue) this.layer.value = n;
	self.event('number', n);
	self.validateInstance(function(s){ return s.endNumber(self.layer, n); });
	self.pop();
}

StreamParser.prototype.startKey = function startKey(){
	// Not much to do here
}

StreamParser.prototype.endKey = function endKey(){
	var key = this.string
	this.event('key', key);
	//this.validateInstance(function(s){ return s.endPropertyName(key); });
	this.pop();
	this.validateInstance(function(s){ return s.endKey(key); });
}

StreamParser.prototype.startString = function startString(){
	var self = this;
	self.validateInstance(function(s){ return s.startString(self.layer); });
}

StreamParser.prototype.appendCodepoint = function appendCodepoint(chrcode){
	if(chrcode>=0x10000){
		// Compute and append UTF-16 surrogate pair
		this.string +=
			String.fromCharCode(((chrcode-0x10000)>>10) + 0xD800)
			+ String.fromCharCode(((chrcode-0x10000)&0x3ff) + 0xDC00);
		this.layer.length++;
	}else{
		this.string += String.fromCharCode(chrcode);
		// Only increment if the character completes a code point
		// i.e. exclude high surrogates
		if(chrcode<0xD800 || chrcode>0xDBFF) this.layer.length++;
	}
}

StreamParser.prototype.endString = function endString(){
	this.event('string', this.string);
	var self = this;
	self.validateInstance(function(s){ return s.endString(self.layer, self.string); });
	this.pop();
}

StreamParser.prototype.startBoolean = function startBoolean(){
	var self = this;
	self.validateInstance(function(s){ return s.startBoolean(self.layer); });
}

StreamParser.prototype.endBoolean = function endBoolean(){
	this.event('boolean', this.value);
	this.pop();
}

StreamParser.prototype.startNull = function startNull(){
	var self = this;
	self.validateInstance(function(s){ return s.startNull(self.layer); });
}

StreamParser.prototype.endNull = function endNull(){
	this.event('null', this.value);
	this.pop();
}

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
		throw new SyntaxError(
			'Unexpected end of document while parsing '+toknam(this.layer.state),
			 this.layer.path,
			{line:this.lineNumber, column:this.characters-this.lineOffset},
			'', // FIXME provide an expected character set here
			'EOF');
	}
}
