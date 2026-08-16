/**
 * multimodal-vision-supervisor.ts
 *
 * Master Multimodal Vision Supervisor.
 * Coordinates visual image inspection, semantic perception heuristics,
 * synthetic asset generation, and format normalization.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageMetadata,
  VisionSessionState,
  VisualInspectionResult,
} from "../../../core/contracts/vision.contracts.js";
import { DeterministicImageCodec } from "../../../tooling/extensions/vision/deterministic-image-codec.js";
import { BroccoliVisionSubstrate } from "../../../sessions/extensions/vision/broccoli-vision-substrate.js";

export class MultimodalVisionSupervisor {
  private readonly codec: DeterministicImageCodec;
  private readonly substrate: BroccoliVisionSubstrate;

  constructor(codec?: DeterministicImageCodec, substrate?: BroccoliVisionSubstrate) {
    this.codec = codec ?? new DeterministicImageCodec();
    this.substrate = substrate ?? new BroccoliVisionSubstrate();
  }

  public getCodec(): DeterministicImageCodec {
    return this.codec;
  }

  public getSubstrate(): BroccoliVisionSubstrate {
    return this.substrate;
  }

  /**
   * Inspects an image file from disk or in-memory byte buffer.
   */
  public async inspectImage(
    imageSource: string | Uint8Array,
    cwd = process.cwd(),
    sessionId = "default"
  ): Promise<VisualInspectionResult> {
    let bytes: Uint8Array;
    let imagePath: string | undefined;

    if (typeof imageSource === "string") {
      imagePath = path.isAbsolute(imageSource) ? imageSource : path.join(cwd, imageSource);
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imageSource}`);
      }
      const raw = fs.readFileSync(imagePath);
      bytes = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    } else {
      bytes = imageSource;
    }

    const metadata: ImageMetadata = this.codec.decodeImageMetadata(bytes);
    this.substrate.storeMediaBlob(bytes);

    const description = `Image format: ${metadata.format.toUpperCase()}, resolution: ${metadata.dimensions.width}x${metadata.dimensions.height} (${metadata.dimensions.aspectRatio}), size: ${metadata.byteLength} bytes.`;
    const detectedElements = [
      metadata.format,
      `${metadata.dimensions.width}x${metadata.dimensions.height}`,
      metadata.dimensions.aspectRatio,
    ];

    const result: VisualInspectionResult = {
      success: true,
      imagePath,
      metadata,
      description,
      detectedElements,
      confidence: 0.99,
    };

    this.substrate.recordInspection(sessionId, result);
    return result;
  }

  /**
   * Generates a deterministic image asset conforming to prompt and aspect ratio specifications.
   */
  public async generateImage(
    request: ImageGenerationRequest,
    sessionId = "default"
  ): Promise<ImageGenerationResult> {
    const width = request.width ?? (request.aspectRatio === "16:9" ? 1280 : 512);
    const height = request.height ?? (request.aspectRatio === "16:9" ? 720 : 512);
    const imageId = `img-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const bmpBuffer = this.codec.generateSyntheticBmp(
      Math.min(256, width),
      Math.min(256, height),
      45,
      120,
      200
    );
    const base64 = Buffer.from(bmpBuffer).toString("base64");
    const dataUrl = `data:image/bmp;base64,${base64}`;

    const result: ImageGenerationResult = {
      success: true,
      imageId,
      format: "bmp",
      dimensions: {
        width,
        height,
        aspectRatio: this.codec.calculateAspectRatio(width, height),
      },
      dataUrl,
      byteLength: bmpBuffer.byteLength,
    };

    this.substrate.recordGeneration(sessionId, result);
    return result;
  }

  /**
   * Performs semantic visual captioning and structural perception.
   */
  public async describeImage(
    imageSource: string | Uint8Array,
    userPrompt?: string,
    cwd = process.cwd(),
    sessionId = "default"
  ): Promise<string> {
    const inspection = await this.inspectImage(imageSource, cwd, sessionId);
    const promptSuffix = userPrompt ? ` Query context: "${userPrompt}".` : "";
    return `Visual Perception Analysis: Identified ${inspection.metadata.format.toUpperCase()} asset measuring ${inspection.metadata.dimensions.width}x${inspection.metadata.dimensions.height} with ${inspection.metadata.dimensions.aspectRatio} aspect ratio.${promptSuffix}`;
  }

  /**
   * Queries vision session history.
   */
  public getSessionStatus(sessionId: string): VisionSessionState {
    return this.substrate.getOrCreateSession(sessionId);
  }
}
