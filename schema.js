
"use strict";

var url = require('url');
var uriResolve = url.resolve;

var Parse = require('./parse.js');

function collapseArray(arr, cb){
	var res = [];
	for(var i=0; i<arr.length; i++) cb(arr[i], i).forEach(function(v){ res.push(v); });
	return res;
}

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
	this.seen = {};
	this.source = {};
	this.parsed = {};
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
		// Strip empty trailing fragment
		if(id.match(/#$/)) id = id.substring(0, id.length-1);
		// Return an already existing Schema
		if(self.parsed[id]){
			return self.parsed[id];
		}
		// Try to parse the Schema at its defined URI
		if(self.source[id]){
			// Do this in two steps so that self.parsed[id] exists prior to evaluating Schema#intersect
			self.parsed[id] = new Schema(id, {}, self);
			self.parsed[id].intersect(self.source[id]);
			return self.parsed[id];
		}
		// Try to decend the property path, if any
		var parts = id.split('#',2);
		var id = parts[0];
		if(self.source[id] && parts[1]){
			var resolved = self.source[id];
			if(!resolved) throw new Error('Could not resolve schema '+JSON.stringify(id));
			var hier = parts[1].split('/').slice(1).map(function(v){
				return v;
			});
			id += '#';
			for(var i=0; i<hier.length; i++){
				var key = hier[i];
				id += '/' + encodeURIComponent(key);
				resolved = resolved[key];
				if(!resolved) throw new Error('Could not resolve schema '+JSON.stringify(id));
			}
			self.parsed[id] = new Schema(id, resolved, self);
			return self.parsed[id];
		}
		throw new Error('Could not resolve schema '+JSON.stringify(id)+' ('+uriref+' in '+JSON.stringify(base)+')');
	}else if(isSchema(schema)){
		return new Schema(base, schema, self);
	}else if(isSchemaResolve(schema)){
		// If it's not a schema, but a schema reference
		return self.resolve(base, schema.$ref);
	}else if(!schema){
		return new Schema(base, {}, self);
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
function Schema(id, schema, registry){
	var self = this;
	if(!registry) registry = new SchemaRegistry;
	self.registry = registry;
	self.id = id;
	if(schema) var idref = schema.$id || schema.id;
	if(idref) self.id = uriResolve(self.id, idref) || '_:';
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
	self.minLength = null;
	self.maxLength = null;
	self.not = [];
	self.anyOf = [];
	self.oneOf = [];
	self.required = {};
	self.items = [];
	self.additionalItems = null;
	//self.propertyNameSchema = null;
	self.properties = {};
	self.patternProperties = {};
	self.patternPropertiesRegExp = {};
	self.additionalProperties = null;
	self.testsString = [];

	if(isSchema(schema)) self.intersect(schema);
}

Schema.prototype.createParser = function createParser(options){
	return new Parse.StreamParser(this, options);
}

Schema.prototype.validate = function validate(errors) {
	//return [new ValidateLayer(this, errors)];
	return new ValidateLayer(this, errors).getAll();
}

Schema.prototype.intersect = function intersect(s){
	// FIXME Thrown errors may leave this object in a partially modified state

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

	// Keyword: "not"
	if(s.not){
		// FIXME allow schema references, too
		if(!isSchemaResolve(s.not)){
			throw new Error('"not" not a schema');
		}
		self.not.push(self.registry.resolve(self.id, s.not));
	}

	// Keyword: "oneOf"
	if(s.oneOf){
		if(!Array.isArray(s.oneOf)){
			throw new Error('"allOf" not an array');
		}
		var oneOf = [];
		s.oneOf.forEach(function(sc){
			if(!isSchemaResolve(sc)) throw new Error('"anyOf" item not a schema');
			oneOf.push(self.registry.resolve(self.id, sc));
		});
		self.oneOf.push(oneOf);
	}

	// Keyword: "anyOf"
	if(s.anyOf){
		if(!Array.isArray(s.anyOf)){
			throw new Error('"anyOf" not an array');
		}
		var anyOf = [];
		s.anyOf.forEach(function(sc){
			if(!isSchemaResolve(sc)) throw new Error('"anyOf" item not a schema');
			anyOf.push(self.registry.resolve(self.id, sc));
		});
		self.anyOf.push(anyOf);
	}

	// Keyword: "type"
	var type = (typeof s.type=='string') ? [s.type] : s.type;
	if(Array.isArray(type)){
		if(type.indexOf('number')<0 && type.indexOf('integer')<0) self.allowNumber=false;
		if(type.indexOf('number')<0) self.allowFraction=false;
		if(type.indexOf('string')<0) self.allowString=false;
		if(type.indexOf('boolean')<0) self.allowBoolean=false;
		if(type.indexOf('null')<0) self.allowNull=false;
		if(type.indexOf('object')<0) self.allowObject=false;
		if(type.indexOf('array')<0) self.allowArray=false;
	}else if(type!==undefined){
		throw new Error('Invalid "type" keyword');
	}
	// Update "allowedTypes" index
	if(self.allowNumber) self.allowedTypes.push('number');
	if(self.allowString) self.allowedTypes.push('string');
	if(self.allowBoolean) self.allowedTypes.push('boolean');
	if(self.allowNull) self.allowedTypes.push('null');
	if(self.allowObject) self.allowedTypes.push('object');
	if(self.allowArray) self.allowedTypes.push('array');

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
	// Keyword: "minLength"
	if(typeof s.minLength=='number' && (s.minLength>self.minLength || self.minLength===null)){
		self.minLength = s.minLength;
	}
	// Keyword: "maxLength"
	if(typeof s.maxLength=='number' && (s.maxLength<self.maxLength || self.maxLength===null)){
		self.maxLength = s.maxLength;
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
		if(isSchemaResolve(s.additionalItems)){
			self.additionalItems = self.registry.resolve(self.id, s.additionalItems);
		}
	}else if(isSchemaResolve(s.items)){
		self.additionalItems = self.registry.resolve(self.id, s.items);
	}
	// Keyword: "properties"
	if(typeof s.properties==='object'){
		for(var k in s.properties){
			if(isSchemaResolve(s.properties[k])){
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
			if(isSchemaResolve(s.patternProperties[k])){
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
	if(isSchemaResolve(s.additionalProperties)){
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
			required[k] = self.required[k] = true;
		});
	}
	// Keyword: "pattern"
	if(typeof s.pattern=='string'){
		self.testsString.push(Schema.stringTestPattern.bind(self, s.pattern));
	}
}


Schema.prototype.startNumber = function startNumber(layer){
	if(this.allowNumber) return;
	return new ValidationError('Expected a number', layer.path, this, 'type', this.allowedTypes, 'number');
}

Schema.prototype.startString = function startString(layer){
	if(this.allowString) return;
	return new ValidationError('Expected a string', layer.path, this, 'type', this.allowedTypes, 'string');
}

Schema.prototype.startBoolean = function startBoolean(layer){
	if(this.allowBoolean) return;
	return new ValidationError('Expected a boolean', layer.path, this, 'type', this.allowedTypes, 'boolean');
}

Schema.prototype.startNull = function startNull(layer){
	if(this.allowNull) return;
	return new ValidationError('Expected a null', layer.path, this, 'type', this.allowedTypes, 'null');
}

Schema.prototype.startObject = function startObject(layer){
	if(this.allowObject) return;
	return new ValidationError('Expected an object', layer.path, this, 'type', this.allowedTypes, 'object');
}

Schema.prototype.startArray = function startArray(layer){
	if(this.allowArray) return;
	return new ValidationError('Expected an array', layer.path, this, 'type', this.allowedTypes, 'array');
}

Schema.prototype.endArray = function(layer){
	var schema = this;
	var error = false;
	var length = layer.length;
	if(typeof schema.minItems=='number' && length < schema.minItems){
		error = true;
	}
	if(typeof schema.maxItems=='number' && length > schema.maxItems){
		error = true;
	}
	if(!error) return;
	return new Error('Incorrect number of items');
}

Schema.prototype.endObject = function(layer){
	var schema = this;
	var error = false;
	var length = layer.length;
	if(typeof schema.minProperties=='number' && length < schema.minProperties){
		error = true;
	}
	if(typeof schema.maxProperties=='number' && length > schema.maxProperties){
		error = true;
	}
	if(!error) return;
	return new Error('Incorrect number of properties');
}

Schema.prototype.endNumber = function(layer, n){
	var schema = this;
	var error = false;
	if(typeof schema.exclusiveMinimum=='number' && n<=schema.exclusiveMinimum){
		return new ValidationError('Number under minimum', layer.path, schema, 'exclusiveMinimum', schema.exclusiveMinimum, n);
	}else if(typeof schema.minimum=='number' && n < schema.minimum){
		return new ValidationError('Number under/equal to minimum', layer.path, schema, 'minimum', schema.minimum, n);
	}
	if(typeof schema.exclusiveMaximum=='number' && n>=schema.exclusiveMaximum){
		return new ValidationError('Number under maximum', layer.path, schema, 'exclusiveMaximum', schema.exclusiveMaximum, n);
	}else if(typeof schema.maximum=='number' && n > schema.maximum){
		return new ValidationError('Number under/equal to maximum', layer.path, schema, 'maximum', schema.maximum, n);
	}
	if(typeof schema.multipleOf=='number' && schema.multipleOf>0 && (n / schema.multipleOf % 1)){
		return new ValidationError('Number not multiple of', layer.path, schema, 'multipleOf', schema.multipleOf, n);
	}
	if(schema.allowFraction==false && n%1){
		return new ValidationError('Expected an integer', layer.path, schema, 'type', schema.type, 'number');
	}
}

Schema.stringTestPattern = function stringTestPattern(pattern, layer, instance){
	if (!instance.match(pattern)) {
		return new ValidationError('String does not match pattern', layer.path , this, 'pattern', pattern, instance);
	}
}

Schema.prototype.endString = function endString(layer, instance){
	var self = this;
	// This function shouldn't be called if instance is not a string
	if(typeof instance != 'string') throw new Error('A string instance is required');
	if(typeof self.minLength=='number' && layer.length < self.minLength){
		return new ValidationError('String too short', layer.path, self, 'minLength', self.minLength, layer.length);
	}
	if(typeof self.maxLength=='number' && layer.length > self.maxLength){
		return new ValidationError('String too long', layer.path, self, 'maxLength', self.maxLength, layer.length);
	}
	for(var i=0; i<self.testsString.length; i++){
		var res = self.testsString[i](layer, instance);
		if(res) return res;
	}
}

// Stores information about this instance for parsing the given schema
module.exports.ValidateLayer = ValidateLayer;
function ValidateLayer(schema, errors){
	var self = this;
	if(!(schema instanceof Schema)) throw new Error('Expected `schema` to be a Schema');
	self.schema = schema;

	// Where to store errors
	// If `errors` is given, it probably points to `StreamParser#errors`
	if(errors){
		this.errors = errors;
	}else{
		this.errors = [];
	}

	// process required properties
	self.requiredMap = {};
	self.requiredRemain = 0;

	// process anyOf/oneOf/not
	// A set of schemas that anyOf/oneOf/not in turn depend on
	self.side = [];
	// an array of arrays
	self.anyOf  = schema.anyOf.map(function(arr){
		return arr.map(function(s){
			var validator = new ValidateLayer(s);
			validator.side.forEach(function(v){ self.side.push(v); });
			return validator;
		});
	});
	// another array of arrays
	self.oneOf  = schema.oneOf.map(function(arr){
		return arr.map(function(s){
			var validator = new ValidateLayer(s);
			validator.side.forEach(function(v){ self.side.push(v); });
			return validator;
		});
	});
	// just one array of not
	self.not = schema.not.map(function(s){
		var validator = new ValidateLayer(s);
		validator.side.forEach(function(v){ self.side.push(v); });
		return validator;
	});
}

ValidateLayer.prototype.getAll = function getAll(errs) {
	var list = [this];
	this.side.forEach(function(v){ list.push(v); });
	this.anyOf.forEach(function(arr){ arr.forEach(function(v){ list.push(v); }); });
	this.oneOf.forEach(function(arr){ arr.forEach(function(v){ list.push(v); }); });
	this.not.forEach(function(v){ list.push(v); });
	return list;
}

ValidateLayer.prototype.addErrorList = function addErrorList(errs) {
	var self = this;
	if(!Array.isArray(errs)) errs = errs?[errs]:[];
	errs.forEach(function(error){
		// `self.errors` might be a reference, so don't replace
		self.errors.push(error);
	});
}

// look up the necessary sub-schemas to validate against a sub-instance
// (array item, object property key, or object property value)

ValidateLayer.prototype.validateProperty = function validateProperty(k){
	var self = this;
	var schema = self.schema;
	var patterns = [];
	if(schema.properties[k]){
		patterns.push(schema.properties[k]);
	}
	for(var regexp in schema.patternPropertiesRegExp){
		if(schema.patternPropertiesRegExp[regexp].test(k)){
			patterns.push(schema.patternProperties[regexp]);
		}
	}
	if(patterns.length==0 && schema.additionalProperties) return schema.additionalProperties.validate(self.errors);
	if(patterns.length==1) return patterns[0].validate(self.errors);
	return collapseArray(patterns, function(v){ return v.validate(self.errors); });
}

ValidateLayer.prototype.validateItem = function validateItem(k){
	var self = this;
	var schema = self.schema;
	var patterns = [];
	if(schema.items[k]){
		patterns.push(schema.items[k]);
	}
	if(patterns.length==0 && schema.additionalItems) return schema.additionalItems.validate(self.errors);
	if(patterns.length==1) return patterns[0].validate(self.errors);
	return collapseArray(patterns, function(v){ return v.validate(self.errors); });
}

ValidateLayer.prototype.getKeySchema = function getKeySchema(n){
	// TODO
	// return an array of ValidateLayers or something,
	// an item for every schema we want to validate against the upcoming object property
}

// Begin parsing an instance
ValidateLayer.prototype.startNumber = function startNumber(layer){
	this.addErrorList(this.schema.startNumber(layer));
}
ValidateLayer.prototype.startString = function startString(layer){
	this.addErrorList(this.schema.startString(layer));
}
ValidateLayer.prototype.startBoolean = function startBoolean(layer){
	this.addErrorList(this.schema.startBoolean(layer));
}
ValidateLayer.prototype.startNull = function startNull(layer){
	this.addErrorList(this.schema.startNull(layer));
}
ValidateLayer.prototype.startObject = function startObject(layer){
	var self = this;
	this.addErrorList(this.schema.startObject(layer));
	// If we're allowed to be an object, then index required properties
	for(var k in self.schema.required){
		if(!(k in self.requiredMap)){
			self.requiredMap[k] = false;
			self.requiredRemain++;
		}
	}
}
ValidateLayer.prototype.startArray = function startArray(layer){
	this.addErrorList(this.schema.startArray(layer));
}

ValidateLayer.prototype.endNumber = function endNumber(layer, n){
	this.addErrorList(this.schema.endNumber(layer, n));
}
ValidateLayer.prototype.endString = function endString(layer, str){
	this.addErrorList(this.schema.endString(layer, str));
}
ValidateLayer.prototype.endObject = function endObject(layer, n){
	this.addErrorList(this.schema.endObject(layer, n));
}
ValidateLayer.prototype.endArray = function endArray(layer, n){
	this.addErrorList(this.schema.endArray(layer, n));
}
ValidateLayer.prototype.endKey = function endKey(k){
	if(this.requiredMap[k]===false){
		this.requiredMap[k] = true;
		this.requiredRemain--;
	}
	//if(this.schema.propertyName){
		// ...
	//}
}
ValidateLayer.prototype.finish = function finish(layer){
	var self = this;
	// Trigger finish on child validators
	self.anyOf.forEach(function(arr){ arr.forEach(function(v){ v.finish(layer); }); });
	self.oneOf.forEach(function(arr){ arr.forEach(function(v){ v.finish(layer); }); });
	self.not.forEach(function(v){ v.finish(layer); });

	// Compute required properties errors
	if(self.requiredRemain){
		var missing = Object.keys(self.requiredMap).filter(function(k){
			return !self.requiredMap[k];
		});
		self.addErrorList(new ValidationError('Required properties missing: '+JSON.stringify(missing), layer.path, self, 'required'));
	}

	// Compute not/oneOf/anyOf failures
	var notFailures = self.not.filter(function(v){ return v.errors.length===0; });
	if(notFailures.length){
		self.addErrorList(new ValidationError('Expected "not" to fail', layer.path, this, 'not'));
	}
	// oneOf
	var oneOf = self.oneOf.map(function(arr){ return arr.map(function(v){ return v.errors.length; }); });
	self.oneOf.forEach(function(arr){
		var oneOfValid = arr.filter(function(v){ return v.errors.length===0; });
		if(oneOfValid.length!==1){
			self.addErrorList(new ValidationError('Expected "oneOf" to have exactly one matching schema', layer.path, self, 'oneOf', 1, oneOfValid.length));
		}
	});
	// anyOf
	var anyOf = self.anyOf.map(function(arr){ return arr.map(function(v){ return v.errors.length; }); });
	self.anyOf.forEach(function(arr){
		var anyOfValid = arr.filter(function(v){ return v.errors.length===0; });
		if(anyOfValid.length===0){
			self.addErrorList(new ValidationError('Expected "anyOf" to have at least one matching schema', layer.path, self, 'anyOf', 1, anyOfValid.length));
		}
	});
}
