/**
 * Encapsulates handling of an image to be used as a baseline.
 */
(function () {
    'use strict';

    var BaselineImageHandler = function () {
        this.image = undefined;
        this.filename = undefined; // The file name of the image.
        this.stepUrl = undefined; // The step URL of the image in the test that set it as baseline.
        this.shouldUse = false; // Whether or not the given image should be currently used as the baseline.
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * @returns {boolean} {@code true} if the image was already uploaded to applitools and as a baseline.
     */
    BaselineImageHandler.prototype.isBaseline = function () {
        return !!this.stepUrl;
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Sets the image.
     * @param {Buffer} image The image to set.
     * @return {Promise} A promise which resolves to the {@code BaselineImageHandler} object when the image is set.
     */
    BaselineImageHandler.prototype.setImage = function (image) {
        return new Promise(function (resolve) {
            this.image = image;
            resolve(this);
        }.bind(this));
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     *
     * @returns {Buffer} The current image, or to undefined if no image is set.
     */
    BaselineImageHandler.prototype.getImage = function () {
        return this.image;
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Sets the image.
     * @param {Buffer} filename The image's file name.
     * @return {Promise} A promise which resolves to the {@code BaselineImageHandler} object when the filename is set.
     */
    BaselineImageHandler.prototype.setFilename = function (filename) {
        return new Promise(function (resolve) {
            this.filename = filename;
            resolve(this);
        }.bind(this));
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * @returns {string} The current image's file filename, or to undefined if no image is set.
     */
    BaselineImageHandler.prototype.getFilename = function () {
        return this.filename;
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Sets the image's step URL.
     * @param {string} stepUrl The step url of the image.
     * @return {Promise} A promise which resolves to the {@code BaselineImageHandler} object when the step URL is set.
     */
    BaselineImageHandler.prototype.setStepUrl = function (stepUrl) {
        return new Promise(function (resolve) {
            this.stepUrl = stepUrl;
            resolve(this);
        }.bind(this));
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     *
     * @returns {string} The current image's step URL, or to undefined if no step URL is set.
     */
    BaselineImageHandler.prototype.getStepUrl = function () {
        return this.stepUrl;
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Sets whether or not the image should be currently used as baseline.
     * @param {boolean} shouldUse Whether or not the image should be currently used as baseline.
     * @return {Promise} A promise which resolves to the {@code BaselineImageHandler} object when the value is set.
     */
    BaselineImageHandler.prototype.setShouldUse = function (shouldUse) {
        return new Promise(function (resolve) {
            this.shouldUse = shouldUse;
            resolve(this);
        }.bind(this));
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     *
     * @returns {Promise} A promise which resolves to true when the image should be used as baseline, or to
     * false otherwise.
     */
    BaselineImageHandler.prototype.getShouldUse = function () {
        return this.shouldUse;
    };

    /**
     * Creates a new baseline image handler from a given image.
     * @param {Buffer} image The image to create the image baseline header from.
     * @param {string} filename The image file name.
     * @return {Promise} A promise which resolves to the {@code BaselineImageHandler} instance.
     */
    var createFromImage = function (image, filename) {
        var baselineImageHandler = new BaselineImageHandler();
        return baselineImageHandler.setImage(image)
            .then(function () {
                return baselineImageHandler.setFilename(filename);
            });
    };

    module.exports.BaselineImageHandler = BaselineImageHandler;
    module.exports.createFromImage = createFromImage;
}());
