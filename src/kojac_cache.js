Kojac.Cache = Kojac.Object.extend({
	store: function(k,v) {
		if (v===undefined) {
			delete this[k];
			return v;
		} else {
			return (this[k] = v);
		}
	},
	retrieve: function(k) {
		return this[k];
	}
});
