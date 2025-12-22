( function( $ ) {
	var settings = {
		rule: {
			eq: function(value, options){
				var compare = $('[name=' + options + ']').val();
	 
				if ( value != compare ) {
					return "Miss-match";
				}
			}
		},
	};

	$.fn.validate = function(event) {
		// let	thisSettings = $.extend(true, settings, settingsObj);
		let hasErrors = false;

		if(this.is('[validate]')) return this.validateField(event);

		if(!this.attr('isValid')){
			console.log('adding reset event')
			this.on('reset', function(){
				$(this).attr('isValid', false);
				$(this).validateClear();
			})
		}

		this.find('[validate]').each(function(){
			if(!$(this).validateField()) hasErrors = true;
		});
		
		this.attr('isValid', !hasErrors);

		if(hasErrors && event) event.preventDefault();

		return !hasErrors;
	};

	$.fn.validateClear = function(){
		$(this).find('input').each(function(){
			$(this).removeClass('is-invalid');
			$(this).removeClass('is-valid');
		})
	}

	$.fn.validateField = function(){
		var attr = this.attr('validate').split(':'); //array of params
		var	rule = attr[0];
		var	options = attr[1];
		var	value = this.val(); //link to input value
		var message;

		if(this.prop('disabled')) return true;


		//checks if field is required, and length 
		if(!isNaN(options) && value.length < options){
			message = options == 1 ? 'Required' : `Must be ${options} characters`;
		}

		//checks if empty to stop processing 
		if(!isNaN(options) && value.length === 0) {
		}else if(rule in settings.rule){
			let message = settings.rule[rule].apply(this, [value, options]);
		}

		this.validateMessage(message)
		return !message;
	}

	$.fn.validateMessage = function(message){
		if(message && message !== true){
			this.closest('.form-group').find('b.invalid-feedback').html(message);
			this.addClass('is-invalid');
		}else{
			this.removeClass('is-invalid');
			this.addClass('is-valid');
		}
		return this;
	};

	jQuery.extend({
		validateSettings: function( settingsObj ) {
			$.extend( true, settings, settingsObj );
		},

		validateInit: function( ettingsObj ) {
			$( '[action]' ).on( 'submit', function ( event, settingsObj ){
				$( this ).validate( settingsObj, event );
			});
		}
	});

}( jQuery ));

$.validateSettings({
	rule:{
		ip: function( value ) {
			value = value.split( '.' );
 
			if ( value.length != 4 ) {
				return "Malformed IP";
			}
 
			$.each( value, function( key, value ) {
				if( value > 255 || value < 0 ) {
					return "Malformed IP";
				}
			});
		},

		host: function( value ) {
			var reg = /^(?=.{1,255}$)[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?)*\.?$/;
			if ( reg.test( value ) === false ) {
				return "Invalid";
			}
		},

		user: function( value ) {
			var reg = /^[a-z0-9\_\-\@\.]{1,32}$/;
			if ( reg.test( value ) === false ) {
				return "Invalid";
			}
		},
 
		password: function( value ) {
			var reg = /^(?=[^\d_].*?\d)\w(\w|[!@#$%]){1,48}/;
			if ( reg.test( value ) === false ) {
				return "Weak password, Try again";
			}
		}
	}
});