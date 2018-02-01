

var fs = require('fs');
var SchemaRegistry = require('./index.js').SchemaRegistry;
var Schema = require('./index.js').Schema;
var Parser = require('./index.js').StreamParser;

Error.stackTraceLimit = 25;

var argv = process.argv.slice(2);
for(var i=0; i<argv.length; i++){
	var arg = argv[i];
	if(arg.slice(0,1)=='-') switch(arg){
		case '-v': case '--version':
			console.log();
			break;
	}
}

var syntaxTestDir = 'test/syntax-suite/test_parsing';
var syntaxTestFiles = fs.readdirSync(syntaxTestDir).filter(function(n){
	return n[0]=='y' || n[0]=='n';
});

var validationTestFiles = [
	'tests/draft7/additionalItems.json',
	'tests/draft7/additionalProperties.json',
	'tests/draft7/allOf.json',
	//'tests/draft7/anyOf.json',
	'tests/draft7/default.json',
	//'tests/draft7/definitions.json',
	//'tests/draft7/dependencies.json',
	//'tests/draft7/enum.json',
	'tests/draft7/items.json',
	'tests/draft7/maximum.json',
	'tests/draft7/maxItems.json',
	//'tests/draft7/maxLength.json',
	'tests/draft7/maxProperties.json',
	'tests/draft7/minimum.json',
	'tests/draft7/minItems.json',
	//'tests/draft7/minLength.json',
	'tests/draft7/minProperties.json',
	'tests/draft7/multipleOf.json',
	//'tests/draft7/not.json',
	//'tests/draft7/oneOf.json',
	'tests/draft7/pattern.json',
	'tests/draft7/patternProperties.json',
	'tests/draft7/properties.json',
	//'tests/draft7/ref.json',
	//'tests/draft7/refRemote.json',
	'tests/draft7/required.json',
	'tests/draft7/type.json',
	//'tests/draft7/uniqueItems.json',
];

function runSyntaxTest(filename, done){
	var res = {
		pass: 0,
		fail: 0,
		messages: [],
		total: 0,
	};
	var filepath = syntaxTestDir + '/' + filename;
	var valid = null;
	if(filename[0]=='y') valid = true;
	else if(filename[0]=='n') valid=false;
	else return void done(new Error('Unknown test type'));
	var testError = null;
	var t = fs.createReadStream(filepath);
	var p = new Parser(null, {keepValue:true});
	t.pipe(p);
	p.on('error', function(err){
		if(!err) return;
		testError = err;
		result(err);
	});
	p.on('finish', function(){
		if(testError) return;
		fs.readFile(filepath, fileContent);
	});
	function fileContent(err, content){
		if(err) throw err;
		result(null, content);
	}
	function result(err, content){
		try{
			var ecmaJSON = JSON.stringify(JSON.parse(content.toString()));
			var localJSON = JSON.stringify(p.value);
		}catch(e){}
		res.total++;
		if((valid==false && err) || (valid==true && !err)){
			if(ecmaJSON!==localJSON){
				res.fail++;
				var er = {description:'JSON parse mismatch', valid:valid, error:null, value:p.value, json:content.toString(), ecmaJSON:ecmaJSON, localJSON:localJSON};
				res.messages.push(er);
			}else{
				res.pass++;
			}
		}else{
			res.fail++;
			var er = {description:err.stack, valid:valid, error:err, value:p.value};
			res.messages.push(er);
		}
		return void done(null, res);
	}
}

function runValidationTest(filepath, done){
	var res = {
		pass: 0,
		fail: 0,
		messages: [],
		total: 0,
	};
	var schemas = require('./test/schema-suite/'+filepath);
	//console.log(filepath + ' ...');
	schemas.forEach(function(s){
		var tests = s.tests;
		tests.forEach(function(t, i){
			var tjson = JSON.stringify(t.data, null, "\t");
			var throws = false;
			try {
				var registry = new SchemaRegistry;
				var schema = registry.import('http://localhost/'+filepath, s.schema);
				var p = schema.createParser({charset:'string'});
				p.parse(tjson);
			}catch(e){
				throws = e;
			}
			res.total++;
			if(throws){
				res.fail++;
				var er = {description:t.description, i:i, valid:t.valid, errors:throws, schema:s.schema, value:t.data};
				res.messages.push(er);
			}else if(t.valid!=!!p.errors.length){
				res.pass++;
			}else{
				res.fail++;
				var er = {description:t.description, i:i, valid:t.valid, errors:p.errors, schema:s.schema, value:t.data};
				res.messages.push(er);
				//console.error('  Error: ('+er.description+') expected '+(er.valid?'valid':'invalid')+' but got '+er.errors.length+' errors');
				//console.log(er.schema, er.value);
				//console.error(er.errors);
			}
		});
	});
	return void done(null, res);
}

function runTests(){
	var totalFail = 0;
	var pass = 0;
	var fail = 0;
	var total = 0;
	var messages = [];
	console.log('Running syntax tests...');
	nextSyntaxTest(0);
	function nextSyntaxTest(i){
		var n = syntaxTestFiles[i];
		console.log('Running syntax test:', n);
		if(!n) return void finishSyntaxTests();
		runSyntaxTest(n, function(err, res){
			if(err) throw err;
			res.messages.forEach(function(v){
				console.log('Error: syntaxTest('+n+') '+v.description);
				console.log(v.json);
				console.log(v.ecmaJSON);
				console.log(v.localJSON);
			});
			pass += res.pass;
			fail += res.fail;
			totalFail += res.fail;
			total += res.total;
			nextSyntaxTest(i+1);
		});
	}
	function finishSyntaxTests(){
		if(fail) console.log('Running syntax tests: ' + fail + ' failed');
		console.log('Running syntax tests: ' + pass + '/' + total + ' passed');
		console.log('Running validation tests...');
		pass = 0;
		fail = 0;
		total = 0;
		nextValidationTest(0);
	}
	function nextValidationTest(i){
		var n = validationTestFiles[i];
		if(!n) return void finishValidationTests(0);
		runValidationTest(n, function(err, res){
			if(err) throw err;
			res.messages.forEach(function(v){
				//console.log('Error: validationTest('+n+') '+v.description, v);
				console.log('Error: validationTest('+n+') '+v.description);
				console.dir(v, {depth:10});
			});
			pass += res.pass;
			fail += res.fail;
			totalFail += res.fail;
			total += res.total;
			process.nextTick(nextValidationTest.bind(null, i+1));
		});
	}
	function finishValidationTests(){
		if(fail) console.log('Validation tests: ' + fail + ' failed');
		console.log('Validation tests: ' + pass + '/' + total + ' passed');
		//if(totalFail) process.exit(1);
	}
}

runTests();

