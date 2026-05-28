'use strict';

/**
 * Component tools for Cocos Creator 2.x
 * Uses scene scripts for component operations (cc engine API).
 */

var PKG_NAME = 'cocos-mcp-server-2x';

function ComponentTools() {}

ComponentTools.prototype.getTools = function() {
    return [
        {
            name: 'add_component',
            description: 'Add a component to a node',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: {
                        type: 'string',
                        description: 'Target node UUID'
                    },
                    componentType: {
                        type: 'string',
                        description: 'Component type (e.g. cc.Sprite, cc.Label, cc.Button)'
                    }
                },
                required: ['nodeUuid', 'componentType']
            }
        },
        {
            name: 'remove_component',
            description: 'Remove a component from a node',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: {
                        type: 'string',
                        description: 'Node UUID'
                    },
                    componentType: {
                        type: 'string',
                        description: 'Component type to remove'
                    }
                },
                required: ['nodeUuid', 'componentType']
            }
        },
        {
            name: 'get_components',
            description: 'Get all components of a node',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: {
                        type: 'string',
                        description: 'Node UUID'
                    }
                },
                required: ['nodeUuid']
            }
        },
        {
            name: 'set_component_property',
            description: 'Set component property value',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: {
                        type: 'string',
                        description: 'Node UUID'
                    },
                    componentType: {
                        type: 'string',
                        description: 'Component type (e.g. cc.Label)'
                    },
                    property: {
                        type: 'string',
                        description: 'Property name (e.g. string, fontSize, _spriteFrame)'
                    },
                    value: {
                        description: 'Property value'
                    }
                },
                required: ['nodeUuid', 'componentType', 'property', 'value']
            }
        },
        {
            name: 'get_component_info',
            description: 'Get detailed component information',
            inputSchema: {
                type: 'object',
                properties: {
                    nodeUuid: {
                        type: 'string',
                        description: 'Node UUID'
                    },
                    componentType: {
                        type: 'string',
                        description: 'Component type'
                    }
                },
                required: ['nodeUuid', 'componentType']
            }
        },
        {
            name: 'get_available_components',
            description: 'Get list of available component types',
            inputSchema: {
                type: 'object',
                properties: {
                    category: {
                        type: 'string',
                        description: 'Component category',
                        enum: ['all', 'renderer', 'ui', 'physics', 'audio', 'layout'],
                        default: 'all'
                    }
                }
            }
        }
    ];
};

ComponentTools.prototype.execute = function(toolName, args) {
    switch (toolName) {
        case 'add_component':
            return this.addComponent(args.nodeUuid, args.componentType);
        case 'remove_component':
            return this.removeComponent(args.nodeUuid, args.componentType);
        case 'get_components':
            return this.getComponents(args.nodeUuid);
        case 'set_component_property':
            return this.setComponentProperty(args.nodeUuid, args.componentType, args.property, args.value);
        case 'get_component_info':
            return this.getComponentInfo(args.nodeUuid, args.componentType);
        case 'get_available_components':
            return this.getAvailableComponents(args.category);
        default:
            return Promise.reject(new Error('Unknown component tool: ' + toolName));
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

ComponentTools.prototype.addComponent = function(nodeUuid, componentType) {
    return callSceneScript('add-component', nodeUuid, componentType);
};

ComponentTools.prototype.removeComponent = function(nodeUuid, componentType) {
    return callSceneScript('remove-component', nodeUuid, componentType);
};

ComponentTools.prototype.getComponents = function(nodeUuid) {
    return callSceneScript('get-components', nodeUuid);
};

ComponentTools.prototype.setComponentProperty = function(nodeUuid, componentType, property, value) {
    return callSceneScript('set-component-property', nodeUuid, componentType, property, JSON.stringify(value));
};

ComponentTools.prototype.getComponentInfo = function(nodeUuid, componentType) {
    return callSceneScript('get-component-info', nodeUuid, componentType);
};

ComponentTools.prototype.getAvailableComponents = function(category) {
    var categories = {
        renderer: ['cc.Sprite', 'cc.Label', 'cc.RichText', 'cc.Mask', 'cc.Graphics', 'cc.TiledMap', 'cc.SpineSkeleton', 'cc.DragonBones'],
        ui: ['cc.Button', 'cc.Toggle', 'cc.Slider', 'cc.ScrollView', 'cc.EditBox', 'cc.ProgressBar', 'cc.PageView'],
        physics: ['cc.RigidBody', 'cc.BoxCollider', 'cc.CircleCollider', 'cc.PolygonCollider'],
        audio: ['cc.AudioSource'],
        layout: ['cc.Layout', 'cc.Widget', 'cc.HorizontalLayout', 'cc.VerticalLayout', 'cc.GridLayout']
    };

    var components = [];
    if (!category || category === 'all') {
        for (var cat in categories) {
            if (categories.hasOwnProperty(cat)) {
                components = components.concat(categories[cat]);
            }
        }
    } else if (categories[category]) {
        components = categories[category];
    }

    return Promise.resolve({
        success: true,
        data: { category: category || 'all', components: components }
    });
};

exports.ComponentTools = ComponentTools;
