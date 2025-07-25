<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use PhpMcp\Schema\JsonRpc\Error;
use PhpMcp\Schema\JsonRpc\Parser;
use PhpMcp\Schema\JsonRpc\Request;
use PhpMcp\Schema\JsonRpc\Response;
use PhpMcp\Schema\JsonRpc\BatchRequest;
use PhpMcp\Schema\JsonRpc\BatchResponse;
use PhpMcp\Schema\JsonRpc\Message;
use PhpMcp\Schema\ServerCapabilities;
use PhpMcp\Server\Defaults\BasicContainer;
use PhpMcp\Server\Server;
use PhpMcp\Server\Session\ArraySessionHandler;
use PhpMcp\Server\Session\SessionManager;
use PhpMcp\Server\Registry;
use PhpMcp\Server\Protocol;
use PhpMcp\Server\Configuration;
use PhpMcp\Server\Session\SubscriptionManager;
use PhpMcp\Server\Utils\SchemaValidator;
use Psr\Log\AbstractLogger;
use Psr\Log\LoggerInterface;
use React\EventLoop\Loop;
use React\Promise\PromiseInterface;
use React\Promise\Deferred;

// Custom logger for Vercel environment
class VercelLogger extends AbstractLogger
{
    public function log($level, \Stringable|string $message, array $context = []): void
    {
        $logEntry = sprintf(
            "[%s][%s] %s %s",
            date('Y-m-d H:i:s'),
            strtoupper($level),
            $message,
            empty($context) ? '' : json_encode($context)
        );
        
        // Write to stderr for Vercel logs
        fwrite(STDERR, $logEntry . "\n");
    }
}

// Vercel-compatible MCP Server Handler
class VercelMcpHandler
{
    private Server $server;
    private LoggerInterface $logger;
    private SessionManager $sessionManager;
    private Registry $registry;
    private Protocol $protocol;
    private SubscriptionManager $subscriptionManager;
    private SchemaValidator $schemaValidator;

    public function __construct()
    {
        $this->logger = new VercelLogger();
        $this->logger->info('Initializing Vercel MCP Server...');

        // Setup container
        $container = new BasicContainer();
        $container->set(LoggerInterface::class, $this->logger);

        // Setup session handler (in-memory for serverless)
        $sessionHandler = new ArraySessionHandler(3600); // 1 hour TTL
        $this->sessionManager = new SessionManager($sessionHandler, $this->logger, Loop::get(), 3600);

        // Setup registry
        $this->registry = new Registry($this->logger, null, $this->sessionManager);

        // Setup subscription manager
        $this->subscriptionManager = new SubscriptionManager($this->logger);

        // Setup schema validator
        $this->schemaValidator = new SchemaValidator($this->logger);

        // Setup configuration
        $configuration = new Configuration(
            serverInfo: new \PhpMcp\Schema\Implementation('Vercel MCP Server', '1.0.0'),
            capabilities: ServerCapabilities::make(
                resources: true,
                resourcesSubscribe: true,
                prompts: true,
                tools: true,
                completions: true,
                logging: true
            ),
            logger: $this->logger,
            loop: Loop::get(),
            cache: null,
            container: $container,
            paginationLimit: 50,
            instructions: 'Vercel-hosted MCP Server with calculator and utility tools'
        );

        // Setup protocol
        $this->protocol = new Protocol($configuration, $this->registry, $this->sessionManager);

        // Build server
        $this->server = new Server($configuration, $this->registry, $this->protocol, $this->sessionManager);

        // Register tools manually (since discovery doesn't work well in serverless)
        $this->registerTools();
        
        $this->logger->info('Vercel MCP Server initialized successfully');
    }

    private function registerTools(): void
    {
        // Calculator tool
        $this->registry->registerTool(
            new \PhpMcp\Schema\Tool(
                name: 'calculator',
                description: 'Perform basic mathematical operations',
                inputSchema: [
                    'type' => 'object',
                    'properties' => [
                        'operation' => [
                            'type' => 'string',
                            'enum' => ['add', 'subtract', 'multiply', 'divide', 'power'],
                            'description' => 'The mathematical operation to perform'
                        ],
                        'a' => [
                            'type' => 'number',
                            'description' => 'First operand'
                        ],
                        'b' => [
                            'type' => 'number',
                            'description' => 'Second operand'
                        ]
                    ],
                    'required' => ['operation', 'a', 'b']
                ]
            ),
            function (array $args): array {
                $operation = $args['operation'];
                $a = $args['a'];
                $b = $args['b'];

                $result = match ($operation) {
                    'add' => $a + $b,
                    'subtract' => $a - $b,
                    'multiply' => $a * $b,
                    'divide' => $b != 0 ? $a / $b : throw new \InvalidArgumentException('Division by zero'),
                    'power' => pow($a, $b),
                    default => throw new \InvalidArgumentException("Unknown operation: {$operation}")
                };

                return [
                    'operation' => $operation,
                    'operands' => [$a, $b],
                    'result' => $result,
                    'timestamp' => date('Y-m-d H:i:s')
                ];
            },
            isManual: true
        );

        // System status resource
        $this->registry->registerResource(
            new \PhpMcp\Schema\Resource(
                uri: 'system://status',
                name: 'system_status',
                description: 'Current system status and runtime information',
                mimeType: 'application/json'
            ),
            function (string $uri): array {
                return [
                    'server_time' => date('Y-m-d H:i:s'),
                    'memory_usage_mb' => round(memory_get_usage(true) / 1024 / 1024, 2),
                    'memory_peak_mb' => round(memory_get_peak_usage(true) / 1024 / 1024, 2),
                    'php_version' => PHP_VERSION,
                    'environment' => $_ENV['MCP_ENV'] ?? 'development',
                    'status' => 'healthy',
                    'deployment' => 'vercel'
                ];
            },
            isManual: true
        );

        // Text processing tool
        $this->registry->registerTool(
            new \PhpMcp\Schema\Tool(
                name: 'process_text',
                description: 'Process and transform text',
                inputSchema: [
                    'type' => 'object',
                    'properties' => [
                        'text' => [
                            'type' => 'string',
                            'description' => 'Text to process'
                        ],
                        'operation' => [
                            'type' => 'string',
                            'enum' => ['uppercase', 'lowercase', 'reverse', 'word_count', 'character_count'],
                            'description' => 'Text processing operation'
                        ]
                    ],
                    'required' => ['text', 'operation']
                ]
            ),
            function (array $args): array {
                $text = $args['text'];
                $operation = $args['operation'];

                $result = match ($operation) {
                    'uppercase' => strtoupper($text),
                    'lowercase' => strtolower($text),
                    'reverse' => strrev($text),
                    'word_count' => str_word_count($text),
                    'character_count' => strlen($text),
                    default => throw new \InvalidArgumentException("Unknown operation: {$operation}")
                };

                return [
                    'original_text' => $text,
                    'operation' => $operation,
                    'result' => $result,
                    'processed_at' => date('Y-m-d H:i:s')
                ];
            },
            isManual: true
        );

        // Weather simulation tool (for demo purposes)
        $this->registry->registerTool(
            new \PhpMcp\Schema\Tool(
                name: 'get_weather',
                description: 'Get simulated weather information for a location',
                inputSchema: [
                    'type' => 'object',
                    'properties' => [
                        'location' => [
                            'type' => 'string',
                            'description' => 'City or location name'
                        ],
                        'units' => [
                            'type' => 'string',
                            'enum' => ['celsius', 'fahrenheit'],
                            'default' => 'celsius',
                            'description' => 'Temperature units'
                        ]
                    ],
                    'required' => ['location']
                ]
            ),
            function (array $args): array {
                $location = $args['location'];
                $units = $args['units'] ?? 'celsius';
                
                // Simulate weather data
                $temperature = rand(10, 30);
                $conditions = ['sunny', 'cloudy', 'rainy', 'partly_cloudy'];
                $condition = $conditions[array_rand($conditions)];
                
                if ($units === 'fahrenheit') {
                    $temperature = ($temperature * 9/5) + 32;
                }

                return [
                    'location' => $location,
                    'temperature' => $temperature,
                    'units' => $units,
                    'condition' => $condition,
                    'humidity' => rand(40, 80),
                    'wind_speed' => rand(0, 20),
                    'timestamp' => date('Y-m-d H:i:s'),
                    'note' => 'This is simulated weather data for demonstration purposes'
                ];
            },
            isManual: true
        );
    }

    public function handleRequest(string $method, string $path, array $headers, ?string $body): array
    {
        try {
            $this->logger->info('Handling request', [
                'method' => $method,
                'path' => $path,
                'headers' => $headers
            ]);

            // Handle CORS preflight
            if ($method === 'OPTIONS') {
                return [
                    'statusCode' => 204,
                    'headers' => [
                        'Access-Control-Allow-Origin' => '*',
                        'Access-Control-Allow-Methods' => 'GET, POST, DELETE, OPTIONS',
                        'Access-Control-Allow-Headers' => 'Content-Type, Mcp-Session-Id, Last-Event-ID, Authorization',
                        'Access-Control-Max-Age' => '86400'
                    ],
                    'body' => ''
                ];
            }

            // Generate session ID for this request
            $sessionId = bin2hex(random_bytes(16));
            $session = $this->sessionManager->createSession($sessionId);

            // Handle different request types
            if ($method === 'GET') {
                return $this->handleGetRequest($headers, $sessionId);
            } elseif ($method === 'POST') {
                return $this->handlePostRequest($body, $sessionId);
            } elseif ($method === 'DELETE') {
                return $this->handleDeleteRequest($sessionId);
            } else {
                return $this->createErrorResponse(405, 'Method not allowed');
            }

        } catch (\Throwable $e) {
            $this->logger->error('Request handling error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return $this->createErrorResponse(500, 'Internal server error: ' . $e->getMessage());
        }
    }

    private function handleGetRequest(array $headers, string $sessionId): array
    {
        // Handle SSE connection for streaming responses
        $lastEventId = $headers['last-event-id'] ?? null;
        
        $this->logger->info('Handling GET request (SSE)', ['sessionId' => $sessionId]);

        // For Vercel, we'll return a simple response indicating SSE support
        // In a real implementation, you'd need to handle streaming differently
        return [
            'statusCode' => 200,
            'headers' => [
                'Content-Type' => 'text/event-stream',
                'Cache-Control' => 'no-cache',
                'Connection' => 'keep-alive',
                'Access-Control-Allow-Origin' => '*',
                'Access-Control-Allow-Headers' => 'Content-Type, Mcp-Session-Id, Last-Event-ID'
            ],
            'body' => "data: " . json_encode([
                'type' => 'connection_established',
                'session_id' => $sessionId,
                'message' => 'SSE connection established. Use POST for MCP requests.'
            ]) . "\n\n"
        ];
    }

    private function handlePostRequest(?string $body, string $sessionId): array
    {
        if (empty($body)) {
            return $this->createErrorResponse(400, 'Request body is required');
        }

        try {
            $this->logger->info('Processing POST request', ['sessionId' => $sessionId]);

            // Parse JSON-RPC message
            $parser = new Parser();
            $message = $parser->parse($body);

            if ($message instanceof Request) {
                return $this->handleJsonRpcRequest($message, $sessionId);
            } elseif ($message instanceof BatchRequest) {
                return $this->handleBatchRequest($message, $sessionId);
            } else {
                return $this->createErrorResponse(400, 'Invalid JSON-RPC message');
            }

        } catch (\Throwable $e) {
            $this->logger->error('POST request processing error', [
                'error' => $e->getMessage(),
                'body' => $body
            ]);

            return $this->createErrorResponse(400, 'Invalid request: ' . $e->getMessage());
        }
    }

    private function handleJsonRpcRequest(Request $request, string $sessionId): array
    {
        $this->logger->info('Processing JSON-RPC request', [
            'method' => $request->method,
            'id' => $request->id
        ]);

        try {
            // Create context
            $context = new \PhpMcp\Server\Context(
                $this->sessionManager->getSession($sessionId)
            );

            // Process the request
            $result = $this->protocol->processMessage($request, $sessionId);

            if ($result instanceof Response) {
                return [
                    'statusCode' => 200,
                    'headers' => [
                        'Content-Type' => 'application/json',
                        'Access-Control-Allow-Origin' => '*'
                    ],
                    'body' => json_encode($result)
                ];
            } else {
                return $this->createErrorResponse(500, 'Unexpected response type');
            }

        } catch (\Throwable $e) {
            $this->logger->error('Request processing error', [
                'method' => $request->method,
                'error' => $e->getMessage()
            ]);

            $error = Error::forInternalError($e->getMessage());
            $response = new Response($request->id, null, $error);

            return [
                'statusCode' => 200, // JSON-RPC errors are returned as 200 with error in body
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Access-Control-Allow-Origin' => '*'
                ],
                'body' => json_encode($response)
            ];
        }
    }

    private function handleBatchRequest(BatchRequest $batchRequest, string $sessionId): array
    {
        $this->logger->info('Processing batch request', [
            'count' => count($batchRequest->requests)
        ]);

        try {
            $result = $this->protocol->processMessage($batchRequest, $sessionId);

            if ($result instanceof BatchResponse) {
                return [
                    'statusCode' => 200,
                    'headers' => [
                        'Content-Type' => 'application/json',
                        'Access-Control-Allow-Origin' => '*'
                    ],
                    'body' => json_encode($result)
                ];
            } else {
                return $this->createErrorResponse(500, 'Unexpected batch response type');
            }

        } catch (\Throwable $e) {
            $this->logger->error('Batch request processing error', [
                'error' => $e->getMessage()
            ]);

            return $this->createErrorResponse(500, 'Batch processing error: ' . $e->getMessage());
        }
    }

    private function handleDeleteRequest(string $sessionId): array
    {
        $this->logger->info('Handling DELETE request', ['sessionId' => $sessionId]);

        // Clean up session
        $this->sessionManager->deleteSession($sessionId);

        return [
            'statusCode' => 204,
            'headers' => [
                'Access-Control-Allow-Origin' => '*'
            ],
            'body' => ''
        ];
    }

    private function createErrorResponse(int $statusCode, string $message): array
    {
        return [
            'statusCode' => $statusCode,
            'headers' => [
                'Content-Type' => 'application/json',
                'Access-Control-Allow-Origin' => '*'
            ],
            'body' => json_encode([
                'error' => $message,
                'status' => $statusCode
            ])
        ];
    }
}

// Vercel serverless function entry point
return function (array $event): array {
    $handler = new VercelMcpHandler();
    
    $method = $event['httpMethod'] ?? 'GET';
    $path = $event['path'] ?? '/';
    $headers = $event['headers'] ?? [];
    $body = $event['body'] ?? null;
    
    $result = $handler->handleRequest($method, $path, $headers, $body);
    
    // Ensure proper response format for Vercel
    return [
        'statusCode' => $result['statusCode'] ?? 200,
        'headers' => $result['headers'] ?? ['Content-Type' => 'application/json'],
        'body' => $result['body'] ?? json_encode(['error' => 'No response body'])
    ];
}; 