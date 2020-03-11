module.exports = {
	"env": {
		  "mocha": true,
		  "es6": true,
	},
	"extends": "eslint:recommended",
	"parserOptions": {
		"ecmaVersion": 6,
	},
	"rules": {
		"indent": [ "error", "tab", { SwitchCase: 0 } ],
		"no-unused-vars": [ "warn" ],
		"no-unreachable": [ "warn" ],
		"linebreak-style": [  "error", "unix" ],
		//"semi": [ "error", "always" ],
		"comma-dangle": [ "error", "always-multiline" ],
		"no-console": [ "warn" ],
	}
};
