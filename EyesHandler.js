/**
 * Provides a gateway for utilizing the images SDK.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var EyesImages = require('eyes.images'),
        EyesUtils = require('eyes.utils'),
        restler = require('restler'),
        RSVP = require('rsvp'),
        Eyes = EyesImages.Eyes,
        MatchLevel = EyesImages.MatchLevel,
        ConsoleLogHandler = EyesImages.ConsoleLogHandler,
        GeneralUtils = EyesUtils.GeneralUtils,
        ConfigurationStore = require('./ConfigurationStore.js');

    var EyesHandler = {};

    /**
     * Runs a single test for the given image.
     * @param {Object} testParams The parameters defining the test (e.g., app name, test name, etc.).
     * @param {Buffer} image The image to test.
     * @param {string} tag The step tag for the image.
     * @returns {Promise} A promise which resolves to the test results.
     */
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
                eyes.setAgentId('eyes.extension.chrome/1.22');
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
                if (testParams.saveFailedTests) {
                    eyes.setSaveFailedTests(true);
                }
                if (testParams.inferred) {
                    eyes.setInferredEnvironment(testParams.inferred);
                } else {
                    eyes.setInferredEnvironment('useragent:' + navigator.userAgent);
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

    /**
     * Delete the tests with the given IDs.
     * @param {Array} testIds The list of test IDs to delete.
     * @returns {Promise} A promise which resolves when the delete is finished, or rejects if an error occurred.
     */
    EyesHandler.deleteTests = function (testIds) {
        var eyesApiServerUrl, accountIdKey;
        var CONNECTION_TIMEOUT_MS = 5 * 60 * 1000,
            DEFAULT_HEADERS = {'Accept': 'application/json', 'Content-Type': 'application/json'};


        return ConfigurationStore.getEyesApiServerUrl()
            .then(function (eyesApiServerUrl_) {
                eyesApiServerUrl = eyesApiServerUrl_;
            }).then(function () {
                // For deleting tests, we need the user api key, not the run key.
                return ConfigurationStore.getAccountId();
            }).then(function (accountIdKey_) {
                accountIdKey = accountIdKey_;
            }).then(function () {
                var httpOptions = {
                    rejectUnauthorized: false,
                    headers: DEFAULT_HEADERS,
                    timeout: CONNECTION_TIMEOUT_MS,
                    query: {apiKey: accountIdKey}
                };

                var url = GeneralUtils.urlConcat(eyesApiServerUrl, 'api/sessions');
                return new RSVP.Promise(function (resolve, reject) {
                    restler.json(url, {ids: testIds}, httpOptions, 'DELETE')
                        .on('complete', function (data, response) {
                            if (response.statusCode === 200) {
                                resolve();
                            } else {
                                reject(new Error('Error trying to delete sessions!'));
                            }
                        });
                });
            });
    };

    //noinspection JSUnresolvedVariable
    module.exports = EyesHandler;
}());
