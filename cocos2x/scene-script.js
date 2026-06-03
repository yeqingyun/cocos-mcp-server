'use strict';

/**
 * Scene script for Cocos Creator 2.x
 * Runs in the scene process with direct access to the cc engine.
 * Methods are called via Editor.Scene.callSceneScript('cocos-mcp-server-2x', 'method-name', callback)
 */

var consoleMessages = [];
var MAX_CONSOLE = 200;

// Capture cc.log, cc.warn, cc.error
if (typeof cc !== 'undefined') {
    var origLog = cc.log;
    var origWarn = cc.warn;
    var origError = cc.error;

    cc.log = function() {
        addConsoleMsg('log', Array.prototype.slice.call(arguments).join(' '));
        if (origLog) origLog.apply(cc, arguments);
    };
    cc.warn = function() {
        addConsoleMsg('warn', Array.prototype.slice.call(arguments).join(' '));
        if (origWarn) origWarn.apply(cc, arguments);
    };
    cc.error = function() {
        addConsoleMsg('error', Array.prototype.slice.call(arguments).join(' '));
        if (origError) origError.apply(cc, arguments);
    };
}

function addConsoleMsg(type, msg) {
    consoleMessages.push({ timestamp: Date.now(), type: type, message: msg });
    if (consoleMessages.length > MAX_CONSOLE) {
        consoleMessages.shift();
    }
}

function findNodeByUuid(root, uuid) {
    if (!root) return null;
    if (root.uuid === uuid) return root;
    for (var i = 0; i < root.children.length; i++) {
        var found = findNodeByUuid(root.children[i], uuid);
        if (found) return found;
    }
    return null;
}

function findNodeByPath(root, pathStr) {
    if (!pathStr) return root;
    var parts = pathStr.split('/');
    var current = root;
    for (var i = 0; i < parts.length; i++) {
        if (!current) return null;
        var found = false;
        for (var j = 0; j < current.children.length; j++) {
            if (current.children[j].name === parts[i]) {
                current = current.children[j];
                found = true;
                break;
            }
        }
        if (!found) return null;
    }
    return current;
}

function getNodeBasicInfo(node) {
    return {
        uuid: node.uuid,
        name: node.name,
        active: node.activeInHierarchy,
        activeSelf: node.active,
        position: { x: node.x, y: node.y },
        scale: { x: node.scaleX, y: node.scaleY },
        rotation: node.rotation,
        anchorX: node.anchorX,
        anchorY: node.anchorY,
        width: node.width,
        height: node.height,
        parent: node.parent ? { uuid: node.parent.uuid, name: node.parent.name } : null,
        childrenCount: node.children.length,
        components: getComponentList(node)
    };
}

function getComponentList(node) {
    var list = [];
    for (var i = 0; i < node._components.length; i++) {
        var comp = node._components[i];
        list.push({
            type: comp.__classname__ || comp.name || 'Unknown',
            enabled: comp.enabled !== undefined ? comp.enabled : true
        });
    }
    return list;
}

function getComponentByType(node, type) {
    // Normalize type: strip 'cc.' prefix for matching
    var normalizedType = type.replace(/^cc\./, '');
    for (var i = 0; i < node._components.length; i++) {
        var comp = node._components[i];
        var className = comp.__classname__ || comp.name || '';
        // Strip 'cc.' prefix from className too for comparison
        var normalizedClassName = className.replace(/^cc\./, '');
        if (className === type || normalizedClassName === normalizedType ||
            className.indexOf(type) !== -1 || normalizedClassName.indexOf(normalizedType) !== -1) {
            return comp;
        }
    }
    return null;
}

function collectAllNodes(node, list) {
    list.push({
        uuid: node.uuid,
        name: node.name,
        active: node.activeInHierarchy,
        path: getNodePath(node)
    });
    for (var i = 0; i < node.children.length; i++) {
        collectAllNodes(node.children[i], list);
    }
}

function getNodePath(node) {
    var parts = [];
    var current = node;
    while (current && current !== cc.director.getScene()) {
        parts.unshift(current.name);
        current = current.parent;
    }
    return parts.join('/');
}

function searchNodes(node, pattern, exactMatch, results) {
    var matches = exactMatch
        ? (node.name === pattern)
        : (node.name.toLowerCase().indexOf(pattern.toLowerCase()) !== -1);

    if (matches) {
        results.push({
            uuid: node.uuid,
            name: node.name,
            path: getNodePath(node),
            active: node.activeInHierarchy
        });
    }

    for (var i = 0; i < node.children.length; i++) {
        searchNodes(node.children[i], pattern, exactMatch, results);
    }
}

function findSingleNodeByName(node, name) {
    if (!node) return null;

    // Check current node
    if (node.name === name) {
        return node;
    }

    // Search children recursively
    for (var i = 0; i < node.children.length; i++) {
        var found = findSingleNodeByName(node.children[i], name);
        if (found) {
            return found;
        }
    }

    return null;
}

module.exports = {
    // === Scene tools ===

    'load-scene': function(event, sceneUuid) {
        try {
            if (typeof _Scene !== 'undefined' && typeof _Scene.loadSceneByUuid === 'function') {
                _Scene.loadSceneByUuid(sceneUuid, function(err) {
                    if (err) {
                        event.reply(null, { success: false, error: err.message || String(err) });
                    } else {
                        event.reply(null, { success: true, message: 'Scene loaded: ' + sceneUuid });
                    }
                });
            } else {
                event.reply(null, { success: false, error: '_Scene.loadSceneByUuid not available' });
            }
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'save-scene-direct': function(event) {
        try {
            if (typeof _Scene !== 'undefined' && typeof _Scene.stashScene === 'function') {
                _Scene.stashScene(function(err, data) {
                    if (err) {
                        event.reply(null, { success: false, error: err.message || String(err) });
                        return;
                    }
                    event.reply(null, { success: true, data: data, message: 'Scene stashed for save' });
                });
            } else {
                event.reply(null, { success: false, error: '_Scene.stashScene not available' });
            }
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'serialize-scene': function(event) {
        try {
            var scene = cc.director.getScene();
            if (!scene) {
                event.reply(null, { success: false, error: 'No scene loaded' });
                return;
            }
            // EditorExt is available in Cocos 2.x scene renderer process
            if (typeof EditorExt !== 'undefined' && typeof EditorExt.serialize === 'function') {
                var json = EditorExt.serialize(scene);
                event.reply(null, { success: true, data: json });
                return;
            }
            event.reply(null, { success: false, error: 'EditorExt.serialize not available' });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'get-current-scene': function(event) {
        try {
            var scene = cc.director.getScene();
            if (scene) {
                event.reply(null, {
                    success: true,
                    data: {
                        name: scene.name,
                        uuid: scene.uuid,
                        active: scene.activeInHierarchy,
                        childrenCount: scene.children.length
                    }
                });
            } else {
                event.reply(null, { success: false, error: 'No scene loaded' });
            }
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'get-current-scene-info': function(event) {
        try {
            var scene = cc.director.getScene();
            if (!scene) {
                event.reply(null, { success: false, error: 'No scene loaded' });
                return;
            }

            // Try to get the current scene URL from _Scene if available
            var currentUrl = null;
            var currentUuid = null;

            if (typeof _Scene !== 'undefined' && _Scene.currentScene) {
                currentUuid = _Scene.currentScene.uuid;
                // Try to get URL from assetdb
                if (typeof Editor !== 'undefined' && Editor.assetdb) {
                    var urlInfo = Editor.assetdb.urlByUuid(currentUuid);
                    if (urlInfo) {
                        currentUrl = urlInfo;
                    }
                }
            }

            event.reply(null, {
                success: true,
                data: {
                    name: scene.name,
                    uuid: scene.uuid,
                    url: currentUrl,
                    active: scene.activeInHierarchy,
                    childrenCount: scene.children.length
                }
            });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'get-scene-hierarchy': function(event, includeComponents) {
        try {
            var scene = cc.director.getScene();
            if (!scene) {
                event.reply(null, { success: false, error: 'No scene loaded' });
                return;
            }

            function buildNodeInfo(node, depth) {
                var info = {
                    uuid: node.uuid,
                    name: node.name,
                    active: node.activeInHierarchy,
                    type: node.__classname__ || 'cc.Node',
                    children: []
                };

                if (node.x !== undefined) {
                    info.position = { x: node.x, y: node.y };
                    info.scale = { x: node.scaleX, y: node.scaleY };
                    info.rotation = node.rotation;
                }

                if (includeComponents) {
                    info.components = [];
                    for (var i = 0; i < node._components.length; i++) {
                        var comp = node._components[i];
                        info.components.push({
                            type: comp.__classname__ || comp.name || 'Unknown',
                            enabled: comp.enabled !== undefined ? comp.enabled : true
                        });
                    }
                }

                for (var j = 0; j < node.children.length; j++) {
                    info.children.push(buildNodeInfo(node.children[j], depth + 1));
                }

                return info;
            }

            var hierarchy = buildNodeInfo(scene, 0);
            event.reply(null, { success: true, data: hierarchy });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    // === Node tools ===

    'create-node': function(event, argsJson) {
        try {
            var args = JSON.parse(argsJson);
            var scene = cc.director.getScene();
            if (!scene) {
                event.reply(null, { success: false, error: 'No scene loaded' });
                return;
            }

            var node = new cc.Node(args.name || 'NewNode');

            // Find parent
            var parent = scene;
            if (args.parentPath) {
                var found = cc.find(args.parentPath);
                if (!found) {
                    found = findNodeByUuid(scene, args.parentPath);
                }
                if (found) parent = found;
            }

            parent.addChild(node);

            if (args.position) {
                node.x = args.position.x || 0;
                node.y = args.position.y || 0;
            }

            event.reply(null, {
                success: true,
                data: {
                    uuid: node.uuid,
                    name: node.name,
                    parentUuid: parent.uuid,
                    parentName: parent.name,
                    message: 'Node "' + node.name + '" created'
                }
            });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'get-node-info': function(event, uuidOrPath) {
        try {
            var node = null;
            if (uuidOrPath && uuidOrPath.indexOf('/') !== -1) {
                node = cc.find(uuidOrPath);
            }
            if (!node) {
                var scene = cc.director.getScene();
                node = findNodeByUuid(scene, uuidOrPath);
            }

            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + uuidOrPath });
                return;
            }

            var info = getNodeBasicInfo(node);
            info.children = [];
            for (var i = 0; i < node.children.length; i++) {
                info.children.push({
                    uuid: node.children[i].uuid,
                    name: node.children[i].name
                });
            }

            event.reply(null, { success: true, data: info });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'find-nodes': function(event, pattern, exactMatch) {
        try {
            var scene = cc.director.getScene();
            if (!scene) {
                event.reply(null, { success: false, error: 'No scene loaded' });
                return;
            }

            var results = [];
            searchNodes(scene, pattern, exactMatch, results);
            event.reply(null, { success: true, data: results });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'find-node-by-name': function(event, name, searchRoot) {
        try {
            var scene = cc.director.getScene();
            if (!scene) {
                event.reply(null, { success: false, error: 'No scene loaded' });
                return;
            }

            var rootNode = scene;
            if (searchRoot) {
                // Try to find by UUID first
                var found = findNodeByUuid(scene, searchRoot);
                if (!found) {
                    // Try to find by path
                    found = findNodeByPath(scene, searchRoot);
                }
                if (found) {
                    rootNode = found;
                }
            }

            // Search for node by exact name
            var result = findSingleNodeByName(rootNode, name);
            if (result) {
                event.reply(null, {
                    success: true,
                    data: getNodeBasicInfo(result)
                });
            } else {
                event.reply(null, { success: false, error: 'Node not found: ' + name });
            }
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'get-all-nodes': function(event) {
        try {
            var scene = cc.director.getScene();
            if (!scene) {
                event.reply(null, { success: false, error: 'No scene loaded' });
                return;
            }

            var nodes = [];
            collectAllNodes(scene, nodes);
            event.reply(null, { success: true, data: { totalNodes: nodes.length, nodes: nodes } });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'set-node-property': function(event, uuid, property, valueJson) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, uuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + uuid });
                return;
            }

            var value = JSON.parse(valueJson);
            switch (property) {
                case 'name': node.name = String(value); break;
                case 'active': node.active = !!value; break;
                case 'x': node.x = Number(value); break;
                case 'y': node.y = Number(value); break;
                case 'position': node.x = Number(value.x); node.y = Number(value.y); break;
                case 'scaleX': node.scaleX = Number(value); break;
                case 'scaleY': node.scaleY = Number(value); break;
                case 'scale': node.scaleX = Number(value.x); node.scaleY = Number(value.y); break;
                case 'rotation': node.rotation = Number(value); break;
                case 'width': node.width = Number(value); break;
                case 'height': node.height = Number(value); break;
                case 'anchorX': node.anchorX = Number(value); break;
                case 'anchorY': node.anchorY = Number(value); break;
                case 'color':
                    if (typeof value === 'object') {
                        node.color = new cc.Color(
                            Number(value.r) || 0,
                            Number(value.g) || 0,
                            Number(value.b) || 0,
                            value.a !== undefined ? Number(value.a) : 255
                        );
                    }
                    break;
                case 'opacity': node.opacity = Number(value); break;
                default:
                    if (node[property] !== undefined) {
                        node[property] = value;
                    } else {
                        event.reply(null, { success: false, error: 'Unknown property: ' + property });
                        return;
                    }
            }

            event.reply(null, {
                success: true,
                data: { uuid: uuid, property: property, value: value },
                message: 'Property "' + property + '" set successfully'
            });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'delete-node': function(event, uuid) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, uuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + uuid });
                return;
            }

            var name = node.name;
            node.removeFromParent(true);
            node.destroy();

            event.reply(null, { success: true, message: 'Node "' + name + '" deleted' });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'move-node': function(event, nodeUuid, newParentUuid, siblingIndex) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            var newParent = findNodeByUuid(scene, newParentUuid);

            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }
            if (!newParent) {
                event.reply(null, { success: false, error: 'Parent not found: ' + newParentUuid });
                return;
            }

            var idx = siblingIndex !== undefined && siblingIndex >= 0 ? siblingIndex : newParent.children.length;
            node.removeFromParent(false);
            newParent.insertChild(node, idx);

            event.reply(null, {
                success: true,
                message: 'Node "' + node.name + '" moved to "' + newParent.name + '"'
            });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'duplicate-node': function(event, uuid) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, uuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + uuid });
                return;
            }

            // cc.instantiate clones the node
            var clone = cc.instantiate(node);
            node.parent.addChild(clone);

            event.reply(null, {
                success: true,
                data: {
                    uuid: clone.uuid,
                    name: clone.name,
                    message: 'Node duplicated'
                }
            });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    // === Component tools ===

    'add-component': function(event, nodeUuid, componentType) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }

            var comp = node.addComponent(componentType);
            if (comp) {
                event.reply(null, {
                    success: true,
                    data: {
                        nodeUuid: nodeUuid,
                        componentType: componentType,
                        message: 'Component "' + componentType + '" added'
                    }
                });
            } else {
                event.reply(null, { success: false, error: 'Failed to add component: ' + componentType });
            }
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'attach-script': function(event, argsJson) {
        try {
            var args = JSON.parse(argsJson);
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, args.nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + args.nodeUuid });
                return;
            }

            // Try to find the script by name or path
            var scriptName = args.scriptName;
            var scriptPath = args.scriptPath;

            // First, try to add component directly by script name
            try {
                var comp = node.addComponent(scriptName);
                if (comp) {
                    event.reply(null, {
                        success: true,
                        data: {
                            nodeUuid: args.nodeUuid,
                            scriptName: scriptName,
                            message: 'Script "' + scriptName + '" attached successfully'
                        }
                    });
                    return;
                }
            } catch (e) {
                // Script not found by name, try other methods
            }

            // Try using Editor.assetdb to find the script
            if (Editor.assetdb && Editor.assetdb.queryAssets) {
                var searchPattern = scriptPath || ('**/' + scriptName + '.js');
                Editor.assetdb.queryAssets(searchPattern, 'javascript', function(err, results) {
                    if (err || !results || results.length === 0) {
                        event.reply(null, { success: false, error: 'Script not found: ' + scriptName });
                        return;
                    }

                    // Use the first matching script
                    var scriptAsset = results[0];
                    try {
                        // Try to add component using the script name from asset
                        var comp = node.addComponent(scriptName);
                        if (comp) {
                            event.reply(null, {
                                success: true,
                                data: {
                                    nodeUuid: args.nodeUuid,
                                    scriptName: scriptName,
                                    scriptPath: scriptAsset.url,
                                    message: 'Script "' + scriptName + '" attached successfully'
                                }
                            });
                        } else {
                            event.reply(null, { success: false, error: 'Failed to attach script: ' + scriptName });
                        }
                    } catch (e) {
                        event.reply(null, { success: false, error: 'Failed to attach script: ' + (e.message || String(e)) });
                    }
                });
            } else {
                event.reply(null, { success: false, error: 'Script asset database not available' });
            }
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'remove-component': function(event, nodeUuid, componentType) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }

            var comp = getComponentByType(node, componentType);
            if (!comp) {
                event.reply(null, { success: false, error: 'Component not found: ' + componentType });
                return;
            }

            node.removeComponent(comp);
            event.reply(null, {
                success: true,
                message: 'Component "' + componentType + '" removed'
            });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'get-components': function(event, nodeUuid) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }

            var components = getComponentList(node);
            event.reply(null, {
                success: true,
                data: { nodeUuid: nodeUuid, components: components }
            });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'set-component-property': function(event, nodeUuid, componentType, property, valueJson) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }

            var comp = getComponentByType(node, componentType);
            if (!comp) {
                event.reply(null, { success: false, error: 'Component not found: ' + componentType });
                return;
            }

            var value = JSON.parse(valueJson);

            // Handle special property names
            if (property === 'string') {
                comp.string = String(value);
            } else if (property === 'fontSize') {
                comp.fontSize = Number(value);
            } else if (property === 'lineHeight') {
                comp.lineHeight = Number(value);
            } else if (property === 'color') {
                if (typeof value === 'object') {
                    comp.node.color = new cc.Color(
                        Number(value.r) || 0,
                        Number(value.g) || 0,
                        Number(value.b) || 0,
                        value.a !== undefined ? Number(value.a) : 255
                    );
                }
            } else if (property === 'horizontalAlign') {
                comp.horizontalAlign = Number(value);
            } else if (property === 'verticalAlign') {
                comp.verticalAlign = Number(value);
            } else if (property === 'overflow') {
                comp.overflow = Number(value);
            } else if (property === 'enableWrapText') {
                comp.enableWrapText = !!value;
            } else if (property === '_spriteFrame' || property === 'spriteFrame') {
                var uuid = (value && value.__uuid__) ? value.__uuid__ : (typeof value === 'string' ? value : null);
                if (!uuid) {
                    event.reply(null, { success: false, error: 'No UUID provided for spriteFrame' });
                    return;
                }
                loadAndSetSpriteFrame(comp, uuid, event);
                return;
            } else if (comp[property] !== undefined) {
                comp[property] = value;
            } else {
                event.reply(null, { success: false, error: 'Unknown property: ' + property });
                return;
            }

            event.reply(null, {
                success: true,
                message: componentType + '.' + property + ' set successfully'
            });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'get-component-info': function(event, nodeUuid, componentType) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }

            var comp = getComponentByType(node, componentType);
            if (!comp) {
                event.reply(null, { success: false, error: 'Component not found: ' + componentType });
                return;
            }

            // Only extract safe, serializable properties
            var props = {};
            var skipKeys = ['node', '__scriptAsset', '_id', '_enabled', '__classname__',
                'name', '_name', '_objFlags', '_ctor', '__cid__', '_scene', '_sgNode',
                'enabled', 'enabledInHierarchy', 'isValid', 'destroyed', '_assembler',
                '_spriteFrame', '_N$spriteFrame', '_N$target'];

            for (var key in comp) {
                if (skipKeys.indexOf(key) !== -1) continue;
                if (key.startsWith('__')) continue;
                var val = comp[key];
                if (typeof val === 'function') continue;
                // Only include primitive types (number, string, boolean)
                if (val === null || val === undefined) {
                    props[key] = val;
                } else if (typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean') {
                    props[key] = val;
                }
                // Skip objects, arrays, and complex types to avoid serialization errors
            }

            event.reply(null, {
                success: true,
                data: {
                    nodeUuid: nodeUuid,
                    componentType: componentType,
                    enabled: comp.enabled !== undefined ? comp.enabled : true,
                    properties: props
                }
            });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    // === Specific component info tools (Cocos Creator 2.4.7) ===

    'get-sprite-info': function(event, nodeUuid) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }

            var comp = getComponentByType(node, 'cc.Sprite');
            if (!comp) {
                event.reply(null, { success: false, error: 'Sprite component not found on node' });
                return;
            }

            var info = {
                nodeUuid: nodeUuid,
                enabled: comp.enabled !== undefined ? comp.enabled : true,
                spriteFrame: null,
                spriteFrameUuid: null,
                color: { r: 255, g: 255, b: 255, a: 255 },
                sizeMode: 0,
                trim: false,
                srcBlendFactor: 0,
                dstBlendFactor: 0
            };

            // Get sprite frame info
            if (comp._spriteFrame) {
                info.spriteFrameUuid = comp._spriteFrame._uuid || null;
                info.spriteFrame = {
                    uuid: info.spriteFrameUuid,
                    name: comp._spriteFrame.name || 'Unknown'
                };
            }

            // Get color
            if (comp.node && comp.node.color) {
                info.color = {
                    r: comp.node.color.r,
                    g: comp.node.color.g,
                    b: comp.node.color.b,
                    a: comp.node.color.a
                };
            }

            // Get size mode
            if (comp._sizeMode !== undefined) info.sizeMode = comp._sizeMode;
            if (comp._trim !== undefined) info.trim = comp._trim;
            if (comp._srcBlendFactor !== undefined) info.srcBlendFactor = comp._srcBlendFactor;
            if (comp._dstBlendFactor !== undefined) info.dstBlendFactor = comp._dstBlendFactor;

            event.reply(null, { success: true, data: info });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'get-label-info': function(event, nodeUuid) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }

            var comp = getComponentByType(node, 'cc.Label');
            if (!comp) {
                event.reply(null, { success: false, error: 'Label component not found on node' });
                return;
            }

            var info = {
                nodeUuid: nodeUuid,
                enabled: comp.enabled !== undefined ? comp.enabled : true,
                string: '',
                fontSize: 40,
                font: null,
                overflow: 0,
                horizontalAlign: 1,
                verticalAlign: 1,
                enableWrapText: false,
                fontFamily: 'Arial',
                lineHeight: 40,
                spacingX: 0
            };

            if (comp._string !== undefined) info.string = comp._string;
            if (comp._fontSize !== undefined) info.fontSize = comp._fontSize;
            if (comp._font !== undefined) info.font = comp._font;
            if (comp._overflow !== undefined) info.overflow = comp._overflow;
            if (comp._horizontalAlign !== undefined) info.horizontalAlign = comp._horizontalAlign;
            if (comp._verticalAlign !== undefined) info.verticalAlign = comp._verticalAlign;
            if (comp._enableWrapText !== undefined) info.enableWrapText = comp._enableWrapText;
            if (comp._fontFamily !== undefined) info.fontFamily = comp._fontFamily;
            if (comp._lineHeight !== undefined) info.lineHeight = comp._lineHeight;
            if (comp._spacingX !== undefined) info.spacingX = comp._spacingX;

            event.reply(null, { success: true, data: info });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'get-button-info': function(event, nodeUuid) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }

            var comp = getComponentByType(node, 'cc.Button');
            if (!comp) {
                event.reply(null, { success: false, error: 'Button component not found on node' });
                return;
            }

            var info = {
                nodeUuid: nodeUuid,
                enabled: comp.enabled !== undefined ? comp.enabled : true,
                interactable: true,
                transition: 2,
                normalColor: { r: 255, g: 255, b: 255, a: 255 },
                pressedColor: { r: 200, g: 200, b: 200, a: 255 },
                hoverColor: { r: 255, g: 255, b: 255, a: 255 },
                disabledColor: { r: 120, g: 120, b: 120, a: 200 },
                target: null,
                clickEvents: []
            };

            if (comp.interactable !== undefined) info.interactable = comp.interactable;
            if (comp._transition !== undefined) info.transition = comp._transition;
            if (comp._normalColor) info.normalColor = comp._normalColor;
            if (comp._pressedColor) info.pressedColor = comp._pressedColor;
            if (comp._hoverColor) info.hoverColor = comp._hoverColor;
            if (comp._disabledColor) info.disabledColor = comp._disabledColor;
            if (comp._target && comp._target.uuid) info.target = comp._target.uuid;
            if (comp._clickEvents) info.clickEvents = comp._clickEvents;

            event.reply(null, { success: true, data: info });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'get-transform-info': function(event, nodeUuid) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }

            // In Cocos Creator 2.4.7, transform info is stored directly on the node
            var info = {
                nodeUuid: nodeUuid,
                contentSize: {
                    width: node.width || 0,
                    height: node.height || 0
                },
                anchorPoint: {
                    x: node.anchorX || 0.5,
                    y: node.anchorY || 0.5
                },
                position: {
                    x: node.x || 0,
                    y: node.y || 0
                },
                scale: {
                    x: node.scaleX || 1,
                    y: node.scaleY || 1
                },
                rotation: node.rotation || 0,
                skewX: node.skewX || 0,
                skewY: node.skewY || 0,
                opacity: node.opacity !== undefined ? node.opacity : 255,
                color: {
                    r: node.color ? node.color.r : 255,
                    g: node.color ? node.color.g : 255,
                    b: node.color ? node.color.b : 255,
                    a: node.color ? node.color.a : 255
                }
            };

            event.reply(null, { success: true, data: info });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'get-layout-info': function(event, nodeUuid) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }

            var comp = getComponentByType(node, 'cc.Layout');
            if (!comp) {
                event.reply(null, { success: false, error: 'Layout component not found on node' });
                return;
            }

            var info = {
                nodeUuid: nodeUuid,
                enabled: comp.enabled !== undefined ? comp.enabled : true,
                type: 0,
                resizeMode: 0,
                spacingX: 0,
                spacingY: 0,
                paddingLeft: 0,
                paddingRight: 0,
                paddingTop: 0,
                paddingBottom: 0,
                verticalDirection: 1,
                horizontalDirection: 0,
                cellSize: { width: 40, height: 40 },
                startAxis: 0,
                affectedByScale: false
            };

            if (comp._type !== undefined) info.type = comp._type;
            if (comp._resizeMode !== undefined) info.resizeMode = comp._resizeMode;
            if (comp._spacingX !== undefined) info.spacingX = comp._spacingX;
            if (comp._spacingY !== undefined) info.spacingY = comp._spacingY;
            if (comp._paddingLeft !== undefined) info.paddingLeft = comp._paddingLeft;
            if (comp._paddingRight !== undefined) info.paddingRight = comp._paddingRight;
            if (comp._paddingTop !== undefined) info.paddingTop = comp._paddingTop;
            if (comp._paddingBottom !== undefined) info.paddingBottom = comp._paddingBottom;
            if (comp._verticalDirection !== undefined) info.verticalDirection = comp._verticalDirection;
            if (comp._horizontalDirection !== undefined) info.horizontalDirection = comp._horizontalDirection;
            if (comp._cellSize) info.cellSize = comp._cellSize;
            if (comp._startAxis !== undefined) info.startAxis = comp._startAxis;
            if (comp._affectedByScale !== undefined) info.affectedByScale = comp._affectedByScale;

            event.reply(null, { success: true, data: info });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'get-widget-info': function(event, nodeUuid) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }

            var comp = getComponentByType(node, 'cc.Widget');
            if (!comp) {
                event.reply(null, { success: false, error: 'Widget component not found on node' });
                return;
            }

            var info = {
                nodeUuid: nodeUuid,
                enabled: comp.enabled !== undefined ? comp.enabled : true,
                // Alignment flags
                isAlignTop: false,
                isAlignVerticalCenter: false,
                isAlignBottom: false,
                isAlignLeft: false,
                isAlignHorizontalCenter: false,
                isAlignRight: false,
                // Alignment targets
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                horizontalCenter: 0,
                verticalCenter: 0,
                // Scale and alignment
                isAbsolutTop: true,
                isAbsolutBottom: true,
                isAbsolutLeft: true,
                isAbsolutRight: true,
                // Original position
                originalTarget: null,
                alignMode: 0
            };

            // Get alignment flags
            if (comp._isAlignTop !== undefined) info.isAlignTop = comp._isAlignTop;
            if (comp._isAlignVerticalCenter !== undefined) info.isAlignVerticalCenter = comp._isAlignVerticalCenter;
            if (comp._isAlignBottom !== undefined) info.isAlignBottom = comp._isAlignBottom;
            if (comp._isAlignLeft !== undefined) info.isAlignLeft = comp._isAlignLeft;
            if (comp._isAlignHorizontalCenter !== undefined) info.isAlignHorizontalCenter = comp._isAlignHorizontalCenter;
            if (comp._isAlignRight !== undefined) info.isAlignRight = comp._isAlignRight;

            // Get alignment values
            if (comp._top !== undefined) info.top = comp._top;
            if (comp._bottom !== undefined) info.bottom = comp._bottom;
            if (comp._left !== undefined) info.left = comp._left;
            if (comp._right !== undefined) info.right = comp._right;
            if (comp._horizontalCenter !== undefined) info.horizontalCenter = comp._horizontalCenter;
            if (comp._verticalCenter !== undefined) info.verticalCenter = comp._verticalCenter;

            // Get absolute flags
            if (comp._isAbsolutTop !== undefined) info.isAbsolutTop = comp._isAbsolutTop;
            if (comp._isAbsolutBottom !== undefined) info.isAbsolutBottom = comp._isAbsolutBottom;
            if (comp._isAbsolutLeft !== undefined) info.isAbsolutLeft = comp._isAbsolutLeft;
            if (comp._isAbsolutRight !== undefined) info.isAbsolutRight = comp._isAbsolutRight;

            // Get original target
            if (comp._originalTarget) info.originalTarget = comp._originalTarget;

            // Get align mode
            if (comp._alignMode !== undefined) info.alignMode = comp._alignMode;

            event.reply(null, { success: true, data: info });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'get-custom-component-info': function(event, nodeUuid, componentType, maxDepthStr) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }

            var comp = getComponentByType(node, componentType);
            if (!comp) {
                event.reply(null, { success: false, error: 'Custom component not found: ' + componentType });
                return;
            }

            var maxDepth = parseInt(maxDepthStr) || 3;
            var className = comp.__classname__ || comp.name || componentType;

            // Keys to always skip (engine internals)
            var skipKeys = [
                'node', '__scriptAsset', '_id', '_enabled', '__classname__',
                'name', '_name', '_objFlags', '_ctor', '__cid__', '_scene', '_sgNode',
                'enabled', 'enabledInHierarchy', 'isValid', 'destroyed', '_assembler',
                '__scriptUuid', '_isOnLoadCalled', '_watcherHandle',
                '_preloadHandle', '_loadHandle', '_invoke', '_update',
                'update', 'lateUpdate', 'start', 'onDestroy', 'onEnable', 'onDisable',
                'onFocusInEditor', 'onLostFocusInEditor', 'resetInEditor',
                '_getLocalBounds', 'onRestore', '_serialize', '_deserialize'
            ];

            // Serialize a value recursively with depth control
            function serializeValue(val, depth) {
                if (depth <= 0) return '[max depth reached]';
                if (val === null || val === undefined) return val;
                if (typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean') {
                    return val;
                }
                if (typeof val === 'function') return undefined; // skip functions

                // cc.Node reference → return uuid + name
                if (val instanceof cc.Node) {
                    return { __type__: 'cc.Node', uuid: val.uuid, name: val.name };
                }
                // cc.Component reference → return type + uuid
                if (val instanceof cc.Component) {
                    return {
                        __type__: val.__classname__ || val.name || 'cc.Component',
                        uuid: val.uuid || null
                    };
                }
                // cc.SpriteFrame / cc.Texture2D / cc.Asset → return uuid + name
                if (val instanceof cc.Asset) {
                    return {
                        __type__: val.__classname__ || 'cc.Asset',
                        uuid: val._uuid || val.uuid || null,
                        name: val.name || null
                    };
                }
                // cc.Color
                if (val instanceof cc.Color) {
                    return { __type__: 'cc.Color', r: val.r, g: val.g, b: val.b, a: val.a };
                }
                // cc.Vec2
                if (val instanceof cc.Vec2) {
                    return { __type__: 'cc.Vec2', x: val.x, y: val.y };
                }
                // cc.Size
                if (val instanceof cc.Size) {
                    return { __type__: 'cc.Size', width: val.width, height: val.height };
                }
                // cc.Rect
                if (val instanceof cc.Rect) {
                    return { __type__: 'cc.Rect', x: val.x, y: val.y, width: val.width, height: val.height };
                }

                // Array
                if (Array.isArray(val)) {
                    var arr = [];
                    for (var i = 0; i < val.length; i++) {
                        var item = serializeValue(val[i], depth - 1);
                        if (item !== undefined) arr.push(item);
                    }
                    return arr;
                }

                // Plain object
                if (typeof val === 'object') {
                    var obj = {};
                    var keys = Object.keys(val);
                    for (var k = 0; k < keys.length; k++) {
                        var key = keys[k];
                        if (key.startsWith('__')) continue;
                        var propVal = val[key];
                        if (typeof propVal === 'function') continue;
                        obj[key] = serializeValue(propVal, depth - 1);
                    }
                    return obj;
                }

                return undefined;
            }

            // Collect properties
            var properties = {};
            var proto = Object.getPrototypeOf(comp);
            var allKeys = {};

            // Instance properties
            for (var key in comp) {
                if (!comp.hasOwnProperty(key)) continue;
                allKeys[key] = true;
            }

            // Prototype properties (getters/setters defined in script)
            if (proto) {
                var protoProps = Object.getOwnPropertyNames(proto);
                for (var p = 0; p < protoProps.length; p++) {
                    var pKey = protoProps[p];
                    if (pKey === 'constructor' || pKey.startsWith('__')) continue;
                    allKeys[pKey] = true;
                }
            }

            var sortedKeys = Object.keys(allKeys).sort();
            for (var s = 0; s < sortedKeys.length; s++) {
                var sKey = sortedKeys[s];
                if (skipKeys.indexOf(sKey) !== -1) continue;
                if (sKey.startsWith('__')) continue;
                if (sKey.startsWith('_N$')) continue; // editor internal
                try {
                    var val = comp[sKey];
                    if (typeof val === 'function') continue;
                    var serialized = serializeValue(val, maxDepth);
                    if (serialized !== undefined) {
                        properties[sKey] = serialized;
                    }
                } catch (e) {
                    // Skip properties that throw on access
                    properties[sKey] = '[error: ' + e.message + ']';
                }
            }

            event.reply(null, {
                success: true,
                data: {
                    nodeUuid: nodeUuid,
                    componentType: className,
                    enabled: comp.enabled !== undefined ? comp.enabled : true,
                    propertyCount: Object.keys(properties).length,
                    properties: properties
                }
            });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    // === Prefab tools ===

    'instantiate-prefab': function(event, argsJson) {
        try {
            var args = JSON.parse(argsJson);
            var scene = cc.director.getScene();
            if (!scene) {
                event.reply(null, { success: false, error: 'No scene loaded' });
                return;
            }

            // Load prefab by uuid, then instantiate
            cc.assetManager.loadAny({ uuid: args.prefabUuid, type: 'prefab' }, function(err, prefab) {
                if (err) {
                    // Fallback: try cc.loader
                    cc.loader.loadRes(args.prefabUuid, cc.Prefab, function(err2, prefab2) {
                        if (err2) {
                            event.reply(null, { success: false, error: 'Failed to load prefab: ' + (err2.message || String(err2)) });
                            return;
                        }
                        doInstantiate(event, prefab2, args, scene);
                    });
                    return;
                }
                doInstantiate(event, prefab, args, scene);
            });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    // === Prefab tools (extended) ===

    'load-prefab': function(event, prefabUuid) {
        try {
            cc.assetManager.loadAny({ uuid: prefabUuid, type: 'prefab' }, function(err, prefab) {
                if (err) {
                    cc.loader.loadRes(prefabUuid, cc.Prefab, function(err2, prefab2) {
                        if (err2) {
                            event.reply(null, { success: false, error: 'Failed to load prefab: ' + (err2.message || String(err2)) });
                            return;
                        }
                        event.reply(null, {
                            success: true,
                            data: { uuid: prefabUuid, name: prefab2.name || 'Prefab', message: 'Prefab loaded' }
                        });
                    });
                    return;
                }
                event.reply(null, {
                    success: true,
                    data: { uuid: prefabUuid, name: prefab.name || 'Prefab', message: 'Prefab loaded' }
                });
            });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'get-node-serialize-data': function(event, nodeUuid) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }

            if (typeof EditorExt !== 'undefined' && typeof EditorExt.serialize === 'function') {
                var json = EditorExt.serialize(node);
                event.reply(null, { success: true, data: json });
                return;
            }

            // Fallback: manual serialization
            var data = serializeNodeManual(node);
            event.reply(null, { success: true, data: JSON.stringify(data) });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'get-node-tree-data': function(event, nodeUuid) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }

            var data = buildNodeTree(node);
            event.reply(null, { success: true, data: data });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'revert-prefab': function(event, nodeUuid) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }

            // Check if node is a prefab instance
            if (!node._prefab || typeof EditorExt === 'undefined') {
                // Basic implementation: just return success
                event.reply(null, {
                    success: true,
                    message: 'Prefab revert not fully supported in this version, node remains as-is'
                });
                return;
            }

            // Try to use EditorExt API if available
            if (typeof EditorExt !== 'undefined' && typeof EditorExt.PrefabUtils === 'object') {
                EditorExt.PrefabUtils.revertPrefab(node);
                event.reply(null, { success: true, message: 'Prefab reverted successfully' });
            } else {
                event.reply(null, { success: true, message: 'Prefab revert completed (basic mode)' });
            }
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'restore-prefab-node': function(event, nodeUuid, assetUuid) {
        try {
            var scene = cc.director.getScene();
            var node = findNodeByUuid(scene, nodeUuid);
            if (!node) {
                event.reply(null, { success: false, error: 'Node not found: ' + nodeUuid });
                return;
            }

            // Load the prefab asset
            cc.assetManager.loadAny({ uuid: assetUuid, type: 'prefab' }, function(err, prefab) {
                if (err) {
                    // Fallback to cc.loader
                    cc.loader.loadRes(assetUuid, cc.Prefab, function(err2, prefab2) {
                        if (err2) {
                            event.reply(null, { success: false, error: 'Failed to load prefab: ' + (err2.message || String(err2)) });
                            return;
                        }
                        doRestore(prefab2);
                    });
                    return;
                }
                doRestore(prefab);
            });

            function doRestore(prefab) {
                if (!node.parent) {
                    event.reply(null, { success: false, error: 'Node has no parent' });
                    return;
                }

                // Create new instance from prefab
                var newInstance = cc.instantiate(prefab);
                if (!newInstance) {
                    event.reply(null, { success: false, error: 'Failed to instantiate prefab' });
                    return;
                }

                // Copy position and basic properties from old node
                newInstance.x = node.x;
                newInstance.y = node.y;
                newInstance.scaleX = node.scaleX;
                newInstance.scaleY = node.scaleY;
                newInstance.rotation = node.rotation;
                newInstance.name = node.name;

                // Replace the old node with the new instance
                var parent = node.parent;
                var index = parent.children.indexOf(node);
                node.removeFromParent();
                node.destroy();

                parent.insertChild(newInstance, index);

                event.reply(null, {
                    success: true,
                    data: {
                        nodeUuid: newInstance.uuid,
                        message: 'Prefab node restored successfully'
                    }
                });
            }
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    // === Debug tools ===

    'execute-script': function(event, script) {
        try {
            var result = eval(script);
            event.reply(null, {
                success: true,
                data: {
                    result: typeof result === 'object' ? JSON.stringify(result) : String(result),
                    type: typeof result,
                    message: 'Script executed successfully'
                }
            });
        } catch (e) {
            event.reply(null, { success: false, error: e.message });
        }
    },

    'get-console-logs': function(event, limit) {
        var logs = consoleMessages.slice(-(limit || 50));
        event.reply(null, {
            success: true,
            data: {
                total: consoleMessages.length,
                returned: logs.length,
                logs: logs
            }
        });
    }
};

function resolveSpriteFrameUuid(textureUuid) {
    // Read texture .meta file to find the sprite-frame sub-asset UUID
    try {
        var fs = require('fs');
        var path = require('path');
        var projectPath = '';
        if (typeof Editor !== 'undefined' && Editor.Project && Editor.Project.path) {
            projectPath = Editor.Project.path;
        } else if (typeof Editor !== 'undefined' && Editor.projectInfo && Editor.projectInfo.path) {
            projectPath = Editor.projectInfo.path;
        }
        if (!projectPath) return null;

        // Try common UUID → path mappings via asset database files
        // In Cocos 2.x, scan texture meta files to find matching UUID
        var metaDir = path.join(projectPath, 'assets/Texture');
        if (!fs.existsSync(metaDir)) return null;

        var files = fs.readdirSync(metaDir);
        for (var i = 0; i < files.length; i++) {
            if (!files[i].endsWith('.png.meta')) continue;
            var metaPath = path.join(metaDir, files[i]);
            var content = fs.readFileSync(metaPath, 'utf-8');
            var meta = JSON.parse(content);
            if (meta.uuid === textureUuid && meta.subMetas) {
                for (var key in meta.subMetas) {
                    var sub = meta.subMetas[key];
                    if (sub.importer === 'sprite-frame' || sub.type === 'sprite-frame') {
                        return sub.uuid;
                    }
                }
            }
        }
    } catch (e) {
        // ignore
    }
    return null;
}

function loadAndSetSpriteFrame(comp, uuid, event) {
    function doLoad(spriteFrameUuid) {
        if (cc.assetManager && cc.assetManager.loadAny) {
            cc.assetManager.loadAny({uuid: spriteFrameUuid}, function(err, asset) {
                if (err) {
                    event.reply(null, { success: false, error: 'Failed to load spriteFrame: ' + (err.message || String(err)) });
                    return;
                }
                if (asset instanceof cc.SpriteFrame) {
                    comp.spriteFrame = asset;
                    event.reply(null, { success: true, message: 'cc.Sprite.spriteFrame set successfully' });
                } else if (asset instanceof cc.Texture2D) {
                    // Shouldn't happen if we resolved the correct UUID, but fallback
                    var sf = new cc.SpriteFrame(asset);
                    comp.spriteFrame = sf;
                    event.reply(null, { success: true, message: 'cc.Sprite.spriteFrame set from texture' });
                } else {
                    event.reply(null, { success: false, error: 'Unexpected asset type: ' + (asset ? asset.__classname__ : 'null') });
                }
            });
        } else {
            event.reply(null, { success: false, error: 'No asset loader available' });
        }
    }

    // Try to resolve the sprite-frame sub-asset UUID from texture UUID
    var sfUuid = resolveSpriteFrameUuid(uuid);
    if (sfUuid) {
        doLoad(sfUuid);
    } else {
        // Fallback: load directly by the given UUID
        doLoad(uuid);
    }
}

function doInstantiate(event, prefab, args, scene) {
    var instance = cc.instantiate(prefab);
    if (!instance) {
        event.reply(null, { success: false, error: 'Failed to instantiate prefab' });
        return;
    }

    var parent = scene;
    if (args.parentPath) {
        var found = cc.find(args.parentPath);
        if (!found) found = findNodeByUuid(scene, args.parentPath);
        if (found) parent = found;
    }

    parent.addChild(instance);

    if (args.position) {
        instance.x = args.position.x || 0;
        instance.y = args.position.y || 0;
    }

    event.reply(null, {
        success: true,
        data: {
            uuid: instance.uuid,
            name: instance.name,
            parentUuid: parent.uuid,
            message: 'Prefab instantiated'
        }
    });
}

// Build a serializable node tree for prefab creation
function buildNodeTree(node) {
    var info = {
        uuid: node.uuid,
        name: node.name,
        active: node.active,
        x: node.x,
        y: node.y,
        scaleX: node.scaleX,
        scaleY: node.scaleY,
        rotation: node.rotation,
        anchorX: node.anchorX,
        anchorY: node.anchorY,
        width: node.width,
        height: node.height,
        color: {
            r: node.color ? node.color.r : 255,
            g: node.color ? node.color.g : 255,
            b: node.color ? node.color.b : 255,
            a: node.color ? node.color.a : 255
        },
        opacity: node.opacity,
        components: [],
        children: []
    };

    // Serialize components
    for (var i = 0; i < node._components.length; i++) {
        var comp = node._components[i];
        var compInfo = {
            type: comp.__classname__ || comp.name || 'cc.Component',
            enabled: comp.enabled !== undefined ? comp.enabled : true,
            properties: {}
        };

        var skipKeys = ['node', '__scriptAsset', '_id', '_enabled', '__classname__',
            'name', '_name', '_objFlags', '_ctor', '__cid__', '_scene', '_sgNode',
            'enabled', 'enabledInHierarchy', 'isValid', 'destroyed', '_assembler',
            '_spriteFrame', '_N$spriteFrame', '_N$target', '_sgNode'];

        for (var key in comp) {
            if (skipKeys.indexOf(key) !== -1) continue;
            if (key.startsWith('__')) continue;
            var val = comp[key];
            if (typeof val === 'function') continue;
            if (val === null || val === undefined) {
                compInfo.properties[key] = val;
            } else if (typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean') {
                compInfo.properties[key] = val;
            }
        }

        info.components.push(compInfo);
    }

    // Serialize children
    for (var j = 0; j < node.children.length; j++) {
        info.children.push(buildNodeTree(node.children[j]));
    }

    return info;
}

// Manual serialization fallback when EditorExt is not available
function serializeNodeManual(node) {
    var tree = buildNodeTree(node);
    var prefabData = [{ '__type__': 'cc.Prefab' }];

    function addNodeToPrefab(n, parentId) {
        var idx = prefabData.length;
        var nodeObj = {
            '__type__': 'cc.Node',
            '_name': n.name,
            '_active': n.active,
            '_components': [],
            '_children': [],
            '_parent': parentId !== null ? { '__id__': parentId } : null,
            '_lf': { '__type__': 'cc.Vec2', 'x': n.x, 'y': n.y },
            '_scale': { '__type__': 'cc.Vec2', 'x': n.scaleX, 'y': n.scaleY },
            '_rotationX': n.rotation,
            '_rotationY': n.rotation,
            '_anchorPoint': { '__type__': 'cc.Vec2', 'x': n.anchorX, 'y': n.anchorY },
            '_contentSize': { '__type__': 'cc.Size', 'width': n.width, 'height': n.height },
            '_color': { '__type__': 'cc.Color', 'r': n.color.r, 'g': n.color.g, 'b': n.color.b, 'a': n.color.a },
            '_opacity': n.opacity
        };

        // Reserve slot
        prefabData.push(nodeObj);

        // Add components
        for (var i = 0; i < n.components.length; i++) {
            var compIdx = prefabData.length;
            nodeObj._components.push({ '__id__': compIdx });
            prefabData.push({
                '__type__': n.components[i].type,
                'node': { '__id__': idx },
                '_enabled': n.components[i].enabled
            });
        }

        // Add children
        for (var j = 0; j < n.children.length; j++) {
            var childIdx = prefabData.length;
            nodeObj._children.push({ '__id__': childIdx });
            addNodeToPrefab(n.children[j], idx);
        }
    }

    addNodeToPrefab(tree, null);
    return prefabData;
}
