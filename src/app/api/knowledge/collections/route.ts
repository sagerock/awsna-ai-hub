import { NextRequest, NextResponse } from 'next/server';
import { listKnowledgeCollections } from '@/lib/qdrant';
import { initializeFirebaseAdmin, getFirebaseAdminAuth } from '@/server/firebase-admin';
import { getUserSchoolAccessAdmin } from '@/server/school-admin-actions';

async function verifyToken(req: NextRequest): Promise<string | null> {
  const authorizationHeader = req.headers.get('Authorization');
  if (authorizationHeader?.startsWith('Bearer ')) {
    const idToken = authorizationHeader.substring(7);
    try {
      initializeFirebaseAdmin();
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

/**
 * Filter collections based on school context and user permissions
 * Returns: 
 * - awsna_ collections (global AWSNA content available to all)
 * - school-specific collections if user has access to that school
 * - For admin users: all collections from all schools
 */
function filterCollectionsForSchool(allCollections: string[], schoolId?: string, isAdmin: boolean = false): string[] {
  const filteredCollections: string[] = [];
  const addedCollections = new Set<string>(); // Track to avoid duplicates
  
  for (const collection of allCollections) {
    let cleanName = collection;
    let shouldInclude = false;
    
    // Always include AWSNA global collections (available to all)
    if (collection.startsWith('awsna_')) {
      cleanName = collection.replace('awsna_', '');
      shouldInclude = true;
    }
    // Include school-specific collections if schoolId matches
    else if (schoolId && collection.startsWith(`${schoolId}_`)) {
      cleanName = collection.replace(`${schoolId}_`, '');
      shouldInclude = true;
    }
    // For admin users, include ALL collections from ALL schools
    else if (isAdmin) {
      // Extract school prefix and collection name
      const parts = collection.split('_');
      if (parts.length >= 2) {
        const schoolPrefix = parts[0];
        cleanName = parts.slice(1).join('_');
        // Mark as school-specific for admin visibility
        cleanName = `${cleanName} (${schoolPrefix})`;
        shouldInclude = true;
      }
    }
    
    // Add collection if it should be included and not already added
    if (shouldInclude && !addedCollections.has(cleanName)) {
      filteredCollections.push(cleanName);
      addedCollections.add(cleanName);
    }
  }
  
  // Sort collections: AWSNA content first, then school-specific, then others
  return filteredCollections.sort((a, b) => {
    const aIsSchoolSpecific = a.includes('(');
    const bIsSchoolSpecific = b.includes('(');
    
    if (!aIsSchoolSpecific && bIsSchoolSpecific) return -1;
    if (aIsSchoolSpecific && !bIsSchoolSpecific) return 1;
    return a.localeCompare(b);
  });
}

export async function GET(req: NextRequest) {
  try {
    const userId = await verifyToken(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or missing token' }, { status: 401 });
    }

    // Get query parameters for school context
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('schoolId');
    const showAll = searchParams.get('showAll') === 'true'; // Admin flag
    
    // Determine if user is an admin (you may want to implement proper admin checking)
    // For now, we'll use a simple heuristic or you can extend this
    const isAdmin = showAll; // This could be replaced with proper admin role checking
    
    // Verify user has access to the specified school (if provided and not admin)
    if (schoolId && schoolId !== 'awsna' && !isAdmin) {
      const hasAccess = await getUserSchoolAccessAdmin(userId, schoolId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied to this school' }, { status: 403 });
      }
    } else if (schoolId === 'awsna') {
      console.log('Allowing access to default AWSNA school for testing');
    }

    // Get all collections from Qdrant
    const allCollections = await listKnowledgeCollections();
    console.log('All collections from Qdrant:', allCollections);
    
    // Filter collections based on school context and admin status
    const filteredCollections = filterCollectionsForSchool(allCollections, schoolId || undefined, isAdmin);
    
    console.log(`Filtered collections for school '${schoolId}' (admin: ${isAdmin}):`, filteredCollections);
    console.log('Returning API response:', { collections: filteredCollections });
    
    return NextResponse.json({ collections: filteredCollections });

  } catch (error) {
    console.error('Error fetching knowledge collections:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch collections: ${errorMessage}` }, { status: 500 });
  }
}
