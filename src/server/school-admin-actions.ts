// Using import statements with 'server-only' package ensures this file is never used in client components
import 'server-only';

// We might need Timestamp if it's used in return types or parameters,
// but it's not directly used in getUserSchoolAccessAdmin.
// For now, let's assume it's not needed here. If it is, we'll add:
// import { Timestamp } from 'firebase/firestore'; 

/**
 * Check if a user has access to a specific school (server-side version)
 * @param userId User ID to check
 * @param schoolId School ID to check access for
 * @returns Boolean indicating if the user has access to the school
 */
export async function getUserSchoolAccessAdmin(userId: string, schoolId: string): Promise<boolean> {
  try {
    // Allow access to the default AWSNA school for testing
    if (schoolId === 'awsna') {
      console.log('Allowing access to default AWSNA school for testing');
      return true;
    }
    
    // This needs to be dynamically imported to prevent client-side inclusion
    const { getAdminDb } = await import('@/server/firebase-admin');
    const adminDb = getAdminDb();
    
    // Check if user exists in the school's users collection
    const userRef = adminDb.collection('schools').doc(schoolId).collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    return userDoc.exists;
  } catch (error) {
    console.error('Error checking user school access (admin):', error);
    // Default to no access on error
    return false;
  }
}
