"use strict";
module.exports = {
	"env": {
		"node": true,
		"es6": true,
	},
	"extends": "eslint:recommended",
	"parserOptions": {
		"ecmaVersion": 6,
	},
	"rules": {
		"indent": [ "error", "tab", { SwitchCase: 0 } ],
		"strict": ["error", "global"],
		"no-unused-vars": [ "warn", { "args": "none" } ],
		"no-unreachable": [ "error" ],
		"no-shadow": ["error", { "builtinGlobals":false, "hoist":"functions" }],
		"linebreak-style": [  "error", "unix" ],
		"semi": [ "error", "always" ],
		"comma-dangle": [ "error", "always-multiline" ],
		"no-console": [ "error" ],
	},
};
