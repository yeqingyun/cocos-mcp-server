'use strict';

/**
 * Project tools for Cocos Creator 2.x
 * Uses Editor.Project, Editor.assetdb for project and asset operations.
 */

var fs = require('fs');
var path = require('path');

function ProjectTools() {}

ProjectTools.prototype.getTools = function() {
    return [
        {
            name: 'get_project_info',
            description: 'Get project information',
            inputSchema: { type: 'object', properties: {} }
        },
        {
            name: 'get_assets',
            description: 'Get assets by type with pagination support, optional path filtering',
            inputSchema: {
                type: 'object',
                properties: {
                    type: {
                        type: 'string',
                        description: 'Asset type filter',
                        enum: ['all', 'scene', 'prefab', 'script', 'texture', 'audio', 'animation'],
                        default: 'all'
                    },
                    path: {
                        type: 'string',
                        description: 'Filter by path pattern (e.g. "db://assets/res/hall/**/*.png")'
                    },
                    limit: {
                        type: 'number',
                        description: 'Maximum number of assets to return (default: 100, max: 1000)',
                        default: 100
                    },
                    offset: {
                        type: 'number',
                        description: 'Number of assets to skip (for pagination, default: 0)',
                        default: 0
                    },
                    countOnly: {
                        type: 'boolean',
                        description: 'Return only the count without asset list (much faster)',
                        default: false
                    }
                }
            }
        },
        {
            name: 'get_asset_info',
            description: 'Get asset information by UUID',
            inputSchema: {
                type: 'object',
                properties: {
                    uuid: {
                        type: 'string',
                        description: 'Asset UUID'
                    }
                },
                required: ['uuid']
            }
        },
        {
            name: 'query_asset_uuid',
            description: 'Get asset UUID from URL',
            inputSchema: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'Asset URL (e.g. db://assets/textures/icon.png)'
                    }
                },
                required: ['url']
            }
        },
        {
            name: 'refresh_assets',
            description: 'Refresh asset database',
            inputSchema: {
                type: 'object',
                properties: {
                    folder: {
                        type: 'string',
                        description: 'Folder to refresh (optional)'
                    }
                }
            }
        },
        {
            name: 'create_asset',
            description: 'Create a new asset file',
            inputSchema: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'Asset URL (e.g. db://assets/newScript.js)'
                    },
                    content: {
                        type: 'string',
                        description: 'File content'
                    }
                },
                required: ['url']
            }
        },
        {
            name: 'delete_asset',
            description: 'Delete an asset',
            inputSchema: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'Asset URL to delete'
                    }
                },
                required: ['url']
            }
        }
    ];
};

ProjectTools.prototype.execute = function(toolName, args) {
    switch (toolName) {
        case 'get_project_info':
            return this.getProjectInfo();
        case 'get_assets':
            return this.getAssets(args.type, args.path, args.limit, args.offset, args.countOnly);
        case 'get_asset_info':
            return this.getAssetInfo(args.uuid);
        case 'query_asset_uuid':
            return this.queryAssetUuid(args.url);
        case 'refresh_assets':
            return this.refreshAssets(args.folder);
        case 'create_asset':
            return this.createAsset(args.url, args.content);
        case 'delete_asset':
            return this.deleteAsset(args.url);
        default:
            return Promise.reject(new Error('Unknown project tool: ' + toolName));
    }
};

ProjectTools.prototype.getProjectInfo = function() {
    var info = {
        editor: {
            version: (Editor.versions && Editor.versions.editor) || 'Unknown',
            cocosVersion: (Editor.versions && Editor.versions['cocos2d-html5']) || 'Unknown',
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version
        },
        project: {},
        memory: process.memoryUsage(),
        uptime: process.uptime()
    };

    if (Editor.Project && Editor.Project.path) {
        info.project.name = path.basename(Editor.Project.path);
        info.project.path = Editor.Project.path;
    } else if (Editor.projectInfo && Editor.projectInfo.path) {
        info.project.name = path.basename(Editor.projectInfo.path);
        info.project.path = Editor.projectInfo.path;
    }

    return Promise.resolve({ success: true, data: info });
};

ProjectTools.prototype.getAssets = function(type, path, limit, offset, countOnly) {
    var typeMap = {
        'scene': 'scene',
        'prefab': 'prefab',
        'script': 'javascript',
        'texture': 'texture',
        'audio': 'audio',
        'animation': 'animation-clip'
    };

    var queryType = typeMap[type] || null;
    var maxLimit = 1000;
    var defaultLimit = 100;

    // Build pattern for path filtering (only if path is explicitly provided)
    var pattern = path || null;

    // Apply limits
    limit = limit || defaultLimit;
    if (limit > maxLimit) {
        limit = maxLimit;
    }
    offset = offset || 0;

    return new Promise(function(resolve) {
        Editor.assetdb.queryAssets(pattern, queryType, function(err, results) {
            if (err) {
                resolve({ success: false, error: err.message || String(err) });
                return;
            }

            var totalCount = results ? results.length : 0;

            // If countOnly is true, return just the count
            if (countOnly) {
                resolve({
                    success: true,
                    data: {
                        type: type || 'all',
                        path: path || null,
                        count: totalCount,
                        assets: []
                    }
                });
                return;
            }

            // Apply pagination
            var assets = [];
            if (results) {
                var endIndex = Math.min(offset + limit, results.length);
                for (var i = offset; i < endIndex; i++) {
                    var asset = results[i];
                    assets.push({
                        name: asset.name,
                        path: asset.url,
                        uuid: asset.uuid,
                        type: asset.type
                    });
                }
            }

            resolve({
                success: true,
                data: {
                    type: type || 'all',
                    path: path || null,
                    count: totalCount,
                    offset: offset,
                    limit: limit,
                    hasMore: (offset + limit) < totalCount,
                    assets: assets
                }
            });
        });
    });
};

ProjectTools.prototype.getAssetInfo = function(uuid) {
    return new Promise(function(resolve) {
        // Try async queryInfoByUuid first (renderer process)
        if (Editor.assetdb.queryInfoByUuid) {
            Editor.assetdb.queryInfoByUuid(uuid, function(err, info) {
                if (err || !info) {
                    resolve({ success: false, error: err ? err.message || String(err) : 'Asset not found' });
                    return;
                }
                resolve({
                    success: true,
                    data: {
                        name: info.name || path.basename(info.path || ''),
                        uuid: info.uuid,
                        path: info.url,
                        type: info.type,
                        isDirectory: info.isDirectory || false
                    }
                });
            });
        } else if (Editor.assetdb.assetInfoByUuid) {
            // Fallback: synchronous main process method
            try {
                var info = Editor.assetdb.assetInfoByUuid(uuid);
                if (!info) {
                    resolve({ success: false, error: 'Asset not found' });
                    return;
                }
                resolve({
                    success: true,
                    data: {
                        name: info.name || path.basename(info.path || ''),
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

ProjectTools.prototype.queryAssetUuid = function(url) {
    return new Promise(function(resolve) {
        // Try synchronous method first (main process)
        if (Editor.assetdb.urlToUuid) {
            var uuid = Editor.assetdb.urlToUuid(url);
            if (uuid) {
                resolve({ success: true, data: { url: url, uuid: uuid } });
            } else {
                resolve({ success: false, error: 'UUID not found for: ' + url });
            }
        } else if (Editor.assetdb.queryUuidByUrl) {
            // Fallback: async renderer method
            Editor.assetdb.queryUuidByUrl(url, function(err, uuid) {
                if (err || !uuid) {
                    resolve({ success: false, error: 'UUID not found for: ' + url });
                    return;
                }
                resolve({ success: true, data: { url: url, uuid: uuid } });
            });
        } else {
            resolve({ success: false, error: 'No UUID query API available' });
        }
    });
};

ProjectTools.prototype.refreshAssets = function(folder) {
    return new Promise(function(resolve) {
        var target = folder || 'db://assets';
        Editor.assetdb.refresh(target, function(err) {
            if (err) {
                resolve({ success: false, error: err.message || String(err) });
            } else {
                resolve({ success: true, message: 'Assets refreshed: ' + target });
            }
        });
    });
};

ProjectTools.prototype.createAsset = function(url, content) {
    return new Promise(function(resolve) {
        Editor.assetdb.create(url, content || '', function(err, results) {
            if (err) {
                resolve({ success: false, error: err.message || String(err) });
                return;
            }
            var created = results && results[0] ? results[0] : null;
            resolve({
                success: true,
                data: {
                    url: url,
                    uuid: created ? created.uuid : null,
                    message: 'Asset created: ' + url
                }
            });
        });
    });
};

ProjectTools.prototype.deleteAsset = function(url) {
    var self = this;
    return new Promise(function(resolve) {
        // Convert db:// URL to file system path
        var fsPath = null;

        // Try different APIs for URL to path conversion
        if (Editor.assetdb && Editor.assetdb._fspath) {
            // Cocos Creator 2.x internal method
            try {
                fsPath = Editor.assetdb._fspath(url);
            } catch (e) {
                // Ignore
            }
        }

        if (!fsPath && Editor.urlToPath) {
            try {
                fsPath = Editor.urlToPath(url);
            } catch (e) {
                // Ignore
            }
        }

        if (!fsPath) {
            // Manual conversion: db://assets/path -> projectPath/assets/path
            var projectPath = Editor.Project ? Editor.Project.path : (Editor.projectInfo ? Editor.projectInfo.path : null);
            if (projectPath && url.indexOf('db://assets/') === 0) {
                var relativePath = url.substring('db://assets/'.length);
                fsPath = path.join(projectPath, 'assets', relativePath);
            }
        }

        if (!fsPath) {
            resolve({ success: false, error: 'Cannot convert URL to path: ' + url });
            return;
        }

        // Try using fs.unlink directly (faster and more reliable)
        fs.unlink(fsPath, function(err) {
            if (err) {
                // If file doesn't exist, consider it deleted
                if (err.code === 'ENOENT') {
                    resolve({ success: true, message: 'Asset already deleted: ' + url });
                } else {
                    resolve({ success: false, error: 'Delete failed: ' + err.message });
                }
                return;
            }

            // Refresh asset database after deletion (non-blocking)
            var folder = 'db://assets';
            if (Editor.assetdb && Editor.assetdb.refresh) {
                try {
                    Editor.assetdb.refresh(folder, function(refreshErr) {
                        // Refresh complete, but don't wait for it
                    });
                } catch (e) {
                    // Ignore refresh errors
                }
            }

            resolve({ success: true, message: 'Asset deleted: ' + url });
        });
    });
};

exports.ProjectTools = ProjectTools;
