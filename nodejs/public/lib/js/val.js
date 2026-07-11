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
			message = `Must be ${options} characters`;
		}

		//checks if empty to stop processing 
		if(!isNaN(options) && value.length === 0) {
		}else if(rule in settings.rule){
			message = settings.rule[rule].apply(this, [value, options]);
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

// Host / target validation, mirrored from the backend (utils/hostname_validate.js):
// a bare hostname or IPv4 address, no protocol / "/" / ":" / whitespace. The
// incoming host may be a wildcard ("*.example.com"); the target may not.
(function(){
	var LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
	var HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
	var FORBIDDEN = /[\s/:]/;

	function isIPv4( value ) {
		var parts = value.split( '.' );
		if ( parts.length !== 4 ) return false;
		return parts.every( function( p ) {
			return /^(0|[1-9]\d{0,2})$/.test( p ) && Number( p ) <= 255;
		});
	}

	// Incoming-host pattern: labels may be normal, "*" (one fragment), or "**"
	// (any number of fragments, incl. a bare "**" global catch-all).
	function isHostPattern( value ) {
		if ( value.length > 253 ) return false;
		return value.split( '.' ).every( function( l ) {
			return l === '*' || l === '**' || LABEL.test( l );
		});
	}

	function forbidden( value ) {
		return FORBIDDEN.test( value ) || value.includes( '://' );
	}

	// Incoming host: IPv4 or a wildcard host pattern.
	function checkHost( value ) {
		if ( typeof value !== 'string' || value.length === 0 ) return "Required";
		if ( forbidden( value ) ) return 'No protocol, "/", or ":"';
		if ( isIPv4( value ) || isHostPattern( value ) ) return;
		return "Enter a valid host or wildcard (*, **)";
	}

	// Downstream target: IPv4 or a strict hostname, no wildcard.
	function checkTarget( value ) {
		if ( typeof value !== 'string' || value.length === 0 ) return "Required";
		if ( forbidden( value ) ) return 'No protocol, "/", or ":"';
		if ( isIPv4( value ) || HOSTNAME.test( value ) ) return;
		return "Enter a valid hostname or IP";
	}

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

			// Incoming host name — hostname, IPv4, or wildcard pattern (*, **).
			host: function( value ) {
				return checkHost( value );
			},

			// Downstream target — hostname or IPv4, no wildcard.
			target: function( value ) {
				return checkTarget( value );
			},

			// Back-compat alias (no wildcard).
			hostname: function( value ) {
				return checkTarget( value );
			},

			user: function( value ) {
				var reg = /^[a-z0-9\_\-\@\.]{1,32}$/;
				if ( reg.test( value ) === false ) {
					return "Invalid";
				}
			},

			// Mirrors utils/password_policy.js: >= 8 chars, and either 12+ chars
			// or at least 3 of {lowercase, uppercase, number, symbol}.
			password: function( value ) {
				if ( typeof value !== 'string' || value.length < 8 ) {
					return "Password must be at least 8 characters";
				}
				if ( value.length >= 12 ) return;

				var classes = 0;
				if ( /[a-z]/.test( value ) ) classes++;
				if ( /[A-Z]/.test( value ) ) classes++;
				if ( /[0-9]/.test( value ) ) classes++;
				if ( /[^A-Za-z0-9]/.test( value ) ) classes++;

				if ( classes < 3 ) {
					return "Use 3 of: lowercase, uppercase, number, symbol (or 12+ chars)";
				}
			}
		}
	});
})();