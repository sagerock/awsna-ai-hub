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

async function ensureAWSNASchoolExists(adminDb: any, userId: string): Promise<void> {
  try {
    const awsnaDoc = await adminDb.collection('schools').doc('awsna').get();
    
    if (!awsnaDoc.exists) {
      const awsnaData = {
        name: 'AWSNA (Association of Waldorf Schools of North America)',
        address: '518 Davis Street, Evanston, IL 60201',
        website: 'https://www.waldorfeducation.org',
        contactEmail: 'info@waldorfeducation.org',
        createdAt: new Date(),
        createdBy: 'system'
      };
      
      await adminDb.collection('schools').doc('awsna').set(awsnaData);
      console.log('AWSNA school created automatically');
    }
  } catch (error) {
    console.error('Error ensuring AWSNA school exists:', error);
  }
}

async function ensureUserInAWSNA(userId: string): Promise<void> {
  try {
    const adminDb = getAdminDb();
    
    // Ensure AWSNA school exists first
    await ensureAWSNASchoolExists(adminDb, userId);
    
    // Check if user is already in AWSNA
    const userInAWSNA = await adminDb.collection('schools').doc('awsna').collection('users').doc(userId).get();
    
    if (!userInAWSNA.exists) {
      // Add user to AWSNA with user role
      await adminDb.collection('schools').doc('awsna').collection('users').doc(userId).set({
        role: 'user',
        assignedAt: new Date(),
        assignedBy: 'system'
      });
      console.log('User automatically assigned to AWSNA:', userId);
    }
  } catch (error) {
    console.error('Error ensuring user in AWSNA:', error);
  }
}

async function createDefaultCollectionsForSchool(schoolId: string): Promise<void> {
  try {
    // Import QdrantClient and get cluster configs
    const { QdrantClient } = await import('@qdrant/js-client-rest');
    const { getClusterConfigs, getClusterForSchool } = await import('@/lib/cluster-config');
    
    // Get the appropriate cluster for this school
    const clusterName = getClusterForSchool(schoolId);
    const configs = getClusterConfigs();
    const config = configs[clusterName];
    
    if (!config) {
      console.error(`No cluster config found for school: ${schoolId}`);
      return;
    }
    
    // Initialize Qdrant client
    const client = new QdrantClient({
      url: config.url,
      ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    });
    
    // Default collections for Waldorf schools
    const defaultCollections = [
      'curriculum',
      'accreditation', 
      'marketing',
      'administration',
      'general',
      'school-renewal'
    ];
    
    console.log(`Creating default collections for school: ${schoolId}`);
    
    // Create each collection with the school prefix
    for (const collection of defaultCollections) {
      const fullCollectionName = `${schoolId}_${collection}`;
      
      try {
        // Check if collection exists
        const collections = await client.getCollections();
        const collectionExists = collections.collections.some((c: any) => c.name === fullCollectionName);
        
        if (!collectionExists) {
          console.log(`Creating collection: ${fullCollectionName}`);
          
          // Create collection with 512 dimensions (optimized embedding size)
          await client.createCollection(fullCollectionName, {
            vectors: {
              size: 512,
              distance: 'Cosine',
            },
          });
          
          // Create payload indexes
          await client.createPayloadIndex(fullCollectionName, {
            field_name: 'text',
            field_schema: 'text',
          });
          
          await client.createPayloadIndex(fullCollectionName, {
            field_name: 'metadata.collection',
            field_schema: 'keyword',
          });
          
          await client.createPayloadIndex(fullCollectionName, {
            field_name: 'metadata.schoolId',
            field_schema: 'keyword',
          });
          
          console.log(`Collection ${fullCollectionName} created successfully with indexes`);
        } else {
          console.log(`Collection ${fullCollectionName} already exists`);
        }
      } catch (collectionError) {
        console.error(`Error creating collection ${fullCollectionName}:`, collectionError);
        // Don't throw error for individual collection failures
      }
    }
    
    console.log(`Completed creating default collections for school: ${schoolId}`);
  } catch (error) {
    console.error('Error creating default collections for school:', error);
    // Don't throw error to avoid breaking school creation
  }
}

async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const adminDb = getAdminDb();
    
    // Ensure all users are in AWSNA (default school)
    await ensureUserInAWSNA(userId);
    
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
        // Ensure AWSNA exists before creating admin
        await ensureAWSNASchoolExists(adminDb, userId);
        
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
        
        // Also ensure admin is in AWSNA with admin role
        await adminDb.collection('schools').doc('awsna').collection('users').doc(userId).set({
          role: 'admin',
          assignedAt: new Date(),
          assignedBy: 'system'
        });
        
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
        const adminAuth = getFirebaseAdminAuth();
        const adminDb = getAdminDb();
        
        // Get all users from Firebase Auth
        const listUsersResult = await adminAuth.listUsers();
        
        const users: any[] = [];
        
        // For each user, also get their school assignments
        for (const userRecord of listUsersResult.users) {
          // Get user's school assignments
          const schoolAssignments: any[] = [];
          try {
            const schoolsSnapshot = await adminDb.collection('schools').get();
            for (const schoolDoc of schoolsSnapshot.docs) {
              const userInSchool = await schoolDoc.ref.collection('users').doc(userRecord.uid).get();
              if (userInSchool.exists) {
                const userData = userInSchool.data();
                schoolAssignments.push({
                  schoolId: schoolDoc.id,
                  schoolName: schoolDoc.data().name,
                  role: userData?.role || 'user'
                });
              }
            }
          } catch (schoolError) {
            console.error('Error getting school assignments for user:', userRecord.uid, schoolError);
          }
          
          users.push({
            uid: userRecord.uid,
            email: userRecord.email || '',
            displayName: userRecord.displayName || userRecord.email || 'Unknown',
            emailVerified: userRecord.emailVerified,
            disabled: userRecord.disabled,
            creationTime: userRecord.metadata.creationTime,
            lastSignInTime: userRecord.metadata.lastSignInTime,
            schools: schoolAssignments
          });
        }
        
        return NextResponse.json({ users });
      } catch (error) {
        console.error('Error getting users:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to get users: ${errorMessage}` }, { status: 500 });
      }
    }

    if (action === 'getMySchools') {
      // Regular users can get their own school assignments
      try {
        const adminDb = getAdminDb();
        
        // Get user's school assignments
        const schoolAssignments: any[] = [];
        const schoolsSnapshot = await adminDb.collection('schools').get();
        
        for (const schoolDoc of schoolsSnapshot.docs) {
          const userInSchool = await schoolDoc.ref.collection('users').doc(userId).get();
          if (userInSchool.exists) {
            const userData = userInSchool.data();
            const schoolData = schoolDoc.data();
            schoolAssignments.push({
              school: {
                id: schoolDoc.id,
                name: schoolData.name,
                address: schoolData.address,
                website: schoolData.website,
                contactEmail: schoolData.contactEmail,
                isDefault: schoolDoc.id === 'awsna'
              },
              role: userData?.role || 'user'
            });
          }
        }
        
        return NextResponse.json({ schools: schoolAssignments });
      } catch (error) {
        console.error('Error getting user schools:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to get user schools: ${errorMessage}` }, { status: 500 });
      }
    }

    if (action === 'getSchools') {
      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      try {
        const adminDb = getAdminDb();
        const schoolsSnapshot = await adminDb.collection('schools').get();
        
        const schools: any[] = [];
        schoolsSnapshot.forEach((doc) => {
          const data = doc.data();
          schools.push({
            id: doc.id,
            name: data.name,
            address: data.address,
            website: data.website,
            contactEmail: data.contactEmail,
            createdAt: data.createdAt,
            createdBy: data.createdBy,
            isDefault: doc.id === 'awsna'
          });
        });
        
        return NextResponse.json({ schools });
      } catch (error) {
        console.error('Error getting schools:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to get schools: ${errorMessage}` }, { status: 500 });
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

    if (action === 'createUser') {
      const { email, password, displayName } = body;
      
      try {
        const adminAuth = getFirebaseAdminAuth();
        const adminDb = getAdminDb();
        
        // Create user in Firebase Auth
        const userRecord = await adminAuth.createUser({
          email,
          password,
          displayName: displayName || email,
          emailVerified: false // Admin-created users should verify their email
        });
        
        // Ensure AWSNA school exists and assign user to it
        await ensureAWSNASchoolExists(adminDb, userId);
        await adminDb.collection('schools').doc('awsna').collection('users').doc(userRecord.uid).set({
          role: 'user',
          assignedAt: new Date(),
          assignedBy: userId
        });
        
        console.log('User created by admin:', email, 'UID:', userRecord.uid, 'and assigned to AWSNA');
        
        return NextResponse.json({ 
          success: true, 
          user: {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName
          }
        });
      } catch (error) {
        console.error('Error creating user:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to create user: ${errorMessage}` }, { status: 500 });
      }
    }

    if (action === 'deleteUser') {
      const { targetUserId } = body;
      
      try {
        const adminAuth = getFirebaseAdminAuth();
        const adminDb = getAdminDb();
        
        // Get user info before deletion for logging
        const userRecord = await adminAuth.getUser(targetUserId);
        
        // Prevent system admins from being deleted
        if (await isSystemAdmin(userRecord.email || '')) {
          return NextResponse.json({ error: 'Cannot delete system administrators' }, { status: 403 });
        }
        
        // Delete user from Firebase Auth
        await adminAuth.deleteUser(targetUserId);
        
        // Also remove from admins collection if they were an admin
        try {
          await adminDb.collection('admins').doc(targetUserId).delete();
        } catch (adminDeleteError) {
          // It's okay if they weren't an admin
          console.log('User was not an admin, skipping admin record deletion');
        }
        
        console.log('User deleted by admin:', userRecord.email, 'UID:', targetUserId);
        
        return NextResponse.json({ success: true });
      } catch (error) {
        console.error('Error deleting user:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to delete user: ${errorMessage}` }, { status: 500 });
      }
    }

    if (action === 'updateUser') {
      const { targetUserId, email, displayName, disabled } = body;
      
      try {
        const adminAuth = getFirebaseAdminAuth();
        
        // Get current user to check if they're a system admin
        const currentUser = await adminAuth.getUser(targetUserId);
        if (await isSystemAdmin(currentUser.email || '')) {
          return NextResponse.json({ error: 'Cannot modify system administrators' }, { status: 403 });
        }
        
        // Update user in Firebase Auth
        const updateData: any = {};
        if (email) updateData.email = email;
        if (displayName) updateData.displayName = displayName;
        if (disabled !== undefined) updateData.disabled = disabled;
        
        const userRecord = await adminAuth.updateUser(targetUserId, updateData);
        
        console.log('User updated by admin:', userRecord.email, 'UID:', targetUserId);
        
        return NextResponse.json({ 
          success: true,
          user: {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            disabled: userRecord.disabled
          }
        });
      } catch (error) {
        console.error('Error updating user:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to update user: ${errorMessage}` }, { status: 500 });
      }
    }

    if (action === 'createSchool') {
      const { name, address, website, contactEmail } = body;
      
      try {
        const adminDb = getAdminDb();
        
        // Generate school ID from name (lowercase, replace spaces with hyphens)
        const schoolId = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        
        // Check if school already exists
        const existingSchool = await adminDb.collection('schools').doc(schoolId).get();
        if (existingSchool.exists) {
          return NextResponse.json({ error: 'A school with this name already exists' }, { status: 400 });
        }
        
        const schoolData = {
          name,
          address: address || '',
          website: website || '',
          contactEmail: contactEmail || '',
          createdAt: new Date(),
          createdBy: userId
        };
        
        await adminDb.collection('schools').doc(schoolId).set(schoolData);
        
        // Create default Qdrant collections for the new school
        await createDefaultCollectionsForSchool(schoolId);
        
        console.log('School created by admin:', name, 'ID:', schoolId, 'with default collections');
        
        return NextResponse.json({ 
          success: true, 
          school: {
            id: schoolId,
            ...schoolData
          }
        });
      } catch (error) {
        console.error('Error creating school:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to create school: ${errorMessage}` }, { status: 500 });
      }
    }

    if (action === 'assignUserToSchool') {
      const { targetUserId, schoolId, role } = body;
      
      try {
        const adminDb = getAdminDb();
        
        // Verify school exists
        const schoolDoc = await adminDb.collection('schools').doc(schoolId).get();
        if (!schoolDoc.exists) {
          return NextResponse.json({ error: 'School not found' }, { status: 404 });
        }
        
        // Add user to school
        const userSchoolData = {
          role: role || 'user',
          assignedAt: new Date(),
          assignedBy: userId
        };
        
        await adminDb.collection('schools').doc(schoolId).collection('users').doc(targetUserId).set(userSchoolData);
        
        console.log('User assigned to school:', targetUserId, 'to', schoolId, 'as', role);
        
        return NextResponse.json({ success: true });
      } catch (error) {
        console.error('Error assigning user to school:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to assign user to school: ${errorMessage}` }, { status: 500 });
      }
    }

    if (action === 'removeUserFromSchool') {
      const { targetUserId, schoolId } = body;
      
      try {
        const adminDb = getAdminDb();
        
        // Cannot remove from AWSNA (default school)
        if (schoolId === 'awsna') {
          return NextResponse.json({ error: 'Cannot remove users from AWSNA (default school)' }, { status: 400 });
        }
        
        await adminDb.collection('schools').doc(schoolId).collection('users').doc(targetUserId).delete();
        
        console.log('User removed from school:', targetUserId, 'from', schoolId);
        
        return NextResponse.json({ success: true });
      } catch (error) {
        console.error('Error removing user from school:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to remove user from school: ${errorMessage}` }, { status: 500 });
      }
    }

    if (action === 'updateSchool') {
      const { schoolId, name, address, website, contactEmail } = body;
      
      try {
        // Cannot edit AWSNA school ID or completely replace it
        if (schoolId === 'awsna' && name && name !== 'AWSNA (Association of Waldorf Schools of North America)') {
          return NextResponse.json({ error: 'Cannot change AWSNA school name' }, { status: 400 });
        }
        
        const adminDb = getAdminDb();
        
        // Get current school data
        const schoolDoc = await adminDb.collection('schools').doc(schoolId).get();
        if (!schoolDoc.exists) {
          return NextResponse.json({ error: 'School not found' }, { status: 404 });
        }
        
        // Prepare update data
        const updateData: any = {
          updatedAt: new Date(),
          updatedBy: userId
        };
        
        if (name !== undefined) updateData.name = name;
        if (address !== undefined) updateData.address = address;
        if (website !== undefined) updateData.website = website;
        if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
        
        await adminDb.collection('schools').doc(schoolId).update(updateData);
        
        console.log('School updated by admin:', schoolId, 'Changes:', updateData);
        
        return NextResponse.json({ success: true });
      } catch (error) {
        console.error('Error updating school:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to update school: ${errorMessage}` }, { status: 500 });
      }
    }

    if (action === 'deleteSchool') {
      const { schoolId } = body;
      
      try {
        // Cannot delete AWSNA (default school)
        if (schoolId === 'awsna') {
          return NextResponse.json({ error: 'Cannot delete AWSNA (default school)' }, { status: 400 });
        }
        
        const adminDb = getAdminDb();
        
        // Delete all users in the school first
        const usersSnapshot = await adminDb.collection('schools').doc(schoolId).collection('users').get();
        const batch = adminDb.batch();
        
        usersSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        
        // Delete the school document
        batch.delete(adminDb.collection('schools').doc(schoolId));
        
        await batch.commit();
        
        console.log('School deleted by admin:', schoolId);
        
        return NextResponse.json({ success: true });
      } catch (error) {
        console.error('Error deleting school:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: `Failed to delete school: ${errorMessage}` }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error in admin POST API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Admin POST API error: ${errorMessage}` }, { status: 500 });
  }
} 