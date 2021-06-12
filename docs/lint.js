"use strict";

window.addEventListener('DOMContentLoaded', function(){
	const { body } = document;
	const { localStorage } = window;
	var selectorForm = document.getElementById('theme-selector');
	function handleThemeChange(e){
		body.className = e.target.value;
		localStorage.setItem('theme-selector', e.target.value);
	}
	for(var i=selectorForm.firstElementChild; i; i=i.nextElementSibling){
		i.firstElementChild.addEventListener('change', handleThemeChange);
	}
	// Restore the last used theme, if any
	if(localStorage.getItem('theme-selector')){
		body.className = localStorage.getItem('theme-selector');
	}
});
