"use strict";

var url = require('url');
var uriResolve = url.resolve;

var { ValidationError } = require('./error.js');
var { Annotation } = require('./error.js');

module.exports.isSchema = isSchema;
function isSchema(s){
	// Is an object, but not an array, and not a schema reference with $ref
	// Also a boolean is also a valid schema
	return (s && typeof s=='object' && !Array.isArray(s)) || (typeof s=='boolean');
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
	// The set of schemas that we know about, and may or may not be defined
	this.seen = new Set;
	// URIs mapped to the original, unparsed object.
	this.source = {};
	// URIs mapped to Schema objects
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

	if(typeof schema.$recursiveRef === 'string'){
		self.$recursiveRef = schema.$recursiveRef;
	}else if(schema.$recursiveRef !== undefined){
		throw new Error("Expected $recursiveRef to provide a string URI Reference");
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
	return Array.from(self.seen)
		.filter(function(v){ return !self.source[v]; });
};

// Represents a complete JSON Schema and its keywords
module.exports.Schema = Schema;
function Schema(id, schema, registry){
	// console.log('Schema', id);
	const self = this;
	self.id = id;
	const paths = [];

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

	if(typeof id !== 'string'){
		throw new Error('Expected `id` to be a string');
	}
	if(id.indexOf('>')>=0 || id.indexOf(' ')>=0){
		throw new Error('Illegal character in `id`: '+id);
	}

	const idref = schema.$id || schema.id;
	if(typeof idref === 'string'){
		self.id = uriResolve(self.id, idref);
		if(!self.id) throw new Error('Expected schema to have an `id`');
	}

	if(!registry) registry = new SchemaRegistry;
	self.registry = registry;

	this.subschemas = [];
	this.allSubschemas = [];
	function addSubschema(v){
		self.subschemas.push(v);
		self.allSubschemas.push(v);
		v.allSubschemas.forEach(function(w){
			self.allSubschemas.push(w);
		});
	}

	// Core
	self.allOf = [];
	if(Array.isArray(schema.allOf)){
		self.allOf = registry.scanList(self.id, schema.allOf, addPath(paths, self.id, 'allOf'));
		self.allOf.forEach(addSubschema);
	}else if(schema.allOf !== undefined){
		throw new Error('Expected "allOf" to be an array of schemas');
	}

	self.anyOf = [];
	if(Array.isArray(schema.anyOf)){
		self.anyOf = [ registry.scanList(self.id, schema.anyOf, addPath(paths, self.id, 'anyOf')) ];
		self.anyOf[0].forEach(addSubschema);
	}else if(schema.anyOf !== undefined){
		throw new Error('Expected "anyOf" to be an array of schemas');
	}

	self.oneOf = [];
	if(Array.isArray(schema.oneOf)){
		self.oneOf = [ registry.scanList(self.id, schema.oneOf, addPath(paths, self.id, 'oneOf')) ];
		self.oneOf[0].forEach(addSubschema);
	}else if(schema.oneOf !== undefined){
		throw new Error('Expected "oneOf" to be an array of schemas');
	}

	self.not = [];
	if(isSchema(schema.not)){
		self.not = [ registry.scanSchema(self.id, schema.not, addPath(paths, self.id, 'not')) ];
		self.not.forEach(addSubschema);
	}else if(schema.not !== undefined){
		throw new Error('Expected "not" to be a schema');
	}

	// General

	const typeValues = [ 'number', 'integer', 'string', 'boolean', 'null', 'object', 'array' ];
	if(schema.type===undefined){
		self.allowNumber = self.allowFraction = self.allowString = self.allowBoolean = self.allowNull = self.allowObject = self.allowArray = true;
	}else if(typeof schema.type==='string'){
		if(typeValues.indexOf(schema.type) < 0){
			throw new Error('Unknown "type" value: '+JSON.stringify(schema.type));
		}
		self.allowNumber = schema.type==='number' || schema.type==='integer';
		self.allowFraction = schema.type==='number';
		self.allowString = schema.type==='string';
		self.allowBoolean = schema.type==='boolean';
		self.allowNull = schema.type==='null';
		self.allowObject = schema.type==='object';
		self.allowArray = schema.type==='array';
	}else if(Array.isArray(schema.type)){
		schema.type.forEach(function(v){
			if(typeValues.indexOf(v) < 0){
				throw new Error('Unknown "type" value: '+JSON.stringify(v));
			}
		});
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
	self.type = self.allowedTypes.length===1 ? self.allowedTypes[0] : self.allowedTypes;

	// Object

	if(Array.isArray(schema.required)){
		self.required = new Set;
		schema.required.forEach(function(k){
			if(typeof k !== 'string') throw new Error('Expected "required" to be an array of strings');
			self.required.add(k);
		});
	}else if(schema.required !== undefined){
		throw new Error('Expected array for "required"');
	}

	self.properties = {};
	if(schema.properties){
		self.properties = registry.scanMap(self.id, schema.properties, addPath(paths, self.id, 'properties'));
		Object.values(self.properties).forEach(addSubschema);
	}

	self.patternProperties = {};
	self.patternPropertiesRegExp = {};
	if(isObject(schema.patternProperties)){
		for(const k in schema.patternProperties){
			self.patternPropertiesRegExp[k] = new RegExp(k, 'u');
		}
		self.patternProperties = registry.scanMap(self.id, schema.patternProperties, addPath(paths, self.id, 'patternProperties'));
		Object.values(self.patternProperties).forEach(addSubschema);
	}else if(schema.patternProperties !== undefined){
		throw new Error('Expected `patternProperties` to be an object (string->schema map)');
	}


	self.additionalProperties = null;
	if(isSchema(schema.additionalProperties)){
		self.additionalProperties = registry.scanSchema(self.id, schema.additionalProperties, addPath(paths, self.id, 'additionalProperties'));
		addSubschema(self.additionalProperties);
	}else if(schema.additionalProperties !== undefined){
		throw new Error('Expected `additionalProperties` to be a schema (object or boolean)');
	}

	self.unevaluatedProperties = null;
	if(isSchema(schema.unevaluatedProperties)){
		self.unevaluatedProperties = registry.scanSchema(self.id, schema.unevaluatedProperties, addPath(paths, self.id, 'unevaluatedProperties'));
		addSubschema(self.unevaluatedProperties);
	}else if(schema.unevaluatedProperties !== undefined){
		throw new Error('Expected `unevaluatedProperties` to be a schema (object or boolean)');
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
		self.sequence.forEach(addSubschema);
		if(isSchema(schema.additionalItems)){
			self.additionalItems = registry.scanSchema(self.id, schema.additionalItems, addPath(paths, self.id, 'additionalItems'));
			addSubschema(self.additionalItems);
		}else if(schema.additionalItems !== undefined){
			throw new Error('Expected `additionalItems` to be a schema (object or boolean)');
		}
	}else if(isSchema(schema.items)){
		self.additionalItems = registry.scanSchema(self.id, schema.items, addPath(paths, self.id, 'items'));
		addSubschema(self.additionalItems);
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
			self.patternRegExp = new RegExp(schema.pattern, 'u');
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

	// "enum"
	// A schema with const for matching an object/array
	self.enumSchemas = null;
	// Optimization for matching a string/number/boolean/null
	self.enumLiterals = null;
	if(schema.enum && Array.isArray(schema.enum)){
		self.enumSchemas = []; // values expected if instance is object/array
		self.enumLiterals = new Set; // values expected if instance is string/number/boolean/null
		schema.enum.forEach(function(v){
			if(typeof v==='string' || typeof v==='number' || typeof v==='boolean' || v===null){
				self.enumLiterals.add(v);
			}else{
				self.enumSchemas.push(new Schema(id, {const: v}, self.registry));
			}
		});
	}else if(schema.enum !== undefined){
		throw new Error('enum must be an array');
	}

	// "const"
	self.constType = undefined; // stores expected type for matching const
	self.constValue = undefined; // expected value for string/number/boolean/null
	self.constLength = undefined; // stores expected number of properties/items
	self.constProperties = undefined;
	self.constItems = undefined;
	if(schema.const !== undefined){
		self.constValue = schema.const;
		if(Array.isArray(schema.const)){
			self.constType = 'array';
			self.constLength = schema.const.length;
			self.constItems = schema.const.map(function(item, i){
				return new Schema(self.id+'/const/'+i, {const: item}, self.registry);
			});
		}else if(schema.const && typeof schema.const==='object'){
			self.constType = 'object';
			const keys = Object.keys(schema.const);
			self.constLength = keys.length;
			self.constProperties = {};
			keys.forEach(function(key){
				self.constProperties[key] = new Schema(self.id+'/const/'+key, {const: schema.const[key]}, self.registry);
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
			throw new Error('Assertion error: Unknown const type');
		}
	}

	// if/then/else
	if(isSchema(schema.if)){
		self.if = registry.scanSchema(self.id, schema.if, addPath(paths, self.id, 'if'));
		addSubschema(self.if);
	}else if(schema.if !== undefined){
		throw new Error('`if` must be a schema`');
	}
	if(isSchema(schema.then)){
		self.then = registry.scanSchema(self.id, schema.then, addPath(paths, self.id, 'then'));
		addSubschema(self.then);
	}else if(schema.then !== undefined){
		throw new Error('`then` must be a schema`');
	}
	if(isSchema(schema.else)){
		self.else = registry.scanSchema(self.id, schema.else, addPath(paths, self.id, 'else'));
		addSubschema(self.else);
	}else if(schema.else !== undefined){
		throw new Error('`else` must be a schema`');
	}

	// $ref
	if(typeof schema.$ref === 'string'){
		self.$ref = uriResolve(self.id, schema.$ref);
	}else if(schema.$ref !== undefined){
		throw new Error("Expected $ref to provide a string URI Reference");
	}

	if(typeof schema.$ref === 'string'){
		const refUri = uriResolve(self.id, schema.$ref);
		// This won't do anything if `refUri` is already in the set
		registry.seen.add(refUri);
	}else if(schema.$ref !== undefined){
		throw new Error('Expected $ref to be a string');
	}

	// $recursiveRef
	if(typeof schema.$recursiveRef === 'string'){
		self.$recursiveRef = schema.$recursiveRef;
	}else if(schema.$recursiveRef !== undefined){
		throw new Error("Expected $recursiveRef to provide a string URI Reference");
	}
	if(schema.$recursiveAnchor === true){
		self.$recursiveAnchor = schema.$recursiveAnchor;
	}

	// No-op
	if(isObject(schema.definitions)){
		self.definitions = registry.scanMap(self.id, schema.definitions, addPath(paths, self.id, 'definitions'));
		Object.values(self.definitions).forEach(addSubschema);
	}else if(schema.definitions !== undefined){
		throw new Error('Expected `definitions` to be an object (string->schema map)');
	}
	if(isObject(schema.$defs)){
		self.$defs = registry.scanMap(self.id, schema.$defs, addPath(paths, self.id, '$defs'));
		Object.values(self.$defs).forEach(addSubschema);
	}else if(schema.definitions !== undefined){
		throw new Error('Expected `definitions` to be an object (string->schema map)');
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

	// Compute unknown keywords
	const known = {
		$schema: null,
		$vocabulary: null, // unsupported
		$id: null,
		$anchor: null,
		$ref: null,
		$recursiveRef: null,
		$recursiveAnchor: null,
		$comment: null,
		$defs: null,
		additionalItems: null,
		additionalProperties: null,
		unevaluatedProperties: null,
		allOf: null,
		anchor: null,
		anyOf: null,
		const: null,
		default: null,
		definitions: null,
		description: null, // annotate
		else: null,
		enum: null,
		exclusiveMaximum: null,
		exclusiveMinimum: null,
		format: null,
		if: null,
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
		then: null,
		title: null, // annotate
		type: null,
		uniqueItems: null, // unsupported
	};
	self.unknown = [];
	for(const k in schema){
		if(!(k in known)) self.unknown.push(k);
		// if(!(k in known)) throw new Error("Unknown keyword: "+JSON.stringify(k));
	}
	self.allUnknown = self.unknown.slice();
	self.allSubschemas.forEach(function(s){
		s.unknown.forEach(function(v){
			if(self.allUnknown.indexOf(v) < 0) self.allUnknown.push(v);
		});
	});

	// Compute references
	this.references = [];
	if(this.$ref){
		this.references.push(this.$ref);
	}
	this.allReferences = this.references.slice();
	self.allSubschemas.forEach(function(s){
		s.references.forEach(function(v){
			if(self.allReferences.indexOf(v) < 0) self.allReferences.push(v);
		});
	});

	self.validators = self.exportRules();
}

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
	// Arrays of functions
	// `this` in functions is a ValidateLayer
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
	if(schema.constType && schema.constType!=='object'){
		validators.StartObject.push(function testConstObject(layer){
			return new ValidationError(expectedType('object', [schema.constType]), layer, schema, 'const', schema.constType, 'object');
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
	if(schema.required){
		validators.StartObject.push(function testRequired(){
			this.requiredRemain = new Set(schema.required);
		});
		validators.EndObject.push(function testRequired(layer){
			if(this.requiredRemain.size) return new ValidationError('Required property missing', layer, schema, 'required', 0, this.requiredRemain.size);
		});
	}
	if(schema.enumSchemas){
		validators.EndObject.push(function testEnum(layer){
			const enumValid = this.enum.filter(function(v){ return v.errors.length===0; });
			if(enumValid.length===0){
				return new ValidationError('Expected "enum" to have one matching value', layer, this, 'enum', 1, enumValid.length);
			}
		});
	}

	// Array
	if(schema.allowArray===false){
		validators.StartArray.push(function testTypeArray(layer){
			return new ValidationError(expectedType('array', schema.allowedTypes), layer, schema, 'type', schema.allowedTypes, 'array');
		});
	}
	if(schema.constType && schema.constType!=='array'){
		validators.StartArray.push(function testConstArray(layer){
			return new ValidationError(expectedType('array', [schema.constType]), layer, schema, 'const', schema.constType, 'array');
		});
	}
	if(typeof schema.constLength=='number'){
		validators.EndArray.push(function constLength(layer){
			const length = layer.length;
			if(length !== schema.constLength) return new ValidationError('Incorrect number of items', layer, schema, 'const', schema.constLength, length);
		});
	}
	if(typeof schema.minItems=='number'){
		validators.EndArray.push(function testMinItems(layer){
			const length = layer.length;
			if(length < schema.minItems) return (new ValidationError('Too few items', layer, schema, 'minItems', schema.minItems, length));
		});
	}
	if(typeof schema.maxItems=='number'){
		validators.EndArray.push(function testMaxItems(layer){
			const length = layer.length;
			if(length > schema.maxItems) return (new ValidationError('Too many items', layer, schema, 'maxItems', schema.maxItems, length));
		});
	}
	if(schema.enumSchemas){
		validators.EndArray.push(function testEnum(layer){
			const enumValid = this.enum.filter(function(v){ return v.errors.length===0; });
			if(enumValid.length===0){
				return new ValidationError('Expected "enum" to have one matching value', layer, this, 'enum', 1, enumValid.length);
			}
		});
	}

	// String
	if(schema.allowString===false){
		const rule = function testTypeString(layer){
			return new ValidationError(expectedType('string', schema.allowedTypes), layer, schema, 'type', schema.allowedTypes, 'string');
		};
		validators.StartString.push(rule);
	}
	if(schema.constType && schema.constType!=='string'){
		validators.StartString.push(function testConstString(layer){
			return new ValidationError(expectedType('string', [schema.constType]), layer, schema, 'const', schema.constType, 'string');
		});
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
	if(schema.enumLiterals){
		validators.EndString.push(function testEnum(layer, str){
			if(!schema.enumLiterals.has(str)) return new ValidationError('String does not match one of the enumerated values', layer, schema, 'enum', schema.enumLiterals);
		});
	}
	if(schema.constValue !== undefined){
		validators.EndString.push(function testEnum(layer, str){
			if(schema.constValue!==str) return new ValidationError('String does not match constant', layer, schema, 'const', schema.constValue, str);
		});
	}

	// Number
	// TODO refactor this into an if(schema.allowNumber === true) {} else {}
	if(schema.allowNumber===false){
		validators.StartNumber.push(function number(layer){
			return new ValidationError(expectedType('number', schema.allowedTypes), layer, schema, 'type', schema.allowedTypes, 'number');
		});
	}
	if(schema.constType && schema.constType!=='number'){
		validators.StartNumber.push(function testConstNumber(layer){
			return new ValidationError(expectedType('number', [schema.constType]), layer, schema, 'const', schema.constType, 'number');
		});
	}
	if(schema.constValue !== undefined){
		validators.EndNumber.push(function testConst(layer, n){
			if(schema.constValue!==n) return (new ValidationError('const number mismatch', layer, schema, 'const', schema.constValue, n));
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
	if(schema.enumLiterals){
		validators.EndNumber.push(function testEnum(layer, n){
			if(!schema.enumLiterals.has(n)) return new ValidationError('Number does not match one of the enumerated values', layer, schema, 'enum', schema.enumLiterals);
		});
	}

	// Boolean
	if(schema.allowBoolean===false){
		validators.StartBoolean.push(function testTypeBoolean(layer){
			return new ValidationError(expectedType('boolean', schema.allowedTypes), layer, schema, 'type', schema.allowedTypes, 'boolean');
		});
	}
	if(schema.constType && schema.constType!=='boolean'){
		validators.StartBoolean.push(function testConstBoolean(layer){
			return new ValidationError(expectedType('boolean', [schema.constType]), layer, schema, 'const', schema.constType, 'boolean');
		});
	}
	if(schema.constValue!==undefined){
		validators.EndBoolean.push(function testTypeBoolean(layer, instance){
			if(schema.constValue!==instance) return (new ValidationError('const mismatch', layer, schema, 'const', schema.constValue, instance));
		});
	}
	if(schema.enumLiterals){
		validators.EndBoolean.push(function testEnum(layer, v){
			if(!schema.enumLiterals.has(v)) return new ValidationError('Boolean does not match one of the enumerated values', layer, schema, 'enum', schema.enumLiterals);
		});
	}

	// Null
	if(schema.allowNull===false){
		validators.StartNull.push(function testTypeNull(layer){
			return new ValidationError(expectedType('null', schema.allowedTypes), layer, schema, 'type', schema.allowedTypes, 'null');
		});
	}
	if(schema.constType && schema.constType!=='null'){
		validators.StartNull.push(function testConstNull(layer){
			return new ValidationError(expectedType('null', [schema.constType]), layer, schema, 'const', schema.constType, 'null');
		});
	}
	if(schema.enumLiterals){
		validators.StartNull.push(function testEnum(layer){
			if(!schema.enumLiterals.has(null)) return new ValidationError('Null does not match one of the enumerated values', layer, schema, 'enum', schema.enumLiterals);
		});
	}
	if(schema.constValue!==undefined){
		validators.StartNull.push(function testTypeNull(layer, instance){
			if(schema.constValue!==null) return (new ValidationError('const mismatch', layer, schema, 'const', schema.constValue, instance));
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

// Stores state for parsing a single instance against a schema
module.exports.ValidateLayer = ValidateLayer;
function ValidateLayer(schema, root, argv){
	const validator = this;
	if(!(schema instanceof Schema)) throw new Error('Expected `schema` to be a Schema');

	validator.schema = schema;

	validator.validateFinish = schema.validators.Finish;
	validator.validateStartObject = schema.validators.StartObject;
	validator.validateEndKey = schema.validators.EndKey;
	validator.validateNewProperty = schema.validators.NewProperty;
	validator.validateEndObject = schema.validators.EndObject;
	validator.validateStartArray = schema.validators.StartArray;
	validator.validateNewItem = schema.validators.NewItem;
	validator.validateEndArray = schema.validators.EndArray;
	validator.validateStartString = schema.validators.StartString;
	validator.validateEndString = schema.validators.EndString;
	validator.validateStartNumber = schema.validators.StartNumber;
	validator.validateEndNumber = schema.validators.EndNumber;
	validator.validateStartBoolean = schema.validators.StartBoolean;
	validator.validateEndBoolean = schema.validators.EndBoolean;
	validator.validateStartNull = schema.validators.StartNull;
	validator.validateAnnotations = schema.validators.Annotations;

	// Where to store errors
	// If `root` is given, it probably points to the StreamParser
	if(root){
		validator.root = root;
		validator.errors = root.errors;
		validator.throw = root.throw;
		validator.annotations = root.annotations;
	}else{
		validator.errors = [];
		validator.throw = null;
		validator.annotations = [];
	}

	// Process arguments – runtime behavior changes for how a schema can function
	if(argv && argv.recursiveBase){
		validator.recursiveBase = argv.recursiveBase;
	}else if(root && root.recursiveBase){
		validator.recursiveBase = root.recursiveBase;
	}else if(schema.$recursiveAnchor){
		validator.recursiveBase = schema.id;
	}else{
		validator.recursiveBase = null;
	}
	const subopts = {
		recursiveBase: validator.recursiveBase,
	};

	// process anyOf/oneOf/not
	// an array
	validator.allOf = schema.allOf.map(function(s){
		var subvalidator = new ValidateLayer(s, validator, subopts);
		return subvalidator;
	});
	// array of arrays
	validator.anyOf = schema.anyOf.map(function(arr){
		return arr.map(function(s){
			var subvalidator = new ValidateLayer(s, null, subopts);
			return subvalidator;
		});
	});
	// another array of arrays
	validator.oneOf = schema.oneOf.map(function(arr){
		return arr.map(function(s){
			var subvalidator = new ValidateLayer(s, null, subopts);
			return subvalidator;
		});
	});
	// just one array of not
	validator.not = schema.not.map(function(s){
		var subvalidator = new ValidateLayer(s, null, subopts);
		return subvalidator;
	});
	// array of allowed literal values
	if(schema.enumSchemas) validator.enum = schema.enumSchemas.map(function(s){
		var subvalidator = new ValidateLayer(s, null, subopts);
		return subvalidator;
	});
	// single allowed literal values
	if(schema.constSchema){
		validator.const = new ValidateLayer(schema.constSchema, null, subopts);
	}

	// if/then/else
	if(schema.if) validator.if = new ValidateLayer(schema.if, null, subopts);
	if(schema.then) validator.then = new ValidateLayer(schema.then, null, subopts);
	if(schema.else) validator.else = new ValidateLayer(schema.else, null, subopts);

	// external reference to parse
	if(schema.$ref){
		const subschemaURI = schema.$ref;
		// const subschemaURI = uriResolve(schema.id, schema.$ref);
		const subschema = schema.registry.lookup(schema.$ref);
		if(!subschema) throw new Error('Could not lookup schema <'+subschemaURI+'>');
		const subvalidator = new ValidateLayer(subschema, validator, subopts);
		validator.$ref = subvalidator;
	}
	// external reference to parse
	if(schema.$recursiveRef){
		const recursiveBase = validator.recursiveBase || schema.id;
		const subschemaURI = uriResolve(recursiveBase, schema.$recursiveRef);
		const subschema = schema.registry.lookup(subschemaURI);
		if(!subschema) throw new Error('Could not lookup schema <'+subschemaURI+'>');
		const subvalidator = new ValidateLayer(subschema, validator, subopts);
		validator.$ref = subvalidator; // FIXME
	}
}

// Return the set of validators that must receive parser events
ValidateLayer.prototype.getAll = function getAll() {
	var list = [];
	function im(v){
		v.getAll().forEach(function(w){ list.push(w); });
	}
	this.allOf.forEach(im);
	this.anyOf.forEach(function(arr){ arr.forEach(im); });
	this.oneOf.forEach(function(arr){ arr.forEach(im); });
	this.not.forEach(im);
	if(this.enum) this.enum.forEach(im);
	if(this.$ref) im(this.$ref);
	if(this.if) im(this.if);
	if(this.then) im(this.then);
	if(this.else) im(this.else);
	list.push(this);
	return list;
};

ValidateLayer.prototype.importLayer = function importLayer(layer) {
	const self = this;
	self.addErrorList(layer.errors);
	self.addAnnotationList(layer.annotations);
	if(layer.evaluatedPropertiesSet){
		layer.evaluatedPropertiesSet.forEach((v) => self.evaluatedPropertiesSet.add(v));
	}
};

ValidateLayer.prototype.addErrorList = function addErrorList(errs) {
	const self = this;
	if(errs){
		if(Array.isArray(errs)){
			if(!errs.length) return;
			if(self.root && self.throw) self.root.emitError(errs[0], errs.slice(1));
			else errs.forEach(function(error){
				self.errors.push(error);
			});
		}else{
			if(self.root && self.throw) self.root.emitError(errs);
			else self.errors.push(errs);
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
	var validators = [];
	if(schema.properties[key]){
		schema.properties[key].validate(self).forEach((v) => validators.push(v));
	}
	for(var regexp in schema.patternPropertiesRegExp){
		if(schema.patternPropertiesRegExp[regexp].test(key)){
			schema.patternProperties[regexp].validate(self).forEach((v) => validators.push(v));
		}
	}
	if(validators.length==0 && schema.additionalProperties){
		schema.additionalProperties.validate(self).forEach((v) => validators.push(v));
	}
	if(validators.length){
		self.evaluatedPropertiesSet.add(key);
	}else if(validators.length==0 && schema.unevaluatedProperties){
		const unevaluatedPropertyValidators = schema.unevaluatedProperties.validate();
		unevaluatedPropertyValidators.forEach((v) => validators.push(v));
		self.unevaluatedPropertiesMap.set(key, unevaluatedPropertyValidators[unevaluatedPropertyValidators.length-1]);
	}
	if(schema.constProperties && schema.constProperties[key]){
		schema.constProperties[key].validate(self).forEach((v) => validators.push(v));
	}
	return validators;
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
	if(schema.constItems && schema.constItems[k]){
		patterns.push(schema.constItems[k]);
	}
	return patterns.flatMap( (v) => v.validate(self) );
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
	const self = this;
	for(let i=0; i<self.validateStartString.length; i++){
		self.addErrorList(self.validateStartString[i].call(self, layer));
	}
};

ValidateLayer.prototype.startBoolean = function startBoolean(layer){
	const self = this;
	for(let i=0; i<self.validateStartBoolean.length; i++){
		self.addErrorList(self.validateStartBoolean[i].call(self, layer));
	}
};

ValidateLayer.prototype.startNull = function startNull(layer){
	const self = this;
	for(let i=0; i<self.validateStartNull.length; i++){
		self.addErrorList(self.validateStartNull[i].call(self, layer));
	}
};

ValidateLayer.prototype.startObject = function startObject(layer){
	const self = this;
	self.evaluatedPropertiesSet = new Set;
	self.unevaluatedPropertiesMap = new Map;
	for(let i=0; i<self.validateStartObject.length; i++){
		self.addErrorList(self.validateStartObject[i].call(self, layer));
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
	// Compute required properties errors
	if(self.requiredRemain && self.requiredRemain.size){
		const missing = Array.from(self.requiredRemain);
		self.addErrorList(new ValidationError('Required properties missing', layer, self. schema, 'required', missing));
	}
};

ValidateLayer.prototype.endArray = function endArray(layer, n){
	const self = this;
	for(let i=0; i<self.validateEndArray.length; i++){
		self.addErrorList(self.validateEndArray[i].call(self, layer));
	}
};

ValidateLayer.prototype.endKey = function endKey(k){
	if(this.requiredRemain) this.requiredRemain.delete(k);
	//if(this.schema.propertyName){
	// ...
	//}
};

ValidateLayer.prototype.finish = function finish(layer){
	const self = this;
	const schema = this.schema;
	function fin(v){
		if(v===self) return;
		v.finish(layer);
	}
	this.getAll().forEach(fin);

	// if/then/else
	if(self.if){
		if(self.if.errors.length===0){
			if(self.then) self.importLayer(self.then);
		}else{
			if(self.else) self.importLayer(self.else);
		}
	}

	if(schema.constRemain){
		// FIXME is this right? This can't be right
		const expected = Object.keys(schema.constValue);
		self.addErrorList(new ValidationError('Required properties missing', layer, schema, 'const', expected));
	}

	// "not"
	const notFailures = self.not.filter(function(v){ return v.errors.length===0; });
	if(notFailures.length){
		self.addErrorList(new ValidationError('Expected "not" to fail', layer, this, 'not'));
	}

	// allOf and $ref don't need entries here because they add errors directly to this instance's error list
	self.allOf.forEach(function(sub){
		if(sub.evaluatedPropertiesSet){
			sub.evaluatedPropertiesSet.forEach((v) => self.evaluatedPropertiesSet.add(v));
		}
	});

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

	if(schema.unevaluatedProperties && self.evaluatedPropertiesSet && self.evaluatedPropertiesSet.size !== layer.length){
		self.unevaluatedPropertiesMap.forEach(function(res, key){
			// If this property ended up being evaluated (e.g. by if/then/else), ignore it
			// Otherwise import the errors
			if(!self.evaluatedPropertiesSet.has(key)){
				self.importLayer(res);
			}
		});
	}

	// constSchema
	if(self.const && self.const.errors.length){
		// self.addErrorList(new ValidationError('"const" mismatch', layer, self, 'const', 1, self.schema.constValue));
		self.importLayer(self.const);
	}

	if(self.annotations && self.errors.length===0){
		for(let i=0; i<self.validateAnnotations.length; i++){
			self.addAnnotationList(self.validateAnnotations[i].call(self, layer));
		}
	}

};
