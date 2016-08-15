/**
 * The Kojac core object
 * @class Kojac.Core
 * @extends Kojac.Object
 *
 * Normal API V2 Usage
 *
 * App = {};
 * App.cache = {};
 * App.kojac = new Kojac.Core({
 *  remoteProvider: ...,
 *  cache: App.cache
 * });
 *
 * App.kojac.read('products').done(...);
 * App.kojac.chain().create('products').execute('refresh').request(function(aKR){   // using optional done handler
 *   // handle done here
 * }).fail(function(aKR){
 *   // handle fail here
 * });
 *
 * Old API V1 usage
 *
 * App = {};
 * App.cache = {};
 * App.kojac = new Kojac.Core({
 *  remoteProvider: ...,
 *  cache: App.cache,
 *  apiVersion: 1
 * });
 *
 * App.kojac.readRequest('products').done(...);
 * App.kojac.create('products').execute('refresh').request().done(function(aKR){
 *   // handle done here
 * }).fail(function(aKR){
 *   // handle fail here
 * });
 *
 */
Kojac.Core = Kojac.Object.extend({

		remoteProvider: null,
		objectFactory: null,
		cache: null,
		errorHandler: null,
		dependentKeys: {},
		apiVersion: 2,      // set this to 1 for old read() and readRequest()

		newRequest: function(aOptions) {
			if (!aOptions)
				aOptions = {};
			aOptions = _.extend(aOptions,{kojac: this});
			if (!(this.chaining in aOptions)) {
				aOptions.chaining = this.apiVersion < 2
			}
			return new Kojac.Request(aOptions);
		},

//			var v;
//			for (var i=0;i<aRequest.ops.length;i++) {
//				var op = aRequest.ops[i];
//				if (op.error)
//					break;
//				if (op.options.cacheResults===false)
//					continue;
//				for (p in op.results) {
//					if (p==op.result_key)
//						continue;
//					v = op.results[p];
//					if (v===undefined)
//						delete this.cache[p];
//					else
//						this.cache[p] = op.results[p];
//				}
//				v = op.results[op.result_key];
//				if (v===undefined) {
//					delete this.cache[op.result_key];
//				} else {
//					this.cache[op.result_key] = v;
//				}
//				console.log('end of loop');
//			}

		handleResults: function(aRequest) {
			if (this.cache.beginPropertyChanges)
				this.cache.beginPropertyChanges();

			var updatedObjects = [];

			try {
				for (var i=0;i<aRequest.ops.length;i++) {
					var op = aRequest.ops[i];
					if (op.error)
						break;

					for (var key in op.results) {
						var value = op.results[key];
						if ((op.options.atomise!==false) && _.isObjectStrict(value)) {  // we are atomising and this is an object
							var existing = this.cache.retrieve(key);
							if (_.isObjectStrict(existing) && (op.options.cacheResults!==false)) {         // object is already in cache, and we are caching, so update it
								if (existing.beginPropertyChanges) {
									existing.beginPropertyChanges();
									updatedObjects.push(existing);
								}
								if (existing.setProperties)
									existing.setProperties(value);
								else
									_.copyProperties(existing,value);
								value = existing;
							} else {                                                                      // otherwise manufacture
								if ((op.options.manufacture!==false) && (this.objectFactory)) {
									// if primary key & reassigned by result_key then manufacture with original key
									var mkey = key;   // use the key from results by default
									if (key === op.result_key) {  // this is the result key, so may have been renamed
										var has_dot = op.key.indexOf('.') >= 0; // prefer original key unless it contains a dot
										if (!has_dot)
											mkey = op.key;
									}
									value = this.objectFactory.manufacture(value,mkey);
								}
							}
						}
						op.results[key] = value;
						if (op.options.cacheResults!==false)
							this.cache.store(key,value);
					}
				}
			} finally {
				for (var i=0;i<updatedObjects.length;i++)
					updatedObjects[i].endPropertyChanges();
			}
			if (this.cache.endPropertyChanges)
				this.cache.endPropertyChanges();
		},

		finaliseResponse: function(aRequest) {
			// set convenience properties
			var results = {};
			if (!aRequest.error) for (var i=0;i<aRequest.ops.length;i++) {
				var op = aRequest.ops[i];
				if (op.error) {
					if (!aRequest.error)
						aRequest.error = op.error;
					break;
				}
				_.extend(results,op.results);
				op.result = !op.error && op.results && (op.result_key || op.key) ? op.results[op.result_key || op.key] : null;
				if (i===0) {
					aRequest.op = op;
				}
		    if ((op.performed===true) && (op.fromCache===false) && (op.options.cacheResults!==false)) {
			    var ex_key = (op.result_key || op.key);
			    var dep_keys = [];
			    for (var p in op.results) {
				    if (p===ex_key)
				      continue;
				    dep_keys.push(p);
			    }
			    if (!dep_keys.length) {
			      if (op.key in aRequest.kojac.dependentKeys)
			        delete aRequest.kojac.dependentKeys[op.key];
				  } else {
		        aRequest.kojac.dependentKeys[op.key] = dep_keys
			    }
		    }
			}
			if (aRequest.error) {
				_.removeKey(aRequest,'results');
				_.removeKey(aRequest,'result');
			} else {
				aRequest.results = results;
				aRequest.result = (aRequest.op && aRequest.op.result);
			}
		},

		performRequest: function(aRequest) {
			for (var i=0;i<aRequest.ops.length;i++) {
				var op = aRequest.ops[i]
				op.results = {};
				var k = (op.result_key && (op.result_key !== op.key)) ? op.result_key : op.key;
				var cacheValue = aRequest.kojac.cache.retrieve(k);
				if ((op.verb=='READ') && op.options.preferCache && (cacheValue!==undefined)) {   // resolve from cache
					op.results[k] = cacheValue;
					var dep_keys = aRequest.kojac.dependentKeys[op.key];
					if (dep_keys) {
						for (var i=0;i<dep_keys.length;i++) {
							var dk = dep_keys[i];
							// what if not in cache? perhaps dump siblings in dependentKeys and index key to cause full refresh? or refuse to remove from cache if in dependentKeys
							op.results[dk] = aRequest.kojac.cache.retrieve(dk);
						}
					}
					op.result_key = k;
					op.fromCache = true;
					op.performed = true;
				}
			}
			aRequest.handlers.add(this.remoteProvider.handleRequest,null,this.remoteProvider);

			//if (this.objectFactory)
			aRequest.handlers.add(this.handleResults,null,this);

			aRequest.handlers.run(aRequest).always(this.finaliseResponse);
			return aRequest;
		},

		// BEGIN User Functions

		// These functions enable the user to build and trigger requests to the server/remote provider

		chain: function() {
			return this.newRequest({chaining: true});
		},

		create: function(aKeyValues,aOptions) {
			var req = this.newRequest();
			return req.create(aKeyValues,aOptions);
		},

		read: function(aKeys,aOptions) {
			var req = this.newRequest();
			return req.read(aKeys,aOptions);
		},

		cacheRead: function(aKeys,aOptions) {
			aOptions = _.extend({},aOptions,{preferCache: true});
			return this.read(aKeys,aOptions);
		},

		update: function(aKeyValues,aOptions) {
			var req = this.newRequest();
			return req.update(aKeyValues,aOptions);
		},

		destroy: function(aKeys,aOptions) {
			var req = this.newRequest();
			return req.destroy(aKeys,aOptions);
		},

		execute: function(aKey,aValue,aOptions) {
			var req = this.newRequest();
			return req.execute(aKey,aValue,aOptions);
		},
		// END Convenience Functions

		// BEGIN DEPRECATED API V1 FUNCTIONS
		createRequest: function(aKeyValues,aOptions) {
			if (this.apiVersion > 1)
				throw "*Request methods are deprecated, and only supported when apiVersion is 1";
			return this.create(aKeyValues,aOptions).request();
		},
		readRequest: function(aKeys,aOptions) {
			if (this.apiVersion > 1)
				throw "*Request methods are deprecated, and only supported when apiVersion is 1";
			return this.read(aKeys,aOptions).request();
		},
		cacheReadRequest: function(aKeys,aOptions) {
			if (this.apiVersion > 1)
				throw "*Request methods are deprecated, and only supported when apiVersion is 1";
			aOptions = _.extend({},aOptions,{preferCache: true});
			return this.read(aKeys,aOptions).request();
		},
		updateRequest: function(aKeyValues,aOptions) {
			if (this.apiVersion > 1)
				throw "*Request methods are deprecated, and only supported when apiVersion is 1";
			return this.update(aKeyValues,aOptions).request();
		},
		destroyRequest: function(aKeys,aOptions) {
			if (this.apiVersion > 1)
				throw "*Request methods are deprecated, and only supported when apiVersion is 1";
			return this.destroy(aKeys,aOptions).request();
		},
		executeRequest: function(aKey,aValue,aOptions) {
			if (this.apiVersion > 1)
				throw "*Request methods are deprecated, and only supported when apiVersion is 1";
			return this.execute(aKey,aValue,aOptions).request();
		}
		// END DEPRECATED API V1 FUNCTIONS
});
