/*
Author William Mantly Jr <wmantly@gmail.com>
https://github.com/wmantly/jq-repeat
MIT license
*/

(function($, Mustache){
'use strict';
	var scope = {};

	$.scope = new Proxy(scope, {
		get(obj, prop){
			if(!obj[prop]){
				scope[prop] = [];
			}
			return Reflect.get(...arguments);
		},
		set(obj, prop, value) {

		    return Reflect.set(...arguments);
		},
	});

	var make = function(element, template){
		var result = [];

		result.splice = function(inputValue, ...args){
			//splice does all the heavy lifting by interacting with the DOM elements.

			var toProto = [...args]

			var index;
			//if a string is submitted as the index, try to match it to index number
			if(typeof arguments[0] === 'string'){
				index = this.indexOf( arguments[0] );//set where to start
				if (index === -1) {
					return [];
				}
			}else{
				index = arguments[0]; //set where to start
			}

			toProto.unshift(index)

			var howMany = arguments[1]; //sets the amount of fields to remove
			var args = Array.prototype.slice.call( arguments ); // coverts arguments into array 
			var toAdd = args.slice(2); // only keeps fields to add to array

			// if the starting point is higher then the total index count, start at the end
			if( index > this.length ) {
				index = this.length;
			}
			// if the starting point is negative, start form the end of the array, minus the start point
			if( index < 0 ) {
				index = this.length - Math.abs( index );
			}

			// if there are things to add, figure out the how many new indexes we need
			if( !howMany && howMany !== 0 ) {
				howMany = this.length - index;
			}
			//not sure why i put this here... but it does matter!
			if( howMany > this.length - index ) {
				howMany = this.length - index;
			}

			//figure out how many positions we need to shift the current elements
			var shift = toAdd.length - howMany;

			// figure out how big the new array will be
			// var newLength = this.length + shift;

			//removes fields from array based on howMany needs to be removed
			for( var i = index; i < +index+howMany; i++ ) {
				this.__take(this[index].__jq_$el, this[index], this);
				// this.__take.apply( $( '.jq-repeat-'+ this.__jqRepeatId +'[jq-repeat-index="'+ ( i + index ) +'"]' ) );
			}

			//re-factor element index's
			for(var i = 0; i < this.length; i++){
				if(  i >= index){

					this[i].__jq_$el.attr( 'jq-repeat-index', i+shift );
				}
			}

			//if there are fields to add to the array, add them
			if( toAdd.length > 0 ){

				//$.each( toAdd, function( key, value ){
				for(var I = 0; I < toAdd.length; I++){
					
					//figure out new elements index
					var key = I + index;
					// apply values to template
					var render = Mustache.render(this.__jqTemplate, this.__buildData(i, toAdd[I]));
					
					//set call name and index keys to DOM element
					var $render = $( render ).addClass( 'jq-repeat-'+ this.__jqRepeatId ).attr( 'jq-repeat-index', key );

					//if add new elements in proper stop, or after the place holder.
					if( key === 0 ){
						this.$this.after( $render );
					}else{
						$( '.jq-repeat-'+ this.__jqRepeatId +'[jq-repeat-index="' + ( key -1 ) + '"]' ).after( $render );
					}

					Object.defineProperty( toAdd[I], "__jq_$el", {
						value: $render,
						writable: true,
						enumerable: false,
						configurable: true
					} );
					
					//animate element
					this.__put($render, toAdd[I], this);
				}
			}
			
			//set and return new array
			return Array.prototype.splice.apply(this, toProto);
		};

		result.push = function(){
			//add one or more objects to the array

			//set the index value, if none is set make it zero
			var index = this.length || 0;
			
			//loop each passed object and pass it to slice
			for (var i = 0 ; i < arguments.length; ++i) {
				this.splice( ( index + i ), 0, arguments[i] );
			}

			//return new array length
			return this.length;
		};

		result.pop = function(){
			//remove and return array element

			return this.splice( -1, 1 )[0];
		};

		result.reverse = function() {
			let hold = [];
			for(let item of this){
				hold.push(item.__jq_$el.html())
			}

			for(let idx in hold.reverse()){
				this[idx].__jq_$el.html(hold[idx]);
			}

			Array.prototype.reverse.apply( this );

			return this;
		};

		result.remove = function(key, value){
			let index = this.indexOf(key, value)
			if(index === -1) return;
			this.splice(index, 1)
		}

		result.shift = function() {
			return this.splice( 0, 1 )[0];
		};

		result.unshift = function(data){
			return this.splice(0,0, data)
		}

		result.loop = function(){
			var temp = this[0];
			this.splice( 0,1 );
			this.push( temp );

			return temp;
		};

		result.loopUp = function(){
			var temp = this[this.length-1];
			this.splice( -1, 1 );
			this.splice( 0, 0, temp );
			return temp;
		};

		result.indexOf =  function( key, value ){
			if(typeof key === 'number') return key;
			
			if( typeof value !== 'string' ){
				value = arguments[0];
				key = this.__index;
			}
			for ( var index = 0; index < this.length; ++index ) {
				if( this[index][key] === value ){

					return index;
				}
			}
			return -1;
		};

		result.update = function(key, value, data){
			//set variables using sting for index

			// If update is called with no index/key, assume its the 0
			if(typeof key === 'object'){
				if(this[0]){
					return this.update(0, key);
				}
				return this.splice(0, 1, key);
			}

			if(typeof value !== 'string'){
				data = arguments[1];
				if(typeof key !== 'number'){
					value = arguments[0];
					key = this.__index;
				}
			}

			var index = this.indexOf( key, value );

			if(index === -1) {
				return [];
			}
			this[index] = $.extend( true, this[index], data );

			var $render = $(Mustache.render(this.__jqTemplate, this.__buildData(index, this[index])));
			$render.attr('jq-repeat-index', index);

			this.__update(this[index].__jq_$el, $render, this[index], this);
			this[index].__jq_$el = $render;
		};
		
		result.getByKey = function(key, value){
			return this[this.indexOf(key, value)];
		}

		// User definable helper methods

		result.__put = function($el, item, list){
			$el.show();
		};

		result.__take = function($el, item, list){
			$el.remove();
		};

		result.__update = function($el, $render, item, list){
			$el.replaceWith($render);
			$el.show();
		};

		result.__parseData = function(data){
			return data;
		}

		// internal helper methods

		result.__buildData = function(index, data){
			return {
				...this.__parseData(data),
				nestedTemplates: this.__parseNestedTemplates(index, data),
				_parent: this.__jqParent ? $.scope[this.__jqParent][this.__jqParentIndex] : undefined,
			};
		};

		result.__parseNestedTemplates = function(index, data){
			let templates = []
			let tempData = {
				...data,
				_parent: data,
			};

			for(let idx in this.nestedTemplates){
				let $el = $(`${this.nestedTemplates[idx]}`);

				$el.attr('jq-repeat', Mustache.render($el.attr('jq-repeat'), tempData));
				$el.attr('jq-repeat-index', Mustache.render($el.attr('jq-repeat-index'), tempData));
				$el.attr('jq-repeat-parent', this.__jqRepeatId);
				$el.attr('jq-repeat-parent-index', index);
				templates[idx] = $el[0].outerHTML;
			}

			return templates;
		}

		for(let prop of ['put', 'take', 'update', 'parseData']){
			Object.defineProperty(result, prop, {
				enumerable: false,
				get(){
					return this[`__${prop}`]
				},
				set(value) {
					this[`__${prop}`] = value;
				},
			});
		}

		if($this.attr('jq-repeat-parent')){
			result.__jqParent = $this.attr('jq-repeat-parent');
			result.__jqParentIndex = $this.attr('jq-repeat-parent-index');
		}

		$this.find('[jq-repeat]').each((idx, el)=>{
			let templateIdx = result.nestedTemplates.length;
			let template = `${el.outerHTML}`;
			result.nestedTemplates.push(template);
			$(el).replaceWith(`{{{ nestedTemplates.${templateIdx} }}}`);
		});

		var $this = $(element); 
		result.nestedTemplates = [];
		result.__jqRepeatId = $this.attr( 'jq-repeat' );
		$this.removeAttr('jq-repeat');
		result.__index = $this.attr('jq-repeat-index');
		result.__jqTemplate = $this[0].outerHTML;
		$this.replaceWith( '<script type="x-tmpl-mustache" id="jq-repeat-holder-' + result.__jqRepeatId + '"><\/script>' );
		result.$this = $('#jq-repeat-holder-' + result.__jqRepeatId);

		Mustache.parse(result.__jqTemplate);   // optional, speeds up future uses

		for(let key in result){
			Object.defineProperty(result, key, {
				value: result[key],
				writable: true,
				enumerable: false,
				configurable: true
			});
		}

		var temp = $.scope[result.__jqRepeatId] || [];
		$.scope[result.__jqRepeatId] = result;

		for(let prop of Object.keys(temp)){
			if(prop,Number.isInteger(Number(prop))){
				$.scope[result.__jqRepeatId].push(temp[prop]);
			}else{
				$.scope[result.__jqRepeatId][prop] = temp[prop];
			}
		}
		
	};

	$( document ).ready( function(){

		// Create an instance of MutationObserver and pass the callback function
		const observer = new MutationObserver(function(mutationsList) {
			mutationsList.forEach(mutation => {
				if (mutation.type === 'childList') {
					const addedNodes = mutation.addedNodes;
					addedNodes.forEach(node => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							const $el = $(node);
							if ($el.is('[jq-repeat]')) {
								make(node);
							} else {
								const toMake = [];
								$el.find('[jq-repeat]').each((key, el) => {
									if ($(el).parent().closest('[jq-repeat]').length) return;
									toMake.push(el);
								});

								toMake.forEach(el => {
									make(el);
								});
							}
						}
					});
				}
			});
		});

		// Start observing the document
		observer.observe(document.body, { childList: true, subtree: true });

		let toMake = [];

		$( '[jq-repeat]' ).each(function(key, value){
			if($(value).parent().closest('[jq-repeat]').length) return;
			toMake.push(value);
		});

		for(let el of toMake){
			make(el);
		}
	} );

})(jQuery, Mustache);
