export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  truncated?: boolean;
  durationMs?: number;
}

export interface AnchoredEditResult {
  success: boolean;
  actualHash?: string;
  expectedHash?: string;
  error?: string;
}

export interface ToolingEvent {
  type: string;
  source: string;
  payload: Record<string, unknown>;
  timestamp: number;
  durationMs?: number;
}

export interface TerminalProgressFrame {
  frameIndex: number;
  spinnerSymbol: string;
  label: string;
  percent: number;
  progressBar: string;
  timestamp: number;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params: {
    event: string;
    source: string;
    payload: Record<string, unknown>;
    timestamp: number;
    durationMs?: number;
  };
}

export interface ParameterSchema {
  type: "string" | "number" | "boolean" | "array" | "object";
  required?: boolean;
  description?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, ParameterSchema>;
  execute: (args: Record<string, unknown>, cwd: string) => Promise<unknown>;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

export interface IHands {
  writeFile(filePath: string, content: string): Promise<void>;
  editFile(filePath: string, target: string, replacement: string): Promise<boolean>;
}

export interface IEars {
  listen(eventType: string, callback: (event: ToolingEvent) => void): void;
  emit(eventType: string, source: string, payload: Record<string, unknown>, durationMs?: number): void;
}

export interface IToolRegistry {
  registerTool(tool: ToolDefinition): void;
  executeTool(name: string, args: Record<string, unknown>, cwd: string): Promise<unknown>;
}
