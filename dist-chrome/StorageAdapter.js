/**
 * Provides a gateway to the persistent extension storage.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var RSVP = require('rsvp');

    var StorageAdapter = {};

    /**
     * Save a value to the persistent storage.
     * @param {string} key
     * @param {*} val
     * @return {Promise}
     */
    StorageAdapter.setItem = function (key, val) {
        var obj = {};
        obj[key] = val;

        var deferred = RSVP.defer();

        //noinspection JSUnresolvedVariable
        chrome.storage.sync.set(obj, function () {
            //noinspection JSUnresolvedVariable
            var lastError = chrome.runtime.lastError;
            if (lastError) {
                deferred.reject(new Error("Failed to set '" + key + "': '" + val + "'. Error: " + lastError));
            }
            deferred.resolve(obj);
        });

        return deferred.promise;
    };

    /**
     * Retrieves a value from the persistent storage.
     * @param {string} key
     * @param defaultVal The value which will be retrieved if the key is not available in the local storage.
     * @return {Promise}
     */
    StorageAdapter.getItem = function (key, defaultVal) {
        var what = {};
        // Notice that the key value is the defaultVal (this is how chrome storage works)
        // IMPORTANT if defaultVal is undefined Chrome will always(!) return an empty object, so we need to handle this
        //           case specifically.
        if (defaultVal === undefined) {
            what = key; // We can use a string instead of an object
        } else {
            what[key] = defaultVal;
        }

        var deferred = RSVP.defer();

        //noinspection JSUnresolvedVariable,JSUnresolvedFunction
        chrome.storage.sync.get(what, function (items) {
            //noinspection JSUnresolvedVariable
            var lastError = chrome.runtime.lastError;
            if (lastError) {
                deferred.reject(new Error("Failed to get '" + key + "'. Error: " + lastError));
            }
            deferred.resolve(items[key]);
        });

        return deferred.promise;
    };

    /**
     * Removes a value from the persistent storage.
     * @param {string} key
     * @return {Promise}
     */
    StorageAdapter.removeItem = function (key) {

        var deferred = RSVP.defer();

        //noinspection JSUnresolvedVariable
        chrome.storage.sync.remove(key, function () {
            //noinspection JSUnresolvedVariable
            var lastError = chrome.runtime.lastError;
            if (lastError) {
                deferred.reject(new Error("Failed to remove '" + key + "'. Error: " + lastError));
            }
            deferred.resolve(key);
        });

        return deferred.promise;
    };

    /**
     * Retrieves a cookie.
     * @param {string} url The url for which the cookie belongs.
     * @param {string} name The name of the cookie.
     * @return {Promise}
     */
    StorageAdapter.getCookie = function (url, name) {
        var deferred = RSVP.defer();
        //noinspection JSUnresolvedVariable,JSUnresolvedFunction
        chrome.cookies.get({url: url, name: name}, function (cookie) {
            deferred.resolve(cookie);
        });
        return deferred.promise;
    };

    //noinspection JSUnresolvedVariable
    module.exports = StorageAdapter;
}());
