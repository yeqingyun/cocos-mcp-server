'use strict';

/**
 * Debug tools for Cocos Creator 2.x
 * Provides console logging, script execution, and editor info.
 */

var fs = require('fs');
var path = require('path');

var PKG_NAME = 'cocos-mcp-server-2x';

function DebugTools() {}

DebugTools.prototype.getTools = function() {
    return [
        {
            name: 'execute_script',
            description: 'Execute JavaScript in scene context',
            inputSchema: {
                type: 'object',
                properties: {
                    script: {
                        type: 'string',
                        description: 'JavaScript code to execute'
                    }
                },
                required: ['script']
            }
        },
        {
            name: 'get_editor_info',
            description: 'Get editor and environment information',
            inputSchema: { type: 'object', properties: {} }
        },
        {
            name: 'get_project_logs',
            description: 'Get project log file contents',
            inputSchema: {
                type: 'object',
                properties: {
                    lines: {
                        type: 'number',
                        description: 'Number of lines to read from end (default 100)',
                        default: 100
                    },
                    filterKeyword: {
                        type: 'string',
                        description: 'Filter logs containing keyword'
                    }
                }
            }
        },
        {
            name: 'get_console_logs',
            description: 'Get recent console messages from scene',
            inputSchema: {
                type: 'object',
                properties: {
                    limit: {
                        type: 'number',
                        description: 'Number of recent logs',
                        default: 50
                    }
                }
            }
        }
    ];
};

DebugTools.prototype.execute = function(toolName, args) {
    switch (toolName) {
        case 'execute_script':
            return this.executeScript(args.script);
        case 'get_editor_info':
            return this.getEditorInfo();
        case 'get_project_logs':
            return this.getProjectLogs(args.lines, args.filterKeyword);
        case 'get_console_logs':
            return this.getConsoleLogs(args.limit);
        default:
            return Promise.reject(new Error('Unknown debug tool: ' + toolName));
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

DebugTools.prototype.executeScript = function(script) {
    return callSceneScript('execute-script', script);
};

DebugTools.prototype.getEditorInfo = function() {
    var info = {
        editor: {
            version: (Editor.versions && Editor.versions.editor) || 'Unknown',
            cocosVersion: (Editor.versions && Editor.versions['cocos2d-html5']) || 'Unknown',
            electronVersion: (Editor.versions && Editor.versions.electron) || 'Unknown',
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version
        },
        memory: process.memoryUsage(),
        uptime: process.uptime()
    };

    if (Editor.Project && Editor.Project.path) {
        info.project = {
            name: path.basename(Editor.Project.path),
            path: Editor.Project.path
        };
    } else if (Editor.projectInfo && Editor.projectInfo.path) {
        info.project = {
            name: path.basename(Editor.projectInfo.path),
            path: Editor.projectInfo.path
        };
    }

    return Promise.resolve({ success: true, data: info });
};

DebugTools.prototype.getProjectLogs = function(lines, filterKeyword) {
    var numLines = lines || 100;
    var projectPath = '';

    if (Editor.Project && Editor.Project.path) {
        projectPath = Editor.Project.path;
    } else if (Editor.projectInfo && Editor.projectInfo.path) {
        projectPath = Editor.projectInfo.path;
    }

    if (!projectPath) {
        return Promise.resolve({ success: false, error: 'Project path not found' });
    }

    var logPath = path.join(projectPath, 'temp', 'logs', 'project.log');

    try {
        if (!fs.existsSync(logPath)) {
            return Promise.resolve({ success: false, error: 'Log file not found: ' + logPath });
        }

        var content = fs.readFileSync(logPath, 'utf8');
        var allLines = content.split('\n').filter(function(l) { return l.trim() !== ''; });
        var recentLines = allLines.slice(-numLines);

        if (filterKeyword) {
            var keyword = filterKeyword.toLowerCase();
            recentLines = recentLines.filter(function(l) {
                return l.toLowerCase().indexOf(keyword) !== -1;
            });
        }

        return Promise.resolve({
            success: true,
            data: {
                totalLines: allLines.length,
                returnedLines: recentLines.length,
                filterKeyword: filterKeyword || null,
                logPath: logPath,
                logs: recentLines
            }
        });
    } catch (e) {
        return Promise.resolve({ success: false, error: 'Failed to read log: ' + e.message });
    }
};

DebugTools.prototype.getConsoleLogs = function(limit) {
    return callSceneScript('get-console-logs', limit || 50);
};

exports.DebugTools = DebugTools;
