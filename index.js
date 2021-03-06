var binding = require('./daemon');

var watchdog = null;

exports.booted = binding.booted;
exports.notify = binding.notify;
exports.LISTEN_FDS_START = binding.LISTEN_FDS_START;

exports.listen_fds = function() {
    return parseInt(process.env['LISTEN_FDS'], 10) || 0;
};

exports.notifyReady = function() {
    exports.notify('READY=1');
};

exports.notifyStatus = function(status) {
    exports.notify('STATUS=' + status);
};

exports.notifyWatchdog = function() {
    exports.notify('WATCHDOG=1');
};

exports.watchdogUsec = function() {
    return parseInt(process.env['WATCHDOG_USEC']) || null;
};

/**
 * Starts the watchdog ping if the watchdog enabled (WatchdogSec)
 * @param {number} k
 */
exports.startWatchdogPing = function(k) {
    if (watchdog) return;
        
    var timeout = exports.watchdogUsec();
    
    if (!timeout) return;
    
    if (!(k > 0 && k < 1)) k = 0.5;
    
    timeout = Math.round(timeout * k / 1000);
    
    watchdog = setInterval(function() {
        exports.notifyWatchdog();
    }, timeout);
};

exports.stopWatchdogPing = function() {
    if (watchdog) {
        clearInterval(watchdog);
        watchdog = null;
    }
};

var net = require('net');
var Pipe = process.binding('pipe_wrap').Pipe;

var origListen = net.Server.prototype.listen;
net.Server.prototype.listen = function(arg, cb) {
    if (typeof(arg) == 'object' && 'systemd' in arg) {
    
        if (arg.systemd >= exports.listen_fds()) {
            this.emit('listening', new Error('bad socket activation descriptor'));
            
        } else {
            return this.listen({fd: exports.LISTEN_FDS_START + arg.systemd, listened: true}, cb);
        }
        
    } else if (typeof(arg) == 'object' && 'fd' in arg && arg.listened) {
        if (cb) this.once('listening', cb);
        
        this._handle = new Pipe();
        this._handle.open(arg.fd);
        this._listen2(null, -1, -1);
        
        this.emit('listening');
        
    } else {
        origListen.apply(this, arguments);
    }
    return this;
};
