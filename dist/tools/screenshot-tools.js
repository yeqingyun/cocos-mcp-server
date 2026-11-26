"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenshotTools = void 0;
const png_encoder_1 = require("../utils/png-encoder");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
class ScreenshotTools {
    constructor() {
        this.MAX_SIZE = 2048;
    }
    getTools() {
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
    async execute(toolName, args) {
        switch (toolName) {
            case 'capture_scene':
                return await this.captureScene(args || {});
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
    async captureScene(args) {
        const clamp = (v, dflt) => {
            const n = Math.floor(Number(v));
            if (!Number.isFinite(n) || n <= 0) {
                return dflt;
            }
            return Math.max(1, Math.min(this.MAX_SIZE, n));
        };
        const width = clamp(args.width, 512);
        const height = clamp(args.height, 512);
        const cameraUuid = args.cameraUuid;
        const savePath = args.savePath;
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server',
                method: 'captureScene',
                args: [width, height, cameraUuid]
            }).then((result) => {
                if (!result || !result.success) {
                    resolve({
                        success: false,
                        error: (result && result.error) || 'Scene script capture failed'
                    });
                    return;
                }
                try {
                    // Decode raw RGBA (base64) coming from the scene process.
                    const rgba = Buffer.from(result.dataBase64, 'base64');
                    // GL readback is bottom-up; PNG is top-down -> flip vertically.
                    const flipped = (0, png_encoder_1.flipVertically)(rgba, result.width, result.height);
                    const pngBase64 = (0, png_encoder_1.encodePngBase64)(flipped, result.width, result.height);
                    const data = {
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
                }
                catch (err) {
                    resolve({ success: false, error: `Encode/save failed: ${err.message}` });
                }
            }).catch((err) => {
                resolve({ success: false, error: err.message });
            });
        });
    }
    resolveSavePath(savePath) {
        if (savePath.startsWith('db://')) {
            const rel = savePath.substring('db://'.length);
            return path.join(Editor.Project.path, rel);
        }
        return savePath;
    }
    ensureDir(filePath) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}
exports.ScreenshotTools = ScreenshotTools;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyZWVuc2hvdC10b29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9zY3JlZW5zaG90LXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHNEQUF1RTtBQUN2RSx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBRTdCOzs7Ozs7Ozs7R0FTRztBQUNILE1BQWEsZUFBZTtJQUE1QjtRQUNxQixhQUFRLEdBQUcsSUFBSSxDQUFDO0lBNEhyQyxDQUFDO0lBMUhHLFFBQVE7UUFDSixPQUFPO1lBQ0g7Z0JBQ0ksSUFBSSxFQUFFLGVBQWU7Z0JBQ3JCLFdBQVcsRUFBRSwwUkFBMFI7Z0JBQ3ZTLFdBQVcsRUFBRTtvQkFDVCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxVQUFVLEVBQUU7d0JBQ1IsS0FBSyxFQUFFOzRCQUNILElBQUksRUFBRSxRQUFROzRCQUNkLFdBQVcsRUFBRSxrQ0FBa0M7NEJBQy9DLE9BQU8sRUFBRSxHQUFHOzRCQUNaLE9BQU8sRUFBRSxDQUFDOzRCQUNWLE9BQU8sRUFBRSxJQUFJO3lCQUNoQjt3QkFDRCxNQUFNLEVBQUU7NEJBQ0osSUFBSSxFQUFFLFFBQVE7NEJBQ2QsV0FBVyxFQUFFLG1DQUFtQzs0QkFDaEQsT0FBTyxFQUFFLEdBQUc7NEJBQ1osT0FBTyxFQUFFLENBQUM7NEJBQ1YsT0FBTyxFQUFFLElBQUk7eUJBQ2hCO3dCQUNELFVBQVUsRUFBRTs0QkFDUixJQUFJLEVBQUUsUUFBUTs0QkFDZCxXQUFXLEVBQUUsa0dBQWtHO3lCQUNsSDt3QkFDRCxRQUFRLEVBQUU7NEJBQ04sSUFBSSxFQUFFLFFBQVE7NEJBQ2QsV0FBVyxFQUFFLG9HQUFvRzt5QkFDcEg7cUJBQ0o7aUJBQ0o7YUFDSjtTQUNKLENBQUM7SUFDTixDQUFDO0lBRUQsS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFnQixFQUFFLElBQVM7UUFDckMsUUFBUSxRQUFR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RUFBRSxDQUFDO1lBQy9CLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQy9DLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBQ0QsT0FBTyxRQUFRLENBQUM7SUFDcEIsQ0FBQztJQUVPLFNBQVMsQ0FBQyxRQUFnQjtRQUM5QixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ25DLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDdEIsRUFBRSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMzQyxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBN0hELDBDQTZIQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFRvb2xEZWZpbml0aW9uLCBUb29sUmVzcG9uc2UsIFRvb2xFeGVjdXRvciB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGZsaXBWZXJ0aWNhbGx5LCBlbmNvZGVQbmdCYXNlNjQgfSBmcm9tICcuLi91dGlscy9wbmctZW5jb2Rlcic7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG4vKipcbiAqIFNjcmVlbnNob3QgdG9vbDogcmVuZGVycyB0aGUgY3VycmVudCBzY2VuZSBmcm9tIGEgQ2FtZXJhIGNvbXBvbmVudCBpbnRvIGFcbiAqIFJlbmRlclRleHR1cmUsIHJlYWRzIHRoZSBwaXhlbHMsIGVuY29kZXMgYSBQTkcsIGFuZCByZXR1cm5zIGl0IGlubGluZSBhcyBhblxuICogTUNQIGltYWdlIGNvbnRlbnQgYmxvY2sgKHNvIHRoZSBBSSBjYW4gc2VlIHRoZSBwaWN0dXJlKS4gT3B0aW9uYWxseSBzYXZlc1xuICogdGhlIFBORyB0byBkaXNrLlxuICpcbiAqIE5PVEU6IHRoaXMgY2FwdHVyZXMgdGhlICpnYW1lLWNhbWVyYSB2aWV3KiAoYSBDYW1lcmEgY29tcG9uZW50IGluIHRoZSBzY2VuZSksXG4gKiBub3QgdGhlIGVkaXRvciB2aWV3cG9ydCAoZ2l6bW9zIC8gZ3JpZCAvIHNlbGVjdGlvbiBoaWdobGlnaHQpLiBUaGUgc2NlbmUgbXVzdFxuICogY29udGFpbiBhdCBsZWFzdCBvbmUgQ2FtZXJhLlxuICovXG5leHBvcnQgY2xhc3MgU2NyZWVuc2hvdFRvb2xzIGltcGxlbWVudHMgVG9vbEV4ZWN1dG9yIHtcbiAgICBwcml2YXRlIHJlYWRvbmx5IE1BWF9TSVpFID0gMjA0ODtcblxuICAgIGdldFRvb2xzKCk6IFRvb2xEZWZpbml0aW9uW10ge1xuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjYXB0dXJlX3NjZW5lJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0NhcHR1cmUgdGhlIGN1cnJlbnQgc2NlbmUgYXMgYSBQTkcgc2NyZWVuc2hvdCBieSByZW5kZXJpbmcgYSBDYW1lcmEgY29tcG9uZW50IGludG8gYSBSZW5kZXJUZXh0dXJlLiBSZXR1cm5zIHRoZSBpbWFnZSBpbmxpbmUgKGJhc2U2NCBQTkcpIHNvIGl0IGNhbiBiZSB2aWV3ZWQsIGFuZCBvcHRpb25hbGx5IHNhdmVzIGl0IHRvIGRpc2suIENhcHR1cmVzIHRoZSBnYW1lLWNhbWVyYSB2aWV3LCBub3QgdGhlIGVkaXRvciB2aWV3cG9ydC4gVGhlIHNjZW5lIG11c3QgY29udGFpbiBhIENhbWVyYS4nLFxuICAgICAgICAgICAgICAgIGlucHV0U2NoZW1hOiB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQ2FwdHVyZSB3aWR0aCBpbiBwaXhlbHMgKDEtMjA0OCknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6IDUxMixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaW5pbXVtOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heGltdW06IDIwNDhcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0NhcHR1cmUgaGVpZ2h0IGluIHBpeGVscyAoMS0yMDQ4KScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDogNTEyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pbmltdW06IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF4aW11bTogMjA0OFxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbWVyYVV1aWQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1VVSUQgb2YgdGhlIENhbWVyYSBub2RlIHRvIHJlbmRlciBmcm9tLiBJZiBvbWl0dGVkLCB0aGUgZmlyc3QgQ2FtZXJhIGZvdW5kIGluIHRoZSBzY2VuZSBpcyB1c2VkLidcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBzYXZlUGF0aDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnT3B0aW9uYWwgcGF0aCB0byBzYXZlIHRoZSBQTkcgZmlsZS4gQWJzb2x1dGUgcGF0aCBvciBkYjovLyBwYXRoIChlLmcuIGRiOi8vYXNzZXRzL3NjcmVlbnNob3QucG5nKS4nXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIF07XG4gICAgfVxuXG4gICAgYXN5bmMgZXhlY3V0ZSh0b29sTmFtZTogc3RyaW5nLCBhcmdzOiBhbnkpOiBQcm9taXNlPFRvb2xSZXNwb25zZT4ge1xuICAgICAgICBzd2l0Y2ggKHRvb2xOYW1lKSB7XG4gICAgICAgICAgICBjYXNlICdjYXB0dXJlX3NjZW5lJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5jYXB0dXJlU2NlbmUoYXJncyB8fCB7fSk7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biB0b29sOiAke3Rvb2xOYW1lfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjYXB0dXJlU2NlbmUoYXJnczogYW55KTogUHJvbWlzZTxUb29sUmVzcG9uc2U+IHtcbiAgICAgICAgY29uc3QgY2xhbXAgPSAodjogYW55LCBkZmx0OiBudW1iZXIpOiBudW1iZXIgPT4ge1xuICAgICAgICAgICAgY29uc3QgbiA9IE1hdGguZmxvb3IoTnVtYmVyKHYpKTtcbiAgICAgICAgICAgIGlmICghTnVtYmVyLmlzRmluaXRlKG4pIHx8IG4gPD0gMCkgeyByZXR1cm4gZGZsdDsgfVxuICAgICAgICAgICAgcmV0dXJuIE1hdGgubWF4KDEsIE1hdGgubWluKHRoaXMuTUFYX1NJWkUsIG4pKTtcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3Qgd2lkdGggPSBjbGFtcChhcmdzLndpZHRoLCA1MTIpO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBjbGFtcChhcmdzLmhlaWdodCwgNTEyKTtcbiAgICAgICAgY29uc3QgY2FtZXJhVXVpZDogc3RyaW5nIHwgdW5kZWZpbmVkID0gYXJncy5jYW1lcmFVdWlkO1xuICAgICAgICBjb25zdCBzYXZlUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkID0gYXJncy5zYXZlUGF0aDtcblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJyxcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdjYXB0dXJlU2NlbmUnLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFt3aWR0aCwgaGVpZ2h0LCBjYW1lcmFVdWlkXVxuICAgICAgICAgICAgfSkudGhlbigocmVzdWx0OiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXJlc3VsdCB8fCAhcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiAocmVzdWx0ICYmIHJlc3VsdC5lcnJvcikgfHwgJ1NjZW5lIHNjcmlwdCBjYXB0dXJlIGZhaWxlZCdcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAvLyBEZWNvZGUgcmF3IFJHQkEgKGJhc2U2NCkgY29taW5nIGZyb20gdGhlIHNjZW5lIHByb2Nlc3MuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJnYmE6IFVpbnQ4QXJyYXkgPSBCdWZmZXIuZnJvbShyZXN1bHQuZGF0YUJhc2U2NCwgJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgICAgICAgICAvLyBHTCByZWFkYmFjayBpcyBib3R0b20tdXA7IFBORyBpcyB0b3AtZG93biAtPiBmbGlwIHZlcnRpY2FsbHkuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZsaXBwZWQgPSBmbGlwVmVydGljYWxseShyZ2JhLCByZXN1bHQud2lkdGgsIHJlc3VsdC5oZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwbmdCYXNlNjQgPSBlbmNvZGVQbmdCYXNlNjQoZmxpcHBlZCwgcmVzdWx0LndpZHRoLCByZXN1bHQuaGVpZ2h0KTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkYXRhOiBhbnkgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3aWR0aDogcmVzdWx0LndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiByZXN1bHQuaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgY2FtZXJhVXVpZDogcmVzdWx0LmNhbWVyYVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmFOYW1lOiByZXN1bHQuY2FtZXJhTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBuZ1NpemVCeXRlczogTWF0aC5mbG9vcihwbmdCYXNlNjQubGVuZ3RoICogMyAvIDQpXG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHNhdmVQYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXNvbHZlZCA9IHRoaXMucmVzb2x2ZVNhdmVQYXRoKHNhdmVQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZW5zdXJlRGlyKHJlc29sdmVkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocmVzb2x2ZWQsIEJ1ZmZlci5mcm9tKHBuZ0Jhc2U2NCwgJ2Jhc2U2NCcpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEuc2F2ZWRQYXRoID0gcmVzb2x2ZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgU2NlbmUgY2FwdHVyZWQgZnJvbSBjYW1lcmEgJyR7ZGF0YS5jYW1lcmFOYW1lfScgKCR7ZGF0YS53aWR0aH14JHtkYXRhLmhlaWdodH0pYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICsgKGRhdGEuc2F2ZWRQYXRoID8gYCwgc2F2ZWQgdG8gJHtkYXRhLnNhdmVkUGF0aH1gIDogJyAocmV0dXJuZWQgaW5saW5lKScpLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGltYWdlOiB7IGRhdGE6IHBuZ0Jhc2U2NCwgbWltZVR5cGU6ICdpbWFnZS9wbmcnIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEVuY29kZS9zYXZlIGZhaWxlZDogJHtlcnIubWVzc2FnZX1gIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZXNvbHZlU2F2ZVBhdGgoc2F2ZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIGlmIChzYXZlUGF0aC5zdGFydHNXaXRoKCdkYjovLycpKSB7XG4gICAgICAgICAgICBjb25zdCByZWwgPSBzYXZlUGF0aC5zdWJzdHJpbmcoJ2RiOi8vJy5sZW5ndGgpO1xuICAgICAgICAgICAgcmV0dXJuIHBhdGguam9pbihFZGl0b3IuUHJvamVjdC5wYXRoLCByZWwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzYXZlUGF0aDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGVuc3VyZURpcihmaWxlUGF0aDogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGRpciA9IHBhdGguZGlybmFtZShmaWxlUGF0aCk7XG4gICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhkaXIpKSB7XG4gICAgICAgICAgICBmcy5ta2RpclN5bmMoZGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==