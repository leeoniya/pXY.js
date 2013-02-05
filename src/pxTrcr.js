/*
* Copyright (c) 2013, Leon Sorokin
* All rights reserved. (MIT Licensed)
*
* pxTrcr.js - pixel tracer for pXY.js
*/

function pxTrcr(w, h, ctnr) {
	this.w = w;
	this.h = h;
	this.ctnr = ctnr || null;

	this.cfgs = [];		// chkr/px/layer stack
	this.lyrs = {};		// trace layers
	this.cfgS = [];		// state/px/layer configs

	// recording & buffering
	this._rec = false;
	this.buf = [];
	this.rid = null;	// id returned by reqAnimFrame

	if (!this.ctnr)
		this.rec();

	// init layer 0 and trans pixel
	this.push([0,0,0,0], 0);
}

(function() {
	var	EV_MOVE			= 0,
		EV_SCAN_START	= 1,
		EV_SCAN_END		= 2,
		EV_STATE_ENTER	= 3,
		EV_STATE_EXIT	= 4,

		FN_SET			= 5,
		FN_PUSH			= 6,
		FN_POP			= 7,
		FN_ONE			= 8,
		FN_STATE_BIND	= 9;

	function Lyr(w, h, id) {
		this.id = id;

		this.can = document.createElement("canvas");
		this.can.id = "trclyr-" + id;
		this.can.className = "trclyr";
		this.can.width = w;
		this.can.height = h;
		this.can.style.position = "absolute";
		this.can.style.left = 0;
		this.can.style.top = 0;
		this.can.style.background = "transparent";

		this.ctx = this.can.getContext("2d");
		this.imgd = this.ctx.createImageData(w, h);
		this.pxls = this.imgd.data;
		this.dirty = false;

		var buf = new ArrayBuffer(this.pxls.length),
			buf8 = new Uint8Array(buf),
			buf32 = new Uint32Array(buf);

		this.setPx = function lyrSetPx(i,px) {
			px[3] = px[3] || 255;
			buf32[i] =
				(px[3] << 24) |	// alpha
				(px[2] << 16) |	// blue
				(px[1] <<  8) |	// green
				 px[0];			// red

			this.dirty = true;
		};

		this.upd = function lyrUpd() {
			if (!this.dirty) return;

			this.imgd.data.set(buf8);
			this.ctx.putImageData(this.imgd, 0, 0);
			this.dirty = false;
		};
	}

	// one-shot (single move or scan)
	function OneChkr() {
		this.fired = true;

		this.chk = function(type, id) {
			var ret;
			switch (type) {
				case EV_MOVE: ret = !this.fired; break;
				case EV_SCAN_START: ret = true; this.id = id; break;
				case EV_SCAN_END: ret = this.id == id ? false : true; break;
			}
			this.fired && (this.fired = false);
			return ret;
		};
	}

	// sticky
	function SetChkr() {
		this.chk = function(type, id) {
			return true;
		}
	}

	// modules
	var mods = {
		buffer: {
			rec: function rec() {
				return this.recOn();
			},
			recOn: function recOn() {
				this._rec = true;
				return this;
			},
			recOff: function recOff() {
				this._rec = false;
				return this;
			},
			enq: function enq(fnIdx, args) {
				this.buf.push(Array.prototype.slice.call(arguments));
			},
			deq: function deq() {
				var op = this.buf.shift();
				this[op[0]].apply(this, op[1]);

				return op;						// hack to allow introspection
			}
		},
		config: {
			// @params: pxl, lyrId
			set:  function set()  {return this.cfgOp(FN_SET,  arguments);},
			push: function push() {return this.cfgOp(FN_PUSH, arguments);},
			pop:  function pop()  {return this.cfgOp(FN_POP,  arguments);},
			one:  function one()  {return this.cfgOp(FN_ONE,  arguments);},
			// @params: name, pxl, lyrId
			state: function state() {return this.cfgOp(FN_STATE_BIND, arguments);},
			// DRY base method
			cfgOp: function cfgOp(fnIdx, args) {
				if (this._rec) {
					this.enq(fnIdx, Array.prototype.slice.call(args));
					return this;
				}

				// register pxLyr cfg for state
				if (fnIdx == FN_STATE_BIND) {
					var pxLyr = this.pxLyr.apply(this, Array.prototype.slice.call(args, 1));
					this.cfgS.push([args[0]].concat(pxLyr));
					return this;
				}

				if (fnIdx != FN_POP)
					var pxLyr = this.pxLyr.apply(this, args);

				switch (fnIdx) {
					case FN_SET:  this.cfgs[0] = [new SetChkr].concat(pxLyr);		break;
					case FN_PUSH: this.cfgs.unshift([new SetChkr].concat(pxLyr));	break;
					case FN_POP:  this.cfgs.shift();								break;
					case FN_ONE:  this.cfgs.unshift([new OneChkr].concat(pxLyr));	break;
				}

				return this;
			},
			// takes 1 or 2 args, layer id and/or pixel, in any order
			pxLyr: function(a1, a2) {
				function isLyrId(v) {
					return typeof v == "string" || typeof v == "number";
				}

				switch (arguments.length) {
					case 0:
						return [this.cfgs[0][1], this.cfgs[0][2]];	// inherits both
					case 1:
						if (isLyrId(a1))
							return [this.cfgs[0][1], this.lyr(a1)];	// get/make layer, inherit px
						return [a1, this.cfgs[0][2]];				// use px, inherit layer
					case 2:
						if (isLyrId(a1))
							return [a2, this.lyr(a1)];				// get/make layer, use px
						return [a1, this.lyr(a2)];					// use px, get/make layer
				}
			}
		},
		layer: {
			// get and/or make a layer
			lyr: function lyr(lyrId) {
				if (this.lyrs[lyrId])
					return this.lyrs[lyrId];

				this.lyrs[lyrId] = new Lyr(this.w, this.h, lyrId);

				this.ctnr.appendChild(this.lyrs[lyrId].can);

				return this.lyrs[lyrId];
			},
			clr: function clr(lyrId) {
				if (lyrId || lyrId === 0) {
					this.ctnr.removeChild(this.lyrs[lyrId].can);
					delete this.lyrs[lyrId];

					if (lyrId === 0)
						this.push([0,0,0,0], 0);
				}
				else {
					for (var i in this.lyrs) {
						this.ctnr.removeChild(this.lyrs[i].can);
						delete this.lyrs[i];
					}

					this.push([0,0,0,0], 0);
				}

				return this;
			},
			// draw current pixel to current layer at idx
			// TODO: add lyrId to trace to inactive layer by id (good for async/web-workers)
			setPx: function setPx(i) {
				var top = this.cfgs[0];
				top[2].setPx(i, top[1]);
			},
			// output pixels to canvas(es)
			upd: function upd(lyrId) {
				for (var i in this.lyrs) {
					if (lyrId && i !== lyrId) continue;
					this.lyrs[i].upd();
				}

				return this;
			},
			// @rate: ops/sec to dequeue from buffer
			draw: function draw(rate) {
				var recOld = this._rec;
				this._rec = false;

				if (!this.buf.length) {
					this.upd();						// just update layers
					this._rec = recOld;
				}
				else {
					if (rate) {
						var fps = 60,				// assumed max fps
							ratio = rate / fps,		// target ratio
							frame = 0,				// frame counter
							opers = 0,				// op counter
							self = this;

						var step = function() {
							if (!self.buf.length) {
								self._rec = recOld;
								self.rid = null;
								return;
							}

							self.rid = requestAnimationFrame(step);

							/*
							if (frame == fps) {
								frame = 0;
								opers = 0;
							}
							*/

							frame++;

							var fnIdx, frOps = 0;
							while (opers / frame < ratio && self.buf.length) {
								fnIdx = self.deq()[0];

								if (fnIdx === EV_MOVE) {
									frOps++;
									opers++;
								}
							}

							if (frOps)
								self.upd();
						};

						self.rid = requestAnimationFrame(step);
					}
					else {
						while (this.buf.length)
							this.deq();

						this.upd();
						this._rec = recOld;
					}
				}
			},
		},
		pubsub: {
			sub: function sub(pxy) {
				pxy.sub(this.notify, this);
				return this;
			},
			unsub: function unsub(pxy) {
				pxy.unsub(this.notify, this);
				return this;
			},
			notify: function notify(evt) {
				var crd = evt.pxy.absXy(),
					idx = evt.pxy.absIdx(),
					args = [crd.x, crd.y, idx];

				if (evt.id)
					args.push(evt.id);

				return this[evt.type].apply(this, args);
			}
		},
		events: {
			// @params: x, y, i, id
			move:	function move()  {return this.evtOp(EV_MOVE,		arguments);},
			scan0:	function scan0() {return this.evtOp(EV_SCAN_START,	arguments);},
			scan1:	function scan1() {return this.evtOp(EV_SCAN_END,	arguments);},
			enter:	function enter() {return this.evtOp(EV_STATE_ENTER,	arguments);},
			exit:	function exit()  {return this.evtOp(EV_STATE_EXIT,	arguments);},
			// DRY base method
			evtOp: function evtOp(fnIdx, args) {
				if (this._rec) {
					this.enq(fnIdx, Array.prototype.slice.call(args));
					return this;
				}

				var self = this;
				// state enter/exit
				if (fnIdx == EV_STATE_ENTER) {
					this.cfgS.forEach(function(cfg){
						if (args[3] === cfg[0] || cfg[0] instanceof RegExp && cfg[0].test(args[3])) {
							self.push(cfg[1], cfg[2]);
							return false;
						}
					});

					return this;
				}

				if (fnIdx == EV_STATE_EXIT) {
					this.cfgS.forEach(function(cfg){
						if (args[3] === cfg[0] || cfg[0] instanceof RegExp && cfg[0].test(args[3])) {
							self.pop();
							return false;
						}
					});

					return this;
				}

				// set pixel for moves
				if (fnIdx === EV_MOVE)
					this.setPx(args[2]);

				if (!this.cfgs[0][0].chk(fnIdx, args[3]))
					this.pop();

				return this;
			}
		}
	};

	// combine modules into proto
	for (var i in mods) {
		for (var j in mods[i]) {
			pxTrcr.prototype[j] = mods[i][j];
		}
	}

	// alias ops
	var ops = {
		move:	EV_MOVE,
		scan0:	EV_SCAN_START,
		scan1:	EV_SCAN_END,
		enter:	EV_STATE_ENTER,
		exit:	EV_STATE_EXIT,

		set:	FN_SET,
		push:	FN_PUSH,
		pop:	FN_POP,
		one:	FN_ONE,
		state:	FN_STATE_BIND,
	};

	for (var k in ops)
		pxTrcr.prototype[ops[k]] = pxTrcr.prototype[k];
})();