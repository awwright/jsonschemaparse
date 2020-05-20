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

module.exports.Annotation = Annotation;
function Annotation(value, layer, schema, keyword){
	this.value = value;
	this.path = layer.path;
	this.layer = layer;
	this.position = {line:layer.beginLine, column:layer.beginColumn};
	this.to = {line:layer.endLine, column:layer.endColumn};
	//this.schema = schema;
	this.schemaId = schema.id;
	this.keyword = keyword;
}

module.exports.isSchema = isSchema;
function isSchema(s){
	// Is an object, but not an array, and not a schema reference with $ref
	// Also a boolean is also a valid schema
	return (typeof s=='object' && !Array.isArray(s)) || (typeof s=='boolean');
}

function isObject(v){
	return v && typeof v==='object' && !Array.isArray(v);
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
function buildPropertyPathFragment(keys){
	return keys.map(function(v){
		return '/'+encodeURIComponent(v);
	}).join('');
}

function addPath(paths, baseId, key){
	var subpath = {};
	// console.log('addPath', paths, key);
	if(typeof key === 'string'){
		for(var k in paths){
			subpath[k] = paths[k].concat([key]);
		}
	}
	if(typeof baseId === 'string' && !subpath[baseId]){
		subpath[baseId] = [key];
	}
	return subpath;
}

// Functions to register a schema from all of the following, if any:
// - the URI it was downloaded from

// Import is used when a schema is always available under the given URI
SchemaRegistry.prototype.import = function importSchema(id, schemaObject){
	// console.log(`import <${id}>`);
	const self = this;
	if(self.source[id]){
		const oldSchema = JSON.stringify(self.source[id]);
		const newSchema = JSON.stringify(schemaObject);
		if(oldSchema!==newSchema) throw new Error('Schema already defined: <'+id+'>');
		// At this point, this schema is already imported with an identical definition
	}
	if(this.parsed[id]){
		// console.log('Define '+id, schema);
		return this.parsed[id];
	}
	const schema = self.scanSchema(id, schemaObject);
	if(!(schema instanceof Schema)) throw new Error('scanSchema returned unexpected');
	this.source[id] = schemaObject;
	this.parsed[id] = schema;
	return schema;
};

SchemaRegistry.prototype.scan = function scan(schemaObject, base){
	return this.scanSchema(base || schemaObject.$id, schemaObject);
};

// Add a schema to the Registry
// Registered under:
// - The $id that it declares, if any
// - The $anchor that it declares, if any
SchemaRegistry.prototype.scanSchema = function scanSchema(base, schemaObject, paths){
	const self = this;
	const idList = [];
	paths = paths || {};
	if(schemaObject===undefined) return;
	if(typeof base !== 'string') throw new Error('Argument `base` must be a string');
	// const schemaId = base + ( (paths[base] && paths[base].length) ? ('#'+buildPropertyPathFragment(paths[base])) : '' );
	const schemaId = base + '#' + (paths[base]?buildPropertyPathFragment(paths[base]):'');
	const schema = new Schema(schemaId, schemaObject, self);
	const newSchema = JSON.stringify(schemaObject);
	// if `id` is a reference and not a full URI, and there's no base to resolve it against, then throw an error
	// Because a relative URI Reference needs a base to resolve against, and we don't want to assume one for the application
	// the schema's id, as an unresolved URI Reference
	if(typeof base !== 'string') throw new Error('Expected a string `base` argument');
	var idRef = schemaObject.$id || schemaObject.id;
	if(idRef){
		var fullId = uriResolve(base, idRef);
		// const baseId = fullId.split('#',1)[0];
		// const anchor = fullId.substring(baseId.length+1);
	}
	if(schemaObject.$anchor){
		fullId = uriResolve(fullId || base, '#'+schemaObject.$anchor);
	}
	if(fullId){
		idList.push(fullId);
	}
	idList.forEach(function(id){
		if(self.source[id]){
			const oldSchema = JSON.stringify(self.source[id]);
			if(oldSchema!==newSchema) throw new Error('Schema already defined: <'+id+'>');
			// At this point, this schema is already imported with an identical definition
		}
	});
	idList.forEach(function(id){
		if(!self.source[id]) self.source[id] = schemaObject;
		if(!self.parsed[id]) self.parsed[id] = schema;
	});
	return schema;
};

SchemaRegistry.prototype.scanMap = function scanMap(base, dict, paths){
	if(!dict || typeof dict!=='object' || Array.isArray(dict)){
		throw new Error('Expected schema at <'+base+'#'+(paths[base]||'')+'> to be an object');
	}
	const self = this;
	const map = {};
	for(var n in dict){
		const subschema = dict[n];
		if(typeof subschema!=='boolean' && (!subschema || typeof subschema!=='object' || Array.isArray(subschema))){
			throw new Error('Expected schema at <'+base+'#'+(paths[base]||'')+'> to be an object');
		}
		map[n] = self.scanSchema(base, subschema, addPath(paths, base, n));
	}
	return map;
};

SchemaRegistry.prototype.scanList = function scanList(base, schemaList, paths){
	const self = this;
	// rewrite all this
	if(!Array.isArray(schemaList)){
		throw new Error('Expected schema at <'+base+'#'+(paths[base]||'')+'> to be an array');
	}
	return schemaList.map(function(schemaObject, i){
		return self.scanSchema(base, schemaObject, addPath(paths, base, i.toString()));
	});
};

SchemaRegistry.prototype.lookup = function lookup(id){
	const self = this;
	if(typeof id!=='string') throw new Error('`id` must be a string');
	// Trim trailing fragment
	if(id[id.length-1]==='#') id = id.substring(0, id.length-1);

	// Return an already existing Schema
	if(self.parsed[id]){
		return self.parsed[id];
	}
	// Try to parse the Schema at its defined URI
	if(self.source[id]){
		self.parsed[id] = new Schema(id, self.source[id], self);
		return self.parsed[id];
	}

	const idBase = id.split('#', 1)[0];
	const idFrag = id.substring(idBase.length + 1);

	// Try to decend the property path, if any
	if(self.source[idBase] && idFrag && idFrag[0]==='/'){
		var resolved = self.source[idBase] || self.source[idBase + '#'];
		var path = [];
		if(!resolved) throw new Error('Could not resolve schema '+JSON.stringify(idBase));
		var hier = self.resolveFragment(idFrag);
		for(var i=0; i<hier.length; i++){
			var key = hier[i];
			path.push(key);
			resolved = resolved[key];
			if(resolved===undefined) throw new Error('Could not resolve schema <'+idBase + '#' + buildPropertyPathFragment(path)+'>');
		}
		// const resolvedUri = idBase + '#' + buildPropertyPathFragment(path);
		if(self.parsed[id]){
			throw new Error('Assertion fail: schema already defined');
		}
		self.source[id] = resolved;
		self.parsed[id] = self.scanSchema(id, resolved);
		return self.parsed[id];
	}
	throw new Error(`Could not resolve schema <${id}>`);
};

SchemaRegistry.prototype.resolve = function resolve(base, schema){
	const self = this;
	if(typeof base!=='string' || base.indexOf(':')===-1) throw new Error('`base` must be a URI string');
	if(isSchema(schema)){
		return new Schema(base, schema, self);
	}else{
		throw new Error('Expected a schema (object or boolean)');
	}
};

SchemaRegistry.prototype.getUnresolved = function(){
	const self = this;
	return Object.keys(self.seen)
		.filter(function(v){ return !self.source[v]; });
};

// Represents a complete JSON Schema and its keywords
module.exports.Schema = Schema;
function Schema(id, schema, registry){
	// console.log('Schema', id);
	const self = this;
	self.id = id;
	const paths = [];

	// Core
	self.allOf = [];
	if(Array.isArray(schema.allOf)){
		self.allOf = registry.scanList(self.id, schema.allOf, addPath(paths, self.id, 'allOf'));
	}else if(schema.allOf !== undefined){
		throw new Error('Expected `allOf` to be an array of schemas');
	}

	self.anyOf = [];
	if(Array.isArray(schema.anyOf)){
		self.anyOf = [ registry.scanList(self.id, schema.anyOf, addPath(paths, self.id, 'anyOf')) ];
	}else if(schema.anyOf !== undefined){
		throw new Error('Expected `anyOf` to be an array of schemas');
	}

	self.oneOf = [];
	if(schema.oneOf){
		self.oneOf = [ registry.scanList(self.id, schema.oneOf, addPath(paths, self.id, 'oneOf')) ];
	}else if(schema.oneOf !== undefined){
		throw new Error('Expected `oneOf` to be an array of schemas');
	}

	self.not = [];
	if(isSchema(schema.not)){
		self.not =  [ registry.scanSchema(self.id, schema.not, addPath(paths, self.id, 'not')) ];
	}else if(schema.not !== undefined){
		throw new Error('Expected `not` to be a schema');
	}

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
	const idref = schema.$id || schema.id;
	if(typeof idref === 'string'){
		self.id = uriResolve(self.id, idref);
		if(!self.id) throw new Error('Expected schema to have an id');
	}

	// General

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
	if(self.allowArray) self.allowedTypes.push("array");
	if(self.allowObject) self.allowedTypes.push("object");
	if(self.allowString) self.allowedTypes.push("string");
	if(self.allowNumber) self.allowedTypes.push("number");
	if(self.allowBoolean) self.allowedTypes.push("boolean");
	if(self.allowNull) self.allowedTypes.push("null");


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
	if(schema.properties){
		self.properties = registry.scanMap(self.id, schema.properties, addPath(paths, self.id, 'properties'));
	}

	self.patternProperties = {};
	self.patternPropertiesRegExp = {};
	if(isObject(schema.patternProperties)){
		for(const k in schema.patternProperties){
			self.patternPropertiesRegExp[k] = new RegExp(k);
		}
		self.patternProperties = registry.scanMap(self.id, schema.patternProperties, addPath(paths, self.id, 'patternProperties'));
	}else if(schema.patternProperties !== undefined){
		throw new Error('Expected `patternProperties` to be an object (string->schema map)');
	}


	self.additionalProperties = null;
	if(isSchema(schema.additionalProperties)){
		self.additionalProperties = registry.scanSchema(self.id, schema.additionalProperties, addPath(paths, self.id, 'additionalProperties'));
	}else if(schema.additionalProperties !== undefined){
		throw new Error('Expected `additionalProperties` to be a schema (object or boolean)');
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

	self.sequence = [];
	self.additionalItems = null;
	if(Array.isArray(schema.items)){
		self.sequence = registry.scanList(self.id, schema.items, addPath(paths, self.id, 'items'));
		if(schema.additionalItems !== undefined){
			self.additionalItems = registry.scanSchema(self.id, schema.additionalItems, addPath(paths, self.id, 'additionalItems'));
		}else if(schema.additionalItems !== undefined){
			throw new Error('Expected `additionalItems` to be a schema (object or boolean)');
		}
	}else if(isSchema(schema.items)){
		self.additionalItems = registry.scanSchema(self.id, schema.items, addPath(paths, self.id, 'items'));
	}else if(schema.items !== undefined){
		throw new Error('Expected `items` to be a schema or array of schemas (object or boolean)');
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
	if(typeof schema.$ref === 'string'){
		self.$ref = uriResolve(self.id, schema.$ref);
	}else if(schema.$ref !== undefined){
		throw new Error("Expected $ref to provide a string URI Reference");
	}

	if(typeof schema.$ref === 'string'){
		const refUri = uriResolve(self.id, schema.$ref);
		if(!registry.seen[refUri]){
			registry.seen[refUri] = schema;
			registry.pending.push([refUri, schema]);
		}
	}else if(schema.$ref !== undefined){
		throw new Error('Expected $ref to be a string');
	}


	// $recursiveRef
	if(typeof schema.$recursiveRef === 'string'){
		self.$recursiveRef = uriResolve(self.id, schema.$recursiveRef);
	}else if(schema.$recursiveRef !== undefined){
		throw new Error("Expected $recursiveRef to provide a string URI Reference");
	}

	// No-op
	if(isObject(schema.definitions)){
		self.definitions = registry.scanMap(self.id, schema.definitions, addPath(paths, self.id, 'definitions'));
	}else if(schema.definitions !== undefined){
		throw new Error('Expected `definitions` to be an object (string->schema map)');
	}
	if(schema.$defs){
		self.$defs = registry.scanMap(self.id, schema.$defs, addPath(paths, self.id, '$defs'));
	}

	// obsolete keywords
	if(schema.extends){
		self.extends = registry.scanSchema(self.id, schema.extends, addPath(paths, self.id, 'extends'));
	}
	if(schema.dependencies){
		self.dependencies = registry.scanMap(self.id, schema.dependencies, addPath(paths, self.id, 'dependencies'));
	}
	if(schema.disallow){
		self.disallow = registry.scanSchema(self.id, schema.disallow, addPath(paths, self.id, 'disallow'));
	}

	// Annotations
	if(schema.title !== undefined){
		self.title = schema.title;
	}
	if(schema.description !== undefined){
		self.description = schema.description;
	}

	const known = {
		$schema: null,
		$vocabulary: null, // unsupported
		$id: null,
		$anchor: null,
		$ref: null,
		$recursiveRef: null, // unsupported
		$recursiveAnchor: null, // unsupported
		$comment: null,
		$defs: null,
		additionalItems: null,
		additionalProperties: null,
		allOf: null,
		anchor: null,
		anyOf: null,
		const: null, // unsupported
		default: null,
		definitions: null,
		description: null, // annotate
		enum: null, // unsupported
		exclusiveMaximum: null,
		exclusiveMinimum: null,
		format: null,
		items: null,
		links: null,
		maxItems: null,
		maxLength: null,
		maxProperties: null,
		maximum: null,
		minItems: null,
		minLength: null,
		minProperties: null,
		minimum: null,
		multipleOf: null,
		not: null,
		oneOf: null,
		pattern: null,
		patternProperties: null,
		properties: null,
		propertyNames: null, // unsupported
		required: null,
		title: null, // annotate
		type: null,
		uniqueItems: null, // unsupported
	};
	self.unknown = [];
	for(const k in schema){
		if(!(k in known)) self.unknown.push(k);
		// if(!(k in known)) throw new Error("Unknown keyword: "+JSON.stringify(k));
	}
}

Schema.prototype.createParser = function createParser(options){
	return new Parse.StreamParser(this, options);
};

Schema.prototype.parse = function parse(text, options){
	if(options===undefined){
		options = {};
	}else if(typeof options==='function'){
		options = {reviver: options};
	}
	const opts = Object.assign({}, options, {
		parseValue: true,
		parseAnnotations: false,
		parseInfo: false,
		schema: this,
	});
	const parser = new Parse.StreamParser(opts);
	parser.parse(text);
	if(parser.errors && parser.errors.length){
		throw parser.errors[0];
	}
	return parser.value;
};

Schema.prototype.parseInfo = function parseInfo(text, options){
	if(options===undefined){
		options = {};
	}else if(typeof options==='function'){
		options = {reviver: options};
	}
	const opts = Object.assign({parseInfo: true}, options, {schema: this});
	const parser = new Parse.StreamParser(opts);
	return parser;
};

// Create a state for validating an instance.
// If `errors` is supplied, errors will be pushed to that array instead.
Schema.prototype.validate = function validate(root) {
	//return [new ValidateLayer(this, errors)];
	const schema = this;
	return new ValidateLayer(schema, root).getAll();
};

Schema.prototype.exportRules = function exportRules(){
	const schema = this;
	if(this.validators) return this.validators;
	const validators = {
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
		Finish: [],
		Annotations: [],
	};

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
	// TODO refactor this into an if(schema.allowNumber === true) {} else {}
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
	if(schema.allowNumber===true && schema.allowFraction===false){
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

	// Annotations
	if(schema.title){
		validators.Annotations.push(function collectTitle(layer){
			return new Annotation(schema.title, layer, schema, 'title');
		});
	}
	if(schema.description){
		validators.Annotations.push(function collectTitle(layer){
			return new Annotation(schema.description, layer, schema, 'description');
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
function ValidateLayer(schema, root){
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
	validator.validateAnnotations = rules.Annotations;

	// Where to store errors
	// If `root` is given, it probably points to the StreamParser
	if(root){
		validator.errors = root.errors;
		validator.annotations = root.annotations;
	}else{
		validator.errors = [];
		validator.annotations = [];
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
	// an array
	validator.allOf = schema.allOf.map(function(s){
		var subvalidator = new ValidateLayer(s, validator);
		return subvalidator;
	});
	// array of arrays
	validator.anyOf = schema.anyOf.map(function(arr){
		return arr.map(function(s){
			var subvalidator = new ValidateLayer(s);
			return subvalidator;
		});
	});
	// another array of arrays
	validator.oneOf = schema.oneOf.map(function(arr){
		return arr.map(function(s){
			var subvalidator = new ValidateLayer(s);
			return subvalidator;
		});
	});
	// just one array of not
	validator.not = schema.not.map(function(s){
		var subvalidator = new ValidateLayer(s);
		return subvalidator;
	});
	// array of allowed literal values
	if(schema.enum) validator.enum = schema.enum.map(function(s){
		var subvalidator = new ValidateLayer(s);
		return subvalidator;
	});
	// external reference to parse
	if(schema.$ref){
		const subschemaURI = schema.$ref;
		// const subschemaURI = uriResolve(schema.id, schema.$ref);
		const subschema = schema.registry.lookup(schema.$ref);
		if(!subschema) throw new Error('Could not lookup schema <'+subschemaURI+'>');
		const subvalidator = new ValidateLayer(subschema, validator);
		validator.$ref = subvalidator;
	}
}

// Return the set of validators that must receive parser events
ValidateLayer.prototype.getAll = function getAll() {
	var list = [this];
	this.allOf.forEach(function(v){ v.getAll().forEach(function(w){ list.push(w); }); });
	this.anyOf.forEach(function(arr){ arr.forEach(function(v){ v.getAll().forEach(function(w){ list.push(w); }); }); });
	this.oneOf.forEach(function(arr){ arr.forEach(function(v){ v.getAll().forEach(function(w){ list.push(w); }); }); });
	this.not.forEach(function(v){ v.getAll().forEach(function(w){ list.push(w); }); });
	if(this.enum) this.enum.forEach(function(v){ list.push(v); });
	if(this.$ref){ this.$ref.getAll().forEach(function(w){ list.push(w); }); }
	// console.log('getAll', this.schema.id, list.length);
	return list;
};

ValidateLayer.prototype.addErrorList = function addErrorList(errs) {
	const self = this;
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

ValidateLayer.prototype.addAnnotationList = function addAnnotationList(annotations) {
	const self = this;
	if(annotations){
		if(Array.isArray(annotations)){
			annotations.forEach(function(v){
				// `self.errors` might be a reference, so don't replace
				self.annotations.push(v);
			});
		}else{
			self.annotations.push(annotations);
		}
	}
};

// look up the necessary sub-schemas to validate against a sub-instance
// (array item, object property key, or object property value)

ValidateLayer.prototype.initProperty = function initProperty(key){
	const self = this;
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
	if(patterns.length==0 && schema.additionalProperties) return schema.additionalProperties.validate(self);
	if(patterns.length==1) return patterns[0].validate(self);
	return collapseArray(patterns, function(v){ return v.validate(self); });
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
	}else if(schema.additionalItems){
		patterns.push(schema.additionalItems);
	}
	if(patterns.length==0) return [];
	if(patterns.length==1) return patterns[0].validate(self);
	return collapseArray(patterns, function(v){ return v.validate(self); });
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
	if(self.$ref){
		self.$ref.finish(layer);
	}
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

	if(self.annotations && self.errors.length===0){
		for(let i=0; i<self.validateAnnotations.length; i++){
			self.addAnnotationList(self.validateAnnotations[i].call(self, layer));
		}
	}

};
