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
     * @param {UserAuthHandler} authHandler authentication handler.
     * @returns {Promise} A promise which resolves to the test results.
     */
    EyesHandler.testImage = function (testParams, image, tag, authHandler) {
        return ConfigurationStore.getEyesApiServerUrl().then(function (eyesApiServerUrl) {
            var eyes = new Eyes(eyesApiServerUrl);
            var results;
            eyes.setLogHandler(new ConsoleLogHandler(true));
            return authHandler.getRunKey()
                .then(function (runKeyObj) {
                    eyes.setApiKey(runKeyObj.runKey, runKeyObj.isNewAuthScheme);
                    if (testParams.batch && testParams.batch.id) {
                        eyes.setBatch(testParams.batch.name, testParams.batch.id);
                    }
                    eyes.setAgentId('eyes.extension.chrome/1.23');
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
                        }).then(function (results_) {
                            results = results_;
                            return authHandler.getResultsViewKey();
                        }).then(function (viewKey) {
                            if (viewKey) {
                                results.url = results.url + '?' + viewKey.name + '=' + viewKey.value;
                            }
                            return results;
                        }).catch(function () {
                            return eyes.abortIfNotClosed();
                        });
                });
        });
    };

    /**
     * Delete the tests with the given IDs.
     * @param {Array} testIds The list of test IDs to delete.
     * @param {UserAuthHandler} authHandler authentication handler.
     * @returns {Promise} A promise which resolves when the delete is finished, or rejects if an error occurred.
     */
    EyesHandler.deleteTests = function (testIds, authHandler) {
        var eyesApiServerUrl;
        var CONNECTION_TIMEOUT_MS = 5 * 60 * 1000,
            DEFAULT_HEADERS = {'Accept': 'application/json', 'Content-Type': 'application/json'};


        return ConfigurationStore.getEyesApiServerUrl()
            .then(function (eyesApiServerUrl_) {
                eyesApiServerUrl = eyesApiServerUrl_;
            }).then(function () {
                return authHandler.getAccessKey();
            }).then(function (accessKeyObj) {
                var queryObj = {};
                queryObj[accessKeyObj.name] = accessKeyObj.value;
                var httpOptions = {
                    rejectUnauthorized: false,
                    headers: DEFAULT_HEADERS,
                    timeout: CONNECTION_TIMEOUT_MS,
                    query: queryObj
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
