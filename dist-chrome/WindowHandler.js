/**
 * Provides an api for manipulating browser windows and tabs.
 */
(function () {
    "use strict";

    //noinspection JSUnresolvedFunction
    var RSVP = require('rsvp'),
        ChromeUtils = require('./ChromeUtils');

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
     * @param {Tab} tab The tab for which we want to get the scroll position.
     * @return {Promise} A promise which resolves to the scroll position (x/y).
     */
    WindowHandler.getCurrentScrollPosition = function (tab) {
        //noinspection JSUnresolvedVariable
        var tabId = tab.id;
        //noinspection JSLint
        var leftPromise = ChromeUtils.executeScript(tabId, 'var doc = document.documentElement; var resultX = (window.pageXOffset || doc.scrollLeft) - (doc.clientLeft || 0); resultX');
        //noinspection JSLint
        var topPromise = ChromeUtils.executeScript(tabId, 'var doc = document.documentElement; var resultY = (window.pageYOffset || doc.scrollTop)  - (doc.clientTop || 0); resultY');

        return RSVP.hash({x: leftPromise, y: topPromise}).then(function (results) {
            var x = parseInt(results.x[0], 10);
            var y = parseInt(results.y[0], 10);

            return RSVP.resolve({x: x, y: y});
        });
    };

    /**
     * Scrolls to a given location.
     * @param {Tab} tab The tab in which we would like to scroll.
     * @param {int} x The x value of the position to scroll to.
     * @param {int} y The y value of the position to scroll to.
     * @return {Promise} A promise which resolves when the scroll is executed.
     */
    WindowHandler.scrollTo = function (tab, x, y) {
        //noinspection JSUnresolvedVariable
        return ChromeUtils.executeScript(tab.id, 'window.scrollTo(' + x + ',' + y + ')');
    };

    /**
     * Get the entire page size of the given tab.
     * @param {Tab} tab The tab for which we would like to calculate the entire page size.
     * @return {Promise} A promise which resolves to an object containing the width/height of the page.
     */
    WindowHandler.getEntirePageSize = function (tab) {
        //noinspection JSUnresolvedVariable
        var tabId = tab.id;
        var scrollWidthPromise = ChromeUtils.executeScript(tabId, "document.documentElement.scrollWidth");
        var bodyScrollWidthPromise = ChromeUtils.executeScript(tabId, "document.body.scrollWidth");

        // IMPORTANT: Notice there's a major difference between scrollWidth
        // and scrollHeight. While scrollWidth is the maximum between an
        // element's width and its content width, scrollHeight might be
        // smaller (!) than the clientHeight, which is why we take the
        // maximum between them.
        var clientHeightPromise = ChromeUtils.executeScript(tabId, "document.documentElement.clientHeight");
        var bodyClientHeightPromise = ChromeUtils.executeScript(tabId, "document.body.clientHeight");
        var scrollHeightPromise = ChromeUtils.executeScript(tabId, "document.documentElement.scrollHeight");
        var bodyScrollHeightPromise = ChromeUtils.executeScript(tabId, "document.body.scrollHeight");

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
        return ChromeUtils.executeScript(tab.id, 'window.devicePixelRatio')
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
     * Captures the screenshot of the given tab.
     * @param {Tab} tab The tab for which to capture screenshot.
     * @param {boolean} withImage If true, the return value is an object with two attributes: "imageBuffer" and "image".
     *                  Otherwise - returns a buffer. Default is false.
     * @param {number} scaleRatio The ratio for scaling the image. If this value is undefined or equal to 1.0,
     *                              no scaling will take place.
     * @return {Promise} A promise which resolves to a buffer containing the PNG bytes of the given tab.
     */
    WindowHandler.getTabScreenshot = function (tab, withImage, scaleRatio) {
        withImage = withImage || false;
        scaleRatio = scaleRatio || 1.0;
        var deferred = RSVP.defer();

        //noinspection JSUnresolvedVariable
        chrome.tabs.captureVisibleTab(tab.windowId, {format: "png"}, function (originalDataUri) {
            // Scale the image.
            WindowHandler.scaleImage(originalDataUri, scaleRatio).then(function (dataUri) {

                // Create the image buffer.
                var image64 = dataUri.replace('data:image/png;base64,', '');
                var imageBuffer = new Buffer(image64, 'base64');

                if (withImage) {
                    var image = new Image();
                    image.onload = function () {
                        deferred.resolve({imageBuffer: imageBuffer, image: image});
                    };
                    image.src = dataUri;
                    return;
                }

                // If we don't need to return an Image object
                deferred.resolve(imageBuffer);
            });
        });

        return deferred.promise;
    };

    /**
     * Get a part of the page for full page screenshot.
     * @param {Promise} partsPromise The promise to which to chain the part retrieval promise.
     * @param {Tab} tab The tab from which we want to get the page part.
     * @param {object} position The top/left position of the page part.
     * @return {Promise} A promise which resolves to the page part.
     * @private
     */
    WindowHandler._getPagePart = function (partsPromise, tab, position) {
        var currentScrollPosition;
        return partsPromise.then(function () {
            // Try to scroll to the required position, and give it time to stabilize.
            return WindowHandler.scrollTo(tab, position.left, position.top).then(function () {
                return ChromeUtils.sleep(100);
            }).then(function () {
                // Get the actual scroll position (if the part size is smaller then the viewport size, then we might
                // not be able to scroll all the way to the required position).
                return WindowHandler.getCurrentScrollPosition(tab).then(function (currentScrollPosition_) {
                    currentScrollPosition = currentScrollPosition_;
                    return RSVP.resolve();
                });
            }).then(function () {
                // We don't want to scale the image, as this will be performed in the final stitching.
                return WindowHandler.getTabScreenshot(tab, true, 1);
            }).then(function (imageObj) {
                var pngImage = imageObj.image;
                var part = {image: pngImage,
                    position: {left: currentScrollPosition.x, top: currentScrollPosition.y},
                    size: {width: pngImage.width, height: pngImage.height}};
                return RSVP.resolve(part);
            });
        });
    };

    //noinspection JSValidateJSDoc
    /**
     * Stitches the given parts to a full image.
     * @param {object} fullSize The size of the stitched image. Should have 'width' and 'height' properties.
     * @param {float} devicePixelRatio The ratio between device pixels and css pixels.
     * @param {Array} parts The parts to stitch into an image. Each part should have: 'position'
     *                      (which includes top/left), 'size' (which includes width/height) and image
     *                      (a buffer containing PNG bytes) properties.
     * @return {Promise} A promise which resolves to the stitched image.
     */
    WindowHandler.stitchImage = function (fullSize, devicePixelRatio, parts) {
        // We'll use canvas for stitching an image.
        var canvas = document.createElement('canvas');
        canvas.width = fullSize.width;
        canvas.height = fullSize.height;
        var ctx = canvas.getContext('2d');
        var reverseScaleRatio = 1 / devicePixelRatio;
        ctx.scale(reverseScaleRatio, reverseScaleRatio);


        //noinspection JSLint
        for (var i = 0; i < parts.length; ++i) {
            var currentPart = parts[i];
            var leftInScale = currentPart.position.left / reverseScaleRatio;
            var topInScale = currentPart.position.top / reverseScaleRatio;

            //noinspection JSUnresolvedFunction
            ctx.drawImage(currentPart.image, leftInScale, topInScale);
        }

        var stitchedDataUri = canvas.toDataURL();
        // Create the image buffer.
        var image64 = stitchedDataUri.replace('data:image/png;base64,', '');
        return RSVP.resolve(new Buffer(image64, 'base64'));
    };

    /**
     * Get the full page screenshot of the current tab.
     * @param {Tab} tab The tab from which the screenshot should be taken.
     * @return {Promise} A promise which resolves to a Buffer containing the PNG bytes of the screenshot.
     */
    WindowHandler.getFullPageScreenshot = function (tab) {
        var deferred = RSVP.defer();

        var entirePageSize, originalScrollPosition, partSize, devicePixelRatio;
        var imageParts = [];

        // Getting the entire page size.
        WindowHandler.getEntirePageSize(tab).then(function (entirePageSize_) {
            entirePageSize = entirePageSize_;
            return RSVP.resolve();
        }).then(function () {
            // Saving the original scroll position.
            return WindowHandler.getCurrentScrollPosition(tab).then(function (originalScrollPosition_) {
                originalScrollPosition = originalScrollPosition_;
                return RSVP.resolve();
            });
        }).then(function () {
            // Saving the original scroll position.
            return WindowHandler.getDevicePixelRatio(tab).then(function (devicePixelRatio_) {
                devicePixelRatio = devicePixelRatio_;
                return RSVP.resolve();
            });
        }).then(function () {
            // Scrolling to the top/left of the page.
            return WindowHandler.scrollTo(tab, 0, 0).then(function () {
                // Give the scrolling time to stabilize.
                return ChromeUtils.sleep(100);
            });
        }).then(function () {
            // Capture the first image part. Don't perform any scaling on the image yet.
            return WindowHandler.getTabScreenshot(tab, true, 1).then(function (imageObj) {
                var image = imageObj.image;
                // The image's width and height are in device pixels, so we need to convert them to css pixels
                var imageCssWidth = image.width / devicePixelRatio;
                var imageCssHeight = image.height / devicePixelRatio;

                // If the image is already of the entire page, return it.
                if (imageCssWidth >= entirePageSize.width && imageCssHeight >= entirePageSize.height) {
                    // Scroll back to the original position
                    return WindowHandler.scrollTo(tab, originalScrollPosition.x, originalScrollPosition.y)
                        .then(function () {
                            // Since the result is just this image (and not a stitched image), we need to scale it.
                            var scaleRatio = 1 / devicePixelRatio;
                            return WindowHandler.scaleImage(image.src, scaleRatio).then(function (scaledDataUri) {
                                // We should return a buffer.
                                var image64 = scaledDataUri.replace('data:image/png;base64,', '');
                                return deferred.resolve(new Buffer(image64, 'base64'));
                            });
                        });
                }

                // Calculate the parts size based on the captured image, notice it's smaller than the actual image
                // size, so we can overwrite fixed position footers or right bars (unfortunately, handling fixed
                // position headers/left bars)
                var partSizeWidth = Math.max(imageCssWidth - _MAX_SCROLL_BAR_SIZE, _MIN_SCREENSHOT_PART_SIZE);
                var partSizeHeight = Math.max(imageCssHeight - _MAX_SCROLL_BAR_SIZE, _MIN_SCREENSHOT_PART_SIZE);
                partSize = {width: partSizeWidth, height: partSizeHeight};

                // Create the part for the first image, and add it to the parts list.
                var part = {image: image, position: {left: 0, top: 0}, size: {width: image.width,
                    height: image.height}};
                imageParts.push(part);

                return RSVP.resolve();
            });
        }).then(function () {
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
                partsPromise = WindowHandler._getPagePart(partsPromise, tab,
                    {left: partRegion.left, top: partRegion.top})
                    .then(function (part) {
                        imageParts.push(part);
                        return RSVP.resolve();
                    });
            }
            return partsPromise;
        }).then(function () {
            // Okay, we've got all the parts, return to the original location.
            return WindowHandler.scrollTo(tab, originalScrollPosition.x, originalScrollPosition.y).then(function () {
                // Give the scrolling time to stabilize.
                return ChromeUtils.sleep(100);
            });
        }).then(function () {
            // Stitch the image from the parts we collected and return the stitched image buffer.
            return WindowHandler.stitchImage(entirePageSize, devicePixelRatio, imageParts)
                .then(function (stitchedImageBuffer) {
                    deferred.resolve(stitchedImageBuffer);
                });
        });

        return deferred.promise;
    };

    /**
     * Get the screenshot of the current tab.
     * @param {Tab} tab The tab from which the screenshot should be taken.
     * @param {boolean} forceFullPageScreenshot If true, a screenshot of the entire page will be taken.
     * @return {Promise} A promise which resolves to a Buffer containing the PNG bytes of the screenshot.
     */
    WindowHandler.getScreenshot = function (tab, forceFullPageScreenshot) {
        //noinspection JSUnresolvedVariable
        var tabId = tab.id;
        var originalOverflow, imageBuffer;

        return ChromeUtils.executeScript(tabId, 'var origOF = document.documentElement.style.overflow; document.documentElement.style.overflow = "hidden"; origOF')
            .then(function (originalOverflowResults_) {
                originalOverflow = originalOverflowResults_[0];
            }).then(function () {
                return ChromeUtils.sleep(150); // Let the scrollbars time to disappear.
            }).then(function () {
                // If we should NOT get a full page screenshot, we just capture the given tab.
                if (!forceFullPageScreenshot) {
                    return WindowHandler.getDevicePixelRatio(tab).then(function (devicePixelRatio) {
                        var scaleRatio = 1 / devicePixelRatio;
                        return WindowHandler.getTabScreenshot(tab, false, scaleRatio);
                    });
                }

                return WindowHandler.getFullPageScreenshot(tab);
            }).then(function (imageBuffer_) {
                imageBuffer = imageBuffer_;
                return ChromeUtils.executeScript(tabId, 'document.documentElement.style.overflow="' + originalOverflow + '"');
            }).then(function () {
                return RSVP.resolve(imageBuffer);
            });
    };

    module.exports = WindowHandler;
}());

