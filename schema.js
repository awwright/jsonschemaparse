
module.exports.Schema = Schema;

function Schema(sch){
	var self = this;
	self.allowNumber = true;
	self.allowString = true;
	self.allowBoolean = true;
	self.allowNull = true;
	self.allowObject = true;
	self.allowArray = true;
	self.allowFraction = true;
	self.maximum = null;
	self.exclusiveMaximum = null;
	self.minimum = null;
	self.exclusiveMinimum = null;
	self.anyOf = [];
	self.oneOf = [];
	//self.typeConstraints = [];
	self.items = [];
	self.additionalItems = null;
	//self.propertyNameSchema = null;
	//self.propertyValueSchema = null;

	if(!sch) return;

	function importSchema(s){
		// Keyword: "type"
		if(typeof s.type=='string'){
			if(s.type!='number' && s.type!='integer') self.allowNumber=false;
			if(s.type!='string') self.allowString=false;
			if(s.type!='boolean') self.allowBoolean=false;
			if(s.type!='null') self.allowNull=false;
			if(s.type!='object') self.allowObject=false;
			if(s.type!='array') self.allowArray=false;
		}else if(Array.isArray(s.type)){
			if(s.type.indexOf('number')<0 && s.type.indexOf('integer')<0) self.allowNumber=false;
			if(s.type.indexOf('string')<0) self.allowString=false;
			if(s.type.indexOf('boolean')<0) self.allowBoolean=false;
			if(s.type.indexOf('null')<0) self.allowNull=false;
			if(s.type.indexOf('object')<0) self.allowObject=false;
			if(s.type.indexOf('array')<0) self.allowArray=false;
		}else if(s.type!==undefined){
			throw new Error('Invalid "type"');
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
		// Keyword: "multipleOf"
		if(typeof s.multipleOf=='number'){
			self.multipleOf = s.multipleOf;
		}
		// Keyword: "items"
		if(Array.isArray(s.items)){
			self.items = s.items.map(function(v){ return new Schema(v); });
		}
		// Keyword: "additionalItems"
		if(typeof s.additionalItems=='object'){
			self.additionalItems = new Schema(s.additionalItems);
		}
	}

	importSchema(sch);
	if(sch.allOf){
		sch.allOf(function(sc){ importSchema(sc); });
	}
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
	if(!error) return;
	return new Error('Number out of range');
}


Schema.prototype.testConditionalsBegin = function(){
	var schema = this;
	// Return a stateful object representing which schemas have passed/failed
	var o = {
		oneOf: schema.oneOf.slice(),
		anyOf: schema.anyOf.slice(),
	}
}
