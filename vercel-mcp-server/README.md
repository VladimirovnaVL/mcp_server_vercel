# Vercel MCP Server

A Model Context Protocol (MCP) server deployed on Vercel with a React frontend for testing and interaction.

## 🚀 Features

- **PHP MCP Server**: Full MCP protocol implementation using `php-mcp/server`
- **Vercel Deployment**: Serverless deployment with automatic scaling
- **React Frontend**: Modern UI for testing MCP tools and resources
- **Multiple Tools**: Calculator, text processing, weather simulation, and system status
- **Real-time Interaction**: Execute MCP tools directly from the web interface

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend│◄──►│   Vercel Edge    │◄──►│   PHP MCP Server│
│   (Next.js)     │    │   Functions      │    │   (Serverless)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📦 Project Structure

```
vercel-mcp-server/
├── api/
│   └── mcp.php              # Vercel serverless function
├── frontend/                # React Next.js application
│   ├── app/
│   │   ├── page.tsx         # Main interface
│   │   ├── layout.tsx       # Root layout
│   │   └── globals.css      # Global styles
│   ├── package.json         # Frontend dependencies
│   ├── next.config.js       # Next.js configuration
│   ├── tailwind.config.js   # Tailwind CSS config
│   └── tsconfig.json        # TypeScript config
├── composer.json            # PHP dependencies
├── vercel.json             # Vercel configuration
└── README.md               # This file
```

## 🛠️ Available MCP Tools

### 1. Calculator
- **Name**: `calculator`
- **Description**: Perform basic mathematical operations
- **Parameters**:
  - `operation`: add, subtract, multiply, divide, power
  - `a`: First operand (number)
  - `b`: Second operand (number)

### 2. Text Processor
- **Name**: `process_text`
- **Description**: Process and transform text
- **Parameters**:
  - `text`: Text to process (string)
  - `operation`: uppercase, lowercase, reverse, word_count, character_count

### 3. Weather Simulator
- **Name**: `get_weather`
- **Description**: Get simulated weather information for a location
- **Parameters**:
  - `location`: City or location name (string)
  - `units`: celsius or fahrenheit (optional, default: celsius)

### 4. System Status
- **Name**: `system_status`
- **Type**: Resource
- **URI**: `system://status`
- **Description**: Current system status and runtime information

## 🚀 Deployment

### Prerequisites

- [Vercel CLI](https://vercel.com/docs/cli) installed
- [Node.js](https://nodejs.org/) (for frontend)
- [Composer](https://getcomposer.org/) (for PHP dependencies)

### Step 1: Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd vercel-mcp-server

# Install PHP dependencies
composer install --no-dev --optimize-autoloader

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Step 2: Deploy to Vercel

```bash
# Deploy using Vercel CLI
vercel

# Or deploy to production
vercel --prod
```

### Step 3: Configure Environment Variables

In your Vercel dashboard, set the following environment variables:

```env
MCP_ENV=production
MCP_LOG_LEVEL=info
```

### Step 4: Access Your MCP Server

After deployment, you'll get URLs like:
- **Frontend**: `https://your-project.vercel.app`
- **MCP Endpoint**: `https://your-project.vercel.app/api/mcp`

## 🔧 Local Development

### Running the Frontend

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Testing the MCP Server

You can test the MCP server directly using curl:

```bash
# Initialize the MCP connection
curl -X POST https://your-project.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "init-1",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {
        "tools": {},
        "resources": {"subscribe": true},
        "prompts": {},
        "logging": {}
      },
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'

# List available tools
curl -X POST https://your-project.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "tools-1",
    "method": "tools/list",
    "params": {}
  }'

# Execute a calculator tool
curl -X POST https://your-project.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "calc-1",
    "method": "tools/call",
    "params": {
      "name": "calculator",
      "arguments": {
        "operation": "add",
        "a": 5,
        "b": 3
      }
    }
  }'
```

## 🎯 Using with MCP Clients

### Cursor IDE Configuration

Add to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "vercel-mcp": {
      "url": "https://your-project.vercel.app/api/mcp"
    }
  }
}
```

### Claude Desktop Configuration

Add to your Claude Desktop settings:

```json
{
  "mcpServers": {
    "vercel-mcp": {
      "url": "https://your-project.vercel.app/api/mcp"
    }
  }
}
```

## 🔍 Monitoring and Logs

### Vercel Function Logs

View logs in your Vercel dashboard:
1. Go to your project in Vercel
2. Navigate to Functions tab
3. Click on `api/mcp.php`
4. View real-time logs

### Frontend Logs

Check browser console for frontend errors and network requests.

## 🛡️ Security Considerations

- **CORS**: Configured to allow all origins for development
- **Rate Limiting**: Consider implementing rate limiting for production
- **Authentication**: Add authentication if needed for sensitive operations
- **Input Validation**: All inputs are validated using JSON Schema

## 🔧 Customization

### Adding New Tools

1. Edit `api/mcp.php`
2. Add new tool registration in the `registerTools()` method
3. Deploy to Vercel

Example:

```php
$this->registry->registerTool(
    new \PhpMcp\Schema\Tool(
        name: 'my_custom_tool',
        description: 'My custom tool description',
        inputSchema: [
            'type' => 'object',
            'properties' => [
                'input' => [
                    'type' => 'string',
                    'description' => 'Input parameter'
                ]
            ],
            'required' => ['input']
        ]
    ),
    function (array $args): array {
        $input = $args['input'];
        // Your tool logic here
        return ['result' => 'processed: ' . $input];
    },
    isManual: true
);
```

### Adding New Resources

```php
$this->registry->registerResource(
    new \PhpMcp\Schema\Resource(
        uri: 'custom://data',
        name: 'custom_data',
        description: 'Custom data resource',
        mimeType: 'application/json'
    ),
    function (string $uri): array {
        return ['custom' => 'data', 'timestamp' => time()];
    },
    isManual: true
);
```

## 🐛 Troubleshooting

### Common Issues

1. **Function Timeout**: Vercel functions have a 10-second timeout limit
2. **Memory Limits**: Keep tool execution lightweight
3. **Cold Starts**: First request may be slower
4. **CORS Issues**: Ensure proper CORS headers are set

### Debug Mode

Enable debug logging by setting:
```env
MCP_LOG_LEVEL=debug
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📚 Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [PHP MCP Server](https://github.com/php-mcp/server)
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs) 