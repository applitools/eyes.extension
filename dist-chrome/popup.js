/**
 * Handling logic for the popup view of the extension.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var ConfigurationStore = require('./../ConfigurationStore.js'),
        JSUtils = require('./../JSUtils.js'),
        RSVP = require('rsvp'),
        toBuffer = require('typedarray-to-buffer'),
        debounce = require('lodash.debounce');

    var Applitools = chrome.extension.getBackgroundPage().Applitools;

    var _NOT_DISPLAYED_CLASS = 'notDisplayed',
        _BATCH_OPEN_CLASS = 'batchOpen',
        _INVALID_INPUT_CLASS = 'invalidInput',
        _SELECTED_CLASS = 'selected',
        _FILE_LOADED_CLASS = 'fileLoaded',
        _DISABLED_CLASS = 'disabled',
        _NOTIFICATION_ICON_CLASS = 'notificationIcon';

    var _OPTIONS_ELEMENT_ID = 'options',
        _MAIN_PANEL_ELEMENT_ID = 'mainPanel',
        _BASELINE_PANEL_ELEMENT_ID = 'baselinePanel',
        _SHOW_BASELINE_ELEMENT_ID = 'showBaseline',
        _BATCH_PANEL_ELEMENT_ID = 'batchPanel',
        _STEPS_PANEL_ELEMENT_ID = 'stepsPanel',
        _STEP_TEXT_ELEMENT_ID = 'stepText',
        _PREV_STEP_BUTTON_ELEMENT_ID = 'prevStep',
        _NEXT_STEP_BUTTON_ELEMENT_ID = 'nextStep',
        _CLOSE_STEPS_PANEL_ELEMENT_ID = 'closeStepsPanel',
        _STEPS_LOAD_BUTTON_ELEMENT_ID = 'stepsLoadButton',
        _BASELINE_IMAGE_LOAD_BUTTON_ELEMENT_ID = 'baselineImageLoadButton',
        _BASELINE_IMAGE_LOAD_BUTTON_LABEL_ID = 'baselineImageLoadButtonLabel',
        _USE_IMAGE_AS_BASELINE_CHECKBOX_ID = 'useImageAsBaseline',
        _BASELINE_IMAGE_FILENAME_INPUT_ELEMENT_ID = 'baselineImageFilename',
        _SHOW_BATCH_PANEL_ELEMENT_ID = 'showBatchPanel',
        _MATCH_LEVEL_ELEMENT_ID = 'matchLevel',
        _VIEWPORT_SIZE_ELEMENT_ID = 'viewportSize',
        _RUN_SINGLE_TEST_ELEMENT_ID = 'runSingleTest',
        _RUN_CRAWLER_ELEMENT_ID = 'runCrawler',
        _STEP_URL_ELEMENT_ID = 'stepUrl',
        _STEP_URL_SELECTION_ELEMENT_ID = 'stepUrlSelection',
        _APP_NAME_ELEMENT_ID = 'appName',
        _TEST_NAME_ELEMENT_ID = 'testName',
        _USER_VALUES_SELECTION_ELEMENT_ID = 'userValuesSelection',
        _DEFAULT_VALUES_SELECTION_ELEMENT_ID = 'defaultValuesSelection',
        _DEFAULT_VALUES_SELECTION_CONTAINER_ELEMENT_ID = 'defaultValuesContainer',
        _BASELINE_IMAGE_CONTAINER_ELEMENT_ID = 'baselineImageContainer',
        _BATCH_NAME_ELEMENT_ID = 'batchName',
        _RESET_BATCH_ID_ELEMENT_ID = 'newBatchId',
        _BASELINE_OK_ELEMENT_ID = 'baselineOk';


    var _baselineInitialized = false;

    // Shortcuts for getting DOM elements which are called often.
    var _getStepUrlInputElement = function () {
        return document.getElementById(_STEP_URL_ELEMENT_ID);
    };

    var _getStepUrlSelectionElement = function () {
        return document.getElementById(_STEP_URL_SELECTION_ELEMENT_ID);
    };

    var _getAppNameInputElement = function () {
        return document.getElementById(_APP_NAME_ELEMENT_ID);
    };

    var _getTestNameInputElement = function () {
        return document.getElementById(_TEST_NAME_ELEMENT_ID);
    };

    var _getUserValuesSelectionElement = function () {
        return document.getElementById(_USER_VALUES_SELECTION_ELEMENT_ID);
    };

    var _getDefaultValuesSelectionElement = function () {
        return document.getElementById(_DEFAULT_VALUES_SELECTION_ELEMENT_ID);
    };

    var _getBatchNameInputElement = function () {
        return document.getElementById(_BATCH_NAME_ELEMENT_ID);
    };

    var _getResetBatchIdElement = function () {
        return document.getElementById(_RESET_BATCH_ID_ELEMENT_ID);
    };

    var _getBatchPanelElement = function () {
        return document.getElementById(_BATCH_PANEL_ELEMENT_ID);
    };

    var _getShowBatchPanelElement = function () {
        return document.getElementById(_SHOW_BATCH_PANEL_ELEMENT_ID);
    };

    var _getStepsPanelElement = function () {
        return document.getElementById(_STEPS_PANEL_ELEMENT_ID);
    };

    var _getStepTextElement = function () {
        return document.getElementById(_STEP_TEXT_ELEMENT_ID);
    };

    var _getCloseStepsPanelElement = function () {
        return document.getElementById(_CLOSE_STEPS_PANEL_ELEMENT_ID);
    };

    var _getStepsLoadButtonElement = function () {
        return document.getElementById(_STEPS_LOAD_BUTTON_ELEMENT_ID);
    };

    var _getNextStepButtonElement = function () {
        return document.getElementById(_NEXT_STEP_BUTTON_ELEMENT_ID);
    };

    var _getPrevStepButtonElement = function () {
        return document.getElementById(_PREV_STEP_BUTTON_ELEMENT_ID);
    };

    var _getBaselineImageLoadButtonElement = function () {
        return document.getElementById(_BASELINE_IMAGE_LOAD_BUTTON_ELEMENT_ID);
    };

    var _getBaselineImageFilenameInputElement = function () {
        return document.getElementById(_BASELINE_IMAGE_FILENAME_INPUT_ELEMENT_ID);
    };

    var _getBaselineImageLoadButtonLabelElement = function () {
        return document.getElementById(_BASELINE_IMAGE_LOAD_BUTTON_LABEL_ID);
    };

    var _getUseImageAsBaselineCheckboxElement = function () {
        return document.getElementById(_USE_IMAGE_AS_BASELINE_CHECKBOX_ID);
    };

    var _getBaselineOkButtonElement = function () {
        return document.getElementById(_BASELINE_OK_ELEMENT_ID);
    };

    //noinspection JSUnusedLocalSymbols
    var _getMainPanelElement = function () {
        return document.getElementById(_MAIN_PANEL_ELEMENT_ID);
    };

    var _getShowBaselinePanelButton = function () {
        return document.getElementById(_SHOW_BASELINE_ELEMENT_ID);
    };

    var _getDefaultValuesSelectionContainer = function () {
        return document.getElementById(_DEFAULT_VALUES_SELECTION_CONTAINER_ELEMENT_ID);
    };

    var _getBaselineImageContainer = function () {
        return document.getElementById(_BASELINE_IMAGE_CONTAINER_ELEMENT_ID);
    };

    /**
     * Highlight the given input to notify the user that the value input is invalid.
     * @param inputElement The input element to highlight.
     * @return {Promise} A promise which resolves when the highlighting is finished.
     * @private
     */
    var _highlightInvalidInput = function (inputElement) {
        inputElement.classList.add(_INVALID_INPUT_CLASS);
        var deferred = RSVP.defer();
        setTimeout(function () {
            inputElement.classList.remove(_INVALID_INPUT_CLASS);
            deferred.resolve();
        },500);
        return deferred.promise;
    };

    /**
     * Initializes the options button with the required event listeners.
     * @return {Promise} A promise which resolves to the options element when the init is done.
     * @private
     */
    var _initOptionsButton = function () {
        var optionsElement = document.getElementById(_OPTIONS_ELEMENT_ID);

        _addRemoveClass(optionsElement, Applitools.currentState.unreadErrorsExist, _NOTIFICATION_ICON_CLASS);

        // Open the options tab, or switch to it if it's already opened.
        optionsElement.addEventListener('click', function () {
            var optionsUrl = chrome.extension.getURL('options.html');

            chrome.tabs.query({url: optionsUrl}, function (tabs) {
                if (tabs.length) {
                    chrome.tabs.update(tabs[0].id, {active: true});
                } else {
                    chrome.tabs.create({url: optionsUrl});
                }
            });
        });

        return RSVP.resolve(optionsElement);
    };

    /**
     * Makes the requested panel displayed.
     * @param {string} panelId The ID of the panel to be displayed. Currently supported only 'mainPanel'
     *                          and 'baselinePanel'
     * @return {Promise} A promise which is resolved when the panel is set to be displayed.
     * @private
     */
    var _showPanel = function (panelId) {
        var mainPanel = document.getElementById(_MAIN_PANEL_ELEMENT_ID);
        var baselinePanel = document.getElementById(_BASELINE_PANEL_ELEMENT_ID);
        var panelToShow;
        var batchPanelPromise;
        if (panelId === _BASELINE_PANEL_ELEMENT_ID) {
            panelToShow = baselinePanel;
            baselinePanel.classList.remove(_NOT_DISPLAYED_CLASS);
            mainPanel.classList.add(_NOT_DISPLAYED_CLASS);
            batchPanelPromise = _showBatchPanel(false);
        } else {
            // show main panel
            panelToShow = mainPanel;
            mainPanel.classList.remove(_NOT_DISPLAYED_CLASS);
            baselinePanel.classList.add(_NOT_DISPLAYED_CLASS);

            // Whether or not to show the batch panel depends on whether if a batch is set.
            batchPanelPromise = ConfigurationStore.getShouldUseBatch()
                .then(function (shouldUseBatch) {
                    return _showBatchPanel(shouldUseBatch);
                });
        }

        return batchPanelPromise.then(function () {
            return panelToShow;
        });
    };

    /**
     * Handle user click on the baseline button in the main panel.
     * @return {Promise} A promise which resolves when done handling the click.
     * @private
     */
    var _onShowBaselineButtonClicked = function () {
        return _initBaselinePanel().then(function () {
            return _showPanel(_BASELINE_PANEL_ELEMENT_ID);
        });
    };

    /**
     * Initializes the main panel's baseline button functionality
     * @return {Promise} A promise which resolves to the DOM element when initialization is done.
     * @private
     */
    var _initShowBaselinePanelButton = function () {
        var baselineButton = document.getElementById(_SHOW_BASELINE_ELEMENT_ID);
        baselineButton.addEventListener('click', _onShowBaselineButtonClicked);

        return ConfigurationStore.getBaselineSelection().then(function (selection) {
            return _updateShowBaselinePanelButton(baselineButton, selection);
        });
    };

    var _updateShowBaselinePanelButton = function (baselineButton, selectionId) {
        // Checking if there's a non-default baseline selection - i.e. not undefined
        if ((!selectionId || selectionId === _DEFAULT_VALUES_SELECTION_ELEMENT_ID) &&
                !Applitools.getShouldUseImageAsBaseline()) {
            baselineButton.classList.remove(_NOTIFICATION_ICON_CLASS);
            baselineButton.title = 'Set a custom baseline';
            return RSVP.resolve(baselineButton);
        }

        baselineButton.classList.add(_NOTIFICATION_ICON_CLASS);
        return RSVP.all([ConfigurationStore.getBaselineStepUrl(),
            ConfigurationStore.getBaselineAppName(),
            ConfigurationStore.getBaselineTestName()])
            .then(function (baselineParams) {
                baselineButton.title = "(Custom baseline) " + ((selectionId === _STEP_URL_SELECTION_ELEMENT_ID) ?
                    ("Step URL: " + baselineParams[0]) :
                    ("Application name: \"" + baselineParams[1] + "\", test name: \"" + baselineParams[2]) + "\".");

                return RSVP.resolve(baselineButton);
            });
    };

    /**
     * Show/Hide the batch panel.
     * @param shouldShow Whether to show or hide the batch panel.
     * @return {Promise} A promise which resolves to the batchPanel element.
     * @private
     */
    var _showBatchPanel = function (shouldShow) {
        var batchPanel = _getBatchPanelElement();
        var showBatchPanelElement = _getShowBatchPanelElement();

        if (shouldShow) {
            batchPanel.classList.remove(_NOT_DISPLAYED_CLASS);
            showBatchPanelElement.classList.add(_BATCH_OPEN_CLASS);
        } else {
            batchPanel.classList.add(_NOT_DISPLAYED_CLASS);
            showBatchPanelElement.classList.remove(_BATCH_OPEN_CLASS);
        }

        return RSVP.resolve(batchPanel);
    };

    /**
     * Handle "use session" toggling.
     * @return {Promise} A promise which resolves when done handling the toggle.
     * @private
     */
    var _onToggleUseBatch = function () {
        return ConfigurationStore.getShouldUseBatch().then(function (shouldUseBatch) {
            // Perform toggle.
            shouldUseBatch = !shouldUseBatch;
            if (shouldUseBatch && Applitools.getCurrentBatchId() === undefined) {
                _resetBatchId();
            }
            return _showBatchPanel(shouldUseBatch).then(function () {
               return ConfigurationStore.setShouldUseBatch(shouldUseBatch);
            });
        });
    };

    /**
     * Initializes the main panel's batch button functionality.
     * @return {Promise} A promise which resolves to the DOM element when initialization is done.
     * @private
     */
    var _initShowBatchPanelButton = function () {
        var showBatchPanelButton = document.getElementById(_SHOW_BATCH_PANEL_ELEMENT_ID);
        showBatchPanelButton.addEventListener('click', _onToggleUseBatch);

        return RSVP.resolve(showBatchPanelButton);
    };

    /**
     * Show/Hide the steps panel.
     * @param shouldShow Whether to show or hide the panel.
     * @return {Promise} A promise which resolves to the steps panel element.
     * @private
     */
    var _showStepsPanel = function (shouldShow) {
        var stepsPanel = _getStepsPanelElement();

        if (shouldShow) {
            stepsPanel.classList.remove(_NOT_DISPLAYED_CLASS);
        } else {
            stepsPanel.classList.add(_NOT_DISPLAYED_CLASS);
        }

        return RSVP.resolve(stepsPanel);
    };

    /**
     * Handle user selection of a match level value.
     * @return {Promise} A promise which resolves to the user selected value when done handling the value change.
     * @private
     */
    var _onMatchLevelChanged = function () {
        var matchLevel = document.getElementById(_MATCH_LEVEL_ELEMENT_ID).value;
        return ConfigurationStore.setMatchLevel(matchLevel);
    };

    /**
     * Initializes the match level select element with the values and event listeners.
     * @return {Promise} A promise which resolves to the DOM element when initialization is done.
     * @private
     */
    var _initMatchLevel = function () {
        var matchLevelElement = document.getElementById(_MATCH_LEVEL_ELEMENT_ID);

        // Get all available match levels.
        return ConfigurationStore.getAllMatchLevels().then(function (allMatchLevels) {
            // Get currently set match level
            return ConfigurationStore.getMatchLevel().then(function (matchLevel) {
                // Update the element.
                return JSUtils.setSelect(matchLevelElement, allMatchLevels, allMatchLevels, matchLevel);
            }).then(function (initializedElement) {
                initializedElement.addEventListener('change', _onMatchLevelChanged);
                return RSVP.resolve(initializedElement);
            });
        });
    };

    /**
     * Handle user selection of a viewport size value.
     * @return {Promise} A promise which resolves to the user selected value when done handling the value change.
     * @private
     */
    var _onViewportSizeChanged = function () {
        var viewportSize = document.getElementById(_VIEWPORT_SIZE_ELEMENT_ID).value;
        return ConfigurationStore.setViewportSize(viewportSize);
    };

    /**
     * Initializes the viewport size select element with the values and event listeners.
     * @return {Promise} A promise which resolves to the DOM element when initialization is done.
     * @private
     */
    var _initViewportSize = function () {
        var viewportSizeElement = document.getElementById(_VIEWPORT_SIZE_ELEMENT_ID);

        return RSVP.all([
            // We need the baseline selection to disable the viewport in case a step URL was selected
            ConfigurationStore.getBaselineSelection(),
            // Get all viewport sizes available.
            ConfigurationStore.getAllViewportSizes(),
            // Get the currently set viewport size.
            ConfigurationStore.getViewportSize()]).then(function (results) {

            var baselineSelection = results[0],
                allViewportSizes = results[1],
                viewportSize = results[2];

            var disabled = (baselineSelection === _STEP_URL_SELECTION_ELEMENT_ID);

            _addRemoveClass(viewportSizeElement, disabled, _DISABLED_CLASS);
            viewportSizeElement.disabled = disabled;
            viewportSizeElement.title = disabled ? "Viewport size will be taken from the referred baseline step" :
                "Set the viewport size in which the test will run";

            // Update the element.
            return JSUtils.setSelect(viewportSizeElement, allViewportSizes, allViewportSizes, viewportSize);
        }).then(function (initializedElement) {
            initializedElement.addEventListener('change', _onViewportSizeChanged);
            return RSVP.resolve(initializedElement);
        });
    };

    /**
     * Initializes the "run single test" button with the required event listeners.
     * @return {Promise} A promise which resolves to the run element when the init is done.
     * @private
     */
    var _initRunSingleTestButton = function () {
        var runElement = document.getElementById(_RUN_SINGLE_TEST_ELEMENT_ID);
        // Run a visual test when button is clicked.
        runElement.addEventListener("click", function () {
            // IMPORTANT All test logic must run in the background page! This is because when the popup is closed,
            // the Javascript in the popup js file stops immediately, it does not wait for operations to complete.
            Applitools.runSingleTest();
        });
        return RSVP.resolve(runElement);
    };

    /**
     * Initializes the "run crawler" button with the required event listeners.
     * @return {Promise} A promise which resolves to the run element when the init is done.
     * @private
     */
    var _initRunCrawlerButton = function () {
        var runElement = document.getElementById(_RUN_CRAWLER_ELEMENT_ID);
        // Run a visual test when button is clicked.
        runElement.addEventListener("click", function () {
            // IMPORTANT All test logic must run in the background page! This is because when the popup is closed,
            // the Javascript in the popup js file stops immediately, it does not wait for operations to complete.
            //Applitools.runSingleTest();
            Applitools.crawl();
        });
        return RSVP.resolve(runElement);
    };

    /**
     * Initializes the elements on the main panel.
     * @return {Promise} A promise which resolves to an array containing the initialization results.
     * @private
     */
    var _initMainPanel = function () {
        // We perform a "set size" to the already existing value avoid the rendering "glitch" which happens on the
        // first "set size".
        var setSizePromise = JSUtils.defer(function () {
            _getMainPanelElement().style.height = '52px';
        }, 200);

        return RSVP.all([setSizePromise, _initOptionsButton(),
            _initShowBaselinePanelButton(),
            _initShowBatchPanelButton(),
            _initMatchLevel(),
            _initViewportSize(),
            _initRunCrawlerButton(),
            _initRunSingleTestButton()]
        );
    };

    /**
     * Saves the changes the user performed on the baseline panel (if valid). If changes were not valid, it will
     * highlight them.
     * @return {Promise} A promise which resolves when the changes are saved, or rejected to an error highlight callback.
     * @private
     */
    var _saveBaselineSettings = function () {
        var stepUrl, appName, testName, selectionId;

        // We want to save the values even inside the non-selected inputs, since this is the flow the user expects.
        var stepUrlSelectionElement = _getStepUrlSelectionElement();
        stepUrl = _getStepUrlInputElement().value.trim();

        var userValuesSelectionElement = _getUserValuesSelectionElement();
        appName = _getAppNameInputElement().value;
        testName = _getTestNameInputElement().value;

        // For the selected type of input we want to make sure values are valid.
        if (stepUrlSelectionElement.checked) {
            if (!stepUrl || !Applitools.extractStepUrlParameters(stepUrl)) {
                return RSVP.reject(function () {
                    _highlightInvalidInput(_getStepUrlInputElement());
                });
            }
            selectionId = stepUrlSelectionElement.id;
        } else if (userValuesSelectionElement.checked) {
            if (!appName.trim() && !testName.trim()) {
                return RSVP.reject(function () {
                    _highlightInvalidInput(_getAppNameInputElement());
                    _highlightInvalidInput(_getTestNameInputElement());
                });
            }

            selectionId = userValuesSelectionElement.id;
        }

        return ConfigurationStore.setBaselineSelection(selectionId)
            .then(function () {
                return ConfigurationStore.setBaselineStepUrl(stepUrl);
            }).then(function () {
                return ConfigurationStore.setBaselineAppName(appName);
            }).then(function () {
                return ConfigurationStore.setBaselineTestName(testName);
            }).then(function () {
                return _updateShowBaselinePanelButton(_getShowBaselinePanelButton(), selectionId);
            }).then(function () {
                return _initViewportSize();
            });
    };

    /**
     * Saves the changes the user performed on the baseline panel (if valid) and shows the main panel. If changes were
     * not valid, it will NOT switch back to the main panel.
     * @return {Promise} A promise which resolves when the changes are saved and the main panel is set to be shown,
     *                   or rejected if the user provided values are invalid.
     * @private
     */
    var _onBaselineOkayButtonClicked = function () {
        return _saveBaselineSettings().then(function () {
            return _showPanel(_MAIN_PANEL_ELEMENT_ID);
        }, function (onErrorCallback) {
            onErrorCallback();
        });
    };

    var _setBaselineImageLoadingEnabled = function (isEnabled) {
        Applitools.setBaselineImageLoadingEnabled(isEnabled);
        var useImageAsBaselineCheckbox = _getUseImageAsBaselineCheckboxElement();
        useImageAsBaselineCheckbox.disabled = !isEnabled;
        useImageAsBaselineCheckbox.checked = isEnabled && Applitools.getShouldUseImageAsBaseline();

        if (isEnabled) {
            _getBaselineImageContainer().classList.remove(_DISABLED_CLASS);
        } else {
            _getBaselineImageContainer().classList.add(_DISABLED_CLASS);
        }
    };

    /**
     * Updates styling for the now unselected elements.
     * @param elements The list of elements update.
     * @private
     */
    var _onInputElementsUnSelected = function (elements) {
        for (var i = 0; i < elements.length; ++i) {
            var currentElement = elements[i];
            currentElement.classList.remove(_SELECTED_CLASS);

            // For anything other than step URL, we enable baseline image loading
            if (currentElement === _getStepUrlInputElement()) {
                _setBaselineImageLoadingEnabled(true);
            }
        }
    };

    /**
     * Updates styling for selected input elements.
     * @param elements The list of elements to update.
     * @private
     */
    var _onInputElementsSelected = function (elements) {
        for (var i = 0; i < elements.length; ++i) {
            var currentElement = elements[i];
            currentElement.classList.add(_SELECTED_CLASS);

            // For step URL selection, we disable baseline image loading.
            if (currentElement === _getStepUrlInputElement()) {
                _setBaselineImageLoadingEnabled(false);
            }
        }
    };

    /**
     * Handle user change of the step url input.
     * @return {Promise} A promise which resolves to the element.
     * @private
     */
    var _onBaselineStepUrlSelected = function () {
        _getStepUrlSelectionElement().checked = true;
        _onInputElementsSelected([_getStepUrlInputElement()]);
        _onInputElementsUnSelected([_getAppNameInputElement(), _getTestNameInputElement()]);
        return _saveBaselineSettings().then(_getStepUrlInputElement);
    };

    /**
     * Handle user change of the application name input.
     * @return {Promise} A promise which resolves to the element.
     * @private
     */
    var _onBaselineAppNameSelected = function () {
        _getUserValuesSelectionElement().checked = true;
        _onInputElementsSelected([_getAppNameInputElement(), _getTestNameInputElement()]);
        _onInputElementsUnSelected([_getStepUrlInputElement()]);
        return _saveBaselineSettings().then(_getAppNameInputElement);
    };

    /**
     * Handle user change of the test name input.
     * @return {Promise} A promise which resolves to the element.
     * @private
     */
    var _onBaselineTestNameSelected = function () {
        _getUserValuesSelectionElement().checked = true;
        _onInputElementsSelected([_getAppNameInputElement(), _getTestNameInputElement()]);
        _onInputElementsUnSelected([_getStepUrlInputElement()]);
        return _saveBaselineSettings().then(_getTestNameInputElement);
    };

    /**
     * Handles user focus on the default values selection.
     * @return {Promise} A promise which resolves to the default values selection container.
     * @private
     */
    var _onBaselineDefaultSelectionSelected = function () {
        _getDefaultValuesSelectionElement().checked = true;
        _onInputElementsUnSelected([_getStepUrlInputElement(), _getAppNameInputElement(), _getTestNameInputElement()]);
        return _saveBaselineSettings().then(_getDefaultValuesSelectionContainer);
    };

    //noinspection SpellCheckingInspection
    /**
     * Sets an event listener on an element which checks if the Return key was pressed. If so, it's as if the okay
     * button was clicked.
     * @param element The DOM element to set the listener on.
     * @private
     */
    var _makeOkayable = function (element) {
        // If the user pressed enter on one of the inputs
        element.addEventListener('keypress', _handleOkayableKeypress);
        return RSVP.resolve(element);
    };

    //noinspection SpellCheckingInspection
    /**
     * Checks if the Return key was pressed. If so, it's as if the okay button was clicked.
     * @param event The DOM element to set the listener on.
     * @private
     */
    var _handleOkayableKeypress = function (event) {
        if (event.keyCode === 13) {
            _onBaselineOkayButtonClicked();
        }
    };

    /**
     * Wraps a function with 'debounce'.
     * @param {function} f The function to wrap with debounce.
     * @param {number} [timeout=500] The timeout of the debounce.
     * @param {Object} [options={leading: true, trailing: false}] Options object to pass to the debug
     * @returns {function} The function wrapped in the debounce.
     * @private
     */
    var _wrapWithDebounce = function (f, timeout, options) {
        timeout = timeout ? timeout : 1000;
        options = options ? options : {leading: true, trailing: false};
        return debounce(f, timeout, options);
    };

    /**
     * Initializes the user selection elements (which one is selected, and the current value, if exists).
     * @return {Promise} A promise which resolves to the checked element initialization is done.
     * @private
     */
    var _initUserSelection = function () {

        var stepUrlInput = _getStepUrlInputElement();
        var appNameInput = _getAppNameInputElement();
        var testNameInput = _getTestNameInputElement();
        var defaultValuesSelectionContainer = _getDefaultValuesSelectionContainer();

        // Load values from storage
        return ConfigurationStore.getBaselineStepUrl().then(function (stepUrl) {
            stepUrlInput.value = stepUrl || '';
            stepUrlInput.addEventListener('click', _onBaselineStepUrlSelected);
            // Since keypress might be activated multiple times very quickly (e.g, when the user is typing),
            // we want to pass it through a 'debounce' mechanism.
            stepUrlInput.addEventListener('keypress', _wrapWithDebounce(_onBaselineStepUrlSelected));
            return _makeOkayable(stepUrlInput).then(function () {
                return ConfigurationStore.getBaselineAppName();
            });
        }).then(function (appName) {
            appNameInput.value = appName || '';
            appNameInput.addEventListener('click', _onBaselineAppNameSelected);
            appNameInput.addEventListener('keypress', _wrapWithDebounce(_onBaselineAppNameSelected));
            return _makeOkayable(appNameInput).then(function () {
                return ConfigurationStore.getBaselineTestName();
            });
        }).then(function (testName) {
            testNameInput.value = testName || '';
            testNameInput.addEventListener('click', _onBaselineTestNameSelected);
            testNameInput.addEventListener('keypress', _wrapWithDebounce(_onBaselineTestNameSelected));
            return _makeOkayable(testNameInput).then(function() {
                return ConfigurationStore.getBaselineSelection();
            });
        }).then(function (selectionId) {
            // When clicking on the the radio buttons, we also want the input boxes to behave properly.
            _getDefaultValuesSelectionElement().addEventListener('click', _onBaselineDefaultSelectionSelected);
            _getStepUrlSelectionElement().addEventListener('click', _onBaselineStepUrlSelected);
            _getUserValuesSelectionElement().addEventListener('click', _onBaselineAppNameSelected);
            // Default values should be select also when we move using the "tab" key into the default values container.
            defaultValuesSelectionContainer.addEventListener('focus', _onBaselineDefaultSelectionSelected);
            // Making the Selections acceptable by clicking "Return".
            return _makeOkayable(defaultValuesSelectionContainer).then(function () {
                return _makeOkayable(_getUserValuesSelectionElement()).then(function () {
                    return _makeOkayable(_getStepUrlSelectionElement()).then(function () {
                        // If we don't have a selection Id, we'll assume that the default is selected
                        var checkedElement = selectionId ? document.getElementById(selectionId) :
                            _getDefaultValuesSelectionElement();
                        var selectionPromise;
                        if (selectionId === _USER_VALUES_SELECTION_ELEMENT_ID) {
                            selectionPromise = _onBaselineAppNameSelected();
                        } else if (selectionId === _STEP_URL_SELECTION_ELEMENT_ID) {
                            selectionPromise = _onBaselineStepUrlSelected();
                        } else {
                            selectionPromise = _onBaselineDefaultSelectionSelected();
                        }
                        return selectionPromise.then(function () {
                            RSVP.resolve(checkedElement);
                        });
                    });
                });
            });
        });
    };

    /**
     * Sets a new batch ID in the background script state.
     * @return {Promise} A propmise which is resolved when the batch ID is reset.
     * @private
     */
    var _resetBatchId = function () {
        Applitools.resetBatchId();
        return Applitools.moveToStep(0).then(function () {
            return _updateStepText();
        });
    };

    /**
     * @return {string|undefined} The current batch ID, if exists.
     * @private
     */
    var _getBatchId = function () {
        return Applitools.currentState.batchId;
    };

    /**
     * Handles batch name change.
     * @return {Promise} A promise which resolves to the batch name element.
     * @private
     */
    var _onBatchNameChange = function () {
        var batchNameElement = _getBatchNameInputElement();
        var batchName = batchNameElement.value.trim() ? batchNameElement.value : undefined;
        return ConfigurationStore.setBatchName(batchName).then(function () {
            _resetBatchId();
            return RSVP.resolve(batchNameElement);
        });
    };

    /**
     * Initializes the batch panel's name element with the required listeners.
     * @return {Promise} A promise which resolves to the batchName element.
     * @private
     */
    var _initBatchName = function () {
        var batchNameInputElement = _getBatchNameInputElement();
        // The batch element is always "selected".
        _onInputElementsSelected([batchNameInputElement]);
        batchNameInputElement.addEventListener('keyup', _onBatchNameChange);
        // Load value into the batch name input
        return ConfigurationStore.getBatchName().then(function (batchName) {
            batchNameInputElement.value = batchName || '';
            return RSVP.resolve(batchNameInputElement);
        });
    };

    /**
     * Initializes the batch panel's new batch ID element with the required listeners.
     * @return {Promise} A promise which resolves to the batchName element.
     * @private
     */
    var _initResetBatchId = function () {
        var newBatchIdElement = _getResetBatchIdElement();
        // We don't really need the entire "batch name change" functionality, only the GUID reset, but no point
        newBatchIdElement.addEventListener('click', _resetBatchId);
        return RSVP.resolve(newBatchIdElement);
    };

    /**
     * Update the text in the step text element to be that of the current step, if available.
     * @returns {Promise} A promise which is resolved once the text is updated.
     * @private
     */
    var _updateStepText = function () {
        return new RSVP.Promise(function (resolve) {
            var stepsCount, currentStepIndex, stepText;
            Applitools.getStepsCount().then(function (stepsCount_) {
                stepsCount = stepsCount_;
            }).then(function () {
                return Applitools.getCurrentStepIndex();
            }).then(function (currentStepIndex_) {
                currentStepIndex = currentStepIndex_;
                if (currentStepIndex === undefined) {
                    return undefined;
                }
                return Applitools.getCurrentStep();
            }).then(function (stepText_) {
                if (stepText_ !== undefined) {
                    // The "+1" is to show the index in a human format :)
                    stepText = (currentStepIndex + 1) + '/' + stepsCount + ': ' + stepText_;
                } else {
                    stepText = '';
                }
                // We have a current step, so we set it for the user to see
                var stepTextElement = _getStepTextElement();
                stepTextElement.value = stepText;
                stepTextElement.title = stepText;

                resolve(stepText);
            });

        });
    };

    /**
     * Handle the steps load event.
     * @return {Promise} A promise which resolves when the loading finished.
     * @private
     */
    var _onStepsLoad = function () {
        // Since this function is a direct event handler for a DOM element, "this" refers to the "File" input element.
        var fileInput = this;
        return new RSVP.Promise(function (resolve) {
            var stepsFile = fileInput.files[0];

            var reader = new FileReader();
            reader.onload = function (e) {
                Applitools.createStepListFromString(e.target.result).then(function () {
                    // We reset the value of the load button so that we can re-open the same file is needed.
                    _getStepsLoadButtonElement().value = '';
                    return _updateStepText()
                        .then(function () {
                            return _showStepsPanel(true);
                        }).then(function () {
                            _resetBatchId();
                        }).then(function () {
                            resolve();
                        });
                });
            };

            // FIXME add handling reader.onerror

            reader.readAsText(stepsFile);
        });
    };

    /**
     * Initializes the steps panel's load button with the required listeners.
     * @return {Promise} A promise which resolves to the steps load button element.
     * @private
     */
    var _initStepsLoadButton = function () {
        var stepsLoadButtonElement = _getStepsLoadButtonElement();
        stepsLoadButtonElement.addEventListener('change', _onStepsLoad);
        return RSVP.resolve(stepsLoadButtonElement);
    };

    /**
     * Close the steps panel and stop using steps.
     * @return {Promise} A promise which resolves when the steps panel is closed.
     * @private
     */
    var _onCloseStepsPanel = function () {
        return Applitools.removeSteps().then(function () {
                return _showStepsPanel(false);
            });
    };

    /**
     * Update to the next step in the steps list.
     * @return {Promise} A promise which resolves when the step is updated.
     * @private
     */
    var _onNextStep = function () {
        return Applitools.moveToNextStep()
            .then(function () {
                return _updateStepText();
            });
    };

    /**
     * Update to the previous step in the steps list.
     * @return {Promise} A promise which resolves when the step is updated.
     * @private
     */
    var _onPrevStep = function () {
        return Applitools.moveToPrevStep()
            .then(function () {
                return _updateStepText();
            });
    };

    /**
     * Initializes the steps panel's close button with the required listeners.
     * @return {Promise} A promise which resolves to the "close steps panel" element.
     * @private
     */
    var _initCloseStepsPanel = function () {
        var closeStepsPanelElement = _getCloseStepsPanelElement();
        closeStepsPanelElement.addEventListener('click', _onCloseStepsPanel);
        return RSVP.resolve(closeStepsPanelElement);
    };

    /**
     * Initializes the steps panel's next step button with the required listeners.
     * @return {Promise} A promise which resolves to the "next step" element.
     * @private
     */
    var _initNextStepButton = function () {
        var nextStepButtonElement = _getNextStepButtonElement();
        nextStepButtonElement.addEventListener('click', _onNextStep);
        return RSVP.resolve(nextStepButtonElement);
    };

    /**
     * Initializes the steps panel's previous step button with the required listeners.
     * @return {Promise} A promise which resolves to the "previous step" element.
     * @private
     */
    var _initPrevStepButton = function () {
        var prevStepButtonElement = _getPrevStepButtonElement();
        prevStepButtonElement.addEventListener('click', _onPrevStep);
        return RSVP.resolve(prevStepButtonElement);
    };

    /**
     * Initializes the elements on the steps panel.
     * @return {Promise} A promise which resolves when the steps panel's elements are initialized.
     * @private
     */
    var _initStepsPanel = function () {
        return _initStepsLoadButton()
            .then(function () {
                return _initCloseStepsPanel();
            }).then(function () {
                return _initNextStepButton();
            }).then(function () {
                return _initPrevStepButton();
            }).then(function () {
                return Applitools.getCurrentStepIndex();
            }).then(function (currentStepIndex) {
                // If there's no current step, then we don't show the steps panel.
                if (currentStepIndex === undefined) {
                    return _showStepsPanel(false);
                }

                return _updateStepText().then(function () {
                    _showStepsPanel(true);
                });
            });
    };

    /**
     * Initializes the elements on the batch panel.
     * @return {Promise} A promise which resolves when all the batch panel's elements are initialized.
     * @private
     */
    var _initBatchPanel = function () {
        var shouldUseBatch;
        return ConfigurationStore.getShouldUseBatch()
            .then(function (shouldUseBatch_) {
                shouldUseBatch = shouldUseBatch_;
                // If we should use batch, but no batch ID is defined yet, we need to set it.
                if (shouldUseBatch && !_getBatchId()) {
                    _resetBatchId();
                }
                return _initBatchName();
            }).then(function () {
                return _initResetBatchId();
            }).then(function () {
                return _initStepsPanel();
            }).then(function () {
                return _showBatchPanel(shouldUseBatch);
            });
    };

    /**
     * Sets whether or not we should use a baseline image.
     * @param {boolean} shouldUse Whether or not we should use a baseline image.
     * @param {boolean} [updateBgPageState=true] Whether or not we should update the current state of the background
     *                  script. We might not want to that if this function is called due to reading state from the
     *                  background script.
     * @returns {Promise} A promise which resolves once the value is set, or rejects if no image was previously loaded.
     * @private
     */
    var _setShouldUseBaselineImage = function (shouldUse, updateBgPageState) {
        updateBgPageState = updateBgPageState === undefined ? true : updateBgPageState;

        // Checkbox checked/unchecked
        var baselineImageCheckboxElement = _getUseImageAsBaselineCheckboxElement();
        baselineImageCheckboxElement.checked = Applitools.isBaselineImageLoadingEnabled() && shouldUse;

        // Image name input styling + file name.
        var baselineImageFilenameInputElement = _getBaselineImageFilenameInputElement();
        var baselineImageName = Applitools.getBaselineImageName();
        baselineImageFilenameInputElement.value = baselineImageName ? baselineImageName : '';
        if (shouldUse) {
            baselineImageFilenameInputElement.classList.add(_FILE_LOADED_CLASS);
        } else {
            baselineImageFilenameInputElement.classList.remove(_FILE_LOADED_CLASS);
        }

        var resultPromise = updateBgPageState ? Applitools.setShouldUseImageAsBaseline(shouldUse) : Promise.resolve();
        return resultPromise.then(function () {
            return ConfigurationStore.getBaselineSelection();
        }).then(function (selectionId) {
            return _updateShowBaselinePanelButton(_getShowBaselinePanelButton(), selectionId);
        });
    };

    /**
     * Handle the baseline image load event.
     * @return {Promise} A promise which resolves when the loading finished.
     * @private
     */
    var _onBaselineImageLoad = function () {
        // Since this function is a direct event handler for a DOM element, "this" refers to the "File" input element.
        var fileInput = this;
        return new Promise(function (resolve) {
            if (fileInput.files.length > 0) {
                var imageFile = fileInput.files[0];
                var name = imageFile.name;
                var reader = new FileReader();
                reader.onload = function (e) {
                    // The result is an ArrayBuffer, but we need it as a buffer.
                    var image = toBuffer(e.target.result);
                    return Applitools.prepareImageForBaseline(image, name)
                        .then(function () {
                            // We reset the value of the load button so that we can re-open the same file is needed.
                            fileInput.value = '';
                            return _setShouldUseBaselineImage(true);
                        }).then(function () {
                            resolve();
                        });
                };
                // FIXME add handling reader.onerror
                reader.readAsArrayBuffer(imageFile);
            } else {
                // If there's no file to load (e.g, when clicking "cancel" on the open file dialog).
                resolve();
            }
        });
    };

    /**
     * Initializes the baseline panel's load baseline image button with the required listeners.
     * @return {Promise} A promise which resolves to the baseline image load button element.
     * @private
     */
    var _initBaselineImageLoadButton = function () {
        var baselineImageLoadButton = _getBaselineImageLoadButtonElement();
        baselineImageLoadButton.addEventListener('change', _onBaselineImageLoad);
    };

    /**
     * Initializes the baseline panel's "load baseline image" label.
     * @return {Promise} A promise which resolves to the baseline image load label element.
     * @private
     */
    var _initBaselineImageLoadLabel = function () {
        var imageLoadLabel = _getBaselineImageLoadButtonLabelElement();
        imageLoadLabel.addEventListener('click', function () {
            if (Applitools.isBaselineImageLoadingEnabled()) {
                // Passing the click on to the image load button (since the button is not visible and hidden by
                // the label).
                _getBaselineImageLoadButtonElement().click();
            }
            return Promise.resolve();
        });
        return _makeOkayable(imageLoadLabel);
    };

    /**
     * @return {Promise} A promise which resolves when the click handling is done.
     * @private
     */
    var _onUseBaselineAsImageCheckboxClick = function () {
        var resultPromise = Promise.resolve();

        var useImageAsBaselineCheckbox = _getUseImageAsBaselineCheckboxElement();
        if (useImageAsBaselineCheckbox.checked) {
            // An image was already loaded, so just mark it for use.
            if (Applitools.isImageAsBaselineLoaded()) {
                resultPromise = _setShouldUseBaselineImage(true);
            } else {
                // No file was selected yet, so we want the checkbox to marked only after the user selects a file from
                // the "open file" dialog.
                useImageAsBaselineCheckbox.checked = false;
                // Open the file dialog.
                _getBaselineImageLoadButtonElement().click();
            }
        } else {
            resultPromise = _setShouldUseBaselineImage(false);
        }
        return resultPromise;
    };

    /**
     * Initializes the baseline panel's "use image as baseline" checkbox.
     * @return {Promise} A promise which resolves to the use image as baseline checkbox element.
     * @private
     */
    var _initUseImageAsBaselineCheckbox = function () {
        var useImageAsBaselineCheckbox = _getUseImageAsBaselineCheckboxElement();
        useImageAsBaselineCheckbox.addEventListener('click', _onUseBaselineAsImageCheckboxClick);
        return _makeOkayable(useImageAsBaselineCheckbox);
    };

    /**
     * Initializes the baseline panel's "OK" button with the required listeners.
     * @return {Promise} A promise which resolves when the initialization is done.
     * @private
     */
    var _initBaselineOkButton = function () {
        var okButton = _getBaselineOkButtonElement();
        okButton.addEventListener('click', _onBaselineOkayButtonClicked);
        return RSVP.resolve(okButton);
    };

    /**
     * Initializes the elements on the baseline panel.
     * @return {Promise} A promise which resolves when all the baseline panel's elements are initialized.
     * @private
     */
    var _initBaselinePanel = function () {
        // A hack to avoid initializing the baseline more than once.
        if (!_baselineInitialized) {
            _baselineInitialized = true;
            return RSVP.all([_initUserSelection(), _initBaselineOkButton(), _initBaselineImageLoadLabel(),
                _initBaselineImageLoadButton(), _initUseImageAsBaselineCheckbox()])
                .then(function () {
                    return _setShouldUseBaselineImage(Applitools.getShouldUseImageAsBaseline(), false);
                });
        } else {
            return Promise.resolve();
        }
    };

    /**
     * Verifies that running a test is possible, and initializes the elements on the page.
     * @return {Promise} A promise which resolves to an array containing the initializations results.
     * @private
     */
    var _initPage = function () {
        // We want to make sure the batch panel is initialized before the main panel, and both of them
        // after a timeout, so we avoid rendering glitches.
        var mainPanelInitPromise = _initBatchPanel().then(function () {
            return _initMainPanel();
        });
        return Applitools.popupOpened().then(function () {
            return RSVP.all([mainPanelInitPromise, _initBaselinePanel()]);
        });
    };

    /**
     * Adds or remove a class from an element.
     * @param element - a DOM element.
     * @param shouldAdd - when true the class will be added to the element. Otherwise - removed.
     * @param className - the class to add or remove
     * @private
     */
    var _addRemoveClass = function (element, shouldAdd, className) {
        if (shouldAdd) {
            element.classList.add(className);
        } else {
            element.classList.remove(className);
        }
    };

    document.addEventListener('DOMContentLoaded', _initPage);
}());
