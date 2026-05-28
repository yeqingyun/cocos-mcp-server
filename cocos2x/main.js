'use strict';

var mcpServer = null;
var settings = {
    port: 8585,
    autoStart: true
};

function getProjectPath() {
    if (Editor.Project && Editor.Project.path) return Editor.Project.path;
    if (Editor.projectInfo && Editor.projectInfo.path) return Editor.projectInfo.path;
    return '';
}

function loadSettings() {
    try {
        var fs = require('fs');
        var path = require('path');
        var settingsPath = path.join(getProjectPath(), 'settings', 'mcp-server-2x.json');
        if (fs.existsSync(settingsPath)) {
            var content = fs.readFileSync(settingsPath, 'utf8');
            var loaded = JSON.parse(content);
            for (var key in loaded) {
                if (loaded.hasOwnProperty(key)) {
                    settings[key] = loaded[key];
                }
            }
        }
    } catch (e) {
        console.error('[MCP 2x] Failed to load settings:', e);
    }
}

function startMCPServer() {
    if (!mcpServer) {
        console.error('[MCP 2x] mcpServer is null');
        return;
    }
    mcpServer.start().then(function() {
        console.log('[MCP 2x] Server started on http://127.0.0.1:' + settings.port + '/mcp');
    }).catch(function(err) {
        console.error('[MCP 2x] Server start failed:', err);
    });
}

function stopMCPServer() {
    if (mcpServer) {
        mcpServer.stop();
        console.log('[MCP 2x] Server stopped');
    }
}

function safeRequire(modulePath) {
    try {
        return require(modulePath);
    } catch (e) {
        console.error('[MCP 2x] Failed to load ' + modulePath + ':', e.message);
        return null;
    }
}

module.exports = {
    load: function() {
        console.log('[MCP 2x] === load() called ===');

        var MCPServer = safeRequire('./mcp-server');
        if (!MCPServer) return;

        var SceneTools = safeRequire('./scene-tools');
        var NodeTools = safeRequire('./node-tools');
        var ComponentTools = safeRequire('./component-tools');
        var PrefabTools = safeRequire('./prefab-tools');
        var ProjectTools = safeRequire('./project-tools');
        var DebugTools = safeRequire('./debug-tools');

        loadSettings();

        var tools = {};

        if (SceneTools) tools.scene = new SceneTools.SceneTools();
        if (NodeTools) tools.node = new NodeTools.NodeTools();
        if (ComponentTools) tools.component = new ComponentTools.ComponentTools();
        if (PrefabTools) tools.prefab = new PrefabTools.PrefabTools();
        if (ProjectTools) tools.project = new ProjectTools.ProjectTools();
        if (DebugTools) tools.debug = new DebugTools.DebugTools();

        try {
            mcpServer = new MCPServer.MCPServer(settings.port, tools);
            console.log('[MCP 2x] Server instance created on port ' + settings.port + ' with ' + Object.keys(tools).length + ' tool categories');
        } catch (e) {
            console.error('[MCP 2x] Failed to create server:', e);
            return;
        }

        startMCPServer();
        console.log('[MCP 2x] === extension loaded successfully ===');
    },

    unload: function() {
        stopMCPServer();
        console.log('[MCP 2x] Extension unloaded');
    },

    messages: {
        'start-server': function(event) {
            console.log('[MCP 2x] start-server message received');
            startMCPServer();
            if (event && event.reply) event.reply(null, 'OK');
        },

        'stop-server': function(event) {
            console.log('[MCP 2x] stop-server message received');
            stopMCPServer();
            if (event && event.reply) event.reply(null, 'OK');
        }
    }
};
