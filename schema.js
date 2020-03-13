"use strict";

var url = require('url');
var uriResolve = url.resolve;

var Parse = require('./parse.js');

module.exports.collapseArray = collapseArray;
function collapseArray(arr, cb){
	var res = [];
	for(var i=0; i<arr.length; i++) cb(arr[i], i).forEach(function(v){ res.push(v); });
	return res;
}

module.exports.compareDeep = compareDeep;
function compareDeep(a, b){
	if(typeof a!==typeof b) return false;
	if(a===b) return true;
	if(typeof a!=='object') return a===b; // handle string, number, boolean, undefined equality
	if(!a || !b) return a===b; // handle null equality
	// now handle array and object cases
	if(Array.isArray(a) && Array.isArray(b)){
		if(a.length !== b.length) return false;
		return a.every(function(v, i){ return compareDeep(v, b[i]); });
	}else{
		if(Object.keys(a).length !== Object.keys(b).length) return false;
		for(var k in a) if(compareDeep(a[k], b[k])===false) return false;
		return true;
	}
}

module.exports.ValidationError = ValidationError;
function ValidationError(message, layer, schema, keyword, expected, actual){
	this.message = message;
	this.path = layer.path;
	this.layer = layer;
	this.position = {line:layer.beginLine, column:layer.beginColumn};
	this.to = {line:layer.endLine, column:layer.endColumn};
	//this.schema = schema;
	this.schemaId = schema.id;
	this.keyword = keyword;
	this.expected = expected;
	this.actual = actual;
}
ValidationError.prototype.toString = function toString(){
	return this.message
		+ '\n\t' + JSON.stringify(this.schema)
		+ '\n\t' + JSON.stringify(this.actual);
};

module.exports.isSchema = isSchema;
function isSchema(s){
	// Is an object, but not an array, and not a schema reference with $ref
	// Also a boolean is also a valid schema
	return (typeof s=='object' && !Array.isArray(s)) || (typeof s=='boolean');
}

module.exports.resolveFragmentDefault = resolveFragmentDefault;
function resolveFragmentDefault(fragment){
	return fragment.split('/').slice(1).map(function(v){
		return decodeURIComponent(v).replace(/~0/g, '~').replace(/~1/g, '/');
		//return decodeURIComponent(v);
		//return (v);
	});
}

/*
A SchemaRegistry maps URIs to Schema instances.
*/
module.exports.SchemaRegistry = SchemaRegistry;
function SchemaRegistry(){
	this.seen = {};
	this.pending = [];
	this.source = {};
	this.parsed = {};
	this.resolveFragment = resolveFragmentDefault;
}
SchemaRegistry.prototype.import = function importSchema(id, schema, path){
	// Strip trailing empty fragment
	if(id.match(/#$/)){
		id = id.substring(0, id.length-1);
	}else if(id.match(/#\//)){
		throw new Error('Cannot import a schema with property path');
	}
	if(this.parsed[id]) return this.parsed[id];
	this.scan(id, schema, '');
	const parsed = this.resolve(id, schema);
	this.parsed[id] = parsed;
	return parsed;
};
SchemaRegistry.prototype.scanMap = function scan(id, map, path){
	var self = this;
	if(map) for(var n in map) if(typeof map[n]=='object') self.scan(id, map[n], path+'/'+n);
};
SchemaRegistry.prototype.scan = function scan(base, schema, path){
	var self = this;
	if(schema===undefined){
		return;
	}
	if(!base){
		throw new Error('Argument `base` required');
	}
	var id = base;
	if(!path){
		path = '';
	}
	if(Array.isArray(schema)){
		schema.forEach(function(v, i){ self.scan(base, schema[i], path+'/'+i); });
		return;
	}
	// if(typeof schema==='string'){
	// 	var id = uriResolve(base, schema);
	// 	if(!this.source[id]) this.source[id] = null;
	// 	this.seen[id] = true;
	// }
	if(typeof schema==='boolean'){
		// Alias boolean form to an object schema
		if(schema===true){
			schema = { id:'_:true' };
		}else if(schema===false){
			schema = { id:'_:false', type:[] };
		}
		// continue to 'object'
	}
	if(typeof schema==='object'){
		var uriref = schema.$id || schema.id;
		if(uriref){
			id = uriResolve(base, uriref);
		}else{
			id = base + '#' + path;
		}
		if(schema.$anchor){
			if(uriref.indexOf('#') >= 0) throw new Error('Cannot use $anchor on fragment URI');
			uriref = uriref + '#' + schema.$anchor;
		}
		// Strip trailing empty fragment
		if(id.match(/#$/)){
			id = id.substring(0, id.length-1);
		}
		// Throw error if schema is being re-defined with different definition
		if(self.source[id]){
			var oldSchema = JSON.stringify(self.source[id]);
			var newSchema = JSON.stringify(schema);
			if(oldSchema!==newSchema) throw new Error('Schema already defined');
			// This schema is, presumably, already imported with an identical definition
			return;
		}
		self.source[id] = schema;
		self.scan(id, schema.items, path+'/items');
		self.scan(id, schema.extends, path+'/extends');
		self.scan(id, schema.additionalItems, path+'/additionalItems');
		self.scanMap(id, schema.properties, path+'/properties');
		self.scan(id, schema.additionalProperties, path+'/additionalProperties');
		self.scanMap(id, schema.definitions, path+'/definitions');
		self.scanMap(id, schema.$defs, path+'/$defs');
		self.scanMap(id, schema.patternProperties, path+'/patternProperties');
		self.scanMap(id, schema.dependencies, path+'/dependencies');
		self.scan(id, schema.disallow, path+'/disallow');
		self.scan(id, schema.allOf, path+'/allOf');
		self.scan(id, schema.anyOf, path+'/anyOf');
		self.scan(id, schema.oneOf, path+'/oneOf');
		self.scan(id, schema.not, path+'/not');
		if(schema.$ref!==undefined){
			if(typeof schema.$ref==='string'){
				var refUri = uriResolve(id, schema.$ref);
				if(self.seen[refUri]){
					//throw new Error('Already imported: '+refUri);
				}else{
					self.seen[refUri] = schema;
					self.pending.push([refUri, schema]);
				}
			}else{
				throw new Error('Expected $ref to be a string');
			}
		}
	}else{
		throw new Error('Unexpected value for schema (expected object or boolean)');
	}
};
SchemaRegistry.prototype.lookup = function lookup(id){
	const self = this;
	if(typeof id!=='string') throw new Error('`id` must be a string');

	// Return an already existing Schema
	if(self.parsed[id]){
		return self.parsed[id];
	}
	// Try to parse the Schema at its defined URI
	if(self.source[id]){
		self.parsed[id] = new Schema(id, self.source[id], self);
		return self.parsed[id];
	}

	const idParts = id.split('#', 1);
	const idBase = idParts[0];
	const idFrag = id.substring(idBase.length + 1);

	// Try to decend the property path, if any
	if(self.source[idBase] && idFrag && idFrag[0]==='/'){
		var resolved = self.source[idBase] || self.source[idBase + '#'];
		var path = idBase + '#';
		if(!resolved) throw new Error('Could not resolve schema '+JSON.stringify(idBase));
		var hier = self.resolveFragment(idFrag);
		for(var i=0; i<hier.length; i++){
			var key = hier[i];
			path += '/' + encodeURIComponent(key);
			resolved = resolved[key];
			if(!resolved) throw new Error('Could not resolve schema '+JSON.stringify(path));
		}
		self.parsed[path] = new Schema(path, resolved, self);
		return self.parsed[path];
	}
	throw new Error(`Could not resolve schema <${id}>`);
};

SchemaRegistry.prototype.resolve = function resolve(base, schema){
	var self = this;
	if(typeof base!=='string' || base.indexOf(':')===-1) throw new Error('`base` must be a URI string');
	if(isSchema(schema)){
		return new Schema(base, schema, self);
	}else{
		throw new Error('Expected a schema (object or boolean)');
	}
};

SchemaRegistry.prototype.getUnresolved = function(){
	var self = this;
	return Object.keys(self.seen)
		.filter(function(v){ return !self.source[v]; });
};

// Represents a complete JSON Schema and its keywords
module.exports.Schema = Schema;
function Schema(id, schema, registry){
	var self = this;

	// Core

	if(!registry) registry = new SchemaRegistry;
	self.registry = registry;
	if(typeof id !== 'string'){
		throw new Error('Expected `id` to be a string');
	}
	if(id.indexOf('>')>=0 || id.indexOf(' ')>=0){
		throw new Error('Illegal character in id: '+id);
	}
	self.id = id;
	if(typeof schema==='boolean'){
		if(schema===false){
			// self.allowNumber = self.allowFraction = self.allowString = self.allowBoolean = self.allowNull = self.allowObject = self.allowArray = false;
			schema = {type:[]};
		}else{
			schema = {};
		}
	}else if(!schema || typeof schema!=='object'){
		throw new Error('Expected a valid schema (object or boolean)');
	}
	if(schema) var idref = schema.$id || schema.id;
	if(idref) self.id = uriResolve(self.id, idref) || '_:';

	// General
	self.not = [];
	if(schema.not!==undefined){
		if(isSchema(schema.not)){
			self.not.push(self.registry.resolve(self.id, schema.not));
		}else{
			throw new Error('Expected `not` to be a schemas');
		}
	}

	self.anyOf = [];
	if(Array.isArray(schema.anyOf)){
		self.anyOf.push(schema.anyOf.map(function(s2, i){
			return self.registry.resolve(self.id, s2);
		}));
	}

	self.oneOf = [];
	if(schema.oneOf!==undefined){
		if(Array.isArray(schema.oneOf)){
			self.oneOf.push(schema.oneOf.map(function(s2, i){
				return self.registry.resolve(self.id, s2);
			}));
		}else{
			throw new Error('Expected `oneOf` to be an array of schemas');
		}
	}

	self.allOf = [];
	if(Array.isArray(schema.allOf)){
		schema.allOf.forEach(function(s2, i){
			self.allOf.push(self.registry.resolve(self.id, s2));
		});
	}

	if(schema.type===undefined){
		self.allowNumber = self.allowFraction = self.allowString = self.allowBoolean = self.allowNull = self.allowObject = self.allowArray = true;
	}else if(typeof schema.type==='string'){
		self.allowNumber = schema.type==='number' || schema.type==='integer';
		self.allowFraction = schema.type==='number';
		self.allowString = schema.type==='string';
		self.allowBoolean = schema.type==='boolean';
		self.allowNull = schema.type==='null';
		self.allowObject = schema.type==='object';
		self.allowArray = schema.type==='array';
	}else if(Array.isArray(schema.type)){
		self.allowNumber = schema.type.indexOf('number')>=0 || schema.type.indexOf('integer')>=0;
		self.allowFraction = schema.type.indexOf('number')>=0;
		self.allowString = schema.type.indexOf('string')>=0;
		self.allowBoolean = schema.type.indexOf('boolean')>=0;
		self.allowNull = schema.type.indexOf('null')>=0;
		self.allowObject = schema.type.indexOf('object')>=0;
		self.allowArray = schema.type.indexOf('array')>=0;
	}else{
		throw new Error('Unexpected value for "type" keyword (expected string or array)');
	}
	self.allowedTypes = [];


	// Object

	self.required = {};
	self.requiredLength = 0;
	if(schema.required !== undefined){
		if(Array.isArray(schema.required)){
			schema.required.forEach(function(k){
				self.required[k] = null;
				self.requiredLength++;
			});
		}else{
			throw new Error('Expected array for `required`');
		}
	}

	self.properties = {};
	if(schema.properties!==undefined){
		for(const k in schema.properties){
			const subschema = schema.properties[k];
			if(isSchema(subschema)){
				self.properties[k] = self.registry.resolve(self.id, subschema);
			}else{
				throw new Error('Expected a schema for properties[k]');
			}
		}
	}

	self.patternProperties = {};
	self.patternPropertiesRegExp = {};
	if(schema.patternProperties!==undefined){
		for(const k in schema.patternProperties){
			const subschema = schema.patternProperties[k];
			if(isSchema(subschema)){
				self.patternProperties[k] = self.registry.resolve(self.id, subschema);
				self.patternPropertiesRegExp[k] = new RegExp(k);
			}else{
				throw new Error('Expected a schema for patternProperties[k]');
			}
		}
	}

	self.additionalProperties = null;
	if(schema.additionalProperties!==undefined){
		if(isSchema(schema.additionalProperties)){
			self.additionalProperties = self.registry.resolve(self.id, schema.additionalProperties);
		}else{
			throw new Error('Expected a schema for additionalProperties');
		}
	}

	self.minProperties = null;
	if(schema.minProperties !== undefined){
		if(typeof schema.minProperties === 'number' && schema.minProperties%1===0 && schema.minProperties >= 0){
			self.minProperties = schema.minProperties;
		}else{
			throw new Error('`minProperties` must be an non-negative integer');
		}
	}

	self.maxProperties = null;
	if(schema.maxProperties !== undefined){
		if(typeof schema.maxProperties === 'number' && schema.maxProperties%1===0 && schema.maxProperties >= 0){
			self.maxProperties = schema.maxProperties;
		}else{
			throw new Error('`maxProperties` must be non-negative integer');
		}
	}

	//self.propertyNameSchema = null;


	// Array

	self.itemValues = null;
	self.sequence = [null];
	self.additionalItems = null;
	if(Array.isArray(schema.items)){
		schema.items.forEach(function(s2, i){
			self.sequence[i] = self.registry.resolve(self.id, s2);
		});
		if(isSchema(schema.additionalItems)){
			self.additionalItems = self.registry.resolve(self.id, schema.additionalItems);
		}
	}else if(isSchema(schema.items)){
		self.itemValues = self.registry.resolve(self.id, schema.items);
	}
	self.minItems = null;
	if(schema.minItems !== undefined){
		if(typeof schema.minItems === 'number' && schema.minItems%1===0 && schema.minItems >= 0){
			self.minItems = schema.minItems;
		}else{
			throw new Error('`minItems` must be an a non-negative integer');
		}
	}
	self.maxItems = null;
	if(schema.maxItems !== undefined){
		if(typeof schema.maxItems === 'number' && schema.maxItems%1===0 && schema.maxItems >= 0){
			self.maxItems = schema.maxItems;
		}else{
			throw new Error('`maxItems` must be a non-negative integer');
		}
	}
	self.contains = [];


	// String

	self.minLength = null;
	if(schema.minLength !== undefined){
		if(typeof schema.minLength === 'number' && schema.minLength%1===0 && schema.minLength >= 0){
			self.minLength = schema.minLength;
		}else{
			throw new Error('`minLength` must be an a non-negative integer');
		}
	}

	self.maxLength = null;
	if(schema.maxLength !== undefined){
		if(typeof schema.maxLength === 'number' && schema.maxLength%1===0 && schema.maxLength >= 0){
			self.maxLength = schema.maxLength;
		}else{
			throw new Error('`maxLength` must be a non-negative integer');
		}
	}

	self.pattern = null;
	self.patternRegExp = null;
	if(schema.pattern !== undefined){
		if(typeof schema.pattern === 'string'){
			self.pattern = schema.pattern;
			self.patternRegExp = new RegExp(schema.pattern);
		}else{
			throw new Error('`pattern` must be a string');
		}
	}
	

	// Number

	self.maximum = null;
	if(schema.maximum!==undefined){
		if(typeof schema.maximum !== 'number'){
			throw new Error('maximum must be a number');
		}else{
			self.maximum = schema.maximum;
		}
	}

	self.exclusiveMaximum = null;
	if(schema.exclusiveMaximum!==undefined){
		if(typeof schema.exclusiveMaximum !== 'number'){
			throw new Error('exclusiveMaximum must be a number');
		}else{
			self.exclusiveMaximum = schema.exclusiveMaximum;
		}
	}

	self.minimum = null;
	if(schema.minimum!==undefined){
		if(typeof schema.minimum !== 'number'){
			throw new Error('minimum must be a number');
		}else{
			self.minimum = schema.minimum;
		}
	}

	self.exclusiveMinimum = null;
	if(schema.exclusiveMinimum!==undefined){
		if(typeof schema.exclusiveMinimum !== 'number'){
			throw new Error('exclusiveMinimum must be a number');
		}else{
			self.exclusiveMinimum = schema.exclusiveMinimum;
		}
	}

	self.multipleOf = null;
	if(schema.multipleOf!==undefined){
		if(typeof schema.multipleOf !== 'number'){
			throw new Error('multipleOf must be a positive number');
		}else if(schema.multipleOf <= 0){
			throw new Error('multipleOf must be a positive number');
		}else{
			self.multipleOf = schema.multipleOf;
		}
	}

	// "const"
	self.constType = undefined; // stores expected type for matching const
	self.constValue = undefined;
	self.constLength = undefined; // stores expected number of properties/items
	self.constSchema = undefined;
	if(schema.const !== undefined){
		self.const = schema.const;
		if(Array.isArray(schema.const)){
			self.constType = 'array';
			self.constLength = schema.const.length;
			self.constSchema = new Schema(self.id+'/const', {items: schema.const.map(function(item){
				return {const: item};
			})});
		}else if(schema.const && typeof schema.const==='object'){
			self.constType = 'object';
			const keys = Object.keys(schema.const);
			self.constLength = keys.length;
			const properties = {};
			keys.forEach(function(key){
				properties[key] = {const: schema.const[key]};
			});
			self.constSchema = new Schema(self.id+'/const', {properties: properties});

			keys.forEach(function(key){
				const value = schema.const[key];
				if(!self.properties[key]) self.properties[key] = new Schema(self.id+'/'+key, {const: value}, self.registry);
			});
		}else if(typeof schema.const==='boolean'){
			self.constType = 'boolean';
		}else if(typeof schema.const==='string'){
			self.constType = 'string';
			self.constLength = schema.const.length;
		}else if(typeof schema.const==='number'){
			self.constType = 'number';
		}else if(schema.const===null){
			self.constType = 'null';
		}else{
			throw new Error('Assertion error: Unkown const type');
		}
	}

	// $ref
	if(schema.$ref !== undefined){
		if(typeof schema.$ref === 'string'){
			self.$ref = uriResolve(self.id, schema.$ref);
		}else{
			throw new Error("Expected $ref to provide a string URI Reference");
		}
	}
}


Schema.prototype.createParser = function createParser(options){
	return new Parse.StreamParser(this, options);
};

// Create a state for validating an instance.
// If `errors` is supplied, errors will be pushed to that array instead.
Schema.prototype.validate = function validate(errors) {
	//return [new ValidateLayer(this, errors)];
	const schema = this;
	return new ValidateLayer(schema, errors).getAll();
};

Schema.prototype.exportRules = function exportRules(){
	const schema = this;
	if(this.validators) return this.validators;
	const validators = {
		Finish: [],
		StartObject: [],
		EndKey: [],
		ValidateProperty: [],
		EndObject: [],
		StartArray: [],
		ValidateItem: [],
		EndArray: [],
		StartString: [],
		EndString: [],
		StartNumber: [],
		EndNumber: [],
		StartBoolean: [],
		EndBoolean: [],
		StartNull: [],
	};

	// General


	// Object
	if(schema.allowObject===false){
		validators.StartObject.push(function testTypeObject(layer){
			return new ValidationError(expectedType('object', schema.allowedTypes), layer, schema, 'type', schema.allowedTypes, 'object');
		});
	}
	if(typeof schema.minProperties=='number'){
		validators.EndObject.push(function testMinProperties(layer){
			const length = layer.length;
			if(length < schema.minProperties) return new ValidationError('Too few properties', layer, schema, 'minProperties', schema.minProperties, length);
		});
	}
	if(typeof schema.maxProperties=='number'){
		validators.EndObject.push(function testMaxProperties(layer){
			const length = layer.length;
			if(length > schema.maxProperties) return new ValidationError('Too many properties', layer, schema, 'maxProperties', schema.maxProperties, length);
		});
	}
	if(typeof schema.constLength=='number'){
		validators.EndObject.push(function constLength(layer){
			const length = layer.length;
			// TODO specialize this type to distinguish this from other violations of "const" (e.g. wrong type)
			if(length !== schema.constLength) return new ValidationError('Incorrect number of properties', layer, schema, 'const', schema.constLength, length);
		});
	}
	if(schema.requiredLength){
		validators.EndObject.push(function testRequired(layer){
			if(this.requiredRemain) return new ValidationError('Required property missing', layer, schema, 'required', 0, this.requiredRemain);
		});
	}

	// Array
	if(schema.allowArray===false){
		validators.StartArray.push(function testTypeArray(layer){
			return new ValidationError(expectedType('array', schema.allowedTypes), layer, schema, 'type', schema.allowedTypes, 'array');
		});
	}
	if(schema.constType){
		validators.StartArray.push(function testTypeArray(layer){
			if(schema.constType!=='array') return (new ValidationError('Unexpected array', layer, schema, 'const', schema.constType, 'array'));
		});
	}
	if(schema.itemValues){
		validators.EndArray.push(function testTypeArray(layer){
			const length = layer.length;
			if(length < schema.minItems) return (new ValidationError('Too few items', layer, schema, 'minItems', schema.minItems, length));
		});
	}
	if(schema.sequence){
		validators.EndArray.push(function testTypeArray(layer){
			const length = layer.length;
			if(length < schema.minItems) return (new ValidationError('Too few items', layer, schema, 'minItems', schema.minItems, length));
		});
	}

	if(typeof schema.minItems=='number'){
		validators.EndArray.push(function testTypeArray(layer){
			const length = layer.length;
			if(length < schema.minItems) return (new ValidationError('Too few items', layer, schema, 'minItems', schema.minItems, length));
		});
	}
	if(typeof schema.maxItems=='number'){
		validators.EndArray.push(function testTypeArray(layer){
			const length = layer.length;
			if(length > schema.maxItems) return (new ValidationError('Too many items', layer, schema, 'maxItems', schema.maxItems, length));
		});
	}
	if(typeof schema.constLength=='number'){
		validators.EndArray.push(function testTypeArray(layer){
			const length = layer.length;
			// TODO specialize this type to distinguish this from other violations of "const" (e.g. wrong type)
			if(length !== schema.constLength) return (new ValidationError('Incorrect number of properties', layer, schema, 'const', schema.constLength, length));
		});
	}

	// String
	if(schema.allowString===false){
		const rule = function testTypeString(layer){
			return new ValidationError(expectedType('string', schema.allowedTypes), layer, schema, 'type', schema.allowedTypes, 'string');
		};
		validators.StartString.push(rule);
	}
	if(typeof schema.minLength=='number'){
		validators.EndString.push(function testMinLength(layer){
			if(layer.length < schema.minLength) return new ValidationError('String too short', layer, schema, 'minLength', schema.minLength, layer.length);
		});
	}
	if(typeof schema.maxLength=='number'){
		validators.EndString.push(function testMaxLength(layer){
			if(layer.length > schema.maxLength) return new ValidationError('String too long', layer, schema, 'maxLength', schema.maxLength, layer.length);
		});
	}
	if(schema.patternRegExp){
		validators.EndString.push(function testPattern(layer, str){
			if(!schema.patternRegExp.test(str)) return new ValidationError('String does not match /'+schema.pattern+'/', layer, schema, 'pattern', schema.pattern);
		});
	}

	// Number
	if(schema.allowNumber===false){
		validators.StartNumber.push(function number(layer){
			return new ValidationError(expectedType('number', schema.allowedTypes), layer, schema, 'type', schema.allowedTypes, 'number');
		});
	}
	if(typeof schema.exclusiveMinimum=='number'){
		validators.EndNumber.push(function exclusiveMinimum(layer, n){
			if(n<=schema.exclusiveMinimum) return new ValidationError('Number under minimum', layer, schema, 'exclusiveMinimum', schema.exclusiveMinimum, n);
		});
	}
	if(typeof schema.minimum=='number'){
		validators.EndNumber.push(function minimum(layer, n){
			if(n < schema.minimum) return new ValidationError('Number under/equal to minimum', layer, schema, 'minimum', schema.minimum, n);
		});
	}
	if(typeof schema.exclusiveMaximum=='number'){
		validators.EndNumber.push(function exclusiveMaximum(layer, n){
			if(n>=schema.exclusiveMaximum) return new ValidationError('Number under maximum', layer, schema, 'exclusiveMaximum', schema.exclusiveMaximum, n);
		});
	}
	if(typeof schema.maximum=='number'){
		validators.EndNumber.push(function maximum(layer, n){
			if(n > schema.maximum) return new ValidationError('Number under/equal to maximum', layer, schema, 'maximum', schema.maximum, n);
		});
	}
	if(typeof schema.multipleOf=='number'){
		validators.EndNumber.push(function multipleOf(layer, n){
			if(n / schema.multipleOf % 1) return (new ValidationError('Number not multiple of', layer, schema, 'multipleOf', schema.multipleOf, n));
		});
	}
	if(schema.allowFraction===false){
		validators.EndNumber.push(function testTypeInteger(layer, n){
			if(n%1) return (new ValidationError('Expected an integer', layer, schema, 'type', schema.type, 'integer'));
		});
	}
	if(typeof schema.const=='number'){
		validators.EndNumber.push(function testConst(layer, n){
			if(schema.const!==n) return (new ValidationError('const number mismatch', layer, schema, 'const', schema.constLength, n));
		});
	}

	// Boolean
	if(schema.allowBoolean===false){
		validators.StartBoolean.push(function testTypeBoolean(layer){
			return new ValidationError(expectedType('boolean', schema.allowedTypes), layer, schema, 'type', schema.allowedTypes, 'boolean');
		});
	}
	if(schema.const!==undefined){
		validators.StartBoolean.push(function testTypeBoolean(layer, instance){
			if(schema.const!==instance) return (new ValidationError('const mismatch', layer, schema, 'const', schema.constType, schema.const));
		});
	}

	// Null
	if(schema.allowNull===false){
		validators.StartNull.push(function testTypeNull(layer){
			return new ValidationError(expectedType('null', schema.allowedTypes), layer, schema, 'type', schema.allowedTypes, 'null');
		});
	}

	return validators;
};

function expectedType(actual, allowedTypes){
	if(allowedTypes.length===0) return "Unexpected "+actual+": No value allowed";
	if(allowedTypes.length===1) return "Unexpected "+actual+": Expected "+allowedTypes[0];
	return "Unexpected "+actual+": Expected one of "+allowedTypes.join(', ');
}

Schema.stringTestPattern = function stringTestPattern(pattern, layer, instance){
	if (!instance.match(pattern)) {
		return new ValidationError('String does not match pattern', layer , this, 'pattern', pattern, instance);
	}
};

// Stores information about this instance for parsing the given schema
module.exports.ValidateLayer = ValidateLayer;
function ValidateLayer(schema, errors){
	const validator = this;
	if(!(schema instanceof Schema)) throw new Error('Expected `schema` to be a Schema');

	validator.schema = schema;

	const rules = schema.exportRules(validator);
	validator.validateFinish = rules.Finish;
	validator.validateStartObject = rules.StartObject;
	validator.validateEndKey = rules.EndKey;
	validator.validateNewProperty = rules.NewProperty;
	validator.validateEndObject = rules.EndObject;
	validator.validateStartArray = rules.StartArray;
	validator.validateNewItem = rules.NewItem;
	validator.validateEndArray = rules.EndArray;
	validator.validateStartString = rules.StartString;
	validator.validateEndString = rules.EndString;
	validator.validateStartNumber = rules.StartNumber;
	validator.validateEndNumber = rules.EndNumber;
	validator.validateStartBoolean = rules.StartBoolean;
	validator.validateEndBoolean = rules.EndBoolean;
	validator.validateStartNull = rules.StartNull;

	// Where to store errors
	// If `errors` is given, it probably points to `StreamParser#errors`
	if(errors){
		validator.errors = errors;
	}else{
		validator.errors = [];
	}

	// process required properties
	validator.requiredMap = {};
	validator.requiredRemain = 0;
	if(schema.requiredLength){
		for(const k in schema.required){
			validator.requiredMap[k] = false;
			validator.requiredRemain++;
		}
	}

	// process anyOf/oneOf/not
	// A set of schemas that anyOf/oneOf/not in turn depend on
	validator.side = [];
	// an array
	validator.allOf = schema.allOf.map(function(s){
		var subvalidator = new ValidateLayer(s, validator.errors);
		subvalidator.getAll().forEach(function(v){ validator.side.push(v); });
		return subvalidator;
	});
	// array of arrays
	validator.anyOf = schema.anyOf.map(function(arr){
		return arr.map(function(s){
			var subvalidator = new ValidateLayer(s);
			subvalidator.getAll().forEach(function(v){ validator.side.push(v); });
			return subvalidator;
		});
	});
	// another array of arrays
	validator.oneOf = schema.oneOf.map(function(arr){
		return arr.map(function(s){
			var subvalidator = new ValidateLayer(s);
			subvalidator.getAll().forEach(function(v){ validator.side.push(v); });
			return subvalidator;
		});
	});
	// just one array of not
	validator.not = schema.not.map(function(s){
		var subvalidator = new ValidateLayer(s);
		subvalidator.getAll().forEach(function(v){ validator.side.push(v); });
		return subvalidator;
	});
	// array of allowed literal values
	if(schema.enum) validator.enum = schema.enum.map(function(s){
		var subvalidator = new ValidateLayer(s);
		subvalidator.getAll().forEach(function(v){ validator.side.push(v); });
		return subvalidator;
	});
	// external reference to parse
	if(schema.$ref){
		const subschemaURI = uriResolve(schema.id, schema.$ref);
		const subschema = schema.registry.lookup(subschemaURI);
		if(!subschema) throw new Error('Could not lookup schema <'+subschemaURI+'>');
		const subvalidator = new ValidateLayer(subschema, validator.errors);
		subvalidator.getAll().forEach(function(v){ validator.side.push(v); });
		validator.$ref = subvalidator;
	}
}

ValidateLayer.prototype.getAll = function getAll() {
	var list = [this];
	this.side.forEach(function(v){ list.push(v); });
	this.allOf.forEach(function(v){ list.push(v); });
	this.anyOf.forEach(function(arr){ arr.forEach(function(v){ list.push(v); }); });
	this.oneOf.forEach(function(arr){ arr.forEach(function(v){ list.push(v); }); });
	this.not.forEach(function(v){ list.push(v); });
	if(this.enum) this.enum.forEach(function(v){ list.push(v); });
	if(this.$ref) list.push(this.$ref);
	return list;
};

ValidateLayer.prototype.addErrorList = function addErrorList(errs) {
	var self = this;
	if(errs){
		if(Array.isArray(errs)){
			errs.forEach(function(error){
				// `self.errors` might be a reference, so don't replace
				self.errors.push(error);
			});
		}else{
			self.errors.push(errs);
		}
	}
};

// look up the necessary sub-schemas to validate against a sub-instance
// (array item, object property key, or object property value)

ValidateLayer.prototype.initProperty = function initProperty(key){
	var self = this;
	// for(let i=0; i<self.validateNewProperty.length; i++){
	// 	self.addErrorList(self.validateNewProperty[i].call(self));
	// }
	var schema = self.schema;
	var patterns = [];
	if(schema.properties[key]){
		patterns.push(schema.properties[key]);
	}else if(schema.constType==='object'){
		this.addErrorList(new ValidationError('Unexpected property by const', self, schema, 'const', null, key));
	}
	for(var regexp in schema.patternPropertiesRegExp){
		if(schema.patternPropertiesRegExp[regexp].test(key)){
			patterns.push(schema.patternProperties[regexp]);
		}
	}
	if(patterns.length==0 && schema.additionalProperties) return schema.additionalProperties.validate(self.errors);
	if(patterns.length==1) return patterns[0].validate(self.errors);
	return collapseArray(patterns, function(v){ return v.validate(self.errors); });
};

ValidateLayer.prototype.initItem = function initItem(k){
	const self = this;
	// for(let i=0; i<self.validateNewItem.length; i++){
	// 	self.addErrorList(self.validateNewItem[i].call(self));
	// }
	var schema = self.schema;
	var patterns = [];
	if(schema.sequence && schema.sequence[k]){
		patterns.push(schema.sequence[k]);
		self.addErrorList();
	}else if(schema.additionalItems){
		patterns.push(schema.additionalItems);
	}
	if(schema.itemValues){
		patterns.push(schema.itemValues);
	}
	if(patterns.length==0) return [];
	if(patterns.length==1) return patterns[0].validate(self.errors);
	return collapseArray(patterns, function(v){ return v.validate(self.errors); });
};

ValidateLayer.prototype.getKeySchema = function getKeySchema(n){
	// TODO
	// return an array of ValidateLayers or something,
	// an item for every schema we want to validate against the upcoming object property
};

// Begin parsing an instance
ValidateLayer.prototype.startNumber = function startNumber(layer){
	const self = this;
	for(let i=0; i<self.validateStartNumber.length; i++){
		self.addErrorList(self.validateStartNumber[i].call(self, layer));
	}
};

ValidateLayer.prototype.startString = function startString(layer){
	const schema = this.schema;
	if(!schema.allowString){
		this.addErrorList(new ValidationError(expectedType('string', schema.allowedTypes), layer, schema, 'type', schema.allowedTypes, 'string'));
	}
	if(schema.constType && schema.constType!=='string'){
		this.addErrorList(new ValidationError('Unexpected string', layer, schema, 'const', schema.constType, 'string'));
	}
};

ValidateLayer.prototype.startBoolean = function startBoolean(layer){
	const schema = this.schema;
	if(!schema.allowBoolean){
		this.addErrorList(new ValidationError(expectedType('boolean', schema.allowedTypes), layer, schema, 'type', schema.allowedTypes, 'boolean'));
	}
	if(schema.constType && schema.constType!=='boolean'){
		this.addErrorList(new ValidationError('Unexpected boolean', layer, schema, 'const', schema.constType, 'boolean'));
	}
};

ValidateLayer.prototype.startNull = function startNull(layer){
	const schema = this.schema;
	if(!schema.allowNull){
		this.addErrorList(new ValidationError(expectedType('null', schema.allowedTypes), layer, schema, 'type', schema.allowedTypes, 'null'));
	}
	if(schema.constType && schema.constType!=='null'){
		this.addErrorList(new ValidationError('Unexpected null', layer, schema, 'const', schema.constType, 'null'));
	}
};

ValidateLayer.prototype.startObject = function startObject(layer){
	const self = this;
	const schema = this.schema;

	for(let i=0; i<self.validateStartObject.length; i++){
		self.addErrorList(self.validateStartObject[i].call(self, layer));
	}

	// If we're allowed to be an object, then index required properties
	for(var k in schema.required){
		if(!(k in self.requiredMap)){
			self.requiredMap[k] = false;
			self.requiredRemain++;
		}
	}
};

ValidateLayer.prototype.startArray = function startArray(layer){
	const self = this;
	for(let i=0; i<self.validateStartArray.length; i++){
		self.addErrorList(self.validateStartArray[i].call(self, layer));
	}
};

ValidateLayer.prototype.endNumber = function endNumber(layer, n){
	const self = this;
	for(let i=0; i<self.validateEndNumber.length; i++){
		self.addErrorList(self.validateEndNumber[i].call(self, layer, n));
	}
};

ValidateLayer.prototype.endString = function endString(layer, instance){
	const self = this;
	for(let i=0; i<self.validateEndString.length; i++){
		self.addErrorList(self.validateEndString[i].call(self, layer, instance));
	}
};

ValidateLayer.prototype.endBoolean = function endBoolean(layer, instance){
	const self = this;
	for(let i=0; i<self.validateEndBoolean.length; i++){
		self.addErrorList(self.validateEndBoolean[i].call(self, layer, instance));
	}
};

ValidateLayer.prototype.endObject = function endObject(layer, instance){
	const self = this;
	for(let i=0; i<self.validateEndObject.length; i++){
		self.addErrorList(self.validateEndObject[i].call(self, layer, instance));
	}

};

ValidateLayer.prototype.endArray = function endArray(layer, n){
	const self = this;
	for(let i=0; i<self.validateEndArray.length; i++){
		self.addErrorList(self.validateEndArray[i].call(self, layer));
	}
};

ValidateLayer.prototype.endKey = function endKey(k){
	if(this.requiredMap[k]===false){
		this.requiredMap[k] = true;
		this.requiredRemain--;
	}
	//if(this.schema.propertyName){
	// ...
	//}
};

ValidateLayer.prototype.finish = function finish(layer){
	const self = this;
	const schema = this.schema;

	// Trigger finish on child validators
	self.allOf.forEach(function(v){ v.finish(layer); });
	if(self.$ref) self.$ref.finish(layer);
	self.anyOf.forEach(function(arr){ arr.forEach(function(v){ v.finish(layer); }); });
	self.oneOf.forEach(function(arr){ arr.forEach(function(v){ v.finish(layer); }); });
	self.not.forEach(function(v){ v.finish(layer); });
	if(self.enum) self.enum.forEach(function(v){ v.finish(layer); });
	// TODO add if/then/else schemas here

	// Compute required properties errors
	if(schema.requiredRemain){
		const missing = Object.keys(schema.requiredMap).filter(function(k){
			return !schema.requiredMap[k];
		});
		self.addErrorList(new ValidationError('Required properties missing: '+JSON.stringify(missing), layer, schema, 'required'));
	}

	if(schema.constRemain){
		// FIXME is this right? This can't be right
		const missing = Object.keys(schema.requiredMap).filter(function(k){
			return !schema.requiredMap[k];
		});
		self.addErrorList(new ValidationError('Required properties missing: '+JSON.stringify(missing), layer, schema, 'required'));
	}

	// "const"
	const notFailures = self.not.filter(function(v){ return v.errors.length===0; });
	if(notFailures.length){
		self.addErrorList(new ValidationError('Expected "not" to fail', layer, this, 'not'));
	}

	// allOf and $ref don't need entries here because they add errors directly to this instance's error list

	// oneOf
	self.oneOf.forEach(function(arr){
		const oneOfValid = arr.filter(function(v){ return v.errors.length===0; });
		if(oneOfValid.length!==1){
			self.addErrorList(new ValidationError('Expected "oneOf" to have exactly one matching schema', layer, self, 'oneOf', 1, oneOfValid.length));
		}
	});

	// anyOf
	self.anyOf.forEach(function(arr){
		const anyOfValid = arr.filter(function(v){ return v.errors.length===0; });
		if(anyOfValid.length===0){
			self.addErrorList(new ValidationError('Expected "anyOf" to have at least one matching schema', layer, self, 'anyOf', 1, anyOfValid.length));
		}
	});

	// enum
	if(self.enum){
		const enumValid = self.enum.filter(function(v){ return v.errors.length===0; });
		if(enumValid.length===0){
			self.addErrorList(new ValidationError('Expected "enum" to have at least one matching value', layer, self, 'enum', 1, enumValid.length));
		}
	}

};
