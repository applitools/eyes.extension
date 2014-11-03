/**
 * Provides a gateway for utilizing the images SDK.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var RSVP = require('rsvp'),
        EyesImages = require('eyes.images'),
        Eyes = EyesImages.Eyes,
        ConsoleLogHandler = EyesImages.ConsoleLogHandler,
        EyesUtils = require('eyes.utils'),
        PromiseFactory = EyesUtils.PromiseFactory,
        ConfigurationStore = require('./ConfigurationStore.js');

    PromiseFactory.setFactoryMethods(function (asyncAction) {
        return new RSVP.Promise(asyncAction);
    }, function () {
        return RSVP.defer();
    });
    EyesUtils.setPromiseFactory(PromiseFactory);

    var EyesHandler = {};

    EyesHandler.testImage = function (testParams, image, tag) {
        return ConfigurationStore.getEyesServerUrl().then(function (eyesServerUrl) {
            var eyes = new Eyes(eyesServerUrl);
            eyes.setLogHandler(new ConsoleLogHandler(true));
            return ConfigurationStore.getApiKey().then(function (apiKey) {
                eyes.setApiKey(apiKey);
                eyes.setMatchLevel(testParams.matchLevel);
                eyes.setBranchName(testParams.branchName);
                eyes.setParentBranchName(testParams.parentBranchName);
                eyes.setOs(testParams.os);
                eyes.setHostingApp(testParams.hostingApp);
                if (testParams.inferred) {
                    eyes.setInferredEnvironment(testParams.inferred);
                } else {
                    eyes.setInferredEnvironment("useragent:" + navigator.userAgent);
                }
                return eyes.open(testParams.appName, testParams.testName, testParams.viewportSize)
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
    module.exports = EyesHandler;
}());