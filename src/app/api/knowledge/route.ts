import { NextRequest, NextResponse } from 'next/server';
import { 
  listDocuments, 
  deleteDocument, 
  deleteDocumentByFileName,
  deleteCollection,
  listKnowledgeCollections,
  getCollectionDocumentCount
} from '@/lib/qdrant';
import { initializeFirebaseAdmin, getFirebaseAdminAuth } from '@/server/firebase-admin';
import { getUserSchoolAccessAdmin } from '@/server/school-admin-actions';

// Initialize Firebase Admin
initializeFirebaseAdmin();

async function verifyToken(req: NextRequest): Promise<string | null> {
  const authorizationHeader = req.headers.get('Authorization');
  if (authorizationHeader?.startsWith('Bearer ')) {
    const idToken = authorizationHeader.substring(7);
    try {
      const adminAuth = getFirebaseAdminAuth();
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      return decodedToken.uid;
    } catch (error) {
      console.error("Error verifying Firebase ID token in API route:", error);
      return null;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await verifyToken(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or missing token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const schoolId = searchParams.get('schoolId');
    const collection = searchParams.get('collection');

    // Check user access for school operations
    if (schoolId && schoolId !== 'awsna') {
      const hasAccess = await getUserSchoolAccessAdmin(userId, schoolId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied to this school' }, { status: 403 });
      }
    } else if (schoolId === 'awsna') {
      console.log('Allowing access to default AWSNA school for testing');
    }

    if (action === 'listCollections') {
      const collections = await listKnowledgeCollections(schoolId || undefined);
      return NextResponse.json({ collections });
    }

    if (action === 'listDocuments') {
      const limit = parseInt(searchParams.get('limit') || '10');
      const offset = parseInt(searchParams.get('offset') || '0');
      
      if (!collection) {
        return NextResponse.json({ error: 'Collection parameter is required' }, { status: 400 });
      }

      const collectionName = schoolId ? `${schoolId}_${collection}` : collection;
      const result = await listDocuments(collectionName, schoolId || undefined, limit, offset);
      return NextResponse.json(result);
    }

    if (action === 'getDocumentCount') {
      if (!collection) {
        return NextResponse.json({ error: 'Collection parameter is required' }, { status: 400 });
      }

      const collectionName = schoolId ? `${schoolId}_${collection}` : collection;
      const count = await getCollectionDocumentCount(collectionName, schoolId || undefined);
      return NextResponse.json({ count });
    }

    if (action === 'deleteCollection') {
      if (!collection) {
        return NextResponse.json({ error: 'Collection parameter is required' }, { status: 400 });
      }

      const collectionName = schoolId ? `${schoolId}_${collection}` : collection;
      console.log(`Attempting to delete collection: ${collectionName}`);
      
      try {
        await deleteCollection(collectionName, schoolId || undefined);
        return NextResponse.json({ success: true, message: `Collection ${collectionName} deleted successfully` });
      } catch (error) {
        console.error(`Error deleting collection ${collectionName}:`, error);
        return NextResponse.json({ error: `Failed to delete collection: ${error}` }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });

  } catch (error) {
    console.error('Error in knowledge API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `API request failed: ${errorMessage}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get authorization token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    
    // Verify token
    let decodedToken;
    try {
      decodedToken = await getFirebaseAdminAuth().verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const userId = decodedToken.uid;
    
    // Parse request body
    const body = await request.json();
    const { schoolId, collection, document } = body;
    
    if (!schoolId || !collection || !document) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    // Validate the user has access to the specified school
    const hasAccess = await getUserSchoolAccessAdmin(userId, schoolId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to the specified school' }, { status: 403 });
    }
    
    // Implementation for document upload will be added in a future update
    // This endpoint is a placeholder for future API-based upload functionality
    
    return NextResponse.json({ success: true, message: 'Document upload API endpoint created' });
  } catch (error) {
    console.error('Error in knowledge API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get authorization token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    
    // Verify token
    let decodedToken;
    try {
      decodedToken = await getFirebaseAdminAuth().verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const userId = decodedToken.uid;
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const schoolId = searchParams.get('schoolId');
    const collection = searchParams.get('collection');
    const fileName = searchParams.get('fileName');
    
    if (!schoolId || !collection || !fileName) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    // Validate the user has access to the specified school
    const hasAccess = await getUserSchoolAccessAdmin(userId, schoolId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to the specified school' }, { status: 403 });
    }
    
    // Delete all chunks of the document by filename
    const collectionName = `${schoolId}_${collection}`;
    await deleteDocumentByFileName(collectionName, fileName, schoolId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in knowledge API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
