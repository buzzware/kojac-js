Kojac = {};

/*
 * Function used to determine the data type class of the given value
 * @param {*} aValue
 * @return {Class} eg. see Kojac.FieldTypes
 */
Kojac.getPropertyValueType = function(aValue) {
	var t = _.typeOf(aValue);
	var result;
	switch(t) {
		case 'number':   // determine number or int
			result = (Math.floor(aValue) === aValue) ? Int : Number;
			break;
		default:
		case 'undefined':
		case 'null':
			result = Null;
			break;
		case 'string':
			result = String;
			break;
		case 'boolean':
			result = Boolean;
			break;
		case 'array':
			result = Array;
			break;
		case 'object':
			result = Object;
			break;
		case 'date':
			result = Date;
			break;
		case 'function':
		case 'class':
		case 'instance':
		case 'error':
			result = null;
			break;
	}
	return result;
};


/*
 * Function used to interpret aValue as the given aDestType which is one of the supported data type classes
 * @param {*} aValue any value
 * @param {Class} aDestType Class used to interpret aValue
 * @return {*} aValue interpreted as destination type
 */
Kojac.interpretValueAsType = function(aValue, aDestType) {
	var sourceType = Kojac.getPropertyValueType(aValue);
	if (aDestType===sourceType)
		return aValue;
	switch (aDestType) {
		case Null:
			return aValue;
			break;
		case String:

			switch(sourceType) {
				case Int:
				case Number:
				case Boolean:
					return aValue.toString();
					break;
				case Date:
					return moment(aValue).toISOString();
				default:
				case Null:
					return null;
					break;
			}

			break;
		case Boolean:
			return _.toBoolean(aValue,null);
			break;

		case Number:

			switch(sourceType) {
				case Null:
				default:
					return null;
					break;
				case Boolean:
					return aValue ? 1 : 0;
					break;
				case Int:
					return aValue;
					break;
				case String:
					if (aValue.trim()=='')
						return null;
					var n = Number(aValue);
					return isFinite(n) ? n : null;
					break;
			}
			break;

		case Int:

			switch(sourceType) {
				case Null:
				default:
					return null;
					break;
				case Boolean:
					return aValue ? 1 : 0;
					break;
				case Number:
					return isFinite(aValue) ? Math.round(aValue) : null;
					break;
				case String:
					if (aValue.trim()=='')
						return null;
					var n = Number(aValue);
					return isFinite(n) ? Math.round(n) : null;
					break;
			}

			break;
		case Date:
			switch(sourceType) {
				case String:
					return moment.utc(aValue).toDate();
					break;
				case Number:
					return new Date(aValue);
					break;
				case Null:
				default:
					return null;
					break;
			}
			break;
		case Object:
			return null;
			break;
		case Array:
			return null;
			break;
	}
	return null;
};

/*
 * Function used to read values from a given source object into the given destination object, using the given aDefinition
 * @param {Object} aDestination
 * @param {Object} aSource
 * @param {Object} aDefinition
 * @return {Object} aDestination object
 */
Kojac.readTypedProperties = function(aDestination, aSource, aDefinition) {
	for (p in aSource) {
		if (p in aDefinition) {
			var value = aSource[p];
			var destType = aDefinition[p];
			if (destType===undefined)
				throw Error('no definition for '+p);
			aDestination[p] = Kojac.interpretValueAsType(value,destType);
		} else if (aDefinition.__options===undefined || aDefinition.__options.allowDynamic===undefined || aDefinition.__options.allowDynamic==true) {
			aDestination[p] = aSource[p];
		}
	};
	return aDestination;
};

/*
 * Returns an array of objects from the cache, based on a prefix and an array of ids
 * @param {String} aPrefix
 * @param {Array} aIds
 * @param {Object} aCache
 * @return {Array} of values from cache
 */
Kojac.collectIds = function(aPrefix,aIds,aCache,aFilterFn) {
	var result = [];
	var item;
	for (var i=0;i<aIds.length;i++) {
		item = aCache[aPrefix+'__'+aIds[i]];
		if (!aFilterFn || aFilterFn(item))
			result.push(item);
	}
	return result;
};

export Kojac;
