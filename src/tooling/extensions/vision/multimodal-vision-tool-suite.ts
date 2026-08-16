/**
 * multimodal-vision-tool-suite.ts
 *
 * Model tool suite exposing multimodal vision perception, image generation,
 * metadata extraction, and semantic description:
 * - `vision_inspect`: Inspects an image file for dimensions and format.
 * - `vision_generate`: Generates an image matching specifications.
 * - `vision_describe`: Performs semantic visual captioning.
 * - `vision_session_status`: Queries vision inspection and generation history.
 */

import type { ToolDefinition } from "../../../core/contracts/tooling.contracts.js";
import { MultimodalVisionSupervisor } from "../../../agents/extensions/vision/multimodal-vision-supervisor.js";

export class MultimodalVisionToolSuite {
  private readonly supervisor: MultimodalVisionSupervisor;

  constructor(supervisor: MultimodalVisionSupervisor) {
    this.supervisor = supervisor;
  }

  public getTools(): ToolDefinition[] {
    return [
      {
        name: "vision_inspect",
        description: "Inspects an image file from the workspace, extracting its binary format, resolution width/height, aspect ratio, and metadata.",
        parameters: {
          filePath: {
            type: "string",
            required: true,
            description: "Path to the image file (PNG, JPEG, WebP, GIF, BMP, SVG).",
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const filePath = String(args.filePath || "").trim();

          try {
            const result = await this.supervisor.inspectImage(filePath, cwd);
            return {
              success: true,
              filePath,
              format: result.metadata.format,
              width: result.metadata.dimensions.width,
              height: result.metadata.dimensions.height,
              aspectRatio: result.metadata.dimensions.aspectRatio,
              byteLength: result.metadata.byteLength,
              mimeType: result.metadata.mimeType,
              description: result.description,
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
      },
      {
        name: "vision_generate",
        description: "Generates an image asset matching the requested prompt, aspect ratio, or dimensions.",
        parameters: {
          prompt: {
            type: "string",
            required: true,
            description: "Text prompt describing the desired image.",
          },
          aspectRatio: {
            type: "string",
            required: false,
            description: "Desired aspect ratio (e.g. '16:9', '1:1', '4:3', '9:16').",
          },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const prompt = String(args.prompt || "").trim();
          const aspectRatio = args.aspectRatio ? String(args.aspectRatio).trim() : undefined;

          try {
            const result = await this.supervisor.generateImage({ prompt, aspectRatio });
            return {
              success: true,
              imageId: result.imageId,
              format: result.format,
              width: result.dimensions.width,
              height: result.dimensions.height,
              aspectRatio: result.dimensions.aspectRatio,
              byteLength: result.byteLength,
              dataUrlPrefix: result.dataUrl.substring(0, 32),
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
      },
      {
        name: "vision_describe",
        description: "Analyzes an image and answers questions or describes visual elements in natural language.",
        parameters: {
          filePath: {
            type: "string",
            required: true,
            description: "Path to the image file to describe.",
          },
          userPrompt: {
            type: "string",
            required: false,
            description: "Optional user question or specific focus for analysis.",
          },
        },
        execute: async (args: Record<string, unknown>, cwd: string) => {
          const filePath = String(args.filePath || "").trim();
          const userPrompt = args.userPrompt ? String(args.userPrompt).trim() : undefined;

          try {
            const description = await this.supervisor.describeImage(filePath, userPrompt, cwd);
            return {
              success: true,
              filePath,
              description,
            };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
      },
      {
        name: "vision_session_status",
        description: "Queries the multimodal vision session status, showing inspected images and generated assets count.",
        parameters: {
          sessionId: {
            type: "string",
            required: true,
            description: "The unique identifier of the vision session.",
          },
        },
        execute: async (args: Record<string, unknown>, _cwd: string) => {
          const sessionId = String(args.sessionId || "").trim();
          const state = this.supervisor.getSessionStatus(sessionId);

          return {
            success: true,
            sessionId: state.sessionId,
            totalInspections: state.inspectedImages.length,
            totalGenerations: state.generatedImages.length,
            lastUpdated: state.lastUpdated,
          };
        },
      },
    ];
  }
}
