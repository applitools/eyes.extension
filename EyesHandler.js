/**
 * Provides a gateway for utilizing the images SDK.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var EyesImages = require('eyes.images'),
        Eyes = EyesImages.Eyes,
        MatchLevel = EyesImages.MatchLevel,
        ConsoleLogHandler = EyesImages.ConsoleLogHandler,
        ConfigurationStore = require('./ConfigurationStore.js');

    var EyesHandler = {};

    EyesHandler.testImage = function (testParams, image, tag) {
        return ConfigurationStore.getEyesApiServerUrl().then(function (eyesApiServerUrl) {
            var eyes = new Eyes(eyesApiServerUrl);
            var apiKey;
            eyes.setLogHandler(new ConsoleLogHandler(true));
            return ConfigurationStore.getApiKey().then(function (apiKey_) {
                apiKey = apiKey_;
            }).then(function () {
                eyes.setApiKey(apiKey);
                if (testParams.batch && testParams.batch.id) {
                    eyes.setBatch(testParams.batch.name, testParams.batch.id);
                }
                eyes.setAgentId('eyes.extension.chrome/1.20');
                // TODO Daniel - hack, to use layout2 instead of layout as an experiment.
                if (testParams.matchLevel === 'Layout') {
                    eyes.setMatchLevel(MatchLevel.Layout2);
                } else {
                    eyes.setMatchLevel(testParams.matchLevel);
                }
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
