/**
 * Encapsulates handling of a step list.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var RSVP = require('rsvp');

    var StepsHandler = function () {
        this.stepList = [];
        this.currentStepIndex = -1;
    };

    /**
     * @returns {boolean} {@code true} if there are steps available.
     */
    StepsHandler.prototype.areStepsAvailable = function () {
        return this.stepList.length > 0;
    };

    /**
     * Resets the step list.
     * @returns {Promise} A promise which is resolved when the reset finished.
     */
    StepsHandler.prototype.resetSteps = function () {
        return new RSVP.Promise(function (resolve) {
            this.stepList = [];
            this.currentStepIndex = -1;
            resolve(this);
        }.bind(this));
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     * Set the list of steps.
     * @param {Array|undefined} stepsToSet The steps to set. if the value is {@code undefined} the steps are reset.
     * @return {Promise} A promise which resolves to the {@code StepsHandler} object when the steps are set.
     */
    StepsHandler.prototype.setSteps = function (stepsToSet) {
        return new RSVP.Promise(function (resolve) {
            // For anything other than a valid array.
            if (!(stepsToSet instanceof Array) || stepsToSet.length === 0) {
                return this.resetSteps().then(function () { resolve(this); }.bind(this));
            }
            stepsToSet.forEach(function (potentialStep) {
                var currentStep = potentialStep.trim();
                if (currentStep !== '') {
                    this.stepList.push(currentStep);
                }
            }, this);
            this.currentStepIndex = this.stepList.length > 0 ? 0 : -1;
            resolve(this);
        }.bind(this));
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     *
     * @returns {Promise} A promise which is resolved to the steps count.
     */
    StepsHandler.prototype.getStepsCount = function () {
        return RSVP.resolve(this.stepList.length);
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     *
     * @returns {Promise} A promise which resolves to the step moved to, or undefined if there was an error.
     */
    StepsHandler.prototype.moveToStep = function (stepIndex) {
        if (this.areStepsAvailable() && stepIndex >= 0 && stepIndex < this.stepList.length) {
            this.currentStepIndex = stepIndex;
            return RSVP.resolve(this.stepList[this.currentStepIndex]);
        }
        return RSVP.resolve(undefined);
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     *
     * @returns {Promise} A promise which resolves to the current step index, or -1 if there are no steps.
     */
    StepsHandler.prototype.getCurrentStepIndex = function () {
        return RSVP.resolve(this.currentStepIndex);
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     *
     * @returns {Promise} A promise which resolves to the string which is the current step, or undefined if there are
     *                    no steps.
     */
    StepsHandler.prototype.getCurrentStep = function () {
        if (this.areStepsAvailable()) {
            return RSVP.resolve(this.stepList[this.currentStepIndex]);
        }
        return RSVP.resolve(undefined);
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     *
     * @returns {Promise} A promise which is resolved to the next step, if available. If the current step is the last
     * step, it will resolve to current step. If no steps are available it will resolve to {@code undefined}.
     */
    StepsHandler.prototype.moveToNextStep = function () {
        if (!this.areStepsAvailable()) {
            return RSVP.resolve(undefined);
        }

        if (this.currentStepIndex < (this.stepList.length - 1)) {
            ++this.currentStepIndex;
        }
        return this.getCurrentStep();
    };

    //noinspection JSUnusedGlobalSymbols
    /**
     *
     * @returns {Promise} A promise which is resolved to the previous step, if available. If the current step is the
     * first step, it will resolve to current step. If no steps are available it will resolve to {@code undefined}.
     */
    StepsHandler.prototype.moveToPrevStep = function () {
        if (!this.areStepsAvailable()) {
            return RSVP.resolve(undefined);
        }

        if (this.currentStepIndex > 0) {
            --this.currentStepIndex;
        }
        return this.getCurrentStep();
    };

    /**
     * Load the steps list from a single string (i.e., instructions concatenated using new line chars).
     * @param {string} s The string representing the instructions list.
     * @return {Promise} A promise which resolves to a {@code StepsHandler} object with the instructions given
     *                   in {@code s}.
     */
    var createFromString = function (s) {
        var stepsHandler = new StepsHandler();
        return stepsHandler.setSteps(s.split('\n'));
    };

    module.exports.StepsHandler = StepsHandler;
    module.exports.createFromString = createFromString;
}());
