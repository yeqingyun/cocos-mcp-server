'use strict';

/**
 * Screenshot tools for Cocos Creator 2.x
 *
 * Renders the current scene from a Camera component into a RenderTexture,
 * reads the pixels, encodes a PNG, and returns it inline as an MCP `image`
 * content block (so the AI can see the picture). Optionally saves the PNG
 * to disk.
 *
 * Captures the game-camera view (a Camera component), not the editor
 * viewport. The scene must contain at least one Camera.
 */

var PKG_NAME = 'cocos-mcp-server-2x';
var pngEncoder = require('./png-encoder');
var fs = require('fs');
var path = require('path');

function ScreenshotTools() {}

ScreenshotTools.prototype.MAX_SIZE = 2048;

ScreenshotTools.prototype.getTools = function () {
    return [
        {
            name: 'capture_scene',
            description: 'Capture the current scene as a PNG screenshot by rendering a Camera component into a RenderTexture. Returns the image inline (base64 PNG) so it can be viewed, and optionally saves it to disk. Captures the game-camera view, not the editor viewport. The scene must contain a Camera.',
            inputSchema: {
                type: 'object',
                properties: {
                    width: {
                        type: 'number',
                        description: 'Capture width in pixels (1-2048)',
                        default: 512,
                        minimum: 1,
                        maximum: 2048
                    },
                    height: {
                        type: 'number',
                        description: 'Capture height in pixels (1-2048)',
                        default: 512,
                        minimum: 1,
                        maximum: 2048
                    },
                    cameraUuid: {
                        type: 'string',
                        description: 'UUID of the Camera node to render from. If omitted, the first Camera found in the scene is used.'
                    },
                    targetNodeUuid: {
                        type: 'string',
                        description: 'UUID (or path) of a node whose subtree to frame. When set, a temporary orthographic camera is created and framed tightly on that node only (its siblings/parent are excluded). Ignored if cameraUuid is set. If neither cameraUuid nor targetNodeUuid is set, the whole scene is auto-framed.'
                    },
                    savePath: {
                        type: 'string',
                        description: 'Optional path to save the PNG file. Absolute path or db:// path (e.g. db://assets/screenshot.png).'
                    }
                }
            }
        }
    ];
};

ScreenshotTools.prototype.execute = function (toolName, args) {
    switch (toolName) {
        case 'capture_scene':
            return this.captureScene(args || {});
        default:
            return Promise.reject(new Error('Unknown screenshot tool: ' + toolName));
    }
};

/**
 * Call scene script method and wrap in Promise (same pattern as other 2.x tools).
 */
function callSceneScript(method) {
    var extraArgs = Array.prototype.slice.call(arguments, 1);
    return new Promise(function (resolve, reject) {
        var callback = function (err, result) {
            if (err) {
                reject(new Error(err.message || err));
            } else {
                resolve(result);
            }
        };
        var allArgs = [PKG_NAME, method].concat(extraArgs, [callback]);
        Editor.Scene.callSceneScript.apply(Editor.Scene, allArgs);
    });
}

function getProjectPath() {
    if (Editor.Project && Editor.Project.path) return Editor.Project.path;
    if (Editor.projectInfo && Editor.projectInfo.path) return Editor.projectInfo.path;
    return '';
}

ScreenshotTools.prototype.captureScene = function (args) {
    var self = this;

    function clamp(v, dflt) {
        var n = Math.floor(Number(v));
        if (!isFinite(n) || n <= 0) return dflt;
        return Math.max(1, Math.min(self.MAX_SIZE, n));
    }

    var width = clamp(args.width, 512);
    var height = clamp(args.height, 512);
    var cameraUuid = args.cameraUuid;
    var targetNodeUuid = args.targetNodeUuid;
    var savePath = args.savePath;

    // Always pass both selection args (null when unset) so positions stay stable.
    var p = callSceneScript('capture-scene', width, height, cameraUuid || null, targetNodeUuid || null);

    return p.then(function (result) {
        if (!result || !result.success) {
            return { success: false, error: (result && result.error) || 'Scene script capture failed' };
        }

        try {
            // Decode raw RGBA (base64) coming from the scene process.
            var rgba = Buffer.from(result.dataBase64, 'base64');
            // GL readback is bottom-up; PNG is top-down -> flip vertically.
            var flipped = pngEncoder.flipVertically(rgba, result.width, result.height);
            var pngBase64 = pngEncoder.encodePngBase64(flipped, result.width, result.height);

            var data = {
                width: result.width,
                height: result.height,
                cameraUuid: result.cameraUuid,
                cameraName: result.cameraName,
                autoFramed: !!result.autoFramed,
                framedNodeUuid: result.framedNodeUuid || null,
                pngSizeBytes: Math.floor(pngBase64.length * 3 / 4)
            };

            if (savePath) {
                var resolved = savePath;
                if (savePath.indexOf('db://') === 0) {
                    resolved = path.join(getProjectPath(), savePath.substring('db://'.length));
                }
                var dir = path.dirname(resolved);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(resolved, Buffer.from(pngBase64, 'base64'));
                data.savedPath = resolved;
            }

            return {
                success: true,
                message: 'Scene captured from camera \'' + data.cameraName + '\' (' + data.width + 'x' + data.height + ')'
                    + (data.autoFramed ? ' [auto-framed, no Camera in scene]' : '')
                    + (data.savedPath ? (', saved to ' + data.savedPath) : ' (returned inline)'),
                data: data,
                image: { data: pngBase64, mimeType: 'image/png' }
            };
        } catch (e) {
            return { success: false, error: 'Encode/save failed: ' + e.message };
        }
    }).catch(function (e) {
        return { success: false, error: e.message };
    });
};

exports.ScreenshotTools = ScreenshotTools;
