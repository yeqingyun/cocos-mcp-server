'use strict';

/**
 * Node tools for Cocos Creator 2.x
 * Uses scene scripts for node operations (cc engine API).
 */

var PKG_NAME = 'cocos-mcp-server-2x';

function NodeTools() {}

NodeTools.prototype.getTools = function() {
    return [
        {
            name: 'create_node',
            description: 'Create a new node in the scene',
            inputSchema: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                        description: 'Node name'
                    },
                    parentPath: {
                        type: 'string',
                        description: 'Parent node path (e.g. "Canvas") or UUID. Empty for scene root.'
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
                required: ['name']
            }
        },
        {
            name: 'get_node_info',
            description: 'Get node information by UUID or path',
            inputSchema: {
                type: 'object',
                properties: {
                    uuidOrPath: {
                        type: 'string',
                        description: 'Node UUID or path (e.g. "Canvas/Label")'
                    }
                },
                required: ['uuidOrPath']
            }
        },
        {
            name: 'find_nodes',
            description: 'Find nodes by name pattern',
            inputSchema: {
                type: 'object',
                properties: {
                    pattern: {
                        type: 'string',
                        description: 'Name pattern to search'
                    },
                    exactMatch: {
                        type: 'boolean',
                        description: 'Exact match or partial match',
                        default: false
                    }
                },
                required: ['pattern']
            }
        },
        {
            name: 'get_all_nodes',
            description: 'Get all nodes in the scene with UUIDs',
            inputSchema: { type: 'object', properties: {} }
        },
        {
            name: 'set_node_property',
            description: 'Set node property (name, active, position, scale, rotation, width, height)',
            inputSchema: {
                type: 'object',
                properties: {
                    uuid: {
                        type: 'string',
                        description: 'Node UUID'
                    },
                    property: {
                        type: 'string',
                        description: 'Property name (name, active, x, y, scaleX, scaleY, rotation, width, height, anchorX, anchorY)'
                    },
                    value: {
                        description: 'Property value'
                    }
                },
                required: ['uuid', 'property', 'value']
            }
        },
        {
            name: 'delete_node',
            description: 'Delete a node from scene',
            inputSchema: {
                type: 'object',
                properties: {
                    uuid: {
                        type: 'string',
                        description: 'Node UUID to delete'
                    }
                },
                required: ['uuid']
            }
        },
        {
            name: 'move_node',
            description: 'Move node to a new parent',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: {
                        type: 'string',
                        description: 'Node UUID to move'
                    },
                    newParentUuid: {
                        type: 'string',
                        description: 'New parent node UUID'
                    },
                    siblingIndex: {
                        type: 'number',
                        description: 'Position among siblings (-1 for append)',
                        default: -1
                    }
                },
                required: ['nodeUuid', 'newParentUuid']
            }
        },
        {
            name: 'duplicate_node',
            description: 'Duplicate a node',
            inputSchema: {
                type: 'object',
                properties: {
                    uuid: {
                        type: 'string',
                        description: 'Node UUID to duplicate'
                    }
                },
                required: ['uuid']
            }
        }
    ];
};

NodeTools.prototype.execute = function(toolName, args) {
    switch (toolName) {
        case 'create_node':
            return this.createNode(args);
        case 'get_node_info':
            return this.getNodeInfo(args.uuidOrPath);
        case 'find_nodes':
            return this.findNodes(args.pattern, args.exactMatch);
        case 'get_all_nodes':
            return this.getAllNodes();
        case 'set_node_property':
            return this.setNodeProperty(args.uuid, args.property, args.value);
        case 'delete_node':
            return this.deleteNode(args.uuid);
        case 'move_node':
            return this.moveNode(args.nodeUuid, args.newParentUuid, args.siblingIndex);
        case 'duplicate_node':
            return this.duplicateNode(args.uuid);
        default:
            return Promise.reject(new Error('Unknown node tool: ' + toolName));
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

NodeTools.prototype.createNode = function(args) {
    return callSceneScript('create-node', JSON.stringify(args));
};

NodeTools.prototype.getNodeInfo = function(uuidOrPath) {
    return callSceneScript('get-node-info', uuidOrPath);
};

NodeTools.prototype.findNodes = function(pattern, exactMatch) {
    return callSceneScript('find-nodes', pattern, !!exactMatch);
};

NodeTools.prototype.getAllNodes = function() {
    return callSceneScript('get-all-nodes');
};

NodeTools.prototype.setNodeProperty = function(uuid, property, value) {
    return callSceneScript('set-node-property', uuid, property, JSON.stringify(value));
};

NodeTools.prototype.deleteNode = function(uuid) {
    return callSceneScript('delete-node', uuid);
};

NodeTools.prototype.moveNode = function(nodeUuid, newParentUuid, siblingIndex) {
    return callSceneScript('move-node', nodeUuid, newParentUuid, siblingIndex || -1);
};

NodeTools.prototype.duplicateNode = function(uuid) {
    return callSceneScript('duplicate-node', uuid);
};

exports.NodeTools = NodeTools;
