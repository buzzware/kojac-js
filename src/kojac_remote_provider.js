/**
 * A default RemoteProvider implementation. Your own implementation, or a subclass of this may be used instead.
 * @class Kojac.RemoteProvider
 * @extends Kojac.Object
 */
Kojac.RemoteProvider = Kojac.Object.extend({

	useMockFileValues: false,
	mockFilePath: null,
	mockReadOperationHandler: null,
	serverPath: null,
	timeout: 10000,

	mockWriteOperationHandler: null,//function(aOp) {
//		Ember.Logger.log(JSON.stringify(CanUtils.copyProperties({},aOp,null,['request'])));
//	},

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
		var result;
		var op;
		var me = this;
		for (var i=0;i<aRequest.ops.length;i++) {
			op = aRequest.ops[i];
			if (op.performed)
				continue;
			if (op.verb==='READ' || op.verb==='EXECUTE') {
				if (this.mockReadOperationHandler) {
					result = this.mockReadOperationHandler(op);
					op.performed = true;
					if (op.fromCache===null)
						op.fromCache = false;
					return result;
				}
			} else {
				if (this.mockWriteOperationHandler) {
					result = this.mockWriteOperationHandler(op);
					op.performed = true;
					if (op.fromCache===null)
						op.fromCache = false;
					return result;
				}
			}
		}
		var server_ops = _.filterByCriteria(aRequest.ops,{performed: false});
		if (!server_ops.length)
			return;
		if (this.useMockFileValues) {
			aRequest.handlers.waitForCallNext = true;
			var getMockFile = function(aOp) {
				var fp = me.mockFilePath+aOp.key+'.js';
				var data = null;
				return jQuery.ajax({url: fp, dataType: 'json', cache: false, data: data, timeout: me.timeout}).done(
					function( aData ) {
						for (p in aData) {
							if (p==='results') {
								for (k in aData.results) {
									if ((k===aOp.key) && (aOp.result_key!=aOp.key))
										aOp.results[aOp.result_key] = aData.results[k];
									else
										aOp.results[k] = aData.results[k];
								}
							} else
								aOp[p] = aData[p];
						}
						aOp.receiveResult(aOp);
						this.fromCache = false;
						this.performed = true;
					}
				).fail(
					function(jqXHR, textStatus) {
						aRequest.handlers.handleError(textStatus);
					}
				);
			};
			var reqs = [];
			for (var i=0;i<aRequest.ops.length;i++) {
				reqs.push(getMockFile(aRequest.ops[i]));
			}
			jQuery.when.apply(jQuery,reqs).then(function(){
				aRequest.handlers.callNext();
			});
		} else {
			var opsJson = this.operationsToJson(server_ops);
			var dataToSend = {
				kojac: {
					version: 'KOJAC-1.0',
					ops: opsJson
				}
			};
			aRequest.handlers.waitForCallNext = true;
			// !!! might need to include X-CSRF-Token see http://stackoverflow.com/questions/8511695/rails-render-json-session-lost?rq=1
			var ajaxpars = {
				type: 'POST',
				data: JSON.stringify(dataToSend),
				contentType: "application/json; charset=utf-8",
				dataType: "json"
			};

			var handleAjaxResponse = function(aResult,aStatus,aXhr) {
				if (aResult instanceof Error || (aResult.error && !aResult.ops)) { // new code returns errors without ops
					if (aResult.error) {
						aRequest.error = aResult.error;
					} else {
						aRequest.error = me.interpretXhrError(aXhr);
						if (aStatus == "parsererror") {
							aRequest.error.http_code = 500;
							aRequest.error.kind = "parserError";
							aRequest.error.message = "A data error occurred (parserError)";
							aRequest.error.debug_message = aResult.message;
						}
					}
					aRequest.error.headers = aXhr.getAllResponseHeaders();
					aRequest.error.response = aXhr.responseText;

					for (var i=0;i<server_ops.length;i++) {
						var opRequest = server_ops[i]; //aRequest.ops[request_op_index[i]];
						opRequest.fromCache = false;
						opRequest.performed = true;
					}

					aRequest.handlers.handleError(aRequest.error);
				} else {    // ops may have errors
					// poke results into request ops using request_op_index
					aRequest.xhr = aXhr;
					for (var i=0;i<server_ops.length;i++) {
						var opRequest = server_ops[i]; //aRequest.ops[request_op_index[i]];
						var opResult = (_.isArray(aResult.ops) && (i<aResult.ops.length) && aResult.ops[i]);
						opRequest.fromCache = false;
						opRequest.performed = true;
						if (!opResult)
							opResult = null;
						if (aResult.error) {
							opRequest.error = opResult.error;
							aRequest.handlers.handleError(opResult.error);
							break;
						} else {
							opRequest.receiveResult(opResult);
						}
					}
				}
			};

			var result = jQuery.ajax(this.serverPath,ajaxpars).done(function(aResult,aStatus,aXhr){
				handleAjaxResponse(aResult,aStatus,aXhr);
				aRequest.handlers.callNext();
			}).fail(function(aXhr,aStatus,aError){
				handleAjaxResponse(aError,aStatus,aXhr);
				aRequest.handlers.callNext();
			});
		}
	},

	interpretXhrError: function(aXhr) {
		var http_code = null;
		var kind = null;
		var message = null;
		var debug_message = null;
		var response = null;
		var headers = null;
		if (http_code = (aXhr && aXhr.status)) {
			kind = (aXhr.statusText && aXhr.statusText.replace(' ',''));
			message = debug_message = aXhr.statusText;
		} else {
			http_code = null;
			kind = "NetworkError";
			message = "Failed to connect. Please check network or try again";
			debug_message = "Network connection failed";
		}
		return {
			format: 'KojacError',
			http_code: http_code,   // a valid HTTP status code, or null
			kind: kind,             // CamelCase text name of error, for conditional code handling
			message: message,       // an explanation for normal humans
			debug_message: debug_message, // an explanation for developers
			xhr: aXhr,  // the original XHR object from jQuery
		}
	}
});
