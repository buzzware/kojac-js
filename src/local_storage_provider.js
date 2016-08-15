Kojac.LocalStorageRemoteProvider = Kojac.Object.extend({
	operationsToJson: function(aOps) {
		var result = [];
		for (var i=0;i<aOps.length;i++) {
			var op = aOps[i];
			var jsonOp = {
				verb: op.verb,
				key: op.key
			};
			if ((op.verb==='CREATE') || (op.verb==='UPDATE') || (op.verb==='EXECUTE')) {
				jsonOp.value = Kojac.Utils.toJsono(op.value,op.options);
			}
			var options = (op.options && _.omit(op.options,['cacheResults','preferCache']));
			if (options && !_.isEmpty(options))
				jsonOp.options = options;   // omit local keys
			jsonOp.params = op.params;
			result.push(jsonOp);
		}
		return result
	},

	handleRequest: function(aRequest) {
		var aRequestOp;
		if (!aRequest.ops.length)
			return;
		var ops = this.operationsToJson(aRequest.ops);
		var op_output;
		var v,op,id,key,value,parts,results,result_key;
		for (var i=0;i<ops.length;i++) {
			op = ops[i];
			aRequestOp = aRequest.ops[i];
			if (op.verb=='CREATE') {
				id = Kojac.Utils.createId();
				key = keyJoin(op.key,id);
				result_key = (op.result_key || key);
				value = _.clone(op.value,true,true);
				value.id = id;

				$.jStorage.set(key,value);
				results = {};
				results[result_key] = value;
				op_output = {
					key: op.key,
				  verb: op.verb,
				  result_key: result_key,
				  results: results
				};
			} else if (op.verb=='READ') {
				result_key = (op.result_key || op.key);
				results = {};
				parts = keySplit(op.key);
				if (parts[1]) { // item
					value = $.jStorage.get(op.key,Boolean);
					if (value===Boolean)
						value = undefined;
					results[result_key] = value;
				} else {  // collection
					var keys = $.jStorage.index();
					var ids = [];
					_.each(keys,function(k){
						parts = keySplit(k);
						id = parts[1];
						if (parts[0]!=op.key || !id)
							return;
						ids.push(id);
						v = $.jStorage.get(k,Boolean);
						if (value===Boolean)
							value = undefined;
						results[k] = v;
					});
					results[result_key] = ids;
				}
				op_output = {
					key: op.key,
				  verb: op.verb,
				  result_key: result_key,
				  results: results
				};
			} else if (op.verb=='UPDATE') {
				value = $.jStorage.get(op.key,Boolean);
				if (value===Boolean)
					value = undefined;
				result_key = (op.result_key || op.key);
				if (_.isObjectStrict(value))
					_.extend(value,op.value);
				else
					value = op.value;
				$.jStorage.set(op.key,value);
				results = {};
				results[result_key] = value;
				op_output = {
					key: op.key,
				  verb: op.verb,
				  result_key: result_key,
				  results: results
				};
			} else if (op.verb=='DESTROY') {
				$.jStorage.deleteKey(op.key);
				result_key = (op.result_key || op.key);
				results = {};
				//results[result_key] = undefined;
				op_output = {
					key: op.key,
				  verb: op.verb,
				  result_key: result_key,
				  results: results
				};
			} else {
				throw "verb not implemented";
			}
			aRequestOp.receiveResult(op_output);
			aRequestOp.fromCache = false;
			aRequestOp.performed = true;
		}
	}
});
