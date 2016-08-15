import Kojac = require("kojac.js");

/**
 * Extends Kojac.Object to support typed attributes
 * @class Kojac.Model
 * @extends Kojac.Object
 **/
Kojac.Model = Kojac.Object.extend({
	/**
	 * This method is called when inheriting a new model from Kojac.Model, and allows attributes to be defined as
	 *   name: Class (default value is null)
	 * or
	 *   name: default value (class is inferred)
	 * or
	 *   name: [Class,default value]
	 * @param prop Hash of attributes defined as above
	 * @return Hash of attributes in expected name:value format
	 */
	setup: function(prop) {
		this.__attributes = (this._superClass && this._superClass.__attributes && _.clone(this._superClass.__attributes)) || {};
		//this.__defaults = (constructor.__defaults && _.clone(constructor.__defaults)) || {};
		for (var p in prop) {
			if (['__defaults','__attributes'].indexOf(p)>=0)
				continue;
			var propValue = prop[p];
			if (_.isArray(propValue) && (propValue.length===2) && (Kojac.FieldTypes.indexOf(propValue[0])>=0)) {  // in form property: [Type, Default Value]
				this.__attributes[p] = propValue[0];
				prop[p] = propValue[1];
			} else if (Kojac.FieldTypes.indexOf(propValue) >= 0) {   // field type
				prop[p] = null;
				this.__attributes[p] = propValue;
				//this.__defaults[p] = null;
			} else if (_.isFunction(propValue)) {
				continue;
			} else {        // default value
				var i = Kojac.FieldTypes.indexOf(Kojac.getPropertyValueType(propValue));
				if (i >= 0) {
					this.__attributes[p] = Kojac.FieldTypes[i];
				} else {
					this.__attributes[p] = null;
				}
				//this.__defaults[p] = v;
			}
		}
		return prop;
	},
	/**
	 * The base constructor for Kojac.Model. When creating an instance of a model, an optional hash aValues provides attribute values that override the default values
	 * @param aValues
	 * @constructor
	 */
	init: function(aValues){
		// we don't use base init here
		if (!aValues)
			return;
		for (var p in aValues) {
			if (this.isAttribute(p)) {
				this.attr(p,aValues[p]);
			} else {
				this[p] = aValues[p];
			}
		}
	},

	/**
	 * Determines whether the given name is defined as an attribute in the model definition. Attributes are properties with an additional class and default value
	 * @param aName
	 * @return {Boolean}
	 */
	isAttribute: function(aName) {
		return this.constructor.__attributes && (aName in this.constructor.__attributes);
	},

	/**
	 * Used various ways to access the attributes of a model instance.
	 * 1. attr() returns an object of all attributes and their values
	 * 2. attr(<name>) returns the value of a given attribute
	 * 3. attr(<name>,<value>) sets an attribute to the given value after converting it to the attribute's class
	 * 4. attr({Object}) sets each of the given attributes to the given value after converting to the attribute's class
	 * @param aName
	 * @param aValue
	 * @return {*}
	 */
	attr: function(aName,aValue) {
		if (aName===undefined) {  // read all attributes
			return _.pick(this, _.keys(this.constructor.__attributes));
		} else if (aValue===undefined) {
			if (_.isObject(aName)) {  // write all given attributes
				aValue = aName;
				aName = undefined;
				if (!this.constructor.__attributes)
					return {};
				_.extend(this,_.pick(aValue,_.keys(this.constructor.__attributes)))
			} else {                  // read single attribute
				return (_.has(this.constructor.__attributes,aName) && this[aName]) || undefined;
			}
		} else {  // write single attribute
			var t = this.constructor.__attributes[aName];
			if (t)
				aValue = Kojac.interpretValueAsType(aValue,t);
			return (this[aName]=aValue);
		}
	}
});
