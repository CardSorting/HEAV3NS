/**
 * [LAYER: SESSIONS EXTENSION]
 * broccolidb-vector-ann-engine.ts
 *
 * Approximate Nearest Neighbor (ANN) Vector Similarity Search Substrate for BroccoliDB (Pass 201 / ADR-139).
 * Supports Cosine Similarity, Euclidean Distance (L2), and Dot Product across dense Float64/Float32 embeddings.
 */

import type {
  IBroccoliVectorAnnEngine,
  VectorAnnSearchResult,
  VectorDistanceMetric,
} from "../../../core/contracts/broccolidb.contracts.js";

interface VectorEntry {
  vectorId: string;
  embedding: Float64Array;
  norm: number;
  metadata?: Record<string, unknown>;
}

export class BroccoliVectorAnnEngine implements IBroccoliVectorAnnEngine {
  // namespace -> (vectorId -> VectorEntry)
  private readonly namespaces = new Map<string, Map<string, VectorEntry>>();

  public insertVector(
    namespace: string,
    vectorId: string,
    embedding: Float64Array | Float32Array | readonly number[],
    metadata?: Record<string, unknown>
  ): void {
    if (!this.namespaces.has(namespace)) {
      this.namespaces.set(namespace, new Map());
    }

    const floatArray = embedding instanceof Float64Array ? embedding : new Float64Array(embedding);
    let normSq = 0;
    for (let i = 0; i < floatArray.length; i++) {
      normSq += floatArray[i] * floatArray[i];
    }
    const norm = Math.sqrt(normSq);

    const entry: VectorEntry = {
      vectorId,
      embedding: floatArray,
      norm: norm === 0 ? 1 : norm,
      metadata,
    };

    this.namespaces.get(namespace)!.set(vectorId, entry);
  }

  public deleteVector(namespace: string, vectorId: string): boolean {
    const space = this.namespaces.get(namespace);
    if (!space) return false;
    return space.delete(vectorId);
  }

  public searchNearest(
    namespace: string,
    queryEmbedding: Float64Array | Float32Array | readonly number[],
    topK = 10,
    metric: VectorDistanceMetric = "COSINE"
  ): readonly VectorAnnSearchResult[] {
    const space = this.namespaces.get(namespace);
    if (!space || space.size === 0) return [];

    const queryArray = queryEmbedding instanceof Float64Array ? queryEmbedding : new Float64Array(queryEmbedding);
    let queryNormSq = 0;
    for (let i = 0; i < queryArray.length; i++) {
      queryNormSq += queryArray[i] * queryArray[i];
    }
    const queryNorm = Math.sqrt(queryNormSq) || 1;

    const scoredResults: { vectorId: string; score: number; distance: number; metadata?: Record<string, unknown> }[] = [];

    for (const entry of space.values()) {
      if (entry.embedding.length !== queryArray.length) continue;

      let score = 0;
      let distance = 0;

      if (metric === "COSINE") {
        let dot = 0;
        for (let i = 0; i < queryArray.length; i++) {
          dot += queryArray[i] * entry.embedding[i];
        }
        score = dot / (queryNorm * entry.norm);
        distance = 1 - score;
      } else if (metric === "EUCLIDEAN") {
        let sumSq = 0;
        for (let i = 0; i < queryArray.length; i++) {
          const diff = queryArray[i] - entry.embedding[i];
          sumSq += diff * diff;
        }
        distance = Math.sqrt(sumSq);
        score = 1 / (1 + distance); // Normalize to [0, 1]
      } else if (metric === "DOT_PRODUCT") {
        let dot = 0;
        for (let i = 0; i < queryArray.length; i++) {
          dot += queryArray[i] * entry.embedding[i];
        }
        score = dot;
        distance = -dot;
      }

      scoredResults.push({
        vectorId: entry.vectorId,
        score,
        distance,
        metadata: entry.metadata,
      });
    }

    // Sort descending by score
    scoredResults.sort((a, b) => b.score - a.score);
    return scoredResults.slice(0, topK);
  }

  public getVectorCount(namespace: string): number {
    return this.namespaces.get(namespace)?.size ?? 0;
  }
}
