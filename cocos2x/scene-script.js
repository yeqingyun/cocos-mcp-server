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
    for (var i = 0; i < node._components.length; i++) {
        var comp = node._components[i];
        var className = comp.__classname__ || comp.name || '';
        if (className === type || className.indexOf(type) !== -1) {
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
