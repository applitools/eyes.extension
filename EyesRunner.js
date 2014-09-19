/**
 * Provides a gateway for utilizing the images SDK.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var Eyes = require('eyes.images').Eyes,
        ConsoleLogHandler = require('eyes.images').ConsoleLogHandler,
        ConfigurationStore = require('./ConfigurationStore.js');

    var EyesCore = {};

    EyesCore.testImage = function (appName, testName, image, tag, viewportSize) {
        return ConfigurationStore.getEyesServerUrl().then(function (eyesServerUrl) {
            var eyes = new Eyes(eyesServerUrl);
            eyes.setLogHandler(new ConsoleLogHandler(true));
            return ConfigurationStore.getApiKey().then(function (apiKey) {
                eyes.setApiKey(apiKey);
                return eyes.open(appName, testName, {width: viewportSize.width, height: viewportSize.height})
                    .then(function () {
                        return eyes.checkImage(image, tag, false, -1);
                    }).then(function () {
                        // We don't want close to throw an exception, since we need the url in the results.
                        return eyes.close(false);
                    }).catch(function () {
                        return eyes.abortIfNotClosed();
                    });
            });
        });
    };

    //noinspection JSUnresolvedVariable
    module.exports = EyesCore;
}());