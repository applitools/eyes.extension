/**
 * General utilities.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var RSVP = require('rsvp');

    var JSUtils = {};

    JSUtils.AJAX_TIMEOUT = "AJAX_TIMEOUT";

    /**
     * Waits a specified amount of time before resolving the returned promise.
     * @param {int} ms The amount of time to sleep in milliseconds.
     * @return {Promise} A promise which is resolved when sleep is done.
     */
    JSUtils.sleep = function (ms) {
        var deferred = RSVP.defer();
        setTimeout(function () {
            deferred.resolve();
        }, ms);
        return deferred.promise;
    };

    /**
     * Executes a function after a specified delay.
     * @param {Function} func The function to execute
     * @param {number} delay The delay in milliseconds.
     * @return {Promise} Returns a promise which resolves to the return value of {@code func}.
     */
    JSUtils.defer = function (func, delay) {
        var deferred = RSVP.defer();

        window.setTimeout(function () {
            deferred.resolve(func());
        }, delay);

        return deferred.promise;
    };

    /**
     * Returns a promise which resolves when any of the given promises resolves/rejects.
     * @param {Array} promises A list of promises to listen on.
     * @return {Promise} A promise which resolves to {index: *, state: *, value: *} when any of the given
     * promises resolves, or to {index: *, state: *, reason: *} when any of the given promises rejects.
     */
    JSUtils.any = function (promises) {
        if (!promises) {
            return RSVP.reject("'promises' must be an array!");
        }

        // We use an internal function since we need a closure for each promise.
        function _addPromiseNotification(theIndex, thePromise, theDeferred) {
            thePromise.then(function (value) {
                theDeferred.resolve({index: theIndex, state: 'fulfilled', value: value});
            }, function (reason) {
                theDeferred.resolve({index: theIndex, state: 'rejected', reason: reason});
            });
        }

        var deferred = RSVP.defer();

        //noinspection JSLint
        for (var i = 0; i < promises.length; ++i) {
            _addPromiseNotification(i, promises[i], deferred);
        }

        return deferred.promise;
    };

    /**
     * Performs an AJAX call, which is aborted if it does not get a response within a given timeout.
     * @param {string} url The URL to perform the request on.
     * @param {number} timeout The maximum time we wait for a response, in milliseconds.
     * @param {boolean|undefined} isXmlResponse Should the response be returned as an XML document. Default is false.
     * @return {Promise} A promise which resolves to the response, or rejects in case of an error.
     */
    JSUtils.ajaxGet = function (url, timeout, isXmlResponse) {
        timeout = timeout || (60 * 1000);
        isXmlResponse = isXmlResponse || false;
        var deferred = RSVP.defer();

        var abortTimer;

        var xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        //noinspection SpellCheckingInspection
        xhr.onreadystatechange = function () {
            if (this.readyState === this.DONE) {
                if (abortTimer !== undefined) {
                    clearTimeout(abortTimer);
                }
                if (this.status === 200) {
                    if (isXmlResponse) {
                        deferred.resolve(this.responseXML);
                    } else {
                        deferred.resolve(this.response);
                    }
                } else {
                    deferred.reject(this);
                }
            }
        };

        xhr.send();

        // Activate timer to limit the time we wait for this call.
        abortTimer = setTimeout(function () {
            xhr.abort();
            deferred.reject(JSUtils.AJAX_TIMEOUT);
        }, timeout);

        return deferred.promise;
    };

    //** Task scheduling
    /**
     * Creates a new task.
     * @param {Function} func The function to be executed. Should return a promise.
     * @param {Array} params The parameters to be passed to func when it's activated.
     * @constructor
     */
    var ScheduledTask  = function (func, params) {
        this._func = func;
        this._params = params;
    };

    ScheduledTask.prototype.run = function () {
        return this._func.apply(null, this._params);
    };


    /**
     * Creates a new task scheduler, which runs the tasks one after the other.
     * @constructor
     */
    var SequentialTaskRunner = function () {
        this._tasksChain = RSVP.resolve();
    };

    SequentialTaskRunner.prototype.addTask = function (task) {
        this._tasksChain = this._tasksChain.then(function () {
            return task.run();
        });

        return this._tasksChain;
    };

    JSUtils.ScheduledTask = ScheduledTask;
    JSUtils.SequentialTaskRunner = SequentialTaskRunner;
    module.exports = JSUtils;
}());