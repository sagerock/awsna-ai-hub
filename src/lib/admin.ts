import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  permissions: AdminPermission[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface AdminPermission {
  type: 'system_admin' | 'content_admin' | 'user_admin' | 'school_admin';
  scope: 'global' | string; // 'global' or specific schoolId
  grantedAt: Date;
  grantedBy: string;
}

export interface SystemStats {
  totalUsers: number;
  totalSchools: number;
  totalDocuments: number;
  totalConversations: number;
  activeUsers: number; // users active in last 30 days
  diskUsage: number; // in MB
  lastUpdated: Date;
}

// Predefined system admins - these emails get admin access automatically
const SYSTEM_ADMINS = [
  'sage@sagerock.com'
];

/**
 * Check if a user is a system admin
 */
export function isSystemAdmin(email: string): boolean {
  return SYSTEM_ADMINS.includes(email.toLowerCase());
}

/**
 * Check if a user has admin permissions
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    // Get Firebase ID token for authentication
    const { auth } = await import('@/lib/firebase');
    if (!auth.currentUser) {
      return false;
    }
    
    const token = await auth.currentUser.getIdToken();
    
    const response = await fetch('/api/admin?action=checkAdmin', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error('Failed to check admin status');
      return false;
    }

    const data = await response.json();
    return data.isAdmin || false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Initialize admin user (called when system admin logs in)
 */
export async function initializeAdminUser(userId: string, email: string, displayName: string): Promise<void> {
  try {
    if (!isSystemAdmin(email)) {
      throw new Error('User is not authorized to be an admin');
    }

    // Get Firebase ID token for authentication
    const { auth } = await import('@/lib/firebase');
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    const token = await auth.currentUser.getIdToken();
    
    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'initializeAdmin',
        email,
        displayName
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to initialize admin user');
    }

    console.log('Admin user initialized:', email);
  } catch (error) {
    console.error('Error initializing admin user:', error);
    // Don't throw error to avoid breaking auth flow
    // throw error;
  }
}

/**
 * Grant admin permissions to a user
 */
export async function grantAdminPermissions(
  targetUserId: string,
  targetEmail: string,
  targetDisplayName: string,
  permissions: AdminPermission[],
  grantedBy: string
): Promise<void> {
  try {
    // Get Firebase ID token for authentication
    const { auth } = await import('@/lib/firebase');
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    const token = await auth.currentUser.getIdToken();
    
    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'grantAdmin',
        targetUserId,
        targetEmail,
        targetDisplayName
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to grant admin permissions');
    }

    console.log('Admin permissions granted to:', targetEmail);
  } catch (error) {
    console.error('Error granting admin permissions:', error);
    throw error;
  }
}

/**
 * Revoke admin permissions from a user
 */
export async function revokeAdminPermissions(targetUserId: string, revokedBy: string): Promise<void> {
  try {
    // Get Firebase ID token for authentication
    const { auth } = await import('@/lib/firebase');
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    const token = await auth.currentUser.getIdToken();
    
    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'revokeAdmin',
        targetUserId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to revoke admin permissions');
    }

    console.log('Admin permissions revoked from user:', targetUserId);
  } catch (error) {
    console.error('Error revoking admin permissions:', error);
    throw error;
  }
}

/**
 * Get all admin users
 */
export async function getAllAdmins(): Promise<AdminUser[]> {
  try {
    // Get Firebase ID token for authentication
    const { auth } = await import('@/lib/firebase');
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    const token = await auth.currentUser.getIdToken();
    
    const response = await fetch('/api/admin?action=getAdmins', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get admin users');
    }

    const data = await response.json();
    return data.admins || [];
  } catch (error) {
    console.error('Error getting admin users:', error);
    throw error;
  }
}

/**
 * Get all knowledge collections (admin only)
 */
export async function listKnowledgeCollections(): Promise<string[]> {
  try {
    // Get Firebase ID token for authentication
    const { auth } = await import('@/lib/firebase');
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    const token = await auth.currentUser.getIdToken();
    
    const response = await fetch('/api/admin?action=getCollections', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get collections');
    }

    const data = await response.json();
    return data.collections || [];
  } catch (error) {
    console.error('Error getting collections:', error);
    throw error;
  }
}

/**
 * Delete a knowledge collection (admin only)
 */
export async function deleteCollection(collectionName: string): Promise<boolean> {
  try {
    // Get Firebase ID token for authentication
    const { auth } = await import('@/lib/firebase');
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    const token = await auth.currentUser.getIdToken();
    
    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'deleteCollection',
        collectionName
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete collection');
    }

    return true;
  } catch (error) {
    console.error('Error deleting collection:', error);
    throw error;
  }
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers(): Promise<{uid: string, email: string, displayName: string, emailVerified?: boolean, disabled?: boolean}[]> {
  try {
    // Get Firebase ID token for authentication
    const { auth } = await import('@/lib/firebase');
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    const token = await auth.currentUser.getIdToken();
    
    const response = await fetch('/api/admin?action=getUsers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get users');
    }

    const data = await response.json();
    return data.users || [];
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
}

/**
 * Create a new user (admin only)
 */
export async function createUser(email: string, password: string, displayName?: string): Promise<{uid: string, email: string, displayName: string}> {
  try {
    // Get Firebase ID token for authentication
    const { auth } = await import('@/lib/firebase');
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    const token = await auth.currentUser.getIdToken();
    
    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'createUser',
        email,
        password,
        displayName
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create user');
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

/**
 * Delete a user (admin only)
 */
export async function deleteUser(targetUserId: string): Promise<boolean> {
  try {
    // Get Firebase ID token for authentication
    const { auth } = await import('@/lib/firebase');
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    const token = await auth.currentUser.getIdToken();
    
    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'deleteUser',
        targetUserId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }

    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

/**
 * Update a user (admin only)
 */
export async function updateUser(targetUserId: string, updates: {email?: string, displayName?: string, disabled?: boolean}): Promise<{uid: string, email: string, displayName: string, disabled: boolean}> {
  try {
    // Get Firebase ID token for authentication
    const { auth } = await import('@/lib/firebase');
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    const token = await auth.currentUser.getIdToken();
    
    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'updateUser',
        targetUserId,
        ...updates
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update user');
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

/**
 * Get system statistics for admin dashboard
 */
export async function getSystemStats(): Promise<SystemStats> {
  try {
    // This is a simplified implementation - in production you might want to cache these
    const [usersSnapshot, schoolsSnapshot] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'schools'))
    ]);

    // For conversations and documents, we'd need to aggregate across all user subcollections
    // This is a placeholder implementation
    const stats: SystemStats = {
      totalUsers: usersSnapshot.size,
      totalSchools: schoolsSnapshot.size,
      totalDocuments: 0, // Would need to query Qdrant for this
      totalConversations: 0, // Would need to aggregate all user conversations
      activeUsers: 0, // Would need to check recent activity
      diskUsage: 0, // Would need to calculate from Qdrant/Firebase storage
      lastUpdated: new Date()
    };

    return stats;
  } catch (error) {
    console.error('Error getting system stats:', error);
    throw error;
  }
}

/**
 * Check if user has specific admin permission
 */
export async function hasAdminPermission(
  userId: string, 
  permissionType: AdminPermission['type'], 
  scope: string = 'global'
): Promise<boolean> {
  try {
    const adminDoc = await getDoc(doc(db, 'admins', userId));
    if (!adminDoc.exists()) {
      return false;
    }
    
    const adminData = adminDoc.data() as AdminUser;
    if (!adminData.isAdmin) {
      return false;
    }
    
    // System admins have all permissions
    if (adminData.permissions.some(p => p.type === 'system_admin' && p.scope === 'global')) {
      return true;
    }
    
    // Check specific permission
    return adminData.permissions.some(p => 
      p.type === permissionType && (p.scope === 'global' || p.scope === scope)
    );
  } catch (error) {
    console.error('Error checking admin permission:', error);
    return false;
  }
}

// Helper function to get ID token
async function getIdToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (!auth.currentUser) {
      return null;
    }
    return await auth.currentUser.getIdToken();
  } catch (error) {
    console.error('Error getting ID token:', error);
    return null;
  }
}

// School Management Functions
export async function getSchools(): Promise<any[]> {
  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/admin?action=getSchools', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get schools: ${error}`);
  }

  const data = await response.json();
  return data.schools || [];
}

export async function createSchool(schoolData: {
  name: string;
  address?: string;
  website?: string;
  contactEmail?: string;
}): Promise<void> {
  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      action: 'createSchool',
      ...schoolData
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create school: ${error}`);
  }
}

export async function updateSchool(schoolId: string, schoolData: {
  name?: string;
  address?: string;
  website?: string;
  contactEmail?: string;
}): Promise<void> {
  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      action: 'updateSchool',
      schoolId,
      ...schoolData
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update school: ${error}`);
  }
}

export async function assignUserToSchool(userId: string, schoolId: string, role: string = 'user'): Promise<void> {
  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      action: 'assignUserToSchool',
      targetUserId: userId,
      schoolId,
      role
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to assign user to school: ${error}`);
  }
}

export async function removeUserFromSchool(userId: string, schoolId: string): Promise<void> {
  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      action: 'removeUserFromSchool',
      targetUserId: userId,
      schoolId
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to remove user from school: ${error}`);
  }
}

export async function deleteSchool(schoolId: string): Promise<void> {
  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      action: 'deleteSchool',
      schoolId
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete school: ${error}`);
  }
}

// Function for regular users to get their own school assignments
export async function getMySchools(): Promise<{school: any, role: string}[]> {
  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/admin?action=getMySchools', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user schools: ${error}`);
  }

  const data = await response.json();
  return data.schools || [];
} 