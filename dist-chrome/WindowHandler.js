/**
 * Provides an api for manipulating browser windows and tabs.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var RSVP = require('rsvp'),
        ChromeUtils = require('./ChromeUtils'),
        JSUtils = require('./../JSUtils');

    var EyesUtils = require('eyes.utils'),
        GeometryUtils = EyesUtils.GeometryUtils;

    var _MAX_SCROLL_BAR_SIZE = 50;
    var _MIN_SCREENSHOT_PART_SIZE = 10;

    var WindowHandler = {};

    /**
     * Moves the given tab to a new window
     * @param tab
     * @param {Object} windowSize (Optional) The size of the new window (including the window frame).
     *                              Should include width and height properties.
     * @return {Promise} A promise which resolves to the new window object when the window is created.
     */
    WindowHandler.moveTabToNewWindow = function (tab, windowSize) {
        var deferred = RSVP.defer();

        // Move the current tab to a new window
        var createData = {tabId: tab.id};
        if (windowSize) {
            createData.width = windowSize.width;
            createData.height = windowSize.height;
        }

        chrome.windows.create(createData, function (updatedWindow) {
            deferred.resolve(updatedWindow);
        });
        return deferred.promise;
    };

    /**
     * sets the window size.
     * @param theWindow The window to resize
     * @param {Object} requiredSize The size to set. Should include "width" and "height" properties.
     * @return {Promise} A promise which resolves to the updated window object.
     */
    WindowHandler.resizeWindow = function (theWindow, requiredSize) {
        var deferred = RSVP.defer();
        chrome.windows.update(theWindow.id, requiredSize, function (resizedWindow) {
            // Give the window 200ms to stabilize on the size.
            window.setTimeout(function () {
                chrome.windows.get(resizedWindow.id, {populate: true}, function (populatedResizedWindow) {
                    deferred.resolve(populatedResizedWindow);
                });
            }, 200);
        });
        return deferred.promise;
    };

    /**
     * Moves the given tab to the target window.
     * @param tab
     * @param targetWindow
     * @param {number} targetIndex (optional) The position of the tab in the tabs list of the window.
     * @param {boolean} makeActive (optional) Whether to set the tab as the active tab after it has been moved.
     * @return {Promise} A promise which resolves to the moved tab.
     */
    WindowHandler.moveTabToExistingWindow = function (tab, targetWindow, targetIndex, makeActive) {
        var deferred = RSVP.defer();
        var moveData = {windowId: targetWindow.id, index: targetIndex};
        chrome.tabs.move(tab.id, moveData, function (movedTab) {
            if (makeActive) {
                //noinspection JSUnresolvedVariable
                chrome.tabs.update(movedTab.id, {active: true}, function (activeTab) {
                    deferred.resolve(activeTab);
                });
            } else {
                deferred.resolve(movedTab);
            }
        });

        return deferred.promise;
    };

    /**
     * Sets the given tab's viewport size (i.e., the internal size, without the frame).
     * @param theWindow The window which contains the tab.
     * @param theTab The tab that its viewport we would like to set.
     * @param {Object} requiredViewportSize The required viewport size. Should have "width" and "height" properties.
     * @return {Promise} A promise which resolves to the resized window.
     */
    WindowHandler.setViewportSize = function (theWindow, theTab, requiredViewportSize) {
        var requiredWidth = theWindow.width + (requiredViewportSize.width - theTab.width);
        var requiredHeight = theWindow.height + (requiredViewportSize.height - theTab.height);

        var requiredWindowSize = {width: requiredWidth, height: requiredHeight};

        return WindowHandler.resizeWindow(theWindow, requiredWindowSize).then(function (resizedWindow) {
            // If the window reached the size we wanted, we just return it.
            if (resizedWindow.width === requiredWidth && resizedWindow.height === requiredHeight) {
                return RSVP.resolve(resizedWindow);
            }
            return WindowHandler.resizeWindow(theWindow, requiredWindowSize);
        }).then(function (resizedWindow) { // First retry
            // If the window reached the size we wanted, we just return it.
            if (resizedWindow.width === requiredWidth && resizedWindow.height === requiredHeight) {
                return RSVP.resolve(resizedWindow);
            }
            return WindowHandler.resizeWindow(theWindow, requiredWindowSize);
        }).then(function (resizedWindow) { // Second retry
            // If the window reached the size we wanted, we just return it.
            if (resizedWindow.width === requiredWidth && resizedWindow.height === requiredHeight) {
                return RSVP.resolve(resizedWindow);
            }
            return WindowHandler.resizeWindow(theWindow, requiredWindowSize);
        }).then(function (resizedWindow) { // First retry
            // If the window reached the size we wanted, we just return it.
            if (resizedWindow.width === requiredWidth && resizedWindow.height === requiredHeight) {
                return RSVP.resolve(resizedWindow);
            }
            // We couldn't reach the required size.
            return RSVP.reject(resizedWindow);
        });
    };

    /**
     * Get the current scroll position of the given tab.
     * @param {number} tabId The ID of the tab for which we want to get the scroll position.
     * @return {Promise} A promise which resolves to the scroll position (x/y).
     */
    WindowHandler.getCurrentScrollPosition = function (tabId) {
        var leftPromise = ChromeUtils.executeScript(tabId, 'var doc = document.documentElement; var resultX = (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0); resultX', undefined);
        var topPromise = ChromeUtils.executeScript(tabId, 'var doc = document.documentElement; var resultY = (window.pageYOffset || doc.scrollTop)  - (doc.clientTop || 0); resultY', undefined);

        return RSVP.hash({x: leftPromise, y: topPromise}).then(function (results) {
            var x = parseInt(results.x[0], 10);
            var y = parseInt(results.y[0], 10);

            return RSVP.resolve({x: x, y: y});
        });
    };

    /**
     * Scrolls to a given location.
     * @param {number} tabId The ID of the tab in which we would like to scroll.
     * @param {int} x The x value of the position to scroll to.
     * @param {int} y The y value of the position to scroll to.
     * @return {Promise} A promise which resolves when the scroll is executed.
     */
    WindowHandler.scrollTo = function (tabId, x, y) {
        return ChromeUtils.executeScript(tabId, 'window.scrollTo(' + x + ',' + y + ')', 150);
    };

    /**
     * Get the current transform of the given tab.
     * @param {number} tabId The ID of the tab for which to get the current transform.
     * @return {Promise} A promise which resolves to the current transform value.
     */
    WindowHandler.getCurrentTransform = function (tabId) {
        return ChromeUtils.executeScript(tabId, "document.body.style.transform", undefined).then(function (results) {
            return RSVP.resolve(results[0]);
        });
    };

    /**
     * Get the current transform of the given tab.
     * @param {number} tabId The ID of the tab for which to get the current transform.
     * @param {string} transformToSet The transform to set.
     * @param {number|undefined} stabilizationTimeMs (optional) The amount of time to wait after setting the transform
     *                                                  to let the browser stabilize (e.g., re-render).
     * @return {Promise} A promise which resolves to the current transform value.
     */
    WindowHandler.setTransform = function (tabId, transformToSet, stabilizationTimeMs) {
        if (!transformToSet) {
            transformToSet = '';
        }
        return ChromeUtils.executeScript(tabId,
            "document.body.style.transform = '" + transformToSet + "'",
            stabilizationTimeMs)
            .then(function (results) {
                return RSVP.resolve(results[0]);
            });
    };

    /**
     * CSS translate the document to a given location.
     * @param {number} tabId The ID of the tab in which we would like to scroll.
     * @param {int} x The x value of the position to scroll to.
     * @param {int} y The y value of the position to scroll to.
     * @return {Promise} A promise which resolves when the scroll is executed.
     */
    WindowHandler.translateTo = function (tabId, x, y) {
        return WindowHandler.setTransform(tabId, 'translate(-' + x + 'px, -' + y + 'px)', 250);
    };

    /**
     * Get the entire page size of the given tab.
     * @param {Tab} tab The tab for which we would like to calculate the entire page size.
     * @return {Promise} A promise which resolves to an object containing the width/height of the page.
     */
    WindowHandler.getEntirePageSize = function (tab) {
        //noinspection JSUnresolvedVariable
        var tabId = tab.id;
        var scrollWidthPromise = ChromeUtils.executeScript(tabId, "document.documentElement.scrollWidth", undefined);
        var bodyScrollWidthPromise = ChromeUtils.executeScript(tabId, "document.body.scrollWidth", undefined);

        // IMPORTANT: Notice there's a major difference between scrollWidth
        // and scrollHeight. While scrollWidth is the maximum between an
        // element's width and its content width, scrollHeight might be
        // smaller (!) than the clientHeight, which is why we take the
        // maximum between them.
        var clientHeightPromise = ChromeUtils.executeScript(tabId, "document.documentElement.clientHeight", undefined);
        var bodyClientHeightPromise = ChromeUtils.executeScript(tabId, "document.body.clientHeight", undefined);
        var scrollHeightPromise = ChromeUtils.executeScript(tabId, "document.documentElement.scrollHeight", undefined);
        var bodyScrollHeightPromise = ChromeUtils.executeScript(tabId, "document.body.scrollHeight", undefined);

        return RSVP.all([scrollWidthPromise, bodyScrollWidthPromise, clientHeightPromise, bodyClientHeightPromise,
            scrollHeightPromise, bodyScrollHeightPromise]).then(function (results) {
            // Notice that each result is itself actually an array (since executeScript returns an Array).
            var scrollWidth = parseInt(results[0][0], 10);
            var bodyScrollWidth = parseInt(results[1][0], 10);
            var totalWidth = Math.max(scrollWidth, bodyScrollWidth);

            var clientHeight = parseInt(results[2][0], 10);
            var bodyClientHeight = parseInt(results[3][0], 10);
            var scrollHeight = parseInt(results[4][0], 10);
            var bodyScrollHeight = parseInt(results[5][0], 10);

            var maxDocumentElementHeight = Math.max(clientHeight, scrollHeight);
            var maxBodyHeight = Math.max(bodyClientHeight, bodyScrollHeight);
            var totalHeight = Math.max(maxDocumentElementHeight, maxBodyHeight);

            return RSVP.resolve({width: totalWidth, height: totalHeight});
        });
    };

    /**
     * Gets the device pixel ratio.
     * @param {Tab} tab The tab in which we'll execute the script to get the ratio
     * @return {Promise} A promise which resolves to the device pixel ratio (float type).
     */
    WindowHandler.getDevicePixelRatio = function (tab) {
        //noinspection JSUnresolvedVariable
        return ChromeUtils.executeScript(tab.id, 'window.devicePixelRatio', undefined)
            .then(function (results) {
                var devicePixelRatio = parseFloat(results[0]);
                return RSVP.resolve(devicePixelRatio);
            });
    };

    /**
     * Scales the image so that the result image's device (physical) pixels is scaled by the given scale ratio.
     * @param {string} dataUri The dataUri of the image to scale.
     * @param {number} scaleRatio The ratio by which to scale the image's device pixels. If the scale ratio is 1.0,
     *                              then no scaling is performed.
     * @return {Promise} A promise which resolves to a dataUri of the scaled image.
     */
    WindowHandler.scaleImage = function (dataUri, scaleRatio) {
        // If there's no need to scale, resolve to the original dataUri
        if (scaleRatio === 1.0) {
            return RSVP.resolve(dataUri);
        }

        var deferred = RSVP.defer();

        var image = new Image();
        image.onload = function () {
            // We use canvas for scaling.
            var canvas = document.createElement('canvas');
            canvas.width = image.width * scaleRatio;
            canvas.height = image.height * scaleRatio;
            var ctx = canvas.getContext('2d');

            // This will cause the image to be drawn in the scaled size.
            ctx.scale(scaleRatio, scaleRatio);
            ctx.drawImage(image, 0, 0);

            deferred.resolve(canvas.toDataURL());
        };
        image.src = dataUri;

        return deferred.promise;
    };

    /**
     * Get the zoom factor of the given tab.
     * This functionality is only available from Chrome 41 or higher. For lower chrome versions, this function will
     * return a promise which resolves to undefined.
     * @param {number} tabId The id of the tab for which to get the zoom factor.
     * @return {Promise} A promise which resolves to the zoom factor of the given tab (value of type double), or
     * to undefined if the Chrome version isn't high enough.
     */
    WindowHandler.getZoom = function (tabId) {
        if (typeof chrome.tabs.getZoom !== 'function') {
            return RSVP.resolve(undefined);
        }

        var deferred = RSVP.defer();
        chrome.tabs.getZoom(tabId, function (zoomFactor) {
            deferred.resolve(zoomFactor);
        });
        return deferred.promise;
    };

    /**
     * Set the zoom for a given tab.
     * This functionality is only available from Chrome 41 or higher. If chrome version is lower, this function
     * will do nothing.
     * @param {number} tabId The ID of the tab for which to set the zoom.
     * @param {number} zoomFactor The zoom factor to set.
     * @param {number|undefined} stabilizationTimeMs (optional) Time to wait in milliseconds after the zoom, to give it
     *                                              time to render properly, or undefined if there's no need to wait.
     * @return {Promise} A promise which resolves when the zoom is set.
     */
    WindowHandler.setZoom = function (tabId, zoomFactor, stabilizationTimeMs) {
        if (typeof chrome.tabs.getZoom !== 'function') {
            return RSVP.resolve();
        }

        var deferred = RSVP.defer();
        chrome.tabs.setZoom(tabId, zoomFactor, function () {
            if (stabilizationTimeMs) {
                JSUtils.sleep(stabilizationTimeMs).then(function () {
                    deferred.resolve();
                });
                return;
            }
            deferred.resolve();
        });
        return deferred.promise;
    };

    /**
     * Updates the document's documentElement "overflow" value (mainly used to remove/allow scrollbars).
     * @param {number} tabId The ID of the tab for which overflow style should be set.
     * @param {string} overflowValue The values of the overflow to set.
     * @param {number|undefined} stabilizationTimeMs (optional) The amount of time in milliseconds after setting the
     *                                                  the overflow to give the browser time to finish the rendering.
     * @return {Promise|*} A promise which resolves to the original overflow of the document.
     */
    WindowHandler.setOverflow = function (tabId, overflowValue, stabilizationTimeMs) {
        var deferred = RSVP.defer();
        //noinspection JSLint
        ChromeUtils.executeScript(tabId,
            'var origOF = document.documentElement.style.overflow; document.documentElement.style.overflow = "'
                + overflowValue
                + '"; origOF',
                stabilizationTimeMs)
            .then(function (originalOverflowResults) {
                deferred.resolve(originalOverflowResults[0]);
            });

        return deferred.promise;
    };



    /**
     * Captures the screenshot of the given tab.
     * @param {Tab} tab The tab for which to capture screenshot.
     * @param {boolean} withImage If true, the return value is an object with two attributes: "imageBuffer" and "image".
     *                              Otherwise - returns a buffer. Default is false.
     * @param {number|undefined} scaleRatio The ratio for scaling the image. If this value is undefined or equal to 1.0,
     *                              no scaling will take place.
     * @param {Array|undefined} sizesNotToScale An array of size objects (width/height). If the pre-scaled size of the
     *                                          image matches any of them, then the image will not be scaled.
     * @return {Promise} A promise which resolves to a buffer containing the PNG bytes of the given tab.
     */
    WindowHandler.getTabScreenshot = function (tab, withImage, scaleRatio, sizesNotToScale) {
        withImage = withImage || false;
        scaleRatio = scaleRatio || 1.0;
        var deferred = RSVP.defer();
        var isScaled = true; // we'll scale unless we find that the size match in "sizesNotToScale".

        //noinspection JSUnresolvedVariable
        chrome.tabs.captureVisibleTab(tab.windowId, {format: "png"}, function (originalDataUri) {
            var updatedImagePromise = RSVP.resolve();
            // If there are size not to scale, we compare them to the current size of the image.
            if (sizesNotToScale && sizesNotToScale.length) {
                updatedImagePromise = updatedImagePromise.then(function () {
                    var updatedImageDeferred = RSVP.defer();
                    // Create an image from the dataUri so we can get its width/height.
                    var image = new Image();
                    image.onload = function () {
                        //noinspection JSLint
                        for (var i = 0; i < sizesNotToScale.length; ++i) {
                            // Checking the width is enough for us.
                            if (image.width === sizesNotToScale[i].width) {
                                isScaled = false;
                                break;
                            }
                        }
                        if (isScaled) {
                            WindowHandler.scaleImage(originalDataUri, scaleRatio).then(function (dataUri) {
                                updatedImageDeferred.resolve(dataUri);
                            });
                            return;
                        }
                        updatedImageDeferred.resolve(originalDataUri);
                    };
                    image.src = originalDataUri;
                    return updatedImageDeferred.promise;
                });
            } else {
                // If there's no "sizesNotToScale" list, we scale the image.
                updatedImagePromise = updatedImagePromise.then(function () {
                    return WindowHandler.scaleImage(originalDataUri, scaleRatio);
                });
            }


            // Whether or not we scaled the image, we should now return the result.
            updatedImagePromise.then(function (dataUri) {
                // Create the image buffer.
                var image64 = dataUri.replace('data:image/png;base64,', '');
                var imageBuffer = new Buffer(image64, 'base64');
                if (withImage) {
                    var updatedImage = new Image();
                    updatedImage.onload = function () {
                        deferred.resolve({imageBuffer: imageBuffer, image: updatedImage, isScaled: isScaled});
                    };
                    updatedImage.src = dataUri;
                    return;
                }
                // If we don't need to return an Image object
                deferred.resolve({imageBuffer: imageBuffer, isSclaed: isScaled});
            });
        });

        return deferred.promise;
    };

    /**
     * Get a part of the page for full page screenshot.
     * @param {Promise} partsPromise The promise to which to chain the part retrieval promise.
     * @param {Tab} tab The tab from which we want to get the page part.
     * @param {object} partRegion The top/left and width/height (after scaling!) of the page part.
     * @param {number} scaleRatio The ratio to scale the image (if needed).
     * @param {object} viewportSize The expected size of an image.
     * @return {Promise} A promise which resolves to the page part.
     * @private
     */
    WindowHandler._getPagePart = function (partsPromise, tab, partRegion, scaleRatio, viewportSize) {
        var currentScrollPosition;
        var position = {left: partRegion.left, top: partRegion.top};
        var partSize = {width: partRegion.width, height: partRegion.height};
        return partsPromise.then(function () {
            // Try to scroll to the required position, and give it time to stabilize.
            //noinspection JSUnresolvedVariable
            return WindowHandler.translateTo(tab.id, position.left, position.top).then(function () {
                return JSUtils.sleep(100);
            }).then(function () {
                currentScrollPosition = {x: position.left, y: position.top};
            }).then(function () {
                // We don't want to scale the image, as this will be performed in the final stitching.
                return WindowHandler.getTabScreenshot(tab, true, scaleRatio, [viewportSize]);
            }).then(function (imageObj) {
                var pngImage = imageObj.image;
                var part = {image: pngImage,
                    position: {left: currentScrollPosition.x, top: currentScrollPosition.y},
                    size: partSize};
                return RSVP.resolve(part);
            });
        });
    };

    //noinspection JSValidateJSDoc
    /**
     * Stitches the given parts to a full image.
     * @param {object} fullSize The size of the stitched image. Should have 'width' and 'height' properties.
     * @param {Array} parts The parts to stitch into an image. Each part should have: 'position'
     *                      (which includes top/left), 'size' (which includes width/height) and image
     *                      (a buffer containing PNG bytes) properties.
     * @return {Promise} A promise which resolves to the stitched image.
     */
    WindowHandler.stitchImage = function (fullSize, parts) {
        // We'll use canvas for stitching an image.
        var canvas = document.createElement('canvas');
        canvas.width = fullSize.width;
        canvas.height = fullSize.height;
        var ctx = canvas.getContext('2d');

        //noinspection JSLint
        for (var i = 0; i < parts.length; ++i) {
            var currentPart = parts[i];

            //noinspection JSUnresolvedFunction
            ctx.drawImage(currentPart.image, 0, 0, currentPart.size.width, currentPart.size.height,
                currentPart.position.left, currentPart.position.top, currentPart.size.width, currentPart.size.height);
        }

        var stitchedDataUri = canvas.toDataURL();
        // Create the image buffer.
        var image64 = stitchedDataUri.replace('data:image/png;base64,', '');
        return RSVP.resolve(new Buffer(image64, 'base64'));
    };

    /**
     * Get the full page screenshot of the current tab.
     * @param {Tab} tab The tab from which the screenshot should be taken.
     * @param {number|undefined} scaleRatio The ratio for scaling the image. If this value is undefined or equal to 1.0,
     *                              no scaling will take place.
     * @param {object} viewportSize The size of the viewport.
     * @param {object} entirePageSize The size of the entire page.
     * @return {Promise} A promise which resolves to a Buffer containing the PNG bytes of the screenshot.
     */
    WindowHandler.getFullPageScreenshot = function (tab, scaleRatio, viewportSize, entirePageSize) {
        var deferred = RSVP.defer();

        //noinspection JSUnresolvedVariable
        var tabId = tab.id;
        var originalScrollPosition, originalTransform, partSize;
        var imageParts = [];

        scaleRatio = scaleRatio || 1.0;

        // Saving the original scroll position.
        WindowHandler.getCurrentScrollPosition(tabId).then(function (originalScrollPosition_) {
            originalScrollPosition = originalScrollPosition_;
            // Scrolling to the top/left of the page.
            return WindowHandler.scrollTo(tabId, 0, 0);
        }).then(function () {
            // Get the original transform value for the tab
            return WindowHandler.getCurrentTransform(tabId);
        }).then(function (originalTransform_) {
            originalTransform = originalTransform_;
            // Translating to "top/left" of the page (notice this is different from Javascript scrolling).
            return WindowHandler.translateTo(tabId, 0, 0);
        }).then(function () {
            return JSUtils.sleep(1000);
        }).then(function () {
            // Capture the first image part, or entire screenshot.
            return WindowHandler.getTabScreenshot(tab, true, scaleRatio, [viewportSize, entirePageSize]);
        }).then(function (imageObj) {
            var image = imageObj.image;

            // If the screenshot is already the full page screenshot, we go back to the original position and
            // return it.
            if (image.width >= (entirePageSize.width-1) && image.height >= (entirePageSize.height-1)) {
                return WindowHandler.setTransform(tabId, originalTransform, 250).then(function () {
                    WindowHandler.scrollTo(tabId, originalScrollPosition.x, originalScrollPosition.y).then(function () {
                        deferred.resolve(imageObj.imageBuffer);
                    });
                });
            } else {

                // Calculate the parts size based on the captured image, notice it's smaller than the actual image
                // size, so we can overwrite fixed position footers or right bars (unfortunately, handling fixed
                // position headers/left bars).
                var partSizeWidth = Math.max(image.width - _MAX_SCROLL_BAR_SIZE, _MIN_SCREENSHOT_PART_SIZE);
                var partSizeHeight = Math.max(image.height - _MAX_SCROLL_BAR_SIZE, _MIN_SCREENSHOT_PART_SIZE);
                partSize = {width: partSizeWidth, height: partSizeHeight};

                // Create the part for the first image, and add it to the parts list.
                var part = {
                    image: image,
                    position: {left: 0, top: 0},
                    size: partSize
                };
                imageParts.push(part);

                // Get the properties of the regions which will compose the stitched images.
                var entirePageRegion = {top: 0, left: 0, width: entirePageSize.width, height: entirePageSize.height};
                var subRegions = GeometryUtils.getSubRegions(entirePageRegion, partSize);

                var i, partRegion;
                var partsPromise = RSVP.resolve();
                // Going over each sub region and capturing the respective image part.
                for (i = 0; i < subRegions.length; ++i) {
                    partRegion = subRegions[i];

                    if (partRegion.left === 0 && partRegion.top === 0) {
                        continue;
                    }

                    // Since both the scrolling and the capturing operations are async, we must chain them.
                    //noinspection JSLint
                    partsPromise = WindowHandler._getPagePart(partsPromise, tab, partRegion, scaleRatio, viewportSize)
                        .then(function (part) {
                            imageParts.push(part);
                            return RSVP.resolve();
                        });
                }

                return partsPromise.then(function () {
                    return WindowHandler.translateTo(tabId, 0, 0).then (function () {
                        // Okay, we've got all the parts, return to the original location.
                        return WindowHandler.scrollTo(tabId, originalScrollPosition.x, originalScrollPosition.y)
                            .then(function () {
                                // Give the scrolling time to stabilize.
                                return JSUtils.sleep(100);
                            });
                    });
                }).then(function () {
                    // Stitch the image from the parts we collected and return the stitched image buffer.
                    return WindowHandler.stitchImage(entirePageSize, imageParts)
                        .then(function (stitchedImageBuffer) {
                            deferred.resolve(stitchedImageBuffer);
                        });
                });
            }
        });

        return deferred.promise;
    };

    /**
     * Get the screenshot of the current tab.
     * @param {chrome.tabs.Tab} tab The tab from which the screenshot should be taken.
     * @param {boolean} forceFullPageScreenshot If true, a screenshot of the entire page will be taken.
     * @param {boolean} removeScrollBars If true, scrollbars will be removed before taking the screenshot.
     * @param {object} viewportSize The expected size of the image, in case this is not a full page screenshot.
     *                                      This helps us to decide whether or not to scale the image.
     * @return {Promise} A promise which resolves to a Buffer containing the PNG bytes of the screenshot.
     */
    WindowHandler.getScreenshot = function (tab, forceFullPageScreenshot, removeScrollBars, viewportSize) {
        var originalTab;
        var tabId = tab.id;
        var entirePageSize, scaleRatio, originalZoom;
        var imageBuffer;
        var originalOverflow = undefined;

        return ChromeUtils.getCurrentTab().then(function (originalTab_) {
            originalTab = originalTab_;
        }).then(function () {
            return ChromeUtils.switchToTab(tabId);
        }).then(function () {
            return WindowHandler.getZoom(tabId).then(function (originalZoom_) {
                originalZoom = originalZoom_ ? originalZoom_ : 1.0;
            });
        }).then(function () {
            if (originalZoom !== 1.0) {
                // set the zoom to 100%
                return WindowHandler.setZoom(tabId, 1.0, 300);
            }
        }).then(function () {
            if (removeScrollBars) {
                return WindowHandler.setOverflow(tabId, "hidden", 150).then(function (originalOverflow_) {
                    originalOverflow = originalOverflow_ ? originalOverflow_ : '';
                });
            }
        }).then(function () {
            return WindowHandler.getEntirePageSize(tab);
        }).then(function (entirePageSize_) {
                entirePageSize = entirePageSize_;
        }).then(function () {
            return WindowHandler.getDevicePixelRatio(tab).then(function (devicePixelRatio) {
                scaleRatio = 1 / devicePixelRatio;
            });
        }).then(function () {
            if (forceFullPageScreenshot) {
                return WindowHandler.getFullPageScreenshot(tab, scaleRatio, viewportSize, entirePageSize);
            }
            return WindowHandler.getTabScreenshot(tab, false, scaleRatio, [viewportSize, entirePageSize])
                .then(function (imageObj) {
                    return RSVP.resolve(imageObj.imageBuffer);
                });
        }).then(function (imageBuffer_) {
            imageBuffer = imageBuffer_;
            // If we removed the scrollbars, we need to put back the original overflow value.
            if (originalOverflow !== undefined) {
                //noinspection JSCheckFunctionSignatures
                return WindowHandler.setOverflow(tabId, originalOverflow, 150);
            }
        }).then (function () {
            // If needed, set the zoom back to its original factor.
            if (originalZoom !== 1.0) {
                return WindowHandler.setZoom(tabId, originalZoom, 300);
            }
        }).then (function () {
            return ChromeUtils.switchToTab(originalTab.id);
        }).then (function () {
            return RSVP.resolve(imageBuffer);
        });
    };

    module.exports = WindowHandler;
}());

