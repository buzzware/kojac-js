/**
 * Provides a dynamic asynchronous execution model. Handlers are added in queue or stack style, then executed in order, passing a given context object to each handler.
 * HandlerStack is a Javascript conversion of HandlerStack in the ActionScript Kojac library.
 * @class HandlerStack
 * @extends Kojac.Object
 */
export class HandlerStack {
	
	constructor() {
		this.handlers = null;
		this.parameters = null;
		this.thises = null;
		this.parameter = null;
		this.context = null;
		this.error = null;
		this.deferred = null;
		this.nextHandlerIndex = -1;
		this.waitForCallNext = false;

	//init: function() {
	//	this._super.apply(this,arguments);
		this.clear();
	}

		
	// clears out all handlers and state
	clear() {
		this.handlers = [];
		this.parameters = [];
		this.thises = [];
		this.reset();
	}

	// clears execution state but keeps handlers and parameters for a potential re-call()
	reset() {
		this.parameter = null;
		this.context = null;
		this.error = null;
		this.deferred = null;
		this.nextHandlerIndex = -1;
		this.waitForCallNext = false;
	}

	push(aFunction, aParameter, aThis) {
		this.handlers.unshift(aFunction);
		this.parameters.unshift(aParameter);
		this.thises.unshift(aThis);
	}

	// push in function and parameters to execute next
	pushNext(aFunction, aParameter,aThis) {
		if (this.nextHandlerIndex<0) {
			return this.push(aFunction, aParameter, aThis);
		}
		this.handlers.splice(this.nextHandlerIndex,0,aFunction);
		this.parameters.splice(this.nextHandlerIndex,0,aParameter);
		this.thises.splice(this.nextHandlerIndex,0,aThis);
	}

	add(aFunction, aParameter, aThis) {
		this.handlers.push(aFunction);
		this.parameters.push(aParameter);
		this.thises.push(aThis);
	}

	callNext() {
		if (this.context.error) {
			if (!this.context.isRejected()) {
				this.deferred.reject(this.context);
			}
			return;
		}
		if ((this.handlers.length===0) || (this.nextHandlerIndex>=this.handlers.length)) {
			this.deferred.resolve(this.context);
			return;
		}
		var fn = this.handlers[this.nextHandlerIndex];
		var d = this.parameters[this.nextHandlerIndex];
		var th = this.thises[this.nextHandlerIndex];
		this.nextHandlerIndex++;
		var me = this;
		setTimeout(function() {
			me.executeHandler(fn, d, th);
		}, 0);
	}

	handleError(aError) {
		this.context.error = aError;
		this.deferred.reject(this.context);
	}

	executeHandler(fn,d,th) {
		this.waitForCallNext = false;
		try {
			this.parameter = d;
			if (th) {
				fn.call(th, this.context);
			} else {
				fn(this.context);
			}
		} catch (e) {
			this.handleError(e);
		}
		if (!(this.waitForCallNext)) {
			this.callNext();
		}
	}

	run(aContext) {
		this.context = aContext;
		this.deferred = jQuery.Deferred();
		this.deferred.promise(this.context);
		if (this.context.isResolved===undefined) {
			this.context.isResolved = _.bind(
				function() {
					return this.state()==='resolved';
				},
				this.context
			);
		}
		if (this.context.isRejected===undefined) {
			this.context.isRejected = _.bind(
				function() {
					return this.state()==='rejected';
				},
				this.context
			);
		}
		if (this.context.isPending===undefined) {
			this.context.isPending = _.bind(
				function() {
					return this.state()==='pending';
				},
				this.context
			);
		}
		this.nextHandlerIndex = 0;
		this.callNext();
		return this.context;
	}
}
