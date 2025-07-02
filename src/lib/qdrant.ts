import { QdrantClient } from '@qdrant/js-client-rest';
import OpenAI from 'openai';
import { getClusterConfigs, getClusterForSchool, ClusterConfig as ClusterConfigType } from './cluster-config';

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define document metadata interface
export interface DocumentMetadata {
  fileName: string;
  schoolId?: string;
  collection: string;
  uploadedBy: string;
  uploadedAt: string;
  [key: string]: any; // Allow additional metadata
}

// Cluster configuration interface (re-exported from cluster-config.ts)
export type ClusterConfig = ClusterConfigType;

// Multi-tenant cluster management
class QdrantClusterManager {
  private clusters: Map<string, QdrantClient> = new Map();
  private defaultCluster: string = 'default';
  
  constructor() {
    // Initialize clusters based on configuration
    const configs = getClusterConfigs();
    console.log('Initializing Qdrant clusters with configs:', Object.keys(configs));
    
    for (const [name, config] of Object.entries(configs)) {
      console.log(`Initializing cluster: ${name} with URL: ${config.url}`);
      this.clusters.set(name, new QdrantClient({
        url: config.url,
        ...(config.apiKey ? { apiKey: config.apiKey } : {}),
      }));
    }
  }
  
  // Get cluster for a specific school/client
  getCluster(schoolId?: string): QdrantClient {
    const clusterName = schoolId ? getClusterForSchool(schoolId) : this.defaultCluster;
    const cluster = this.clusters.get(clusterName);
    
    if (!cluster) {
      throw new Error(`No Qdrant cluster available for cluster: ${clusterName}`);
    }
    
    return cluster;
  }
  
  // Add additional clusters for enterprise clients
  addCluster(name: string, config: ClusterConfig): void {
    this.clusters.set(name, new QdrantClient({
      url: config.url,
      ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    }));
  }
  
  // Get collection name with cluster prefix
  getCollectionName(schoolId: string, collection: string, clusterName?: string): string {
    const cluster = clusterName || (schoolId ? getClusterForSchool(schoolId) : this.defaultCluster);
    return `${cluster}_${schoolId}_${collection}`;
  }
}

// Global cluster manager instance
const clusterManager = new QdrantClusterManager();

/**
 * Initialize the Qdrant client
 */
function getQdrantClient(schoolId?: string): QdrantClient {
  try {
    const client = clusterManager.getCluster(schoolId);
    console.log('Qdrant client initialized for school:', schoolId);
    return client;
  } catch (error) {
    console.error('Error getting Qdrant client:', error);
    throw error;
  }
}

/**
 * Ensure collection exists in Qdrant
 */
async function ensureCollection(collectionName: string, schoolId?: string) {
  const client = getQdrantClient(schoolId);
  
  try {
    console.log(`Checking if collection exists: ${collectionName}`);
    
    // Check if collection exists
    const collections = await client.getCollections();
    const collectionExists = collections.collections.some(c => c.name === collectionName);
    
    console.log(`Collection ${collectionName} exists: ${collectionExists}`);
    
    if (!collectionExists) {
      console.log(`Creating collection: ${collectionName}`);
      
      // Create collection with 512 dimensions (optimized embedding size)
      await client.createCollection(collectionName, {
        vectors: {
          size: 512,
          distance: 'Cosine',
        },
      });
      
      console.log(`Collection ${collectionName} created successfully`);
      
      // Create payload index for text search
      console.log('Creating text search index...');
      await client.createPayloadIndex(collectionName, {
        field_name: 'text',
        field_schema: 'text',
      });
      
      // Create payload index for metadata
      console.log('Creating metadata indexes...');
      await client.createPayloadIndex(collectionName, {
        field_name: 'metadata.collection',
        field_schema: 'keyword',
      });
      
      await client.createPayloadIndex(collectionName, {
        field_name: 'metadata.schoolId',
        field_schema: 'keyword',
      });
      
      console.log(`All indexes created for collection: ${collectionName}`);
    }
    
    return true;
      } catch (error) {
      console.error('Error ensuring collection exists:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
}

/**
 * Generate embeddings for text using OpenAI's embedding model
 * @param text Text to generate embeddings for
 * @returns Embedding vector
 */
export async function generateEmbedding(text: string, model: string = 'text-embedding-3-small') {
  try {
    console.log(`Generating embedding for text length: ${text.length} using model: ${model}`);
    
    // Configure model-specific parameters
    const embeddingConfig: any = {
      model: model,
      input: text,
    };
    
    // For text-embedding-3-small and text-embedding-3-large, you can specify dimensions
    if (model === 'text-embedding-3-small') {
      // Options: 512, 768, 1024, 1536 (default)
      // Use 512 for optimized storage and performance
      embeddingConfig.dimensions = 512;
    }
    
    const response = await openai.embeddings.create(embeddingConfig);
    console.log('Embedding generated successfully, dimensions:', response.data[0].embedding.length);
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    console.error('OpenAI API Key set:', process.env.OPENAI_API_KEY ? 'Yes' : 'No');
    throw error;
  }
}

/**
 * Search for relevant documents in Qdrant collection
 * @param query User query
 * @param collections List of collection names to search in
 * @param limit Number of results to return per collection
 * @returns Array of relevant documents with their metadata
 */
export async function searchKnowledge(
  query: string, 
  collectionNames: string[], 
  limit: number = 5,
  schoolId?: string, // Optional schoolId for filtering
  strategy: 'hybrid' | 'semantic' | 'exact' = 'hybrid'
) {
  try {
    const queryEmbedding = await generateEmbedding(query);
    const results = [];
    const client = getQdrantClient(schoolId);
    
    for (const displayCollectionName of collectionNames) {
      // Reconstruct the full Qdrant collection name
      // The frontend sends filtered names like "school-renewal" but we need "awsna_school-renewal"
      let actualCollectionName = displayCollectionName;
      
      // Check if this is a filtered collection name that needs schoolId prefix
      if (schoolId && !displayCollectionName.includes('(') && !displayCollectionName.includes('_')) {
        actualCollectionName = `${schoolId}_${displayCollectionName}`;
      }
      // Handle admin collections like "org_content (sgws)" -> "sgws_org_content"
      else if (displayCollectionName.includes('(') && displayCollectionName.includes(')')) {
        const match = displayCollectionName.match(/^(.+)\s+\((.+)\)$/);
        if (match) {
          const [, collectionPart, schoolPart] = match;
          actualCollectionName = `${schoolPart}_${collectionPart.replace(/\s+/g, '_')}`;
        }
      }
      
      console.log(`Searching collection: ${displayCollectionName} -> ${actualCollectionName}`);
      
      try {
        let searchParams: any = {
          vector: queryEmbedding,
          limit: limit,
          with_payload: true,
        };
        
        // Add filters if schoolId is provided
        if (schoolId) {
          searchParams.filter = {
            must: [
              {
                key: 'metadata.schoolId',
                match: {
                  value: schoolId
                }
              }
            ]
          };
        }
        
        // For hybrid search, add text search
        if (strategy === 'hybrid' || strategy === 'exact') {
          searchParams.with_payload = true;
          searchParams.query_filter = {
            must: [
              {
                key: 'text',
                match: {
                  text: query
                }
              }
            ]
          };
        }
        
        const searchResult = await client.search(actualCollectionName, searchParams);
        results.push(...searchResult);
      } catch (error) {
        console.warn(`Collection ${displayCollectionName} -> ${actualCollectionName} not found or error searching:`, error);
        // Continue with other collections
      }
    }
    
    // Sort by score and take top 'limit' results
    const sortedResults = results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return sortedResults.map(result => ({
      text: result.payload?.text || '',
      metadata: result.payload?.metadata || {},
      score: result.score,
    }));
  } catch (error) {
    console.error('Error searching knowledge:', error);
    return [];
  }
}

/**
 * List all available knowledge collections
 */
export async function listKnowledgeCollections(schoolId?: string) {
  try {
    const client = getQdrantClient(schoolId);
    const collections = await client.getCollections();
    return collections.collections.map(c => c.name);
  } catch (error) {
    console.error('Error listing collections:', error);
    return [];
  }
}

/**
 * Get document count in a collection
 */
export async function getCollectionDocumentCount(collectionName: string, schoolId?: string) {
  try {
    const client = getQdrantClient();
    
    // Create filter if schoolId is provided
    const filter = schoolId ? {
      must: [
        {
          key: 'metadata.schoolId',
          match: {
            value: schoolId
          }
        }
      ]
    } : undefined;
    
    // Get all points to count unique documents
    const result = await client.scroll(collectionName, {
      filter,
      limit: 10000, // Large limit to get all chunks
      with_payload: true,
      with_vector: false
    });
    
    // Count unique filenames
    const uniqueFiles = new Set();
    result.points.forEach(point => {
      const metadata = point.payload?.metadata as DocumentMetadata;
      if (metadata?.fileName) {
        uniqueFiles.add(metadata.fileName);
      }
    });
    
    return uniqueFiles.size;
  } catch (error) {
    console.error(`Error getting document count for ${collectionName}:`, error);
    return 0;
  }
}

/**
 * Generate embeddings for multiple texts in batch using OpenAI's embedding model
 * @param texts Array of texts to generate embeddings for
 * @param model Model to use for embeddings
 * @returns Array of embedding vectors
 */
export async function generateEmbeddingsBatch(texts: string[], model: string = 'text-embedding-3-small'): Promise<number[][]> {
  try {
    console.log(`Generating ${texts.length} embeddings in batch using model: ${model}`);
    
    // Configure model-specific parameters
    const embeddingConfig: any = {
      model: model,
      input: texts, // OpenAI supports batch embedding generation
    };
    
    // For text-embedding-3-small, specify dimensions
    if (model === 'text-embedding-3-small') {
      embeddingConfig.dimensions = 512;
    }
    
    const response = await openai.embeddings.create(embeddingConfig);
    console.log(`Batch embeddings generated successfully, count: ${response.data.length}, dimensions: ${response.data[0].embedding.length}`);
    
    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('Error generating batch embeddings:', error);
    console.error('OpenAI API Key set:', process.env.OPENAI_API_KEY ? 'Yes' : 'No');
    throw error;
  }
}

/**
 * Enhanced chunking with configurable parameters for different document types
 */
function splitTextIntoChunksOptimized(
  text: string, 
  options: {
    maxChunkSize?: number;
    overlap?: number;
    minChunkSize?: number;
    preserveParagraphs?: boolean;
  } = {}
): string[] {
  const {
    maxChunkSize = 2000,
    overlap = 200,
    minChunkSize = 100,
    preserveParagraphs = true
  } = options;

  const chunks: string[] = [];
  
  // For PDFs, try to preserve paragraph structure first
  let segments: string[];
  if (preserveParagraphs) {
    // Split by double newlines (paragraphs) first, then sentences
    segments = text.split(/\n\s*\n/).flatMap(paragraph => 
      paragraph.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0)
    );
  } else {
    segments = text.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
  }
  
  let currentChunk = '';
  
  for (const segment of segments) {
    const trimmedSegment = segment.trim();
    const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + trimmedSegment;
    
    if (potentialChunk.length <= maxChunkSize) {
      currentChunk = potentialChunk;
    } else {
      // Save current chunk if it meets minimum size
      if (currentChunk && currentChunk.length >= minChunkSize) {
        chunks.push(currentChunk + '.');
        
        // Create smart overlap
        const overlapText = currentChunk.slice(-overlap);
        const sentenceStart = overlapText.lastIndexOf('. ');
        currentChunk = sentenceStart > 0 ? overlapText.slice(sentenceStart + 2) : overlapText;
      }
      
      // Start new chunk with current segment
      currentChunk += (currentChunk ? '. ' : '') + trimmedSegment;
    }
  }
  
  // Add final chunk
  if (currentChunk && currentChunk.length >= minChunkSize) {
    chunks.push(currentChunk + '.');
  }
  
  return chunks;
}

/**
 * Split text into chunks for embedding with overlap (legacy function for compatibility)
 */
function splitTextIntoChunks(text: string, maxChunkSize: number = 2000, overlap: number = 200): string[] {
  return splitTextIntoChunksOptimized(text, { maxChunkSize, overlap });
}

/**
 * Optimized document upload with batch processing and parallel operations
 */
export async function uploadDocumentToQdrantOptimized({
  content,
  metadata,
  collectionName,
  onProgress,
  batchSize = 20 // Process chunks in batches for better performance
}: {
  content: string;
  metadata: Record<string, any>;
  collectionName: string;
  onProgress?: (progress: number) => void;
  batchSize?: number;
}) {
  try {
    // Ensure the collection exists
    await ensureCollection(collectionName, metadata.schoolId);
    
    // Enhanced chunking with PDF-specific optimizations
    const chunkOptions = {
      maxChunkSize: 2000,
      overlap: 200,
      minChunkSize: 100,
      preserveParagraphs: metadata.fileType?.includes('pdf') || false
    };
    
    const chunks = splitTextIntoChunksOptimized(content, chunkOptions);
    const totalChunks = chunks.length;
    
    console.log(`Processing ${totalChunks} chunks in batches of ${batchSize}`);
    
    const client = getQdrantClient();
    let processedChunks = 0;
    
    // Process chunks in batches for better performance
    for (let batchStart = 0; batchStart < chunks.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, chunks.length);
      const batchChunks = chunks.slice(batchStart, batchEnd);
      
      console.log(`Processing batch ${Math.floor(batchStart / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
      
      // Generate embeddings for the entire batch at once
      const embeddings = await generateEmbeddingsBatch(batchChunks);
      
      // Prepare points for batch upsert
      const points = batchChunks.map((chunk, index) => ({
        id: Date.now() + batchStart + index,
        vector: embeddings[index],
        payload: {
          text: chunk,
          metadata: metadata,
          chunkIndex: batchStart + index,
          totalChunks: totalChunks
        }
      }));
      
      // Batch upsert all points in this batch
      await client.upsert(collectionName, {
        wait: true,
        points: points
      });
      
      processedChunks += batchChunks.length;
      console.log(`Successfully uploaded batch (${processedChunks}/${totalChunks} chunks)`);
      
      // Report progress
      if (onProgress) {
        onProgress(Math.round((processedChunks / totalChunks) * 100));
      }
    }
    
    console.log(`Document upload completed: ${totalChunks} chunks processed in ${Math.ceil(chunks.length / batchSize)} batches`);
    return true;
  } catch (error) {
    console.error('Error uploading document to Qdrant (optimized):', error);
    throw error;
  }
}

/**
 * Upload a document to Qdrant with progress tracking (backward compatible)
 * Uses optimized batch processing by default
 */
export async function uploadDocumentToQdrant({
  content,
  metadata,
  collectionName,
  onProgress
}: {
  content: string;
  metadata: Record<string, any>;
  collectionName: string;
  onProgress?: (progress: number) => void;
}) {
  return uploadDocumentToQdrantOptimized({
    content,
    metadata,
    collectionName,
    onProgress,
    batchSize: 20 // Default batch size for optimal performance
  });
}

/**
 * Upload a document to Qdrant
 */
export async function uploadDocument(
  collectionName: string, 
  document: string, 
  metadata: Record<string, any>
): Promise<string> {
  try {
    // Ensure the collection exists
    await ensureCollection(collectionName);
    
    // Generate embedding for the document
    const embedding = await generateEmbedding(document);
    
    // Create a unique ID
    const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Upload to Qdrant
    const client = getQdrantClient();
    await client.upsert(collectionName, {
      wait: true,
      points: [
        {
          id,
          vector: embedding,
          payload: {
            text: document,
            metadata
          }
        }
      ]
    });
    
    return id;
  } catch (error) {
    console.error('Error uploading document:', error);
    throw error;
  }
}

/**
 * List documents in a collection grouped by filename with pagination
 * @param collectionName The name of the collection
 * @param schoolId Optional school ID for filtering
 * @param limit Maximum number of documents to return
 * @param offset Offset for pagination
 * @returns Array of unique documents with their metadata and chunk counts
 */
export async function listDocuments(
  collectionName: string,
  schoolId?: string,
  limit: number = 50,
  offset: number = 0
) {
  try {
    const client = getQdrantClient();
    
    // Create filter if schoolId is provided
    const filter = schoolId ? {
      must: [
        {
          key: 'metadata.schoolId',
          match: {
            value: schoolId
          }
        }
      ]
    } : undefined;
    
    // Get all chunks to group by document
    const result = await client.scroll(collectionName, {
      filter,
      limit: 10000, // Get many chunks to group properly
      offset,
      with_payload: true,
      with_vector: false // No need for the vector data
    });
    
    // Group chunks by filename
    const documentsMap = new Map();
    
    result.points.forEach(point => {
      const metadata = point.payload?.metadata as DocumentMetadata || {} as DocumentMetadata;
      const fileName = metadata.fileName;
      
      if (fileName) {
        if (!documentsMap.has(fileName)) {
          // Create new document entry
          documentsMap.set(fileName, {
            fileName,
            metadata,
            chunkCount: 1,
            totalChunks: point.payload?.totalChunks || 1,
            uploadedAt: metadata.uploadedAt,
            fileSize: metadata.fileSize,
            fileType: metadata.fileType,
            uploadedBy: metadata.uploadedBy,
            // Generate meaningful preview based on file type
            preview: (() => {
              const text = point.payload?.text;
              if (typeof text !== 'string') return '(No preview available)';
              
              // Skip preview for binary file types (PDF, images, etc.)
              const fileType = metadata.fileType?.toLowerCase();
              if (fileType?.includes('pdf') || 
                  fileType?.includes('image') || 
                  text.startsWith('%PDF') || 
                  text.match(/^[^\x20-\x7E]+/)) {
                return '(Binary file - no preview)';
              }
              
              // For text files, show meaningful preview
              return text.substring(0, 200) + '...';
            })()
          });
        } else {
          // Increment chunk count for existing document
          const doc = documentsMap.get(fileName);
          if (doc) {
            doc.chunkCount += 1;
          }
        }
      }
    });
    
    // Convert to array and sort by upload date (newest first)
    const documents = Array.from(documentsMap.values()).sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
    
    // Apply pagination to the grouped documents
    const paginatedDocuments = documents.slice(0, limit);
    
    return {
      documents: paginatedDocuments,
      nextOffset: documents.length > limit ? offset + limit : null,
      totalDocuments: documents.length
    };
  } catch (error) {
    console.error(`Error listing documents in ${collectionName}:`, error);
    return { documents: [], nextOffset: null, totalDocuments: 0 };
  }
}

/**
 * Delete a document from a collection
 * @param collectionName The name of the collection
 * @param documentId The ID of the document to delete
 * @returns True if deletion was successful
 */
export async function deleteDocument(
  collectionName: string,
  documentId: string
): Promise<boolean> {
  try {
    const client = getQdrantClient();
    await client.delete(collectionName, {
      wait: true,
      points: [documentId],
    });
    return true;
  } catch (error) {
    console.error(`Error deleting document ${documentId} from ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Delete all chunks of a document by filename using proper Qdrant filter format
 * @param collectionName The name of the collection
 * @param fileName The filename of the document to delete
 * @param schoolId Optional school ID for filtering
 * @returns True if deletion was successful
 */
export async function deleteDocumentByFileName(
  collectionName: string,
  fileName: string,
  schoolId?: string
): Promise<boolean> {
  try {
    const client = getQdrantClient();
    
    console.log(`Deleting all chunks for document ${fileName} from ${collectionName}...`);
    
    // Create proper Qdrant filter using the correct format
    const mustConditions = [
      {
        key: "metadata.fileName",
        match: {
          value: fileName
        }
      }
    ];
    
    // Add school filter if provided
    if (schoolId) {
      mustConditions.push({
        key: "metadata.schoolId",
        match: {
          value: schoolId
        }
      });
    }
    
    // Use the correct Qdrant delete with filter format  
    const response = await client.delete(collectionName, {
      wait: true,
      filter: {
        must: mustConditions
      }
    } as any);
    
    console.log(`Successfully deleted chunks for document ${fileName}`, response);
    return true;
  } catch (error) {
    console.error(`Error deleting document ${fileName} from ${collectionName}:`, error);
    
    // If the filter approach fails, fall back to client-side filtering
    console.log('Filter-based deletion failed, trying client-side approach...');
    return await deleteDocumentByFileNameClientSide(collectionName, fileName, schoolId);
  }
}

/**
 * Fallback method: Delete by getting all points and filtering client-side
 */
async function deleteDocumentByFileNameClientSide(
  collectionName: string,
  fileName: string,
  schoolId?: string
): Promise<boolean> {
  try {
    const client = getQdrantClient();
    
    console.log(`Using client-side filtering for document ${fileName} in ${collectionName}...`);
    
    let allPoints: any[] = [];
    let nextOffset: any = undefined;
    
    // Scroll through all points in batches
    do {
      const result = await client.scroll(collectionName, {
        limit: 1000,
        offset: nextOffset,
        with_payload: true,
        with_vector: false
      });
      
      allPoints.push(...result.points);
      nextOffset = result.next_page_offset;
    } while (nextOffset);
    
    console.log(`Retrieved ${allPoints.length} total points from collection`);
    
    // Filter client-side for matching filename and schoolId
    const matchingPoints = allPoints.filter(point => {
      const metadata = point.payload?.metadata;
      if (!metadata) return false;
      
      const fileNameMatches = metadata.fileName === fileName;
      const schoolMatches = !schoolId || metadata.schoolId === schoolId;
      
      return fileNameMatches && schoolMatches;
    });
    
    if (matchingPoints.length === 0) {
      console.log(`No chunks found for document ${fileName} in ${collectionName}`);
      return true;
    }
    
    // Extract all point IDs
    const pointIds = matchingPoints.map(point => point.id);
    console.log(`Found ${pointIds.length} chunks for document ${fileName}, deleting...`);
    
    // Delete all chunks by their IDs (in batches to avoid large requests)
    const batchSize = 100;
    for (let i = 0; i < pointIds.length; i += batchSize) {
      const batch = pointIds.slice(i, i + batchSize);
      await client.delete(collectionName, {
        wait: true,
        points: batch
      });
      console.log(`Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(pointIds.length / batchSize)}`);
    }
    
    console.log(`Successfully deleted ${pointIds.length} chunks for document ${fileName}`);
    return true;
  } catch (error) {
    console.error(`Error in client-side deletion for ${fileName}:`, error);
    throw error;
  }
}

/**
 * Delete a collection from Qdrant
 * @param collectionName The name of the collection to delete
 * @param schoolId Optional school ID for the client
 * @returns True if deletion was successful
 */
export async function deleteCollection(collectionName: string, schoolId?: string): Promise<boolean> {
  try {
    const client = getQdrantClient(schoolId);
    
    console.log(`Deleting collection: ${collectionName}`);
    
    // Check if collection exists first
    const collections = await client.getCollections();
    const collectionExists = collections.collections.some(c => c.name === collectionName);
    
    if (!collectionExists) {
      console.log(`Collection ${collectionName} does not exist, nothing to delete`);
      return true;
    }
    
    // Delete the collection
    await client.deleteCollection(collectionName);
    console.log(`Successfully deleted collection: ${collectionName}`);
    
    return true;
  } catch (error) {
    console.error(`Error deleting collection ${collectionName}:`, error);
    throw error;
  }
}
