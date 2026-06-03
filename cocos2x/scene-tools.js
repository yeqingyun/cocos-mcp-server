'use strict';

/**
 * Scene tools for Cocos Creator 2.x
 * Uses 2.x Editor APIs: Editor.Scene.callSceneScript, Editor.assetdb, Editor.Ipc
 */

var PKG_NAME = 'cocos-mcp-server-2x';

function SceneTools() {
    this._currentSceneUrl = null;
    this._sceneUuidToUrl = {};
}

SceneTools.prototype.getTools = function() {
    return [
        {
            name: 'get_current_scene',
            description: 'Get current scene information',
            inputSchema: { type: 'object', properties: {} }
        },
        {
            name: 'get_scene_list',
            description: 'Get all scenes (.fire) in the project',
            inputSchema: { type: 'object', properties: {} }
        },
        {
            name: 'open_scene',
            description: 'Open a scene by UUID',
            inputSchema: {
                type: 'object',
                properties: {
                    sceneUuid: {
                        type: 'string',
                        description: 'The scene UUID to open'
                    }
                },
                required: ['sceneUuid']
            }
        },
        {
            name: 'save_scene',
            description: 'Save current scene',
            inputSchema: { type: 'object', properties: {} }
        },
        {
            name: 'create_scene',
            description: 'Create a new .fire scene asset',
            inputSchema: {
                type: 'object',
                properties: {
                    sceneName: {
                        type: 'string',
                        description: 'Name of the new scene'
                    },
                    savePath: {
                        type: 'string',
                        description: 'Path to save (e.g. db://assets/scenes/NewScene.fire)'
                    }
                },
                required: ['sceneName', 'savePath']
            }
        },
        {
            name: 'close_scene',
            description: 'Close current scene (creates a new empty scene)',
            inputSchema: { type: 'object', properties: {} }
        },
        {
            name: 'get_scene_hierarchy',
            description: 'Get the complete hierarchy of the current scene',
            inputSchema: {
                type: 'object',
                properties: {
                    includeComponents: {
                        type: 'boolean',
                        description: 'Include component information',
                        default: false
                    }
                }
            }
        }
    ];
};

SceneTools.prototype.execute = function(toolName, args) {
    switch (toolName) {
        case 'get_current_scene':
            return this.getCurrentScene();
        case 'get_scene_list':
            return this.getSceneList();
        case 'open_scene':
            return this.openScene(args.sceneUuid);
        case 'save_scene':
            return this.saveScene();
        case 'create_scene':
            return this.createScene(args.sceneName, args.savePath);
        case 'close_scene':
            return this.closeScene();
        case 'get_scene_hierarchy':
            return this.getSceneHierarchy(args.includeComponents);
        default:
            return Promise.reject(new Error('Unknown scene tool: ' + toolName));
    }
};

/**
 * Call scene script method and wrap in Promise
 */
function callSceneScript(method) {
    var extraArgs = Array.prototype.slice.call(arguments, 1);
    return new Promise(function(resolve, reject) {
        var callback = function(err, result) {
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

SceneTools.prototype.getCurrentScene = function() {
    return callSceneScript('get-current-scene');
};

SceneTools.prototype.getSceneList = function() {
    return new Promise(function(resolve, reject) {
        Editor.assetdb.queryAssets(null, 'scene', function(err, results) {
            if (err) {
                resolve({ success: false, error: err.message || String(err) });
                return;
            }

            var scenes = [];
            if (results) {
                for (var i = 0; i < results.length; i++) {
                    var asset = results[i];
                    if (asset.url && asset.url.endsWith('.fire')) {
                        scenes.push({
                            name: asset.name,
                            path: asset.url,
                            uuid: asset.uuid
                        });
                    }
                }
            }
            resolve({ success: true, data: scenes });
        });
    });
};

SceneTools.prototype.openScene = function(sceneUuid) {
    var self = this;

    // Look up URL from local UUID→URL mapping (set by createScene)
    var cached = self._sceneUuidToUrl[sceneUuid];
    if (cached) {
        self._currentSceneUrl = cached;
    }

    return new Promise(function(resolve, reject) {
        if (!sceneUuid) {
            resolve({ success: false, error: 'sceneUuid is required' });
            return;
        }

        // Use scene script to load scene — _Scene is available there
        callSceneScript('load-scene', sceneUuid).then(function(result) {
            if (result.success) {
                resolve({ success: true, message: result.message, _debug_cachedUrl: cached || null });
            } else {
                resolve({ success: false, error: result.error || 'Failed to load scene' });
            }
        }).catch(function(e) {
            resolve({ success: false, error: e.message });
        });
    });
};

SceneTools.prototype.saveScene = function() {
    var self = this;
    return new Promise(function(resolve) {
        try {
            // Use editor's save API to ensure dirty flag is cleared
            Editor.Ipc.sendToPanel('scene', 'scene:stash-and-save');
            resolve({ success: true, message: 'Scene saved successfully' });
        } catch (e) {
            resolve({ success: false, error: e.message });
        }
    });
};

SceneTools.prototype.createScene = function(sceneName, savePath) {
    var self = this;
    return new Promise(function(resolve, reject) {
        if (!sceneName || !savePath) {
            resolve({ success: false, error: 'sceneName and savePath are required' });
            return;
        }

        // Ensure .fire extension
        var fullPath = savePath.endsWith('.fire') ? savePath : savePath + '/' + sceneName + '.fire';

        // Minimal Cocos Creator 2.x .fire format
        var sceneContent = JSON.stringify([
            {
                "__type__": "cc.SceneAsset",
                "_name": sceneName,
                "_objFlags": 0,
                "_native": "",
                "scene": { "__id__": 1 }
            },
            {
                "__type__": "cc.Scene",
                "_name": sceneName,
                "_objFlags": 0,
                "_parent": null,
                "_children": [],
                "_active": true,
                "_components": [],
                "_prefab": null,
                "autoReleaseAssets": false,
                "_id": "scene"
            }
        ], null, 2);

        Editor.assetdb.create(fullPath, sceneContent, function(err, results) {
            if (err) {
                resolve({ success: false, error: err.message || String(err) });
            } else {
                var created = results && results[0] ? results[0] : null;
                var assetUuid = created ? created.uuid : null;

                // Cache URL for direct save
                self._currentSceneUrl = fullPath;
                if (assetUuid) {
                    self._sceneUuidToUrl[assetUuid] = fullPath;
                }
                console.log('[MCP 2x] createScene: cached URL', fullPath, 'UUID', assetUuid);

                resolve({
                    success: true,
                    data: {
                        name: sceneName,
                        path: fullPath,
                        uuid: assetUuid,
                        message: "Scene '" + sceneName + "' created successfully"
                    }
                });
            }
        });
    });
};

SceneTools.prototype.closeScene = function() {
    return new Promise(function(resolve) {
        // Don't clear _currentSceneUrl or _sceneUuidToUrl here —
        // openScene will update _currentSceneUrl when loading the next scene.
        try {
            Editor.Ipc.sendToPanel('scene', 'scene:new-scene');
            resolve({ success: true, message: 'Close command sent to scene panel (new empty scene)' });
        } catch (e) {
            resolve({ success: false, error: e.message });
        }
    });
};

SceneTools.prototype.getSceneHierarchy = function(includeComponents) {
    return callSceneScript('get-scene-hierarchy', !!includeComponents);
};

exports.SceneTools = SceneTools;
