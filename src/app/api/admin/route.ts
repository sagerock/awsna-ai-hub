import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin, getFirebaseAdminAuth, getAdminDb } from '@/server/firebase-admin';

// Initialize Firebase Admin
initializeFirebaseAdmin();

// Predefined system admins
const SYSTEM_ADMINS = ['sage@sagerock.com'];

interface AdminPermission {
  type: 'system_admin' | 'content_admin' | 'user_admin' | 'school_admin';
  scope: 'global' | string;
  grantedAt: Date;
  grantedBy: string;
}

interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  permissions: AdminPermission[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

async function verifyToken(req: NextRequest): Promise<string | null> {
  const authorizationHeader = req.headers.get('Authorization');
  if (authorizationHeader?.startsWith('Bearer ')) {
    const idToken = authorizationHeader.substring(7);
    try {
      const adminAuth = getFirebaseAdminAuth();
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      return decodedToken.uid;
    } catch (error) {
      console.error("Error verifying Firebase ID token:", error);
      return null;
    }
  }
  return null;
}

async function isSystemAdmin(email: string): Promise<boolean> {
  return SYSTEM_ADMINS.includes(email.toLowerCase());
}

async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const adminDb = getAdminDb();
    
    // First check if user exists in admins collection
    const adminDoc = await adminDb.collection('admins').doc(userId).get();
    if (adminDoc.exists) {
      const adminData = adminDoc.data() as AdminUser;
      return adminData.isAdmin;
    }
    
    // If not in admin collection, check if they're a system admin by email
    // We need to get the user's email from Firebase Auth
    const adminAuth = getFirebaseAdminAuth();
    try {
      const userRecord = await adminAuth.getUser(userId);
      if (userRecord.email && await isSystemAdmin(userRecord.email)) {
        // Auto-create admin record for system admin
        const adminData: AdminUser = {
          uid: userId,
          email: userRecord.email,
          displayName: userRecord.displayName || userRecord.email,
          isAdmin: true,
          permissions: [
            {
              type: 'system_admin',
              scope: 'global',
              grantedAt: new Date(),
              grantedBy: 'system'
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'system'
        };
        
        await adminDb.collection('admins').doc(userId).set(adminData);
        console.log('Auto-created admin record for system admin:', userRecord.email);
        return true;
      }
    } catch (authError) {
      console.error('Error getting user from Firebase Auth:', authError);
    }
    
    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await verifyToken(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or missing token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'checkAdmin') {
      const isAdmin = await isUserAdmin(userId);
      return NextResponse.json({ isAdmin });
    }

    if (action === 'getAdmins') {
      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      const adminDb = getAdminDb();
      const adminsSnapshot = await adminDb.collection('admins').get();
      
      const admins: AdminUser[] = [];
      adminsSnapshot.forEach((doc) => {
        const data = doc.data() as AdminUser;
        admins.push({
          ...data,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date()
        });
      });
      
      return NextResponse.json({ admins });
    }

    if (action === 'getCollections') {
      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      try {
        const { listKnowledgeCollections } = await import('@/lib/qdrant');
        const collections = await listKnowledgeCollections();
        return NextResponse.json({ collections });
      } catch (error) {
        console.error('Error getting collections:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to get collections: ${errorMessage}` }, { status: 500 });
      }
    }

    if (action === 'getUsers') {
      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      try {
        const adminDb = getAdminDb();
        const usersSnapshot = await adminDb.collection('users').get();
        
        const users: any[] = [];
        usersSnapshot.forEach((doc) => {
          const data = doc.data();
          users.push({
            uid: doc.id,
            email: data.email || '',
            displayName: data.displayName || data.email || 'Unknown'
          });
        });
        
        return NextResponse.json({ users });
      } catch (error) {
        console.error('Error getting users:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to get users: ${errorMessage}` }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error in admin API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Admin API error: ${errorMessage}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyToken(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or missing token' }, { status: 401 });
    }

    const isAdmin = await isUserAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'initializeAdmin') {
      // Admin initialization is now handled automatically in isUserAdmin()
      // Just check if user is admin and return success
      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return NextResponse.json({ error: 'User is not authorized to be an admin' }, { status: 403 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'grantAdmin') {
      const { targetUserId, targetEmail, targetDisplayName } = body;
      
      const permissions: AdminPermission[] = [
        {
          type: 'content_admin',
          scope: 'global',
          grantedAt: new Date(),
          grantedBy: userId
        },
        {
          type: 'user_admin',
          scope: 'global',
          grantedAt: new Date(),
          grantedBy: userId
        }
      ];
      
      const adminDb = getAdminDb();
      const adminRef = adminDb.collection('admins').doc(targetUserId);
      const adminData: AdminUser = {
        uid: targetUserId,
        email: targetEmail,
        displayName: targetDisplayName,
        isAdmin: true,
        permissions,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId
      };
      
      await adminRef.set(adminData);
      console.log('Admin permissions granted to:', targetEmail);
      
      return NextResponse.json({ success: true });
    }

    if (action === 'revokeAdmin') {
      const { targetUserId } = body;
      
      // Prevent system admins from being revoked
      const adminDb = getAdminDb();
      const targetDoc = await adminDb.collection('admins').doc(targetUserId).get();
      if (targetDoc.exists) {
        const targetData = targetDoc.data() as AdminUser;
        if (await isSystemAdmin(targetData.email)) {
          return NextResponse.json({ error: 'Cannot revoke permissions from system admins' }, { status: 403 });
        }
      }

      await adminDb.collection('admins').doc(targetUserId).delete();
      console.log('Admin permissions revoked from user:', targetUserId);
      
      return NextResponse.json({ success: true });
    }

    if (action === 'deleteCollection') {
      const { collectionName } = body;
      
      try {
        const { deleteCollection } = await import('@/lib/qdrant');
        const result = await deleteCollection(collectionName);
        
        if (result) {
          console.log('Collection deleted by admin:', collectionName);
          return NextResponse.json({ success: true });
        } else {
          return NextResponse.json({ error: 'Failed to delete collection' }, { status: 500 });
        }
      } catch (error) {
        console.error('Error deleting collection:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to delete collection: ${errorMessage}` }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error in admin POST API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Admin POST API error: ${errorMessage}` }, { status: 500 });
  }
} 