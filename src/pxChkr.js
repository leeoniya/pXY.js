/*
* Copyright (c) 2012, Leon Sorokin
* All rights reserved. (MIT Licensed)
*
* pxChkr.js - pixel checker for pXY.js
*/

function pxChkr(cfg, pxy) {
	this.cfg = JSON.parse(JSON.stringify(cfg));		// quick deep copy
	this.pxy = pxy;
	this.pxs = [];
	this.res = [];
//	this.dflt = {tol:}

	this.init();
}

(function() {
	// range checker
	function inRange(val, min, max) {
		return !(val < min || val > max);
	}

	// expose
	pxChkr.inRange = inRange;

	// modules
	var mods = {
		all: {
			// grabs ref pixels, pre-calc tol ranges
			init: function init() {
				// pre-calc tols
				for (var i in this.cfg) {		// use while --i?
					var cfg = this.cfg[i];
					if (!cfg.off) cfg.off = [0,0];
					if (!cfg.ref) cfg.ref = this.pxy.px(cfg.off[0], cfg.off[1]);
					if (cfg.tol) {
						this.res[i] = {};
						for (var j in cfg.tol) {
							if (typeof cfg.tol[j] == "number")
								cfg.tol[j] = [-cfg.tol[j], cfg.tol[j]];

							var p = typeof cfg.ref[j] === "function" ? cfg.ref[j]() : cfg.ref[j];

							cfg.tol[j][0] += p;
							cfg.tol[j][1] += p;
						}
					}
				}

				return this;
			},
			// get pixels
			get: function get() {
				var cfg, i = this.cfg.length;
				while (i--) {
					cfg = this.cfg[i];
					this.pxs[i] = this.pxy.px(cfg.off[0],cfg.off[1]);
				}
			},
			chk: function chk() {
				this.get();

				var chk = true, i = this.cfg.length, tol, px, res;

				while (i--) {
					tol	= this.cfg[i].tol;
					px	= this.pxs[i];
					res	= this.res[i];

					for (var q in tol) {
						var p = q.length > 1 ? px[q]() : px[q];		// speed hack to avoid using /hue|sat|lum/.test(q)
						res[q] = inRange(p, tol[q][0], tol[q][1]);
						if (!res[q])
							chk = false;
					}
				}

				return chk;
			},
		}
	};

	// combine modules into proto
	for (var i in mods) {
		for (var j in mods[i]) {
			pxChkr.prototype[j] = mods[i][j];
		}
	}
})();