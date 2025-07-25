'use client';

import { useState, useEffect } from 'react';
import { Calculator, FileText, Cloud, Zap, Send, Loader2 } from 'lucide-react';
import axios from 'axios';

interface McpTool {
  name: string;
  description: string;
  inputSchema: any;
}

interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export default function McpServerPage() {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [resources, setResources] = useState<McpResource[]>([]);
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [toolParams, setToolParams] = useState<Record<string, any>>({});
  const [result, setResult] = useState<ToolResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<any>(null);

  const MCP_SERVER_URL = process.env.NEXT_PUBLIC_MCP_SERVER_URL || '/api/mcp';

  useEffect(() => {
    initializeMcpServer();
    loadSystemStatus();
  }, []);

  const initializeMcpServer = async () => {
    try {
      setLoading(true);
      
      // Initialize MCP connection
      const initResponse = await axios.post(MCP_SERVER_URL, {
        jsonrpc: '2.0',
        id: 'init-1',
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {
            tools: {},
            resources: { subscribe: true },
            prompts: {},
            logging: {}
          },
          clientInfo: {
            name: 'vercel-mcp-frontend',
            version: '1.0.0'
          }
        }
      });

      if (initResponse.data.result) {
        // Get available tools
        const toolsResponse = await axios.post(MCP_SERVER_URL, {
          jsonrpc: '2.0',
          id: 'tools-1',
          method: 'tools/list',
          params: {}
        });

        if (toolsResponse.data.result?.tools) {
          setTools(toolsResponse.data.result.tools);
        }

        // Get available resources
        const resourcesResponse = await axios.post(MCP_SERVER_URL, {
          jsonrpc: '2.0',
          id: 'resources-1',
          method: 'resources/list',
          params: {}
        });

        if (resourcesResponse.data.result?.resources) {
          setResources(resourcesResponse.data.result.resources);
        }
      }
    } catch (error) {
      console.error('Failed to initialize MCP server:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSystemStatus = async () => {
    try {
      const response = await axios.post(MCP_SERVER_URL, {
        jsonrpc: '2.0',
        id: 'status-1',
        method: 'resources/read',
        params: {
          uri: 'system://status'
        }
      });

      if (response.data.result?.contents?.[0]?.text) {
        setSystemStatus(JSON.parse(response.data.result.contents[0].text));
      }
    } catch (error) {
      console.error('Failed to load system status:', error);
    }
  };

  const executeTool = async () => {
    if (!selectedTool) return;

    try {
      setLoading(true);
      setResult(null);

      const response = await axios.post(MCP_SERVER_URL, {
        jsonrpc: '2.0',
        id: `tool-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: selectedTool,
          arguments: toolParams
        }
      });

      if (response.data.result) {
        setResult({
          success: true,
          data: response.data.result.content?.[0]?.text 
            ? JSON.parse(response.data.result.content[0].text)
            : response.data.result
        });
      } else if (response.data.error) {
        setResult({
          success: false,
          error: response.data.error.message
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        error: error.response?.data?.error?.message || error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'calculator':
        return <Calculator className="w-5 h-5" />;
      case 'process_text':
        return <FileText className="w-5 h-5" />;
      case 'get_weather':
        return <Cloud className="w-5 h-5" />;
      default:
        return <Zap className="w-5 h-5" />;
    }
  };

  const renderToolInputs = () => {
    const tool = tools.find(t => t.name === selectedTool);
    if (!tool?.inputSchema?.properties) return null;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Parameters</h3>
        {Object.entries(tool.inputSchema.properties).map(([key, schema]: [string, any]) => (
          <div key={key} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {key} {schema.description && `(${schema.description})`}
            </label>
            {schema.enum ? (
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={toolParams[key] || ''}
                onChange={(e) => setToolParams(prev => ({ ...prev, [key]: e.target.value }))}
              >
                <option value="">Select {key}</option>
                {schema.enum.map((option: string) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : schema.type === 'number' ? (
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Enter ${key}`}
                value={toolParams[key] || ''}
                onChange={(e) => setToolParams(prev => ({ ...prev, [key]: parseFloat(e.target.value) || '' }))}
              />
            ) : (
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Enter ${key}`}
                value={toolParams[key] || ''}
                onChange={(e) => setToolParams(prev => ({ ...prev, [key]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Vercel MCP Server
          </h1>
          <p className="text-lg text-gray-600">
            Model Context Protocol Server deployed on Vercel
          </p>
        </div>

        {/* System Status */}
        {systemStatus && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">System Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{systemStatus.status}</div>
                <div className="text-sm text-gray-500">Status</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{systemStatus.memory_usage_mb}MB</div>
                <div className="text-sm text-gray-500">Memory Usage</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{systemStatus.php_version}</div>
                <div className="text-sm text-gray-500">PHP Version</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{systemStatus.deployment}</div>
                <div className="text-sm text-gray-500">Deployment</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Available Tools */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Tools</h2>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="space-y-3">
                  {tools.map((tool) => (
                    <button
                      key={tool.name}
                      onClick={() => {
                        setSelectedTool(tool.name);
                        setToolParams({});
                        setResult(null);
                      }}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedTool === tool.name
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {getToolIcon(tool.name)}
                        <div>
                          <div className="font-medium text-gray-900">{tool.name}</div>
                          <div className="text-sm text-gray-500">{tool.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tool Execution */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Tool Execution</h2>
              
              {selectedTool ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {selectedTool}
                    </h3>
                    <p className="text-gray-600">
                      {tools.find(t => t.name === selectedTool)?.description}
                    </p>
                  </div>

                  {renderToolInputs()}

                  <button
                    onClick={executeTool}
                    disabled={loading}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>Execute Tool</span>
                  </button>

                  {result && (
                    <div className="mt-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Result</h3>
                      <div className={`p-4 rounded-lg ${
                        result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                      }`}>
                        {result.success ? (
                          <pre className="text-sm text-green-800 whitespace-pre-wrap">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        ) : (
                          <div className="text-sm text-red-800">
                            Error: {result.error}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Zap className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Select a tool from the left to get started</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Available Resources */}
        {resources.length > 0 && (
          <div className="mt-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Resources</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {resources.map((resource) => (
                  <div key={resource.uri} className="p-4 border border-gray-200 rounded-lg">
                    <div className="font-medium text-gray-900">{resource.name}</div>
                    <div className="text-sm text-gray-500">{resource.uri}</div>
                    <div className="text-sm text-gray-600 mt-1">{resource.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 