/**
 * @class Kojac.Object
 *
 * Based on :
 * Simple JavaScript Inheritance
 * By John Resig http://ejohn.org/blog/simple-javascript-inheritance/
 * MIT Licensed.
 *
 * Inspired by base2 and Prototype
 *
 * added setup method support inspired by CanJs as used in Kojac.Model
 *
 */
(function(){
  var initializing = false, fnTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/;
  // The base JrClass implementation (does nothing)
  this.JrClass = function(aProperties){
	  if (initializing) { // making prototype
	    if (aProperties) {
		    _.extend(this,aProperties);
		    _.cloneComplexValues(this);
	    }
		} else {            // making instance
	    _.cloneComplexValues(this);
	    if (this.init)
		    this.init.call(this,aProperties);
		}
  };
	this.JrClass.prototype.init = function(aProperties) {
		_.extend(this,aProperties);
	};
	this.JrClass.prototype.toJSON = function() { // this adds an instance method used by JSON2 that returns an object containing all immediate and background properties (ie from the prototype)
		return _.clone(this);
	};

  // Create a new JrClass that inherits from this class
	this.JrClass.extend = function(prop) {
    var _super = this.prototype;

    // Instantiate a base class (but only create the instance,
    // don't run the init constructor)
    initializing = true;
    var prototype = new this();
    initializing = false;

    // The dummy class constructor
    function JrClass(aProperties) {
	    if (initializing) { // making prototype
		    if (aProperties) {
			    _.extend(this,aProperties);
			    _.cloneComplexValues(this);
		    }
			} else {            // making instance
		    _.cloneComplexValues(this);
		    if (this.init)
			    this.init.call(this,aProperties);
			}
    }

		JrClass._superClass = this;

		if (_super.setup)
			prop = _super.setup.call(JrClass,prop);

    // Copy the properties over onto the new prototype
    for (var name in prop) {
      // Check if we're overwriting an existing function
	    var t = typeof prop[name];//_.typeOf(prop[name]);
	    if (t == "function" && typeof _super[name] == "function" && fnTest.test(prop[name])) {
		    prototype[name] =
	        (function(name, fn){
	          return function() {
	            var tmp = this._super;

	            // Add a new ._super() method that is the same method
	            // but on the super-class
	            this._super = _super[name];

	            // The method only need to be bound temporarily, so we
	            // remove it when we're done executing
	            var ret = fn.apply(this, arguments);
	            this._super = tmp;

	            return ret;
	          };
	        })(name, prop[name]);
	    } else if (t==='array' || t==='object') {
        prototype[name] = _.clone(prop[name]);
	    } else {
	      prototype[name] = prop[name];
	    }
    }

    // Populate our constructed prototype object
    JrClass.prototype = prototype;

    // Enforce the constructor to be what we expect
    JrClass.prototype.constructor = JrClass;

    // And make this class extendable
    JrClass.extend = arguments.callee;

    return JrClass;
  };
	Kojac.Object = this.JrClass;
})();
