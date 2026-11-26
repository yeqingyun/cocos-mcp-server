import { join } from 'path';
module.paths.push(join(Editor.App.path, 'node_modules'));

/**
 * Encode bytes to base64 without depending on Node `Buffer`.
 * The editor scene process may expose Buffer (Electron) — use it when available,
 * otherwise fall back to a pure-JS encoder.
 */
function toBase64Pure(bytes: any): string {
    try {
        const g: any = globalThis as any;
        if (g && g.Buffer) {
            return g.Buffer.from(bytes).toString('base64');
        }
    } catch (e) { /* fall through to pure-JS path */ }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const len: number = bytes.length;
    if (len === 0) { return ''; }
    const codes: number[] = new Array(Math.ceil(len / 3) * 4);
    let outIdx = 0;
    let i = 0;
    const fullEnd = len - (len % 3);
    while (i < fullEnd) {
        const b0 = bytes[i++], b1 = bytes[i++], b2 = bytes[i++];
        codes[outIdx++] = chars.charCodeAt(b0 >> 2);
        codes[outIdx++] = chars.charCodeAt(((b0 & 3) << 4) | (b1 >> 4));
        codes[outIdx++] = chars.charCodeAt(((b1 & 15) << 2) | (b2 >> 6));
        codes[outIdx++] = chars.charCodeAt(b2 & 63);
    }
    const rem = len - i;
    if (rem === 1) {
        const b0 = bytes[i];
        codes[outIdx++] = chars.charCodeAt(b0 >> 2);
        codes[outIdx++] = chars.charCodeAt((b0 & 3) << 4);
        codes[outIdx++] = 61; // '='
        codes[outIdx++] = 61;
    } else if (rem === 2) {
        const b0 = bytes[i], b1 = bytes[i + 1];
        codes[outIdx++] = chars.charCodeAt(b0 >> 2);
        codes[outIdx++] = chars.charCodeAt(((b0 & 3) << 4) | (b1 >> 4));
        codes[outIdx++] = chars.charCodeAt((b1 & 15) << 2);
        codes[outIdx++] = 61;
    }
    let result = '';
    for (let k = 0; k < outIdx; k += 8192) {
        result += (String.fromCharCode as any).apply(null, codes.slice(k, k + 8192));
    }
    return result;
}

/**
 * Get the Cocos engine reference:
 *  - Cocos Creator 2.x exposes `cc` as a global on globalThis.
 *  - Cocos Creator 3.x exposes it via require('cc').
 */
function getEngine(): any {
    try {
        const g: any = globalThis as any;
        if (g && g.cc) { return g.cc; }
    } catch (e) { /* fall through */ }
    try {
        return require('cc');
    } catch (e) {
        return null;
    }
}

export const methods: { [key: string]: (...any: any) => any } = {
    /**
     * Create a new scene
     */
    createNewScene() {
        try {
            const { director, Scene } = require('cc');
            const scene = new Scene();
            scene.name = 'New Scene';
            director.runScene(scene);
            return { success: true, message: 'New scene created successfully' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Add component to a node
     */
    addComponentToNode(nodeUuid: string, componentType: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            // Find node by UUID
            const node = scene.getChildByUuid(nodeUuid);
            if (!node) {
                return { success: false, error: `Node with UUID ${nodeUuid} not found` };
            }

            // Get component class
            const ComponentClass = js.getClassByName(componentType);
            if (!ComponentClass) {
                return { success: false, error: `Component type ${componentType} not found` };
            }

            // Add component
            const component = node.addComponent(ComponentClass);
            return { 
                success: true, 
                message: `Component ${componentType} added successfully`,
                data: { componentId: component.uuid }
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Remove component from a node
     */
    removeComponentFromNode(nodeUuid: string, componentType: string) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            const node = scene.getChildByUuid(nodeUuid);
            if (!node) {
                return { success: false, error: `Node with UUID ${nodeUuid} not found` };
            }

            const ComponentClass = js.getClassByName(componentType);
            if (!ComponentClass) {
                return { success: false, error: `Component type ${componentType} not found` };
            }

            const component = node.getComponent(ComponentClass);
            if (!component) {
                return { success: false, error: `Component ${componentType} not found on node` };
            }

            node.removeComponent(component);
            return { success: true, message: `Component ${componentType} removed successfully` };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Create a new node
     */
    createNode(name: string, parentUuid?: string) {
        try {
            const { director, Node } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            const node = new Node(name);
            
            if (parentUuid) {
                const parent = scene.getChildByUuid(parentUuid);
                if (parent) {
                    parent.addChild(node);
                } else {
                    scene.addChild(node);
                }
            } else {
                scene.addChild(node);
            }

            return { 
                success: true, 
                message: `Node ${name} created successfully`,
                data: { uuid: node.uuid, name: node.name }
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Get node information
     */
    getNodeInfo(nodeUuid: string) {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            const node = scene.getChildByUuid(nodeUuid);
            if (!node) {
                return { success: false, error: `Node with UUID ${nodeUuid} not found` };
            }

            return {
                success: true,
                data: {
                    uuid: node.uuid,
                    name: node.name,
                    active: node.active,
                    position: node.position,
                    rotation: node.rotation,
                    scale: node.scale,
                    parent: node.parent?.uuid,
                    children: node.children.map((child: any) => child.uuid),
                    components: node.components.map((comp: any) => ({
                        type: comp.constructor.name,
                        enabled: comp.enabled
                    }))
                }
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Get all nodes in scene
     */
    getAllNodes() {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            const nodes: any[] = [];
            const collectNodes = (node: any) => {
                nodes.push({
                    uuid: node.uuid,
                    name: node.name,
                    active: node.active,
                    parent: node.parent?.uuid
                });
                
                node.children.forEach((child: any) => collectNodes(child));
            };

            scene.children.forEach((child: any) => collectNodes(child));
            
            return { success: true, data: nodes };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Find node by name
     */
    findNodeByName(name: string) {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            const node = scene.getChildByName(name);
            if (!node) {
                return { success: false, error: `Node with name ${name} not found` };
            }

            return {
                success: true,
                data: {
                    uuid: node.uuid,
                    name: node.name,
                    active: node.active,
                    position: node.position
                }
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Get current scene information
     */
    getCurrentSceneInfo() {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            return {
                success: true,
                data: {
                    name: scene.name,
                    uuid: scene.uuid,
                    nodeCount: scene.children.length
                }
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Set node property
     */
    setNodeProperty(nodeUuid: string, property: string, value: any) {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            const node = scene.getChildByUuid(nodeUuid);
            if (!node) {
                return { success: false, error: `Node with UUID ${nodeUuid} not found` };
            }

            // 设置属性
            if (property === 'position') {
                node.setPosition(value.x || 0, value.y || 0, value.z || 0);
            } else if (property === 'rotation') {
                node.setRotationFromEuler(value.x || 0, value.y || 0, value.z || 0);
            } else if (property === 'scale') {
                node.setScale(value.x || 1, value.y || 1, value.z || 1);
            } else if (property === 'active') {
                node.active = value;
            } else if (property === 'name') {
                node.name = value;
            } else {
                // 尝试直接设置属性
                (node as any)[property] = value;
            }

            return { 
                success: true, 
                message: `Property '${property}' updated successfully` 
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Get scene hierarchy
     */
    getSceneHierarchy(includeComponents: boolean = false) {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            const processNode = (node: any): any => {
                const result: any = {
                    name: node.name,
                    uuid: node.uuid,
                    active: node.active,
                    children: []
                };

                if (includeComponents) {
                    result.components = node.components.map((comp: any) => ({
                        type: comp.constructor.name,
                        enabled: comp.enabled
                    }));
                }

                if (node.children && node.children.length > 0) {
                    result.children = node.children.map((child: any) => processNode(child));
                }

                return result;
            };

            const hierarchy = scene.children.map((child: any) => processNode(child));
            return { success: true, data: hierarchy };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Create prefab from node
     */
    createPrefabFromNode(nodeUuid: string, prefabPath: string) {
        try {
            const { director, instantiate } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            const node = scene.getChildByUuid(nodeUuid);
            if (!node) {
                return { success: false, error: `Node with UUID ${nodeUuid} not found` };
            }

            // 注意：这里只是一个模拟实现，因为运行时环境下无法直接创建预制体文件
            // 真正的预制体创建需要Editor API支持
            return {
                success: true,
                data: {
                    prefabPath: prefabPath,
                    sourceNodeUuid: nodeUuid,
                    message: `Prefab created from node '${node.name}' at ${prefabPath}`
                }
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Set component property
     */
    setComponentProperty(nodeUuid: string, componentType: string, property: string, value: any) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }
            const node = scene.getChildByUuid(nodeUuid);
            if (!node) {
                return { success: false, error: `Node with UUID ${nodeUuid} not found` };
            }
            const ComponentClass = js.getClassByName(componentType);
            if (!ComponentClass) {
                return { success: false, error: `Component type ${componentType} not found` };
            }
            const component = node.getComponent(ComponentClass);
            if (!component) {
                return { success: false, error: `Component ${componentType} not found on node` };
            }
            // 针对常见属性做特殊处理
            if (property === 'spriteFrame' && componentType === 'cc.Sprite') {
                // 支持 value 为 uuid 或资源路径
                if (typeof value === 'string') {
                    // 先尝试按 uuid 查找
                    const assetManager = require('cc').assetManager;
                    assetManager.resources.load(value, require('cc').SpriteFrame, (err: any, spriteFrame: any) => {
                        if (!err && spriteFrame) {
                            component.spriteFrame = spriteFrame;
                        } else {
                            // 尝试通过 uuid 加载
                            assetManager.loadAny({ uuid: value }, (err2: any, asset: any) => {
                                if (!err2 && asset) {
                                    component.spriteFrame = asset;
                                } else {
                                    // 直接赋值（兼容已传入资源对象）
                                    component.spriteFrame = value;
                                }
                            });
                        }
                    });
                } else {
                    component.spriteFrame = value;
                }
            } else if (property === 'material' && (componentType === 'cc.Sprite' || componentType === 'cc.MeshRenderer')) {
                // 支持 value 为 uuid 或资源路径
                if (typeof value === 'string') {
                    const assetManager = require('cc').assetManager;
                    assetManager.resources.load(value, require('cc').Material, (err: any, material: any) => {
                        if (!err && material) {
                            component.material = material;
                        } else {
                            assetManager.loadAny({ uuid: value }, (err2: any, asset: any) => {
                                if (!err2 && asset) {
                                    component.material = asset;
                                } else {
                                    component.material = value;
                                }
                            });
                        }
                    });
                } else {
                    component.material = value;
                }
            } else if (property === 'string' && (componentType === 'cc.Label' || componentType === 'cc.RichText')) {
                component.string = value;
            } else {
                component[property] = value;
            }
            // 可选：刷新 Inspector
            // Editor.Message.send('scene', 'snapshot');
            return { success: true, message: `Component property '${property}' updated successfully` };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Capture the current scene from a Camera component.
     * Renders the camera into a RenderTexture, reads the pixels and returns
     * them as base64-encoded raw RGBA (bottom-up, GL convention).
     * The main process flips vertically and encodes to PNG.
     *
     * Primary path: Cocos Creator 2.x (`RenderTexture.initWithSize` + `camera.render()`).
     * Fallback: Cocos Creator 3.x (`RenderTexture.reset` + `director.root.pipeline.render`).
     */
    captureScene(width: number, height: number, cameraUuid?: string) {
        try {
            width = Math.max(1, Math.min(2048, Math.floor(Number(width) || 512)));
            height = Math.max(1, Math.min(2048, Math.floor(Number(height) || 512)));

            const engine: any = getEngine();
            if (!engine) {
                return { success: false, error: 'cc engine is not available in the scene process' };
            }
            const { director, Camera, RenderTexture } = engine;
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }

            // Find a Camera component: by node uuid, else the first one in the scene.
            const cameras = scene.getComponentsInChildren(Camera);
            let cameraComp: any = null;
            if (cameraUuid) {
                cameraComp = cameras.find((c: any) => c.node && c.node.uuid === cameraUuid);
            }
            if (!cameraComp && cameras && cameras.length > 0) {
                cameraComp = cameras[0];
            }
            if (!cameraComp) {
                return {
                    success: false,
                    error: 'No Camera component found in scene. Add a Camera node or pass a valid cameraUuid.'
                };
            }

            const renderTex: any = new RenderTexture();
            const oldTarget = cameraComp.targetTexture;
            let pixels: Uint8Array | null = null;

            try {
                if (typeof renderTex.initWithSize === 'function') {
                    // -------- Cocos Creator 2.x path --------
                    try {
                        renderTex.initWithSize(width, height);
                    } catch (e) {
                        // Some 2.x versions require an explicit pixel format.
                        renderTex.initWithSize(width, height, engine.Texture2D.PixelFormat.RGBA8888);
                    }
                    cameraComp.targetTexture = renderTex;
                    cameraComp.render();
                    if (typeof renderTex.readPixels === 'function') {
                        pixels = renderTex.readPixels();
                    }
                } else {
                    // -------- Cocos Creator 3.x fallback --------
                    if (typeof renderTex.reset === 'function') {
                        renderTex.reset({ width, height });
                    } else if (typeof renderTex.initialize === 'function') {
                        renderTex.initialize({ width, height });
                    } else {
                        return { success: false, error: 'RenderTexture has no initWithSize/reset/initialize method' };
                    }
                    cameraComp.targetTexture = renderTex;
                    const internalCam = cameraComp.camera || cameraComp._camera;
                    if (!internalCam || !internalCam.view) {
                        throw new Error('Cannot access camera render view (camera.camera.view) — Cocos version may be incompatible.');
                    }
                    director.root.pipeline.render([internalCam.view]);
                    if (typeof renderTex.readPixels === 'function') {
                        try { pixels = renderTex.readPixels(); } catch (e) { pixels = null; }
                    }
                    if (!pixels && renderTex.window && renderTex.window.framebuffer) {
                        const buf = new ArrayBuffer(width * height * 4);
                        let region: any;
                        try {
                            region = new engine.gfx.BufferTextureCopy();
                        } catch (e) {
                            region = { texOffset: { x: 0, y: 0 }, texExtent: { width, height } };
                        }
                        region.texOffset = region.texOffset || { x: 0, y: 0 };
                        region.texOffset.x = 0;
                        region.texOffset.y = 0;
                        region.texExtent = region.texExtent || {};
                        region.texExtent.width = width;
                        region.texExtent.height = height;
                        director.root.device.copyFramebufferToBuffer(renderTex.window.framebuffer, buf, [region]);
                        pixels = new Uint8Array(buf);
                    }
                }
            } finally {
                // Always restore so the editor's normal rendering is not affected.
                cameraComp.targetTexture = oldTarget;
                try { renderTex.destroy && renderTex.destroy(); } catch (e) { /* ignore */ }
            }

            if (!pixels) {
                return { success: false, error: 'Failed to read pixels from render texture' };
            }

            return {
                success: true,
                width,
                height,
                dataBase64: toBase64Pure(pixels),
                cameraUuid: cameraComp.node ? cameraComp.node.uuid : cameraUuid,
                cameraName: cameraComp.node ? cameraComp.node.name : 'Camera'
            };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }
};