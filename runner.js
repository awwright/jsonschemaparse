

var fs = require('fs');
var Parser = require('./parse.js').StreamParser;


var argv = process.argv.slice(2);
for(var i=0; i<argv.length; i++){
	var arg = argv[i];
	if(arg.slice(0,1)=='-') switch(arg){
		case '-v': case '--version':
			console.log();
			break;
	}
}

var dirpath = 'test/syntax-suite/test_parsing';
var syntaxTestFiles = fs.readdirSync(dirpath).filter(function(n){
	return n[0]=='y' || n[0]=='n';
});

var validationTestFiles = [
	//'tests/draft4/additionalItems.json',
	//'tests/draft4/additionalProperties.json',
	//'tests/draft4/allOf.json',
	//'tests/draft4/anyOf.json',
	'tests/draft4/default.json',
	//'tests/draft4/definitions.json',
	//'tests/draft4/dependencies.json',
	//'tests/draft4/enum.json',
	//'tests/draft4/items.json',
	'tests/draft4/maximum.json',
	'tests/draft4/maxItems.json',
	//'tests/draft4/maxLength.json',
	'tests/draft4/maxProperties.json',
	'tests/draft4/minimum.json',
	'tests/draft4/minItems.json',
	//'tests/draft4/minLength.json',
	'tests/draft4/minProperties.json',
	'tests/draft4/multipleOf.json',
	//'tests/draft4/not.json',
	//'tests/draft4/oneOf.json',
	//'tests/draft4/pattern.json',
	//'tests/draft4/patternProperties.json',
	//'tests/draft4/properties.json',
	//'tests/draft4/ref.json',
	//'tests/draft4/refRemote.json',
	//'tests/draft4/required.json',
	'tests/draft4/type.json',
	//'tests/draft4/uniqueItems.json',
];

function runSyntaxTest(spec, cb){
	
}

function runSyntaxTest(filename, done){
	var res = {
		pass: 0,
		fail: 0,
		messages: [],
		total: 0,
	};
	var filepath = dirpath + '/' + filename;
	var valid = null;
	if(filename[0]=='y') valid = true;
	else if(filename[0]=='n') valid=false;
	else return void done(new Error('Unknown test type'));
	var testError = null;
	var t = fs.createReadStream(filepath);
	var p = new Parser({}, {});
	t.pipe(p);
	p.on('error', function(err){
		if(!err) return;
		testError = err;
		result(err);
	});
	t.on('end', function(){
		if(testError) return;
		result();
	});
	function result(err){
		res.total++;
		if((valid==false && err) || (valid==true && !err)){
			res.pass++;
		}else{
			res.fail++;
			var er = {description:n, valid:valid, error:err, value:p.value};
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
		var schema = s.schema;
		var tests = s.tests;
		tests.forEach(function(t, i){
			var tjson = JSON.stringify(t.data, null, "\t");
			var p = new Parser(schema, {});
			p._transform(tjson);
			p.eof();
			res.total++;
			if(t.valid!=!!p.errors.length){
				res.pass++;
			}else{
				res.fail++;
				var er = {description:s.description, i:i, valid:t.valid, errors:p.errors, schema:schema, value:t.data};
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
	var pass = 0;
	var fail = 0;
	var total = 0;
	var messages = [];
	nextSyntaxTest(0);
	function nextSyntaxTest(i){
		var n = syntaxTestFiles[i];
		if(!n) return void nextValidationTest(0);
		runSyntaxTest(n, function(err, res){
			if(err) throw err;
			res.messages.forEach(function(v){
				console.log('Error: syntaxTest('+n+') '+v.description);
			});
			pass += res.pass;
			fail += res.fail;
			total += res.total;
			nextSyntaxTest(i+1);
		});
	}
	function nextValidationTest(i){
		var n = validationTestFiles[i];
		if(!n) return void finished(0);
		runValidationTest(n, function(err, res){
			if(err) throw err;
			res.messages.forEach(function(v){
				console.log('Error: validationTest('+n+') '+v.description+'#'+v.i);
			});
			pass += res.pass;
			fail += res.fail;
			total += res.total;
			nextValidationTest(i+1);
		});
	}
	function finished(){
		console.log(fail + ' failed');
		console.log(pass + '/' + total + ' passed');
	}
}

runTests();

