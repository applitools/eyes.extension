/**
 * Handling get/set of the extension's options.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var ConfigurationStore = require('./../ConfigurationStore.js'),
        RSVP = require('rsvp');


    /**
     * Sets whether or not a new tab should be opened for showing results on test end.
     * @return {Promise} A promise which resolves when the save is finished.
     * @private
     */
    var _saveNewTabForResults = function () {
        var shouldOpen = document.getElementById('newTabForResults').checked;
        return ConfigurationStore.setNewTabForResults(shouldOpen);
    };

    /**
     * Loads the saved value to the options' page newTabForResults checkbox.
     * @return {Promise} A promise which resolves to the element when the checkbox is set.
     * @private
     */
    var _restoreNewTabForResults = function () {
        var newTabForResultsElement = document.getElementById('newTabForResults');
        return ConfigurationStore.getNewTabForResults().then(function (shouldOpen) {
            newTabForResultsElement.checked = shouldOpen;
            return RSVP.resolve(newTabForResultsElement);
        });
    };

    /**
     * Loads the required value and sets required listeners.
     * @return {Promise} A promise which resolves to the element when the initialization is finished.
     * @private
     */
    var _initNewTabForResults = function () {
        return _restoreNewTabForResults().then(function (element) {
            // Registering for the change event so we'll know when to update the element.
            element.addEventListener('change', _saveNewTabForResults);
            return RSVP.resolve(element);
        });
    };

    /**
     * Sets the Eyes server URL.
     * @return {Promise} A promise which resolves when the save is finished.
     * @private
     */
    var _saveEyesServerUrl = function () {
        var eyesServerUrl = document.getElementById('eyesServerUrl').value;
        return ConfigurationStore.setEyesServerUrl(eyesServerUrl);
    };

    /**
     * Loads the saves value to the options' page Eyes server text input.
     * @return {Promise} A promise which resolves to the element when the text input is set.
     * @private
     */
    var _restoreEyesServer = function () {
        var eyesServerUrlElement = document.getElementById('eyesServerUrl');
        return ConfigurationStore.getEyesServerUrl().then(function (eyesServerUrl) {
            eyesServerUrlElement.value = eyesServerUrl;
            return RSVP.resolve(eyesServerUrlElement);
        });
    };

    /**
     * Loads the required value and sets required listeners.
     * @return {Promise} A promise which resolves to the element when the initialization is finished.
     * @private
     */
    var _initEyesServerUrl = function () {
        return _restoreEyesServer().then(function (element) {
            // Registering for the change event so we'll know when to update the element.
            element.addEventListener('change', _saveEyesServerUrl);
            return RSVP.resolve(element);
        });
    };

    /**
     * Loads the values and sets the required handlers of the option elements in the page.
     * @return {Array} An array of the initialized elements.
     * @private
     */
    var _initPage = function () {
        // We're done when ALL options are loaded.
        return RSVP.all([_initNewTabForResults(), _initEyesServerUrl()]);
    };

    document.addEventListener('DOMContentLoaded', _initPage);
}());
