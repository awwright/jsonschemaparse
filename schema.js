
"use strict";

var url = require('url');
var uriResolve = url.resolve;

var Parse = require('./parse.js');

module.exports.ValidationError = ValidationError;
function ValidationError(message, propertyPath, schema, keyword, expected, actual){
	this.message = message;
	this.path = propertyPath;
	//this.schema = schema;
	this.schemaId = schema.id;
	this.keyword = keyword;
	this.expected = expected;
	this.actual = actual;
}
//ValidationError.prototype.toString = function toString(){
//	return this.message
//		+ '\n\t' + JSON.stringify(this.schema)
//		+ '\n\t' + JSON.stringify(this.actual)
//}


module.exports.isSchema = isSchema;
function isSchema(s){
	// Is an object, but not an array, and not a schema reference with $ref
	// Also a boolean is also a valid schema
	return (typeof s=='object' && !Array.isArray(s) && !s.$ref) || (typeof s=='boolean');
}
function isSchemaResolve(s){
	// Is an object, but not an array. $ref is OK.
	// Also a boolean is also a valid schema
	// Also a string can be used to reference a schema.
	return (typeof s=='object' && !Array.isArray(s)) || (typeof s=='boolean') || (typeof s=='string');
}

module.exports.SchemaRegistry = SchemaRegistry;
function SchemaRegistry(){
	this.source = {};
	this.seen = {};
}
SchemaRegistry.prototype.import = function importSchema(id, schema, path){
	this.scan(id, schema, '');
	return this.resolve(id, schema);
}
SchemaRegistry.prototype.scanMap = function scan(id, map, path){
	var self = this;
	if(map) for(var n in map) if(typeof map[n]=='object') self.scan(id, map[n], path+'/'+n);
}
SchemaRegistry.prototype.scan = function scan(base, schema, path){
	var self = this;
	if(!schema){
		return;
	}
	if(!base){
		throw new Error('Argument `base` required');
	}
	if(!path){
		path = '';
	}
	if(Array.isArray(schema)){
		schema.forEach(function(v, i){ self.scan(base, schema[i], path+'/'+i); });
		return;
	}
	if(typeof schema==='string'){
		var id = uriResolve(base, schema);
		if(!this.source[id]) this.source[id] = null;
		this.seen[id] = true;
	}
	if(typeof schema==='boolean'){
		// Alias boolean form to an object schema
		if(schema===true){
			schema = { id:'_:true' };
		}else if(schema===false){
			schema = { id:'_:false', type: [] };
		}
		// continue to 'object'
	}
	if(typeof schema==='object'){
		if(schema.$ref){
			self.scan(schema.$ref)
			return;
		}
		var uriref = schema.$id || schema.id;
		var id;
		if(uriref){
			id = uriResolve(base, uriref);
		}else {
			id = base + '#' + path;
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
		}
		self.source[id] = schema;
		self.scan(id, schema.items, path+'/items');
		self.scan(id, schema.extends, path+'/extends');
		self.scan(id, schema.additionalItems, path+'/additionalItems');
		self.scanMap(id, schema.properties, path+'/properties');
		self.scan(id, schema.additionalProperties, path+'/additionalProperties');
		self.scanMap(id, schema.definitions, path+'/definitions');
		self.scanMap(id, schema.patternProperties, path+'/patternProperties');
		self.scanMap(id, schema.dependencies, path+'/dependencies');
		self.scan(id, schema.disallow, path+'/disallow');
		self.scan(id, schema.allOf, path+'/allOf');
		self.scan(id, schema.anyOf, path+'/anyOf');
		self.scan(id, schema.oneOf, path+'/oneOf');
		self.scan(id, schema.not, path+'/not');
	}
}
SchemaRegistry.prototype.resolve = function resolve(base, schema){
	var self = this;
	if(typeof base!=='string' || base.indexOf(':')===-1) throw new Error('`base` must be a URI string');
	if(typeof schema==='string'){
		var uriref = schema;
		var id = uriResolve(base, uriref);
		if(self.source[id]){
			var resolved = self.source[id];
			if(!resolved) throw new Error('Could not resolve schema '+JSON.stringify(id));
			return new Schema(self.source[id], self);
		}
		var parts = id.split('#',2);
		var id = parts[0];
		if(self.source[id]){
			var resolved = self.source[id];
			if(!resolved) throw new Error('Could not resolve schema '+JSON.stringify(id));
			var hier = parts.split('/').slice(1).map(function(v){
				return v;
			});
			id += '#';
			for(var i=0; i<hier.length; i++){
				var key = hier[i];
				id += '/' + encodeURIComponent(key);
				resolved = resolved[key];
				if(!resolved) throw new Error('Could not resolve schema '+JSON.stringify(id));
			}
			return new Schema(resolved, self);
		}
		throw new Error('Could not resolve schema '+JSON.stringify(schema)+' (in '+JSON.stringify(base)+')');
	}else if(isSchema(schema)){
		return new Schema(schema, self);
	}else if(isSchemaResolve(schema)){
		// If it's not a schema, but a schema reference
		return self.resolve(base, schema.$ref);
	}else if(!schema){
		return new Schema({}, self);
	}
}
SchemaRegistry.prototype.getUnresolved = function(){
	var self = this;
	return Object.keys(self.seen)
		.filter(function(v){ return !self.source[v]; });
}

// Parse and optimize a schema
// All referenced schemas must be imported to the registry already
module.exports.Schema = Schema;
function Schema(sch, registry){
	var self = this;
	if(!registry) registry = new SchemaRegistry;
	self.registry = registry;
	if(sch) var idref = sch.$id || sch.id;
	self.id = idref || 'http://localhost/';
	self.allowNumber = true;
	self.allowString = true;
	self.allowBoolean = true;
	self.allowNull = true;
	self.allowObject = true;
	self.allowArray = true;
	self.allowedTypes = [];
	self.allowFraction = true; // Allow numbers with a fractional component
	self.maximum = null;
	self.exclusiveMaximum = null;
	self.minimum = null;
	self.exclusiveMinimum = null;
	self.minItems = null;
	self.maxItems = null;
	self.minProperties = null;
	self.maxProperties = null;
	self.anyOf = [];
	self.oneOf = [];
	self.required = {};
	//self.typeConstraints = [];
	self.items = [];
	self.additionalItems = null;
	//self.propertyNameSchema = null;
	self.properties = {};
	self.patternProperties = {};
	self.patternPropertiesRegExp = {};
	self.additionalProperties = null;
	self.testsType = [];
	self.testsNumber = [];
	self.testsString = [];
	self.testsArray = [];
	self.testsObject = [];

	if(isSchema(sch)) self.intersect(sch);
}

Schema.prototype.createParser = function createParser(options){
	return new Parse.StreamParser(this, options);
}

Schema.prototype.intersect = function intersect(s){
	var self = this;
	if(s===false){
		// always fail
		self.allowNumber = self.allowString = self.allowBoolean = self.allowNull = self.allowObject = self.allowArray = false;
		return;
	}else if(s===true){
		s = {};
	}

	// Keyword: "allOf"
	if(s.allOf){
		if(!Array.isArray(s.allOf)){
			throw new Error('"allOf" not an array');
		}
		s.allOf.forEach(function(sc){ self.intersect(sc); });
	}

	// Keyword: "type"
	if(typeof s.type=='string'){
		if(s.type!='number' && s.type!='integer') self.allowNumber=false;
		if(s.type!='number') self.allowFraction=false;
		if(s.type!='string') self.allowString=false;
		if(s.type!='boolean') self.allowBoolean=false;
		if(s.type!='null') self.allowNull=false;
		if(s.type!='object') self.allowObject=false;
		if(s.type!='array') self.allowArray=false;
	}else if(Array.isArray(s.type)){
		if(s.type.indexOf('number')<0 && s.type.indexOf('integer')<0) self.allowNumber=false;
		if(s.type.indexOf('number')<0) self.allowFraction=false;
		if(s.type.indexOf('string')<0) self.allowString=false;
		if(s.type.indexOf('boolean')<0) self.allowBoolean=false;
		if(s.type.indexOf('null')<0) self.allowNull=false;
		if(s.type.indexOf('object')<0) self.allowObject=false;
		if(s.type.indexOf('array')<0) self.allowArray=false;
	}else if(s.type!==undefined){
		throw new Error('Invalid "type" keyword');
	}
	// Keyword: "minimum", "exclusiveMinimum"
	if(typeof s.minimum=='number' && s.exclusiveMinimum===true){
		if(s.exclusiveMinimum >= self.exclusiveMinimum || s.minimum >= self.exclusiveMinimum){
			self.minimum = null;
			self.exclusiveMinimum = s.minimum;
		}
	}else if(typeof s.exclusiveMinimum=='number'){
		if(s.exclusiveMinimum >= self.exclusiveMinimum || s.minimum >= self.exclusiveMinimum){
			self.minimum = null;
			self.exclusiveMinimum = s.exclusiveMinimum;
		}
	}else if(typeof s.minimum=='number'){
		if(s.minimum >= self.minimum || s.minimum >= self.minimum){
			self.minimum = s.minimum;
			self.exclusiveMinimum = null;
		}
	}
	// Keyword: "maximum", "exclusiveMaximum"
	if(typeof s.maximum=='number' && s.exclusiveMaximum===true){
		if(s.exclusiveMaximum >= self.exclusiveMaximum || s.maximum >= self.exclusiveMaximum){
			self.maximum = null;
			self.exclusiveMaximum = s.maximum;
		}
	}else if(typeof s.exclusiveMaximum=='number'){
		if(s.exclusiveMaximum >= self.exclusiveMaximum || s.maximum >= self.exclusiveMaximum){
			self.maximum = null;
			self.exclusiveMaximum = s.exclusiveMaximum;
		}
	}else if(typeof s.maximum=='number'){
		if(s.maximum >= self.maximum || s.maximum >= self.maximum){
			self.maximum = s.maximum;
			self.exclusiveMaximum = null;
		}
	}
	// Keyword: "minItems"
	if(typeof s.minItems=='number' && (s.minItems>self.minItems || self.minItems===null)){
		self.minItems = s.minItems;
	}
	// Keyword: "maxItems"
	if(typeof s.maxItems=='number' && (s.maxItems<self.maxItems || self.maxItems===null)){
		self.maxItems = s.maxItems;
	}
	// Keyword: "minProperties"
	if(typeof s.minProperties=='number' && (s.minProperties>self.minProperties || self.minProperties===null)){
		self.minProperties = s.minProperties;
	}
	// Keyword: "maxProperties"
	if(typeof s.maxProperties=='number' && (s.maxProperties<self.maxProperties || self.maxProperties===null)){
		self.maxProperties = s.maxProperties;
	}
	// Keyword: "multipleOf"
	if(typeof s.multipleOf=='number'){
		self.multipleOf = s.multipleOf;
	}
	// Keyword: "items" and "additionalItems"
	if(Array.isArray(s.items)){
		s.items.forEach(function(s2, i){
			self.items[i] = self.registry.resolve(self.id, s2);
		});
		if(isSchema(s.additionalItems)){
			self.additionalItems = self.registry.resolve(self.id, s.additionalItems);
		}
	}else if(isSchema(s.items)){
		self.additionalItems = self.registry.resolve(self.id, s.items);
	}
	// Keyword: "properties"
	if(typeof s.properties==='object'){
		for(var k in s.properties){
			if(isSchema(s.properties[k])){
				self.properties[k] = self.registry.resolve(self.id, s.properties[k]);
			}else if(s.properties[k]!==undefined){
				throw new Error('Value in "properties" must be a schema');
			}
		}
	}else if(s.properties!==undefined){
		throw new Error('"properties" must be an object');
	}
	// Keyword: "patternProperties"
	if(typeof s.patternProperties==='object'){
		for(var k in s.patternProperties){
			if(isSchema(s.patternProperties[k])){
				self.patternPropertiesRegExp[k] = self.patternPropertiesRegExp[k] || new RegExp(k);
				self.patternProperties[k] = self.registry.resolve(self.id, s.patternProperties[k]);
			}else if(s.patternProperties[k]!==undefined){
				throw new Error('Value in "patternProperties" must be a schema');
			}
		}
	}else if(s.patternProperties!==undefined){
		throw new Error('"patternProperties" must be an object');
	}
	// Keyword: "additionalProperties"
	if(isSchema(s.additionalProperties)){
		self.additionalProperties = self.registry.resolve(self.id, s.additionalProperties);
	}else if(s.additionalProperties!==undefined){
		throw new Error('"additionalProperties" must be a schema');
	}
	// Keyword: "required"
	if(Array.isArray(s.required)){
		var required = {};
		s.required.forEach(function(k){
			if(required[k]===true){
				throw new Error('Items in "required" must be unique');
			}
			required[k] = true;
			self.required[k] = true;
		});
	}
	// Keyword: "pattern"
	if(typeof s.pattern=='string'){
		self.testsString.push(Schema.stringTestPattern.bind(self, s.pattern));
	}
	// Update indexes
	if(self.allowNumber) self.allowedTypes.push('number');
	if(self.allowString) self.allowedTypes.push('string');
	if(self.allowBoolean) self.allowedTypes.push('boolean');
	if(self.allowNull) self.allowedTypes.push('null');
	if(self.allowObject) self.allowedTypes.push('object');
	if(self.allowArray) self.allowedTypes.push('array');
}


Schema.prototype.testTypeNumber = function testNumber(layer, expected){
	if(this.allowNumber) return;
	return new ValidationError('Expected a number', layer.path, layer.schema, 'type', expected, 'number');
}

Schema.prototype.testTypeString = function testString(layer, expected){
	if(this.allowString) return;
	return new ValidationError('Expected a string', layer.path, layer.schema, 'type', expected, 'string');
}

Schema.prototype.testTypeBoolean = function testBoolean(layer, expected){
	if(this.allowBoolean) return;
	return new ValidationError('Expected a boolean', layer.path, layer.schema, 'type', expected, 'boolean');
}

Schema.prototype.testTypeNull = function testNull(layer, expected){
	if(this.allowNull) return;
	return new ValidationError('Expected a null', layer.path, layer.schema, 'type', expected, 'null');
}

Schema.prototype.testTypeObject = function testObject(layer, expected){
	if(this.allowObject) return;
	return new ValidationError('Expected an object', layer.path, layer.schema, 'type', expected, 'object');
}

Schema.prototype.testTypeArray = function testArray(layer, expected){
	if(this.allowArray) return;
	return new ValidationError('Expected an array', layer.path, layer.schema, 'type', expected, 'array');
}

Schema.prototype.getPropertySchema = function getPropertySchema(k){
	var self = this;
	var patterns = [];
	//console.log(k, self);
	if(self.properties[k]){
		patterns.push(self.properties[k]);
	}
	for(var regexp in self.patternPropertiesRegExp){
		if(self.patternPropertiesRegExp[regexp].test(k)){
			patterns.push(self.patternProperties[regexp]);
		}
	}
	if(patterns.length==0) return self.additionalProperties;
	if(patterns.length==1) return patterns[0];
	return new SchemaUnion(patterns);
}

Schema.prototype.getItemSchema = function getItemSchema(k){
	// var subschema = schema.items[this.layer.length] || schema.additionalItems;
	var self = this;
	var patterns = [];
	if(self.items[k]){
		patterns.push(self.items[k]);
	}
	if(patterns.length==0) return self.additionalItems;
	if(patterns.length==1) return patterns[0];
	return new SchemaUnion(patterns);
}

Schema.prototype.testItemsCount = function(length){
	var schema = this;
	var error = false;
	if(typeof schema.minItems=='number' && length < schema.minItems){
		error = true;
	}
	if(typeof schema.maxItems=='number' && length > schema.maxItems){
		error = true;
	}
	if(!error) return;
	return new Error('Incorrect number of items');
}

Schema.prototype.testPropertiesCount = function(length){
	var schema = this;
	var error = false;
	if(typeof schema.minProperties=='number' && length < schema.minProperties){
		error = true;
	}
	if(typeof schema.maxProperties=='number' && length > schema.maxProperties){
		error = true;
	}
	if(!error) return;
	return new Error('Incorrect number of properties');
}

Schema.prototype.testNumberRange = function(n){
	var schema = this;
	var error = false;
	if(typeof schema.exclusiveMinimum=='number' && n<=schema.exclusiveMinimum){
		error = true;
	}else if(typeof schema.minimum=='number' && n < schema.minimum){
		error = true;
	}
	if(typeof schema.exclusiveMaximum=='number' && n>=schema.exclusiveMaximum){
		error = true;
	}else if(typeof schema.maximum=='number' && n > schema.maximum){
		error = true;
	}
	if(typeof schema.multipleOf=='number' && schema.multipleOf>0 && (n / schema.multipleOf % 1)){
		error = true;
	}
	if(schema.allowFraction==false && n%1){
		error = true;
	}
	if(!error) return;
	return new Error('Number out of range');
}

Schema.stringTestPattern = function stringTestPattern(pattern, layer, instance){
	if (!instance.match(pattern)) {
		return new ValidationError('String does not match pattern', layer.path , layer.schema, 'pattern', pattern, instance);
	}
}

Schema.prototype.testStringRange = function testStringRange(layer, instance){
	if(typeof instance != 'string') return;
	var self = this;
	for(var i=0; i<self.testsString.length; i++){
		var res = self.testsString[i](layer, instance);
		if(res) return res;
	}
}

function ValidateObject(schema){
	if(!schema) throw new Error('`schema` argument is required');
	var self = this;
	self.schema = schema;
	self.oneOfMap = [];
	schema.oneOf.forEach(function(v,i){ self.oneOfMap[i] = false; });
	self.anyOfMap = [];
	schema.anyOf.forEach(function(v,i){ self.anyOfMap[i] = false; });
	self.requiredMap = {};
	self.requiredRemain = 0;
	for(var k in schema.required){
		self.requiredMap[k] = false;
		self.requiredRemain++;
	}
}
ValidateObject.prototype.testPropertyName = function testPropertyName(k){
	if(this.requiredMap[k]===false){
		this.requiredMap[k] = true;
		this.requiredRemain--;
	}
	//if(this.schema.propertyName){
		// ...
	//}
}
ValidateObject.prototype.finish = function finish(){
	var self = this;
	if(self.requiredRemain){
		var missing = Object.keys(self.requiredMap).filter(function(k){
			return !self.requiredMap[k];
		});
		return new Error('Required properties missing: '+JSON.stringify(missing));
	}
}


function ValidateArray(schema){
	if(!schema) throw new Error('`schema` argument is required');
	self.itemsMap = [];
}

Schema.prototype.testObjectBegin = function(){
	var schema = this;
	// Return a stateful object representing which schemas have passed/failed
	return new ValidateObject(schema);
}


function SchemaUnion(arr){
	if(!Array.isArray(arr)) throw new Error('Expected `arr` to be an Array');
	this.set = arr;
}

SchemaUnion.prototype.intersect = function intersect(s){
	this.set.push(s);
}

SchemaUnion.prototype.testTypeNumber = function testTypeNumber(layer){
	for(var i=0; i<this.set.length; i++){
		if(this.set[i].allowNumber) continue;
		return new ValidationError('Invalid number', layer.path, this.set[i], 'type', this.set[i].type, 'number');
	}
}

SchemaUnion.prototype.testTypeString = function testTypeString(layer){
	for(var i=0; i<this.set.length; i++){
		if(this.set[i].allowString) continue;
		return new ValidationError('Invalid string', layer.path, this.set[i], 'type', this.set[i].type, 'string');
	}
}

SchemaUnion.prototype.testTypeBoolean = function testTypeBoolean(layer){
	for(var i=0; i<this.set.length; i++){
		if(this.set[i].allowBoolean) continue;
		return new ValidationError('Invalid boolean', layer.path, this.set[i], 'type', this.set[i].type, 'boolean');
	}
}

SchemaUnion.prototype.testTypeNull = function testTypeNull(layer){
	for(var i=0; i<this.set.length; i++){
		if(this.set[i].allowNull) continue;
		return new ValidationError('Invalid nuull', layer.path, this.set[i], 'type', this.set[i].type, 'null');
	}
}

SchemaUnion.prototype.testTypeObject = function testTypeObject(layer){
	for(var i=0; i<this.set.length; i++){
		if(this.set[i].allowObject) continue;
		return new ValidationError('Invalid object', layer.path, this.set[i], 'type', this.set[i].type, 'object');
	}
}

SchemaUnion.prototype.testTypeArray = function testTypeArray(layer){
	for(var i=0; i<this.set.length; i++){
		if(this.set[i].allowArray) continue;
		return new ValidationError('Invalid array', layer.path, this.set[i], 'type', this.set[i].type, 'array');
	}
}

SchemaUnion.prototype.testNumberRange = function testNumberRange(n){
	for(var i=0; i<this.set.length; i++){
		var res = this.set[i].testNumberRange(n);
		if(res) return res;
	}
}
SchemaUnion.prototype.testStringRange = function testStringRange(n){
	for(var i=0; i<this.set.length; i++){
		var res = this.set[i].testStringRange(n);
		if(res) return res;
	}
}
SchemaUnion.prototype.getItemSchema = function getItemSchema(n){
	var u = new SchemaUnion([]);
	this.set.forEach(function(v){
		var vv = v.getItemSchema(n);
		if(vv) u.intersect(vv);
	});
	return u;
}
SchemaUnion.prototype.getPropertySchema = function getPropertySchema(n){
	var u = new SchemaUnion([]);
	this.set.forEach(function(v){
		var vv = v.getPropertySchema(n);
		if(vv) u.intersect(vv);
	});
	return u;
}
SchemaUnion.prototype.testItemsCount = function testItemsCount(n){
	for(var i=0; i<this.set.length; i++){
		var res = this.set[i].testItemsCount(n);
		if(res) return res;
	}
}
