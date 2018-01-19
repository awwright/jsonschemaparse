
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



function isSchema(s){
	return (typeof s=='object' && !Array.isArray(s)) || (typeof s=='boolean');
}

function SchemaContext(){

}
SchemaContext.prototype.error = function(){

}

module.exports.Schema = Schema;
function Schema(sch){
	var self = this;
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
	self.additionalProperties = null;
	self.testsType = [];
	self.testsNumber = [];
	self.testsString = [];
	self.testsArray = [];
	self.testsObject = [];

	if(!sch) return;
	self.intersect(sch);
	if(sch.allOf){
		if(!Array.isArray(sch.allOf)){
			throw new Error('"allOf" not an array');
		}
		sch.allOf.forEach(function(sc){ self.intersect(sc); });
	}
	//console.log(self);
}

Schema.prototype.intersect = function intersect(s){
	var self = this;
	if(s===false){
		self.allowNumber = self.allowString = self.allowBoolean = self.allowNull = self.allowObject = self.allowArray = false;
		return;
	}else if(s===true){
		s = {};
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
		self.testsType.push(testType.bind(s, [s.type]));
	}else if(Array.isArray(s.type)){
		if(s.type.indexOf('number')<0 && s.type.indexOf('integer')<0) self.allowNumber=false;
		if(s.type.indexOf('number')<0) self.allowFraction=false;
		if(s.type.indexOf('string')<0) self.allowString=false;
		if(s.type.indexOf('boolean')<0) self.allowBoolean=false;
		if(s.type.indexOf('null')<0) self.allowNull=false;
		if(s.type.indexOf('object')<0) self.allowObject=false;
		if(s.type.indexOf('array')<0) self.allowArray=false;
		self.testsType.push(testType.bind(s, s.type));
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
			self.items[i] = self.items[i] || new Schema;
			self.items[i].intersect(s2);
		});
		if(isSchema(s.additionalItems)){
			self.additionalItems = self.additionalItems || new Schema();
			self.additionalItems.intersect(s.additionalItems);
		}
	}else if(isSchema(s.items)){
		self.additionalItems = self.additionalItems || new Schema();
		self.additionalItems.intersect(s.items);
	}
	// Keyword: "properties"
	if(typeof s.properties==='object'){
		for(var k in s.properties){
			if(isSchema(s.properties[k])){
				self.properties[k] = self.properties[k] || new Schema();
				self.properties[k].intersect(s.properties[k]);
			}else if(s.properties[k]!==undefined){
				throw new Error('Value in "properties" must be a schema');
			}
		}
	}else if(s.properties!==undefined){
		console.log(s.properties)
		throw new Error('"properties" must be an object');
	}
	// Keyword: "additionalProperties"
	if(isSchema(s.additionalProperties)){
		self.additionalProperties = self.additionalProperties || new Schema();
		self.additionalProperties.intersect(s.additionalProperties);
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
	// Update indexes
	if(self.allowNumber) self.allowedTypes.push('number');
	if(self.allowString) self.allowedTypes.push('string');
	if(self.allowBoolean) self.allowedTypes.push('boolean');
	if(self.allowNull) self.allowedTypes.push('null');
	if(self.allowObject) self.allowedTypes.push('object');
	if(self.allowArray) self.allowedTypes.push('array');
}

function testType(ctx, v){

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

Schema.prototype.testObjectBegin = function(){
	var schema = this;
	// Return a stateful object representing which schemas have passed/failed
	return new ValidateObject(schema);
}
