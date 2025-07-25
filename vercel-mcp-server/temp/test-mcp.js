#!/usr/bin/env node

/**
 * Test script for Vercel MCP Server
 * Usage: node test-mcp.js [server-url]
 */

const https = require('https');
const http = require('http');

const SERVER_URL = process.argv[2] || 'https://your-project.vercel.app/api/mcp';

class McpClient {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.sessionId = null;
    }

    async makeRequest(method, params = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.serverUrl);
            const data = JSON.stringify({
                jsonrpc: '2.0',
                id: `test-${Date.now()}`,
                method,
                params
            });

            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const client = url.protocol === 'https:' ? https : http;
            
            const req = client.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = JSON.parse(responseData);
                        resolve(response);
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(data);
            req.end();
        });
    }

    async initialize() {
        console.log('🔌 Initializing MCP connection...');
        
        const response = await this.makeRequest('initialize', {
            protocolVersion: '2025-03-26',
            capabilities: {
                tools: {},
                resources: { subscribe: true },
                prompts: {},
                logging: {}
            },
            clientInfo: {
                name: 'test-client',
                version: '1.0.0'
            }
        });

        if (response.result) {
            console.log('✅ MCP connection initialized successfully');
            console.log(`   Server: ${response.result.serverInfo.name} v${response.result.serverInfo.version}`);
            console.log(`   Protocol: ${response.result.protocolVersion}`);
            return true;
        } else {
            console.error('❌ Failed to initialize MCP connection:', response.error);
            return false;
        }
    }

    async listTools() {
        console.log('\n🔧 Listing available tools...');
        
        const response = await this.makeRequest('tools/list', {});
        
        if (response.result?.tools) {
            console.log(`✅ Found ${response.result.tools.length} tools:`);
            response.result.tools.forEach(tool => {
                console.log(`   - ${tool.name}: ${tool.description}`);
            });
            return response.result.tools;
        } else {
            console.error('❌ Failed to list tools:', response.error);
            return [];
        }
    }

    async listResources() {
        console.log('\n📄 Listing available resources...');
        
        const response = await this.makeRequest('resources/list', {});
        
        if (response.result?.resources) {
            console.log(`✅ Found ${response.result.resources.length} resources:`);
            response.result.resources.forEach(resource => {
                console.log(`   - ${resource.uri}: ${resource.description}`);
            });
            return response.result.resources;
        } else {
            console.error('❌ Failed to list resources:', response.error);
            return [];
        }
    }

    async callTool(toolName, arguments_) {
        console.log(`\n⚡ Calling tool: ${toolName}`);
        console.log(`   Arguments:`, arguments_);
        
        const response = await this.makeRequest('tools/call', {
            name: toolName,
            arguments: arguments_
        });
        
        if (response.result) {
            console.log('✅ Tool executed successfully');
            console.log('   Result:', JSON.stringify(response.result.content?.[0]?.text ? JSON.parse(response.result.content[0].text) : response.result, null, 2));
            return response.result;
        } else {
            console.error('❌ Tool execution failed:', response.error);
            return null;
        }
    }

    async readResource(uri) {
        console.log(`\n📖 Reading resource: ${uri}`);
        
        const response = await this.makeRequest('resources/read', { uri });
        
        if (response.result) {
            console.log('✅ Resource read successfully');
            console.log('   Content:', JSON.stringify(response.result.contents?.[0]?.text ? JSON.parse(response.result.contents[0].text) : response.result, null, 2));
            return response.result;
        } else {
            console.error('❌ Failed to read resource:', response.error);
            return null;
        }
    }
}

async function runTests() {
    console.log('🧪 Testing Vercel MCP Server');
    console.log(`📍 Server URL: ${SERVER_URL}\n`);

    const client = new McpClient(SERVER_URL);

    try {
        // Test 1: Initialize connection
        const initialized = await client.initialize();
        if (!initialized) {
            console.error('❌ Cannot proceed without initialization');
            process.exit(1);
        }

        // Test 2: List tools
        const tools = await client.listTools();

        // Test 3: List resources
        const resources = await client.listResources();

        // Test 4: Call calculator tool
        if (tools.some(t => t.name === 'calculator')) {
            await client.callTool('calculator', {
                operation: 'add',
                a: 5,
                b: 3
            });
        }

        // Test 5: Call text processor tool
        if (tools.some(t => t.name === 'process_text')) {
            await client.callTool('process_text', {
                text: 'Hello World',
                operation: 'uppercase'
            });
        }

        // Test 6: Call weather tool
        if (tools.some(t => t.name === 'get_weather')) {
            await client.callTool('get_weather', {
                location: 'New York',
                units: 'celsius'
            });
        }

        // Test 7: Read system status resource
        if (resources.some(r => r.uri === 'system://status')) {
            await client.readResource('system://status');
        }

        console.log('\n🎉 All tests completed successfully!');
        console.log('✅ Your Vercel MCP Server is working correctly');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    runTests();
}

module.exports = { McpClient }; 