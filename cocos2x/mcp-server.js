'use strict';

var http = require('http');
var url = require('url');

/**
 * MCP Server for Cocos Creator 2.x
 * HTTP server implementing JSON-RPC 2.0 based MCP protocol.
 * Ported from source/mcp-server.ts.
 *
 * @param {number} port - Port to listen on
 * @param {Object} tools - Map of tool category instances, e.g. { scene: SceneToolsInstance }
 */
function MCPServer(port, tools) {
    this.port = port || 8585;
    this.tools = tools || {};
    this.httpServer = null;
    this.toolsList = [];
}

MCPServer.prototype.start = function() {
    var self = this;
    var maxPort = (this.port || 8585) + 100; // 最多尝试递增 100 个端口
    var currentPort = this.port || 8585;
    var serverStarted = false;

    return new Promise(function(resolve, reject) {
        if (self.httpServer) {
            console.log('[MCPServer 2x] Already running');
            resolve();
            return;
        }

        self.setupTools();

        function tryStart(portAttempt) {
            if (serverStarted) {
                return;
            }

            if (portAttempt > maxPort) {
                reject(new Error('Failed to start: all ports from ' + self.port + ' to ' + maxPort + ' are in use'));
                return;
            }

            // 关闭之前的服务器实例（如果有）
            if (self.httpServer) {
                try {
                    self.httpServer.close();
                    self.httpServer = null;
                } catch (e) {
                    // Ignore close errors
                }
            }

            self.httpServer = http.createServer(function(req, res) {
                self.handleHttpRequest(req, res);
            });

            self.httpServer.listen(portAttempt, '127.0.0.1', function() {
                self.port = portAttempt; // 更新实际使用的端口
                console.log('[MCPServer 2x] HTTP server started on http://127.0.0.1:' + portAttempt);
                console.log('[MCPServer 2x] MCP endpoint: http://127.0.0.1:' + portAttempt + '/mcp');
                if (portAttempt !== (self.originalPort || 8585)) {
                    console.log('[MCPServer 2x] Note: Original port ' + (self.originalPort || 8585) + ' was in use, using port ' + portAttempt);
                }
                serverStarted = true;
                resolve();
            });

            self.httpServer.on('error', function(err) {
                if (err.code === 'EADDRINUSE' && portAttempt < maxPort) {
                    console.log('[MCPServer 2x] Port ' + portAttempt + ' is in use, trying port ' + (portAttempt + 1) + '...');
                    tryStart(portAttempt + 1);
                } else if (err.code === 'EADDRINUSE') {
                    console.error('[MCPServer 2x] All ports from ' + self.port + ' to ' + maxPort + ' are in use');
                    reject(err);
                } else {
                    console.error('[MCPServer 2x] Failed to start:', err);
                    reject(err);
                }
            });
        }

        // 保存原始端口
        if (!self.originalPort) {
            self.originalPort = self.port || 8585;
        }

        tryStart(currentPort);
    });
};

MCPServer.prototype.setupTools = function() {
    this.toolsList = [];
    for (var category in this.tools) {
        if (!this.tools.hasOwnProperty(category)) continue;
        var toolSet = this.tools[category];
        var tools = toolSet.getTools();
        for (var i = 0; i < tools.length; i++) {
            this.toolsList.push({
                name: category + '_' + tools[i].name,
                description: tools[i].description,
                inputSchema: tools[i].inputSchema
            });
        }
    }
    console.log('[MCPServer 2x] Registered ' + this.toolsList.length + ' tools');
};

MCPServer.prototype.getAvailableTools = function() {
    return this.toolsList;
};

MCPServer.prototype.executeToolCall = function(toolName, args) {
    var parts = toolName.split('_');
    var category = parts[0];
    var toolMethodName = parts.slice(1).join('_');

    if (this.tools[category]) {
        return this.tools[category].execute(toolMethodName, args);
    }

    return Promise.reject(new Error('Tool ' + toolName + ' not found'));
};

MCPServer.prototype.stop = function() {
    if (this.httpServer) {
        this.httpServer.close();
        this.httpServer = null;
        console.log('[MCPServer 2x] HTTP server stopped');
    }
};

MCPServer.prototype.getStatus = function() {
    return {
        running: !!this.httpServer,
        port: this.port,
        tools: this.toolsList.length
    };
};

MCPServer.prototype.handleHttpRequest = function(req, res) {
    var self = this;
    var parsedUrl = url.parse(req.url || '', true);
    var pathname = parsedUrl.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (pathname === '/mcp' && req.method === 'POST') {
        self.handleMCPRequest(req, res);
    } else if (pathname === '/health' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', tools: self.toolsList.length }));
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }
};

MCPServer.prototype.handleMCPRequest = function(req, res) {
    var self = this;
    var body = '';

    req.on('data', function(chunk) {
        body += chunk.toString();
    });

    req.on('end', function() {
        try {
            var message = JSON.parse(body);
            self.handleMessage(message).then(function(response) {
                res.writeHead(200);
                res.end(JSON.stringify(response));
            });
        } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({
                jsonrpc: '2.0',
                id: null,
                error: { code: -32700, message: 'Parse error: ' + e.message }
            }));
        }
    });
};

MCPServer.prototype.handleMessage = function(message) {
    var self = this;
    var id = message.id;
    var method = message.method;
    var params = message.params || {};

    return new Promise(function(resolve) {
        try {
            var result;

            switch (method) {
                case 'tools/list':
                    result = { tools: self.getAvailableTools() };
                    resolve({
                        jsonrpc: '2.0',
                        id: id,
                        result: result
                    });
                    break;

                case 'tools/call':
                    self.executeToolCall(params.name, params.arguments || {}).then(function(toolResult) {
                        resolve({
                            jsonrpc: '2.0',
                            id: id,
                            result: { content: [{ type: 'text', text: JSON.stringify(toolResult) }] }
                        });
                    }).catch(function(err) {
                        resolve({
                            jsonrpc: '2.0',
                            id: id,
                            error: { code: -32603, message: err.message }
                        });
                    });
                    break;

                case 'initialize':
                    resolve({
                        jsonrpc: '2.0',
                        id: id,
                        result: {
                            protocolVersion: '2024-11-05',
                            capabilities: { tools: {} },
                            serverInfo: {
                                name: 'cocos-mcp-server-2x',
                                version: '0.1.0'
                            }
                        }
                    });
                    break;

                default:
                    resolve({
                        jsonrpc: '2.0',
                        id: id,
                        error: { code: -32601, message: 'Unknown method: ' + method }
                    });
            }
        } catch (e) {
            resolve({
                jsonrpc: '2.0',
                id: id,
                error: { code: -32603, message: e.message }
            });
        }
    });
};

exports.MCPServer = MCPServer;
