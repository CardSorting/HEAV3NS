/**
 * vision.contracts.ts
 *
 * Core data contracts for the Deterministic Multimodal Vision, Visual Perception & Image Codec Substrate (Phase 80 / ADR-032).
 */

export type ImageFormat = "png" | "jpeg" | "webp" | "gif" | "bmp" | "svg";

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
  readonly aspectRatio: string;
}

export interface ImageMetadata {
  readonly format: ImageFormat;
  readonly dimensions: ImageDimensions;
  readonly byteLength: number;
  readonly mimeType: string;
  readonly colorDepth?: number;
}

export interface VisualInspectionResult {
  readonly success: boolean;
  readonly imagePath?: string;
  readonly metadata: ImageMetadata;
  readonly description: string;
  readonly detectedElements?: readonly string[];
  readonly confidence: number;
}

export interface ImageGenerationRequest {
  readonly prompt: string;
  readonly model?: string;
  readonly width?: number;
  readonly height?: number;
  readonly aspectRatio?: string;
  readonly style?: string;
}

export interface ImageGenerationResult {
  readonly success: boolean;
  readonly imageId: string;
  readonly format: ImageFormat;
  readonly dimensions: ImageDimensions;
  readonly dataUrl: string;
  readonly byteLength: number;
}

export interface VisionSessionState {
  readonly sessionId: string;
  readonly inspectedImages: readonly VisualInspectionResult[];
  readonly generatedImages: readonly ImageGenerationResult[];
  readonly lastUpdated: number;
}

export interface VisionWorkspaceSnapshot {
  readonly activeSessions: readonly VisionSessionState[];
  readonly totalInspections: number;
  readonly totalGenerations: number;
  readonly timestamp: number;
}
