// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

// requestAnimationFrame polyfill by Erik Möller
// fixes from Paul Irish and Tino Zijdel
// list-based fallback implementation by Jonas Finnemann Jensen
// https://gist.github.com/4438815

(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }
    if (!window.requestAnimationFrame){
        var tid = null, cbs = [], nb = 0, ts = 0;
        function animate() {
            var i, clist = cbs, len = cbs.length;
            tid = null;
            ts = Date.now();
            cbs = [];
            nb += clist.length;
            for (i = 0; i < len; i++){
                if(clist[i])
                    clist[i](ts);
            }
        }
        window.requestAnimationFrame = function(cb) {
            if (tid == null)
              tid = window.setTimeout(animate, Math.max(0, 20 + ts - Date.now()));
            return cbs.push(cb) + nb;
        };
        window.cancelAnimationFrame = function(id) {
            delete cbs[id - nb - 1];
        };
    }
}());