import { ToolDefinition, ToolResponse, ToolExecutor } from '../types';
import { flipVertically, encodePngBase64 } from '../utils/png-encoder';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Screenshot tool: renders the current scene from a Camera component into a
 * RenderTexture, reads the pixels, encodes a PNG, and returns it inline as an
 * MCP image content block (so the AI can see the picture). Optionally saves
 * the PNG to disk.
 *
 * NOTE: this captures the *game-camera view* (a Camera component in the scene),
 * not the editor viewport (gizmos / grid / selection highlight). The scene must
 * contain at least one Camera.
 */
export class ScreenshotTools implements ToolExecutor {
    private readonly MAX_SIZE = 2048;

    getTools(): ToolDefinition[] {
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
                        savePath: {
                            type: 'string',
                            description: 'Optional path to save the PNG file. Absolute path or db:// path (e.g. db://assets/screenshot.png).'
                        }
                    }
                }
            }
        ];
    }

    async execute(toolName: string, args: any): Promise<ToolResponse> {
        switch (toolName) {
            case 'capture_scene':
                return await this.captureScene(args || {});
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }

    private async captureScene(args: any): Promise<ToolResponse> {
        const clamp = (v: any, dflt: number): number => {
            const n = Math.floor(Number(v));
            if (!Number.isFinite(n) || n <= 0) { return dflt; }
            return Math.max(1, Math.min(this.MAX_SIZE, n));
        };
        const width = clamp(args.width, 512);
        const height = clamp(args.height, 512);
        const cameraUuid: string | undefined = args.cameraUuid;
        const savePath: string | undefined = args.savePath;

        return new Promise((resolve) => {
            Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server',
                method: 'captureScene',
                args: [width, height, cameraUuid]
            }).then((result: any) => {
                if (!result || !result.success) {
                    resolve({
                        success: false,
                        error: (result && result.error) || 'Scene script capture failed'
                    });
                    return;
                }

                try {
                    // Decode raw RGBA (base64) coming from the scene process.
                    const rgba: Uint8Array = Buffer.from(result.dataBase64, 'base64');
                    // GL readback is bottom-up; PNG is top-down -> flip vertically.
                    const flipped = flipVertically(rgba, result.width, result.height);
                    const pngBase64 = encodePngBase64(flipped, result.width, result.height);

                    const data: any = {
                        width: result.width,
                        height: result.height,
                        cameraUuid: result.cameraUuid,
                        cameraName: result.cameraName,
                        pngSizeBytes: Math.floor(pngBase64.length * 3 / 4)
                    };

                    if (savePath) {
                        const resolved = this.resolveSavePath(savePath);
                        this.ensureDir(resolved);
                        fs.writeFileSync(resolved, Buffer.from(pngBase64, 'base64'));
                        data.savedPath = resolved;
                    }

                    resolve({
                        success: true,
                        message: `Scene captured from camera '${data.cameraName}' (${data.width}x${data.height})`
                            + (data.savedPath ? `, saved to ${data.savedPath}` : ' (returned inline)'),
                        data,
                        image: { data: pngBase64, mimeType: 'image/png' }
                    });
                } catch (err: any) {
                    resolve({ success: false, error: `Encode/save failed: ${err.message}` });
                }
            }).catch((err: Error) => {
                resolve({ success: false, error: err.message });
            });
        });
    }

    private resolveSavePath(savePath: string): string {
        if (savePath.startsWith('db://')) {
            const rel = savePath.substring('db://'.length);
            return path.join(Editor.Project.path, rel);
        }
        return savePath;
    }

    private ensureDir(filePath: string): void {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}
