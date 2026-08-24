import type {
  ParameterSchema,
  ToolDefinition,
} from "../../../core/contracts/tooling.contracts.js";

export interface OpenAIFunctionDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required: string[];
      additionalProperties?: boolean;
    };
  };
}

export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "OBJECT";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

/**
 * High-fidelity serializer that converts internal LUMI ToolDefinitions
 * into standardized schema formats for various LLM providers (OpenAI, Anthropic, Gemini, MCP).
 */
export class ToolSchemaSerializer {
  /**
   * Converts a single ParameterSchema to a standard JSON Schema property representation.
   */
  public serializeProperty(schema: ParameterSchema): Record<string, unknown> {
    const prop: Record<string, unknown> = {
      type: schema.type,
      description: schema.description || "",
    };

    if (schema.enum && schema.enum.length > 0) {
      prop.enum = [...schema.enum];
    }

    if (schema.default !== undefined) {
      prop.default = schema.default;
    }

    if (schema.format) {
      prop.format = schema.format;
    }

    if (typeof schema.minimum === "number") {
      prop.minimum = schema.minimum;
    }

    if (typeof schema.maximum === "number") {
      prop.maximum = schema.maximum;
    }

    if (schema.nullable) {
      prop.nullable = true;
    }

    if (schema.type === "array") {
      if (schema.items) {
        prop.items = this.serializeProperty(schema.items);
      } else {
        prop.items = { type: "string" };
      }
    }

    if (schema.type === "object" && schema.properties) {
      const nestedProps: Record<string, unknown> = {};
      const nestedRequired: string[] = [];

      for (const [key, childSchema] of Object.entries(schema.properties)) {
        nestedProps[key] = this.serializeProperty(childSchema);
        if (childSchema.required) {
          nestedRequired.push(key);
        }
      }

      prop.properties = nestedProps;
      if (nestedRequired.length > 0) {
        prop.required = nestedRequired;
      }
    }

    return prop;
  }

  /**
   * Generates a standard JSON Schema object parameters definition for a tool.
   */
  public toJsonSchemaParameters(tool: ToolDefinition): {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  } {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    if (tool.parameters) {
      for (const [name, schema] of Object.entries(tool.parameters)) {
        properties[name] = this.serializeProperty(schema);
        if (schema.required) {
          required.push(name);
        }
      }
    }

    return {
      type: "object",
      properties,
      required,
    };
  }

  /**
   * Serializes a ToolDefinition to OpenAI Function Calling standard format.
   */
  public toOpenAIFunction(tool: ToolDefinition): OpenAIFunctionDefinition {
    const params = this.toJsonSchemaParameters(tool);
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          ...params,
          additionalProperties: false,
        },
      },
    };
  }

  /**
   * Serializes a ToolDefinition to Anthropic Claude tool use format.
   */
  public toAnthropicTool(tool: ToolDefinition): AnthropicToolDefinition {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: this.toJsonSchemaParameters(tool),
    };
  }

  /**
   * Serializes a ToolDefinition to Google Gemini Function Declaration format.
   */
  public toGeminiDeclaration(tool: ToolDefinition): GeminiFunctionDeclaration {
    const params = this.toJsonSchemaParameters(tool);
    const geminiProperties: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(params.properties)) {
      const propObj = { ...(v as Record<string, unknown>) };
      if (propObj.type) {
        propObj.type = String(propObj.type).toUpperCase();
      }
      geminiProperties[k] = propObj;
    }

    return {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "OBJECT",
        properties: geminiProperties,
        required: params.required,
      },
    };
  }

  /**
   * Serializes a ToolDefinition to MCP (Model Context Protocol) format.
   */
  public toMCPTool(tool: ToolDefinition): MCPToolDefinition {
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: this.toJsonSchemaParameters(tool),
    };
  }

  /**
   * Serializes a ToolDefinition to OpenAI Strict Schema format (strict: true).
   * In strict mode, all object parameters must require all keys and have additionalProperties: false.
   */
  public toOpenAIStrictFunction(tool: ToolDefinition): OpenAIFunctionDefinition & { function: { strict: true } } {
    const params = this.toJsonSchemaParameters(tool);
    // In strict mode, all defined properties must be listed in required
    const allProps = Object.keys(params.properties);
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        strict: true,
        parameters: {
          type: "object",
          properties: params.properties,
          required: allProps,
          additionalProperties: false,
        },
      },
    };
  }

  /**
   * Formats tool_choice parameter for OpenAI APIs.
   */
  public toOpenAIToolChoice(
    choice: "auto" | "none" | "required" | { toolName: string }
  ): string | { type: "function"; function: { name: string } } {
    if (typeof choice === "object") {
      return { type: "function", function: { name: choice.toolName } };
    }
    return choice;
  }

  /**
   * Formats tool_choice parameter for Anthropic Claude APIs.
   */
  public toAnthropicToolChoice(
    choice: "auto" | "any" | { toolName: string }
  ): { type: "auto" } | { type: "any" } | { type: "tool"; name: string } {
    if (typeof choice === "object") {
      return { type: "tool", name: choice.toolName };
    }
    return { type: choice };
  }

  /**
   * Formats tool_config parameter for Google Gemini APIs.
   */
  public toGeminiToolConfig(
    mode: "AUTO" | "ANY" | "NONE" = "AUTO",
    allowedFunctionNames?: string[]
  ): { functionCallingConfig: { mode: "AUTO" | "ANY" | "NONE"; allowedFunctionNames?: string[] } } {
    return {
      functionCallingConfig: {
        mode,
        ...(allowedFunctionNames && allowedFunctionNames.length > 0 ? { allowedFunctionNames } : {}),
      },
    };
  }
}
