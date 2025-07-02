import { NextRequest, NextResponse } from 'next/server';
import { uploadDocumentToQdrant, DocumentMetadata } from '@/lib/qdrant'; // qdrant.ts can be imported here as it's server-side
import { initializeFirebaseAdmin, getFirebaseAdminAuth } from '@/server/firebase-admin'; // Ensure this path is correct

async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const authorizationHeader = req.headers.get('Authorization');
  if (authorizationHeader?.startsWith('Bearer ')) {
    const idToken = authorizationHeader.substring(7); // Remove "Bearer " prefix
    try {
      initializeFirebaseAdmin(); // Ensure admin app is initialized
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

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or missing token' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const collectionName = formData.get('collectionName') as string;
    const schoolId = formData.get('schoolId') as string | undefined;

    console.log('Upload request:', {
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      collectionName,
      schoolId,
      userId
    });

    if (!file || !collectionName) {
      return NextResponse.json({ error: 'Missing file or collection name' }, { status: 400 });
    }

    // Handle different file types
    let fileContent: string;
    try {
      if (file.type === 'application/pdf') {
        // For PDFs, we'll need to extract text differently
        // For now, let's try to read as text and see what happens
        fileContent = await file.text();
        console.log('PDF content length:', fileContent.length);
      } else {
        fileContent = await file.text();
        console.log('Text content length:', fileContent.length);
      }
    } catch (fileError) {
      console.error('Error reading file content:', fileError);
      return NextResponse.json({ error: `Failed to read file content: ${fileError}` }, { status: 400 });
    }

    const metadata: DocumentMetadata = {
      fileName: file.name,
      schoolId: schoolId,
      collection: collectionName,
      uploadedBy: userId, // Use authenticated user ID from token
      uploadedAt: new Date().toISOString(),
      fileType: file.type,
      fileSize: file.size.toString(),
    };

    // Use proper collection naming convention: schoolId_collectionName
    const qdrantCollectionName = schoolId ? `${schoolId}_${collectionName}` : collectionName;

    console.log('Uploading to Qdrant:', {
      collectionName: qdrantCollectionName,
      contentLength: fileContent.length,
      metadata
    });

    try {
      await uploadDocumentToQdrant({
        content: fileContent,
        metadata,
        collectionName: qdrantCollectionName,
      });
    } catch (qdrantError) {
      console.error('Error uploading to Qdrant:', qdrantError);
      return NextResponse.json({ error: `Qdrant upload failed: ${qdrantError}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `File '${file.name}' uploaded to '${qdrantCollectionName}'.` });
  } catch (error) {
    console.error('Error in knowledge upload API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Upload failed: ${errorMessage}` }, { status: 500 });
  }
}
