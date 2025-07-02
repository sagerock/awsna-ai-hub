import { auth } from '@/lib/firebase';

/**
 * Client-side utility for interacting with the knowledge management API
 */

/**
 * List documents from a specific school and collection with pagination
 */
export async function listKnowledgeDocuments(
  schoolId: string, 
  collection: string, 
  limit: number = 10, 
  offset: number = 0
): Promise<any> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(
      `/api/knowledge?action=listDocuments&schoolId=${encodeURIComponent(schoolId)}&collection=${encodeURIComponent(collection)}&limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list documents');
    }
    
    return response.json();
  } catch (error) {
    console.error('Error listing knowledge documents:', error);
    throw error;
  }
}

/**
 * List all available knowledge collections
 */
export async function listKnowledgeCollections(): Promise<string[]> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(
      `/api/knowledge?action=listCollections`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list collections');
    }
    
    const data = await response.json();
    return data.collections;
  } catch (error) {
    console.error('Error listing knowledge collections:', error);
    throw error;
  }
}

/**
 * Get the document count for a specific school and collection
 */
export async function getDocumentCount(
  schoolId: string, 
  collection: string
): Promise<number> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(
      `/api/knowledge?action=getDocumentCount&schoolId=${encodeURIComponent(schoolId)}&collection=${encodeURIComponent(collection)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get document count');
    }
    
    const data = await response.json();
    return data.count;
  } catch (error) {
    console.error('Error getting document count:', error);
    throw error;
  }
}

/**
 * Delete a document from a collection by filename
 */
export async function deleteKnowledgeDocument(
  schoolId: string, 
  collection: string, 
  fileName: string
): Promise<boolean> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(
      `/api/knowledge?schoolId=${encodeURIComponent(schoolId)}&collection=${encodeURIComponent(collection)}&fileName=${encodeURIComponent(fileName)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete document');
    }
    
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error deleting knowledge document:', error);
    throw error;
  }
}

/**
 * Upload a document to a knowledge collection
 * @param schoolId School ID to upload the document for
 * @param collection Collection name to upload to
 * @param document Document object with text content and metadata
 * @param onProgress Optional callback for upload progress
 * @returns Promise that resolves when upload is complete
 */
export async function uploadKnowledgeDocument(
  schoolId: string,
  collection: string,
  document: {
    text: string;
    metadata: {
      fileName: string;
      fileType: string;
      fileSize: number;
      uploadedBy: string;
      [key: string]: any;
    };
  },
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; documentId?: string }> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    // For direct API upload implementation in the future
    // This is a placeholder for future development
    // Currently, we're still using the client-side uploadDocumentToQdrant function
    // from qdrant.ts for the actual upload process
    
    /*
    const response = await fetch(
      `/api/knowledge`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          schoolId,
          collection,
          document
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload document');
    }
    
    const data = await response.json();
    return data;
    */
    
    // This is a temporary implementation that will be replaced with the API-based upload
    // when the server-side implementation is complete
    // Import the uploadDocument function directly for now
    const { uploadDocument } = await import('@/lib/qdrant');
    
    const collectionName = `${schoolId}_${collection}`;
    
    // Call the uploadDocument function with the proper parameters
    const docId = await uploadDocument(
      collectionName,
      document.text,
      {
        ...document.metadata,
        schoolId,
        collection,
        uploadedAt: new Date().toISOString()
      }
    );
    
    return { success: true, documentId: docId };
  } catch (error) {
    console.error('Error uploading knowledge document:', error);
    throw error;
  }
}
