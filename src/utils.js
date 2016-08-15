Kojac = require("kojac.js");


/*
 * Global static function that combines a given array of values (any number of arguments) into a cache key string, joined by double-underscores
 * @return {String} cache key
 */
export keyJoin = function() {
	var result = null;
	for (var i=0;i<arguments.length;i++) {
		var v = arguments[i];
		if (!v)
			return null;
		if (!result)
			result = v.toString();
		else
			result += '__' + v.toString();
	}
	return result;
}

export keySplit = function(aKey) {
	var r,ia,id,a;
	var parts = aKey.split('__');
	if (parts.length>=1)      // resource
		r = parts[0];
	else
		return [];
	var result = [r];
	if (parts.length<2)
		return result;
	ia = parts[1];
	parts = ia.split('.');
	if (parts.length>=1) {    // id
		id = parts[0];
		var id_as_i = Number(id); // !!! watch for Number('') => 0
		if (_.isFinite(id_as_i))
			id = id_as_i;
		result.push(id);
	}
	if (parts.length>=2) {    // association
		result.push(parts[1]);
	}
	return result;
}

export keyResource = function(aKey) {
	var parts = aKey.split('__');
	return parts[0];
}

export keyId = function(aKey) {
	var parts = aKey.split('__');
	return parts[1];
}

export Int = {name: 'Int', toString: function() {return 'Int';}};    // represents a virtual integer type
export Null = {name: 'Null', toString: function() {return 'Null';}}; // represents a virtual Null type
Kojac.FieldTypes = [Null,Int,Number,String,Boolean,Date,Array,Object];  // all possible types for fields in Kojac.Model
Kojac.FieldTypeStrings = ['Null','Int','Number','String','Boolean','Date','Array','Object'];  // String names for FieldTypes
Kojac.SimpleTypes = [Null,Int,Number,String,Boolean,Date];  // simple field types in Kojac.Model ie. Object and Array are considered complex

/*
 * @class Kojac.Utils
 *
 * Provides static functions used by Kojac
 */
Kojac.Utils = {

	/**
	 * Converts one or more keys, given in multiple possible ways, to a standard array of strings
	 * @param aKeys one or more keys eg. as array of strings, or single comma-separated list in a single string
	 * @return {Array} array of single-key strings
	 */
	interpretKeys: function(aKeys) {
		if (_.isArray(aKeys))
			return aKeys;
		if (_.isString(aKeys))
			return aKeys.split(',');
		return [];
	},

	/**
	 * Convert object or array to [key1, value, key2, value]
	 * @param aKeyValues array or object of keys with values
	 * @return {Array} [key1, value, key2, value]
	 */
	toKeyValueArray: function(aKeyValues) {
		if (_.isArray(aKeyValues)) {
			var first = aKeyValues[0];
			if (_.isArray(first))         // this style : [[key,value],[key,value]]
				return _.map(aKeyValues,function(o){ return _.flatten(o,true) });
			else if (_.isObject(first)) {   // this style : [{key: value},{key: value}]
				var result = [];
				for (var i=0; i<aKeyValues.length; i++)
					result.push(_.pairs(aKeyValues[i]));
				return _.flatten(result);
			} else
				return aKeyValues;          // assume already [key1, value, key2, value]
		} else if (_.isObject(aKeyValues)) {
			return _.flatten(_.pairs(aKeyValues),true); // this style : {key1: value, key2: value}
		} else
			return null;    // unrecognised input
	},

	// pass a copy aPropListFn aCopyFn when you have a complex object eg. ember class. It will not be passed on to recursive calls
	toJsono: function(aValue,aOptions,aPropListFn,aCopyFn) {
		if (_.isObjectStrict(aValue)) {
			if (!aPropListFn && !aCopyFn && ("toJsono" in aValue))
				aValue = aValue.toJsono(aOptions || {});
			else {
				var aDest = {};
				aOptions = _.clone(aOptions);
				var aProperties = aPropListFn ? aPropListFn(aValue) : aValue;    // may return an array of properties, or an object to use the keys from
				var aInclude = (aOptions && _.removeKey(aOptions,'include')); // must be an array
				if (_.isString(aInclude))
					aInclude = aInclude.split(',');
				if (aInclude && aInclude.length) {
					if (_.isArray(aProperties))          //ensure aProperties is an array to add includes
						aProperties = _.clone(aProperties);
					else
						aProperties = _.keys(aProperties);
					for (var i=0;i<aInclude.length;i++)
						aProperties.push(aInclude[i]);
				}
				var aExclude = (aOptions &&  _.removeKey(aOptions,'exclude'));  // must be an array
				if (_.isString(aExclude))
					aExclude = aExclude.split(',');
				var p;
				var v;
				if (_.isArray(aProperties)) {
					for (var i=0;i<aProperties.length;i++) {
						p = aProperties[i];
						if (aExclude && (aExclude.indexOf(p)>=0))
							continue;
						if (aCopyFn)
							aCopyFn(aDest,aValue,p,aOptions);
						else {
							aDest[p] = Kojac.Utils.toJsono(aValue[p],aOptions);
						}
					}
				} else {  // properties is an object to use keys from
					for (p in aProperties) {
						if (aExclude && (aExclude.indexOf(p)>=0))
							continue;
						if (aCopyFn)
							aCopyFn(aDest,aValue,p,aOptions);
						else {
							aDest[p] = Kojac.Utils.toJsono(aValue[p],aOptions);
						}
					}
				}
				aValue = aDest;
			}
		} else if (_.isArray(aValue)) {
			var result = [];
			for (var i=0; i<aValue.length; i++)
				result.push(Kojac.Utils.toJsono(aValue[i],aOptions));
			aValue = result;
		} else if (_.isDate(aValue)) {
			aValue = Kojac.interpretValueAsType(aValue,String);
		}
		return aValue;
	},

	// returns an id above the normal 32 bit range of rails but within the range of Javascript
	createId: function () {
		return _.randomIntRange(4294967296,4503599627370496); // 2**32 to 2**52 see http://stackoverflow.com/questions/9389315/cross-browser-javascript-number-precision
	},

	timestamp: function() {
		return new Date().getTime();
	},

	resolvedPromise: function() {
		var d = jQuery.Deferred();
		return d.resolve.apply(d,arguments);
	}
};
export Kojac.Utils;
