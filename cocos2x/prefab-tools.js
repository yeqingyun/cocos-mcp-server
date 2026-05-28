'use strict';

/**
 * Prefab tools for Cocos Creator 2.x
 * Uses Editor.assetdb and scene scripts for prefab operations.
 */

var PKG_NAME = 'cocos-mcp-server-2x';

function PrefabTools() {}

PrefabTools.prototype.getTools = function() {
    return [
        {
            name: 'get_prefab_list',
            description: 'Get all prefabs (.prefab) in the project',
            inputSchema: {
                type: 'object',
                properties: {
                    folder: {
                        type: 'string',
                        description: 'Folder to search (e.g. db://assets)',
                        default: 'db://assets'
                    }
                }
            }
        },
        {
            name: 'instantiate_prefab',
            description: 'Instantiate a prefab in the scene',
            inputSchema: {
                type: 'object',
                properties: {
                    prefabUuid: {
                        type: 'string',
                        description: 'Prefab asset UUID'
                    },
                    parentPath: {
                        type: 'string',
                        description: 'Parent node path or UUID (optional)'
                    },
                    position: {
                        type: 'object',
                        properties: {
                            x: { type: 'number' },
                            y: { type: 'number' }
                        },
                        description: 'Initial position'
                    }
                },
                required: ['prefabUuid']
            }
        },
        {
            name: 'get_prefab_info',
            description: 'Get prefab asset information',
            inputSchema: {
                type: 'object',
                properties: {
                    prefabUuid: {
                        type: 'string',
                        description: 'Prefab asset UUID'
                    }
                },
                required: ['prefabUuid']
            }
        }
    ];
};

PrefabTools.prototype.execute = function(toolName, args) {
    switch (toolName) {
        case 'get_prefab_list':
            return this.getPrefabList(args.folder);
        case 'instantiate_prefab':
            return this.instantiatePrefab(args);
        case 'get_prefab_info':
            return this.getPrefabInfo(args.prefabUuid);
        default:
            return Promise.reject(new Error('Unknown prefab tool: ' + toolName));
    }
};

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

PrefabTools.prototype.getPrefabList = function(folder) {
    return new Promise(function(resolve) {
        Editor.assetdb.queryAssets(null, 'prefab', function(err, results) {
            if (err) {
                resolve({ success: false, error: err.message || String(err) });
                return;
            }

            var prefabs = [];
            if (results) {
                for (var i = 0; i < results.length; i++) {
                    var asset = results[i];
                    if (asset.url && asset.url.indexOf('.prefab') !== -1) {
                        prefabs.push({
                            name: asset.name,
                            path: asset.url,
                            uuid: asset.uuid
                        });
                    }
                }
            }
            resolve({ success: true, data: prefabs });
        });
    });
};

PrefabTools.prototype.instantiatePrefab = function(args) {
    return callSceneScript('instantiate-prefab', JSON.stringify(args));
};

PrefabTools.prototype.getPrefabInfo = function(prefabUuid) {
    return new Promise(function(resolve) {
        if (Editor.assetdb.queryInfoByUuid) {
            Editor.assetdb.queryInfoByUuid(prefabUuid, function(err, info) {
                if (err || !info) {
                    resolve({ success: false, error: err ? err.message || String(err) : 'Prefab not found' });
                    return;
                }
                resolve({
                    success: true,
                    data: {
                        name: info.name,
                        uuid: info.uuid,
                        path: info.url,
                        type: info.type,
                        isDirectory: info.isDirectory || false
                    }
                });
            });
        } else if (Editor.assetdb.assetInfoByUuid) {
            try {
                var info = Editor.assetdb.assetInfoByUuid(prefabUuid);
                if (!info) {
                    resolve({ success: false, error: 'Prefab not found' });
                    return;
                }
                resolve({
                    success: true,
                    data: {
                        name: info.name,
                        uuid: info.uuid,
                        path: info.url,
                        type: info.type,
                        isDirectory: false
                    }
                });
            } catch (e) {
                resolve({ success: false, error: e.message });
            }
        } else {
            resolve({ success: false, error: 'No asset info API available' });
        }
    });
};

exports.PrefabTools = PrefabTools;
