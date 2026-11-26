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
            name: 'load_prefab',
            description: 'Load a prefab asset into memory',
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
        },
        {
            name: 'open_prefab',
            description: 'Open a prefab in the editor prefab edit mode (scene panel switches to editing this prefab, like double-clicking it in the assets panel)',
            inputSchema: {
                type: 'object',
                properties: {
                    prefabUuid: {
                        type: 'string',
                        description: 'Prefab asset UUID'
                    },
                    saveBeforeOpen: {
                        type: 'boolean',
                        description: 'Save the currently open scene/prefab before switching (default false)',
                        default: false
                    }
                },
                required: ['prefabUuid']
            }
        },
        {
            name: 'get_prefab_edit_state',
            description: 'Get which prefab is currently open in the scene panel prefab edit mode',
            inputSchema: { type: 'object', properties: {} }
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
            name: 'create_prefab',
            description: 'Create a prefab from a node in the scene',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: {
                        type: 'string',
                        description: 'Source node UUID'
                    },
                    prefabPath: {
                        type: 'string',
                        description: 'Path to save the prefab (e.g. db://assets/prefabs/MyPrefab.prefab)'
                    },
                    prefabName: {
                        type: 'string',
                        description: 'Prefab name (defaults to node name)'
                    }
                },
                required: ['nodeUuid', 'prefabPath']
            }
        },
        {
            name: 'update_prefab',
            description: 'Update an existing prefab from a scene node',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: {
                        type: 'string',
                        description: 'Node UUID with changes to apply to prefab'
                    },
                    prefabUuid: {
                        type: 'string',
                        description: 'Prefab asset UUID to update'
                    }
                },
                required: ['nodeUuid', 'prefabUuid']
            }
        },
        {
            name: 'revert_prefab',
            description: 'Revert a prefab instance to its original prefab state',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: {
                        type: 'string',
                        description: 'Prefab instance node UUID'
                    }
                },
                required: ['nodeUuid']
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
        },
        {
            name: 'validate_prefab',
            description: 'Validate a prefab file format',
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
        },
        {
            name: 'duplicate_prefab',
            description: 'Duplicate an existing prefab',
            inputSchema: {
                type: 'object',
                properties: {
                    sourcePrefabUuid: {
                        type: 'string',
                        description: 'Source prefab UUID'
                    },
                    targetPrefabPath: {
                        type: 'string',
                        description: 'Target prefab path (e.g. db://assets/prefabs/Copy.prefab)'
                    }
                },
                required: ['sourcePrefabUuid', 'targetPrefabPath']
            }
        },
        {
            name: 'restore_prefab_node',
            description: 'Restore a prefab node using prefab asset (built-in undo record)',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: {
                        type: 'string',
                        description: 'Prefab instance node UUID'
                    },
                    assetUuid: {
                        type: 'string',
                        description: 'Prefab asset UUID'
                    }
                },
                required: ['nodeUuid', 'assetUuid']
            }
        }
    ];
};

PrefabTools.prototype.execute = function(toolName, args) {
    switch (toolName) {
        case 'get_prefab_list':
            return this.getPrefabList(args.folder);
        case 'load_prefab':
            return this.loadPrefab(args.prefabUuid);
        case 'open_prefab':
            return this.openPrefab(args.prefabUuid, args.saveBeforeOpen);
        case 'get_prefab_edit_state':
            return this.getPrefabEditState();
        case 'instantiate_prefab':
            return this.instantiatePrefab(args);
        case 'create_prefab':
            return this.createPrefab(args);
        case 'update_prefab':
            return this.updatePrefab(args);
        case 'revert_prefab':
            return this.revertPrefab(args.nodeUuid);
        case 'get_prefab_info':
            return this.getPrefabInfo(args.prefabUuid);
        case 'validate_prefab':
            return this.validatePrefab(args.prefabUuid);
        case 'duplicate_prefab':
            return this.duplicatePrefab(args);
        case 'restore_prefab_node':
            return this.restorePrefabNode(args.nodeUuid, args.assetUuid);
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
        if (typeof Editor.assetdb.queryInfoByUuid === 'function') {
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
        } else if (typeof Editor.assetdb.assetInfoByUuid === 'function') {
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

PrefabTools.prototype.loadPrefab = function(prefabUuid) {
    return callSceneScript('load-prefab', prefabUuid);
};

PrefabTools.prototype.openPrefab = function(prefabUuid, saveBeforeOpen) {
    var self = this;
    return new Promise(function(resolve) {
        if (!prefabUuid) {
            resolve({ success: false, error: 'prefabUuid is required' });
            return;
        }

        // Validate the uuid exists and points to a prefab asset
        // (same dual-path as getPrefabInfo: queryInfoByUuid, fallback assetInfoByUuid)
        self.getPrefabInfo(prefabUuid).then(function(infoResult) {
            if (!infoResult || !infoResult.success) {
                resolve({ success: false, error: 'Prefab not found: ' + prefabUuid +
                    (infoResult && infoResult.error ? ' (' + infoResult.error + ')' : '') });
                return;
            }
            var info = {
                url: infoResult.data.path,
                name: infoResult.data.name
            };
            if (String(info.url || '').indexOf('.prefab') === -1) {
                resolve({ success: false, error: 'Asset is not a prefab: ' + info.url });
                return;
            }

            function sendEnter() {
                // The real "double-click open" IPC: the scene panel handles the
                // full transition itself (stash current state, load prefab).
                try {
                    Editor.Ipc.sendToPanel('scene', 'scene:enter-prefab-edit-mode', prefabUuid);
                    return true;
                } catch (ePanel) {
                    try {
                        Editor.Ipc.sendToScene('scene:enter-prefab-edit-mode', prefabUuid);
                        return true;
                    } catch (eScene) {
                        resolve({
                            success: false,
                            error: 'Failed to send enter-prefab-edit-mode. sendToPanel: ' + ePanel.message +
                                '; sendToScene: ' + eScene.message
                        });
                        return false;
                    }
                }
            }

            function poll(attempts) {
                callSceneScript('query-prefab-edit-state', prefabUuid).then(function(state) {
                    if (state && state.success && state.data && state.data.matchesTarget) {
                        resolve({
                            success: true,
                            data: {
                                uuid: prefabUuid,
                                path: info.url,
                                name: info.name,
                                rootName: state.data.editedRootName,
                                inPrefabEditMode: true,
                                message: 'Prefab opened in edit mode (confirmed after ' + attempts + ' check' + (attempts > 1 ? 's' : '') + ')'
                            }
                        });
                    } else if (attempts >= 15) {
                        resolve({
                            success: false,
                            error: 'Prefab edit mode not confirmed after ' + attempts +
                                ' checks. Last state: ' + JSON.stringify(state && state.data ? state.data : state)
                        });
                    } else {
                        setTimeout(function() { poll(attempts + 1); }, 400);
                    }
                }).catch(function(e) {
                    if (attempts >= 15) {
                        resolve({ success: false, error: 'Failed to query edit state: ' + e.message });
                    } else {
                        setTimeout(function() { poll(attempts + 1); }, 400);
                    }
                });
            }

            // Optional: persist whatever is currently open before switching
            var preStep;
            if (saveBeforeOpen) {
                preStep = new Promise(function(res) {
                    try {
                        Editor.Ipc.sendToPanel('scene', 'scene:stash-and-save');
                    } catch (e) { /* ignore save errors, opening proceeds anyway */ }
                    setTimeout(res, 1200);
                });
            } else {
                preStep = Promise.resolve();
            }

            preStep.then(function() {
                // Already in this prefab's edit mode? skip the reload entirely
                return callSceneScript('query-prefab-edit-state', prefabUuid).then(function(state) {
                    return !!(state && state.success && state.data && state.data.matchesTarget);
                }).catch(function() { return false; });
            }).then(function(alreadyOpen) {
                if (alreadyOpen) {
                    resolve({
                        success: true,
                        data: {
                            uuid: prefabUuid,
                            path: info.url,
                            name: info.name,
                            alreadyOpen: true,
                            message: 'Prefab is already open in edit mode'
                        }
                    });
                    return;
                }

                if (!sendEnter()) return;
                setTimeout(function() { poll(1); }, 600);
            }).catch(function(e) {
                resolve({ success: false, error: e.message });
            });
        });
    });
};

PrefabTools.prototype.getPrefabEditState = function() {
    return callSceneScript('query-prefab-edit-state', null);
};

PrefabTools.prototype.createPrefab = function(args) {
    var self = this;
    return new Promise(function(resolve) {
        // First, get the node data from scene
        callSceneScript('get-node-serialize-data', args.nodeUuid).then(function(result) {
            if (!result.success) {
                resolve(result);
                return;
            }

            var prefabName = args.prefabName || 'NewPrefab';
            var prefabData = result.data;

            // Create the prefab file using assetdb
            Editor.assetdb.create(args.prefabPath, prefabData, function(err, uuid) {
                if (err) {
                    resolve({ success: false, error: err.message || String(err) });
                    return;
                }

                resolve({
                    success: true,
                    data: {
                        uuid: uuid,
                        path: args.prefabPath,
                        name: prefabName,
                        message: 'Prefab created successfully'
                    }
                });
            });
        }).catch(function(err) {
            resolve({ success: false, error: err.message || String(err) });
        });
    });
};

PrefabTools.prototype.updatePrefab = function(args) {
    var self = this;
    return new Promise(function(resolve) {
        // Get the node data from scene
        callSceneScript('get-node-serialize-data', args.nodeUuid).then(function(result) {
            if (!result.success) {
                resolve(result);
                return;
            }

            var prefabData = result.data;

            // First get the prefab path from UUID
            var prefabPath = null;
            if (typeof Editor.assetdb.queryInfoByUuid === 'function') {
                Editor.assetdb.queryInfoByUuid(args.prefabUuid, function(err, info) {
                    if (err || !info) {
                        resolve({ success: false, error: 'Prefab not found' });
                        return;
                    }
                    prefabPath = info.url;
                    doUpdate();
                });
            } else if (typeof Editor.assetdb.assetInfoByUuid === 'function') {
                try {
                    var info = Editor.assetdb.assetInfoByUuid(args.prefabUuid);
                    if (!info) {
                        resolve({ success: false, error: 'Prefab not found' });
                        return;
                    }
                    prefabPath = info.url;
                    doUpdate();
                } catch (e) {
                    resolve({ success: false, error: e.message });
                }
            } else {
                resolve({ success: false, error: 'No asset info API available' });
                return;
            }

            function doUpdate() {
                if (!prefabPath) {
                    resolve({ success: false, error: 'Could not resolve prefab path' });
                    return;
                }

                // Write the updated prefab data directly to file
                var fs = require('fs');
                var realPath = Editor.assetdb._fspath(prefabPath);

                try {
                    // Convert prefabData to JSON string if it's an object
                    var contentToWrite = typeof prefabData === 'string' ? prefabData : JSON.stringify(prefabData);

                    // Write the prefab file
                    fs.writeFileSync(realPath, contentToWrite, 'utf8');

                    resolve({
                        success: true,
                        message: 'Prefab updated successfully (changes will be detected by editor)'
                    });
                } catch (e) {
                    resolve({ success: false, error: 'Failed to write prefab file: ' + e.message });
                }
            }
        }).catch(function(err) {
            resolve({ success: false, error: err.message || String(err) });
        });
    });
};

PrefabTools.prototype.revertPrefab = function(nodeUuid) {
    return callSceneScript('revert-prefab', nodeUuid);
};

PrefabTools.prototype.validatePrefab = function(prefabUuid) {
    return new Promise(function(resolve) {
        // First get the prefab path
        var prefabPath = null;
        if (typeof Editor.assetdb.queryInfoByUuid === 'function') {
            Editor.assetdb.queryInfoByUuid(prefabUuid, function(err, info) {
                if (err || !info) {
                    resolve({ success: false, error: 'Prefab not found' });
                    return;
                }
                prefabPath = info.url;
                doValidate();
            });
        } else if (typeof Editor.assetdb.assetInfoByUuid === 'function') {
            try {
                var info = Editor.assetdb.assetInfoByUuid(prefabUuid);
                if (!info) {
                    resolve({ success: false, error: 'Prefab not found' });
                    return;
                }
                prefabPath = info.url;
                doValidate();
            } catch (e) {
                resolve({ success: false, error: e.message });
            }
        } else {
            resolve({ success: false, error: 'No asset info API available' });
            return;
        }

        function doValidate() {
            if (!prefabPath) {
                resolve({ success: false, error: 'Could not resolve prefab path' });
                return;
            }

            // Try to read and parse the prefab file
            var fs = require('fs');
            var realPath = Editor.assetdb._fspath(prefabPath);

            try {
                var content = fs.readFileSync(realPath, 'utf8');
                var prefabData = JSON.parse(content);

                // Basic validation
                var isValid = Array.isArray(prefabData) && prefabData.length > 0;
                var issues = [];
                var nodeCount = 0;
                var componentCount = 0;

                if (isValid) {
                    // Check for cc.Prefab type in first element
                    if (prefabData[0].__type__ !== 'cc.Prefab') {
                        issues.push('First element must be cc.Prefab type');
                    }

                    // Count nodes and components
                    for (var i = 0; i < prefabData.length; i++) {
                        var item = prefabData[i];
                        if (item.__type__ === 'cc.Node') {
                            nodeCount++;
                        } else if (item.__type__ && item.__type__.indexOf('cc.') === 0) {
                            componentCount++;
                        }
                    }

                    if (nodeCount === 0) {
                        issues.push('Prefab must contain at least one node');
                        isValid = false;
                    }
                } else {
                    issues.push('Prefab data must be an array');
                }

                resolve({
                    success: true,
                    data: {
                        isValid: isValid,
                        issues: issues,
                        nodeCount: nodeCount,
                        componentCount: componentCount,
                        message: isValid ? 'Prefab format is valid' : 'Prefab format has issues'
                    }
                });
            } catch (e) {
                resolve({ success: false, error: 'Failed to read prefab file: ' + e.message });
            }
        }
    });
};

PrefabTools.prototype.duplicatePrefab = function(args) {
    return new Promise(function(resolve) {
        // First get the source prefab path
        var sourcePath = null;
        if (typeof Editor.assetdb.queryInfoByUuid === 'function') {
            Editor.assetdb.queryInfoByUuid(args.sourcePrefabUuid, function(err, info) {
                if (err || !info) {
                    resolve({ success: false, error: 'Source prefab not found' });
                    return;
                }
                sourcePath = info.url;
                doDuplicate();
            });
        } else if (typeof Editor.assetdb.assetInfoByUuid === 'function') {
            try {
                var info = Editor.assetdb.assetInfoByUuid(args.sourcePrefabUuid);
                if (!info) {
                    resolve({ success: false, error: 'Source prefab not found' });
                    return;
                }
                sourcePath = info.url;
                doDuplicate();
            } catch (e) {
                resolve({ success: false, error: e.message });
            }
        } else {
            resolve({ success: false, error: 'No asset info API available' });
            return;
        }

        function doDuplicate() {
            if (!sourcePath) {
                resolve({ success: false, error: 'Could not resolve source prefab path' });
                return;
            }

            // Read the source prefab
            var fs = require('fs');
            var realPath = Editor.assetdb._fspath(sourcePath);

            try {
                var content = fs.readFileSync(realPath, 'utf8');

                // Create the new prefab with the same content
                Editor.assetdb.create(args.targetPrefabPath, content, function(err, uuid) {
                    if (err) {
                        resolve({ success: false, error: err.message || String(err) });
                        return;
                    }

                    resolve({
                        success: true,
                        data: {
                            uuid: uuid,
                            path: args.targetPrefabPath,
                            message: 'Prefab duplicated successfully'
                        }
                    });
                });
            } catch (e) {
                resolve({ success: false, error: 'Failed to duplicate prefab: ' + e.message });
            }
        }
    });
};

PrefabTools.prototype.restorePrefabNode = function(nodeUuid, assetUuid) {
    return callSceneScript('restore-prefab-node', nodeUuid, assetUuid);
};

exports.PrefabTools = PrefabTools;
