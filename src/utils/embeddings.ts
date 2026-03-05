// Lazy-loaded embedding model — downloads ~23MB on first call, cached after
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!embedder) {
    const { pipeline } = await import('@xenova/transformers')
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  }
  const output = await embedder(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data as Float32Array)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom > 0 ? dot / denom : 0
}

// Supabase returns VECTOR as a string "[0.1,0.2,...]"
export function parseVector(raw: unknown): number[] | null {
  if (Array.isArray(raw)) return raw as number[]
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as number[]
    } catch { /* ignore */ }
  }
  return null
}

export function vectorToString(v: number[]): string {
  return `[${v.join(',')}]`
}
