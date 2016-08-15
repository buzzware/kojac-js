/**
 * Represents a single Kojac operation ie. READ, WRITE, UPDATE, DELETE or EXECUTE
 * @class Kojac.Operation
 * @extends Kojac.Object
 */
Kojac.Operation = Kojac.Object.extend({
	request: this,
	verb: null,
	key: null,
	value: undefined,
	results: null,
	result_key: null,
	result: undefined,
	error: null,         // set with some truthy error if this operation fails
	performed: false,
	fromCache: null,     // null means not performed, true means got from cache, false means got from server. !!! Should split this into performed and fromCache
	receiveResult:function (aResponseOp) {
		if (!aResponseOp) {
			this.error = "no result";
		} else if (aResponseOp.error) {
			this.error = aResponseOp.error;
		} else {
			var request_key = this.key;
			var response_key = aResponseOp.result_key || aResponseOp.key || this.key;
			var final_result_key = this.result_key || response_key; // result_key should not be specified unless trying to override
			var results = _.isObjectStrict(aResponseOp.results) ? aResponseOp.results : _.createObject(response_key,aResponseOp.results); // fix up server mistake
			var result;
			if (aResponseOp.verb==='DESTROY')
				result = undefined;
			else
				result = results[response_key];

			results = _.omit(results,response_key); // results now excludes primary result
			if (!this.results)
				this.results = {};
			_.extend(this.results,results);   // store other results
			this.result_key = final_result_key;
			this.results[final_result_key] = result;  // store primary result
		}
	}
});

/**
 * Represents a single Kojac request, analogous to a HTTP request. It may contain 1 or more operations
 * @class Kojac.Request
 * @extends Kojac.Object
 */
Kojac.Request = Kojac.Object.extend({
		kojac: null,
		chaining: false,
		options: {},
		ops: [],
		handlers: null,
		op: null,
		//result: undefined,
		//results: null,
		error: null,        // set with some truthy value if this whole request or any operation fails (will contain first error if multiple)
		newOperation: function() {
			var obj = new Kojac.Operation({request: this});
			if (this.ops.length===0)
				this.op = obj;
			this.ops.push(obj);
			return obj;
		},

		init: function(aProperties) {
			this._super.apply(this,arguments);
			this.handlers = new HandlerStack();
		},

		// {key: value} or [{key1: value},{key2: value}] or {key1: value, key2: value}
		// Can give existing keys with id, and will create a clone in database with a new id
		create: function(aKeyValues,aOptions) {

			var result_key = (aOptions && _.removeKey(aOptions,'result_key'));
			var params = (aOptions && _.removeKey(aOptions,'params'));  // extract specific params
			var options = _.extend({cacheResults: true, manufacture: true},aOptions || {});

			var kvArray = Kojac.Utils.toKeyValueArray(aKeyValues);
			for (var i=0;i<kvArray.length-1;i+=2) {
				var k = kvArray[i];
				var v = kvArray[i+1];
				var op = this.newOperation();
				op.verb = 'CREATE';
				op.options = _.clone(options);
				op.params = (params && _.clone(params));
				var parts = keySplit(k);
				if (parts.length >= 3)
					op.key = k;
				else
					op.key = keyResource(k);
				if ((i===0) && result_key)
					op.result_key = result_key;
				op.value = Kojac.Utils.toJsono(v,op.options);
			}
			if (this.chaining)
				return this;
			else
				return this.request();
		},

		// !!! if aKeys is String, split on ',' into an array
		// known options will be moved from aOptions to op.options; remaining keys will be put into params
		read: function(aKeys,aOptions) {
			var keys = Kojac.Utils.interpretKeys(aKeys);
			var result_key = (aOptions && _.removeKey(aOptions,'result_key'));  // extract result_key
			var params = (aOptions && _.removeKey(aOptions,'params'));  // extract specific params
			var options = _.extend({cacheResults: true, manufacture: true},aOptions || {});
			var me = this;
			jQuery.each(keys,function(i,k) {
				var op = me.newOperation();
				op.options = _.clone(options);
				op.params = (params && _.clone(params));
				op.verb = 'READ';
				op.key = k;
				if (i===0)
					op.result_key = result_key || k;
				else
					op.result_key = k;
			});
			if (this.chaining)
				return this;
			else
				return this.request();
		},

		cacheRead: function(aKeys,aOptions) {
			aOptions = _.extend({},aOptions,{preferCache: true});
			return this.read(aKeys,aOptions);
		},

		update: function(aKeyValues,aOptions) {
			var result_key = (aOptions && _.removeKey(aOptions,'result_key'));
			var options = _.extend({cacheResults: true, manufacture: true},aOptions || {});
			var params = (aOptions && _.removeKey(aOptions,'params'));  // extract specific params
			var first=true;
			var kvArray = Kojac.Utils.toKeyValueArray(aKeyValues);
			for (var i=0;i<kvArray.length-1;i+=2) {
				var k = kvArray[i];
				var v = kvArray[i+1];
				var op = this.newOperation();
				op.verb = 'UPDATE';
				op.options = _.clone(options);
				op.params = (params && _.clone(params));
				op.key = k;
				if (first) {
					op.result_key = result_key || k;
					first = false;
				} else
					op.result_key = k;
				op.value = Kojac.Utils.toJsono(v,op.options);
			};
			if (this.chaining)
				return this;
			else
				return this.request();
		},

		destroy: function(aKeys,aOptions) {
			var keys = Kojac.Utils.interpretKeys(aKeys);
			var result_key = (aOptions && _.removeKey(aOptions,'result_key'));
			var options = _.extend({cacheResults: true},aOptions || {});
			var params = (aOptions && _.removeKey(aOptions,'params'));  // extract specific params
			var me = this;
			jQuery.each(keys,function(i,k) {
				var op = me.newOperation();
				op.options = _.clone(options);
				op.params = (params && _.clone(params));
				op.verb = 'DESTROY';
				op.key = k;
				if (i===0)
					op.result_key = result_key || k;
				else
					op.result_key = k;
			});
			if (this.chaining)
				return this;
			else
				return this.request();
		},

		execute: function(aKey,aValue,aOptions) {
			var op = this.newOperation();
			op.verb = 'EXECUTE';

			var params = (aOptions && _.removeKey(aOptions,'params'));  // extract specific params
			op.result_key = (aOptions && _.removeKey(aOptions,'result_key')) || aKey;
			op.options = _.extend({cacheResults: false, manufacture: false},aOptions || {});
			op.params = (params && _.clone(params));
			op.key = aKey;
			op.value = Kojac.Utils.toJsono(aValue,op.options);
			if (this.chaining)
				return this;
			else
				return this.request();
		},

		request: function(aDone) {
			var result = this.kojac.performRequest(this);
			if (aDone)
				result = result.done(aDone);
			if (this.kojac.errorHandler)
				result = result.fail(this.kojac.errorHandler);
			return result;
		}
});
