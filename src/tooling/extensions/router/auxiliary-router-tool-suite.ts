/**
 * auxiliary-router-tool-suite.ts
 *
 * Model tool suite exposing dynamic user auxiliary routing, task overrides, and provider configuration (Phase 101 / ADR-055).
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import type { AuxiliaryTaskType } from "../../../core/contracts/auxiliary-router.contracts.js";
import { AuxiliaryRouterSupervisor } from "../../../agents/extensions/router/auxiliary-router-supervisor.js";

export class AuxiliaryRouterToolSuite {
  private supervisor: AuxiliaryRouterSupervisor;

  constructor(supervisor: AuxiliaryRouterSupervisor) {
    this.supervisor = supervisor;
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: "auxiliary_route_task",
        description: "Dispatches an auxiliary sub-task (compression, search, extraction, vision, etc.) through the dynamic user-configured fallback chain.",
        parameters: {
          taskType: {
            type: "string",
            description: "Task type: 'compression', 'search', 'web_extract', 'vision_analysis', 'browser_vision', 'title_generation', 'insights', 'patch_review', 'commit_message'",
            required: true,
          },
          prompt: {
            type: "string",
            description: "The prompt or payload for the auxiliary sub-task",
            required: true,
          },
          systemPrompt: {
            type: "string",
            description: "Optional system prompt instructions for the auxiliary task",
            required: false,
          },
          requiresVision: {
            type: "boolean",
            description: "Whether the task requires visual perception capabilities",
            required: false,
          },
          customModelOverride: {
            type: "string",
            description: "Optional dynamic user model override to use for this specific dispatch",
            required: false,
          },
          maxTokens: {
            type: "number",
            description: "Optional maximum tokens to allocate for the auxiliary generation",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (!args.taskType || typeof args.taskType !== "string") {
            return { success: false, error: "Missing required parameter 'taskType'." };
          }
          if (!args.prompt || typeof args.prompt !== "string") {
            return { success: false, error: "Missing required parameter 'prompt'." };
          }

          const taskType = args.taskType as AuxiliaryTaskType;
          const prompt = args.prompt;
          const systemPrompt = typeof args.systemPrompt === "string" ? args.systemPrompt : undefined;
          const requiresVision = typeof args.requiresVision === "boolean" ? args.requiresVision : false;
          const customModelOverride = typeof args.customModelOverride === "string" ? args.customModelOverride : undefined;
          const maxTokens = typeof args.maxTokens === "number" ? args.maxTokens : undefined;

          const result = await this.supervisor.dispatchAuxiliaryTask({
            taskType,
            prompt,
            systemPrompt,
            requiresVision,
            customModelOverride,
            maxTokens,
          });

          return {
            success: result.success,
            taskType: result.taskType,
            selectedProvider: result.selectedProvider,
            selectedModel: result.selectedModel,
            attempts: result.attempts,
            outputText: result.outputText,
            tokensUsed: result.tokensUsed,
          };
        },
      },
      {
        name: "auxiliary_set_task_override",
        description: "Dynamically configures a user-chosen provider and model for a specific auxiliary task type.",
        parameters: {
          taskType: {
            type: "string",
            description: "Task type to override (e.g. 'vision_analysis', 'compression', 'web_extract')",
            required: true,
          },
          provider: {
            type: "string",
            description: "User-selected provider identifier (e.g. 'custom-openai', 'anthropic', 'openrouter', 'ollama')",
            required: true,
          },
          model: {
            type: "string",
            description: "User-selected model name (e.g. 'claude-3-5-sonnet', 'gpt-4o', 'qwen-2.5-coder')",
            required: true,
          },
          baseUrl: {
            type: "string",
            description: "Optional custom API endpoint URL",
            required: false,
          },
          supportsVision: {
            type: "boolean",
            description: "Whether this user-configured model supports multimodal vision",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (!args.taskType || typeof args.taskType !== "string") {
            return { success: false, error: "Missing required parameter 'taskType'." };
          }
          if (!args.provider || typeof args.provider !== "string") {
            return { success: false, error: "Missing required parameter 'provider'." };
          }
          if (!args.model || typeof args.model !== "string") {
            return { success: false, error: "Missing required parameter 'model'." };
          }

          const taskType = args.taskType as AuxiliaryTaskType;
          const provider = args.provider;
          const model = args.model;
          const baseUrl = typeof args.baseUrl === "string" ? args.baseUrl : undefined;
          const supportsVision = typeof args.supportsVision === "boolean" ? args.supportsVision : false;

          this.supervisor.setTaskOverride(taskType, {
            provider,
            model,
            baseUrl,
            supportsVision,
            priority: 0,
          });

          return {
            success: true,
            taskType,
            override: {
              provider,
              model,
              baseUrl,
              supportsVision,
            },
            message: `Auxiliary task '${taskType}' dynamically configured to use user-selected ${provider} (${model}).`,
          };
        },
      },
      {
        name: "auxiliary_configure_provider",
        description: "Dynamically registers or configures a user-chosen provider with custom model, priority, and endpoint.",
        parameters: {
          provider: {
            type: "string",
            description: "Unique provider identifier",
            required: true,
          },
          model: {
            type: "string",
            description: "Model name for this provider",
            required: true,
          },
          priority: {
            type: "number",
            description: "Priority ranking in fallback chain (lower number = higher priority)",
            required: false,
          },
          baseUrl: {
            type: "string",
            description: "Optional custom API base URL",
            required: false,
          },
          isFreeOnly: {
            type: "boolean",
            description: "Whether this provider is a free-tier endpoint",
            required: false,
          },
          supportsVision: {
            type: "boolean",
            description: "Whether this provider supports multimodal vision",
            required: false,
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (!args.provider || typeof args.provider !== "string") {
            return { success: false, error: "Missing required parameter 'provider'." };
          }
          if (!args.model || typeof args.model !== "string") {
            return { success: false, error: "Missing required parameter 'model'." };
          }

          const provider = args.provider;
          const model = args.model;
          const priority = typeof args.priority === "number" ? args.priority : 50;
          const baseUrl = typeof args.baseUrl === "string" ? args.baseUrl : undefined;
          const isFreeOnly = typeof args.isFreeOnly === "boolean" ? args.isFreeOnly : false;
          const supportsVision = typeof args.supportsVision === "boolean" ? args.supportsVision : false;

          this.supervisor.registerUserProvider({
            provider,
            model,
            priority,
            baseUrl,
            isFreeOnly,
            supportsVision,
          });

          return {
            success: true,
            providerConfig: {
              provider,
              model,
              priority,
              baseUrl,
              isFreeOnly,
              supportsVision,
            },
            message: `Auxiliary provider '${provider}' with user-selected model '${model}' registered dynamically.`,
          };
        },
      },
    ];
  }
}
