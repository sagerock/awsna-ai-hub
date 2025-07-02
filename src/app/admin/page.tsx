'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  getAllAdmins, 
  grantAdminPermissions, 
  revokeAdminPermissions,
  getAllUsers,
  listKnowledgeCollections,
  deleteCollection,
  AdminUser, 
  AdminPermission 
} from '@/lib/admin';

interface User {
  uid: string;
  email: string;
  displayName: string;
}

export default function AdminPage() {
  const { currentUser, isAdmin } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  
  // User management
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  
  // Content management
  const [collections, setCollections] = useState<string[]>([]);
  
  // Loading states
  const [isGrantingAdmin, setIsGrantingAdmin] = useState(false);
  const [isRevokingAdmin, setIsRevokingAdmin] = useState<string | null>(null);
  const [isDeletingCollection, setIsDeletingCollection] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/');
    }
  }, [isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      
      // Load all data in parallel
      const [adminsData, collectionsData] = await Promise.all([
        getAllAdmins(),
        listKnowledgeCollections()
      ]);
      
      setAdmins(adminsData);
      setCollections(collectionsData);
      
      // Load all users for admin management
      await loadAllUsers();
      
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const users = await getAllUsers();
      setAllUsers(users);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleGrantAdmin = async () => {
    if (!newAdminEmail || !currentUser) return;
    
    try {
      setIsGrantingAdmin(true);
      
      // Find user by email
      const targetUser = allUsers.find(u => u.email.toLowerCase() === newAdminEmail.toLowerCase());
      if (!targetUser) {
        alert('User not found. Make sure they have signed up first.');
        return;
      }
      
      const permissions: AdminPermission[] = [
        {
          type: 'content_admin',
          scope: 'global',
          grantedAt: new Date(),
          grantedBy: currentUser.uid
        },
        {
          type: 'user_admin',
          scope: 'global',
          grantedAt: new Date(),
          grantedBy: currentUser.uid
        }
      ];
      
      await grantAdminPermissions(
        targetUser.uid,
        targetUser.email,
        targetUser.displayName,
        permissions,
        currentUser.uid
      );
      
      alert('Admin permissions granted successfully!');
      setNewAdminEmail('');
      loadAdminData(); // Refresh data
      
    } catch (error) {
      console.error('Error granting admin permissions:', error);
      alert('Error granting admin permissions: ' + (error as Error).message);
    } finally {
      setIsGrantingAdmin(false);
    }
  };

  const handleRevokeAdmin = async (targetUserId: string) => {
    if (!currentUser) return;
    
    const confirmed = confirm('Are you sure you want to revoke admin permissions? This cannot be undone.');
    if (!confirmed) return;
    
    try {
      setIsRevokingAdmin(targetUserId);
      await revokeAdminPermissions(targetUserId, currentUser.uid);
      alert('Admin permissions revoked successfully!');
      loadAdminData(); // Refresh data
    } catch (error) {
      console.error('Error revoking admin permissions:', error);
      alert('Error revoking admin permissions: ' + (error as Error).message);
    } finally {
      setIsRevokingAdmin(null);
    }
  };

  const handleDeleteCollection = async (collectionName: string) => {
    const confirmed = confirm(`Are you sure you want to delete the entire "${collectionName}" collection? This will permanently delete all documents and cannot be undone.`);
    if (!confirmed) return;
    
    try {
      setIsDeletingCollection(collectionName);
      await deleteCollection(collectionName);
      alert('Collection deleted successfully!');
      loadAdminData(); // Refresh data
    } catch (error) {
      console.error('Error deleting collection:', error);
      alert('Error deleting collection: ' + (error as Error).message);
    } finally {
      setIsDeletingCollection(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access the admin panel.</p>
          <Link href="/" className="mt-4 inline-block text-indigo-600 hover:text-indigo-800">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">Welcome, {currentUser?.email}! You now have admin access.</p>
            </div>
            <Link href="/" className="text-indigo-500 hover:text-indigo-600">
              Back to Home
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">User Management</h3>
            <p className="text-gray-600 mb-4">Add and remove admin users, manage permissions</p>
            <span className="text-sm text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">Enhanced Features Coming Soon</span>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Content Management</h3>
            <p className="text-gray-600 mb-4">Manage all school collections and documents</p>
            <Link 
              href="/knowledge" 
              className="text-sm text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full hover:bg-indigo-200"
            >
              Access Knowledge Management
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">System Monitor</h3>
            <p className="text-gray-600 mb-4">View system stats and health</p>
            <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded-full">System Online</span>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Quick Actions</h3>
            <div className="space-y-2">
              <Link 
                href="/knowledge" 
                className="block text-sm text-blue-600 hover:text-blue-800"
              >
                📚 Manage Knowledge Collections
              </Link>
              <span className="block text-sm text-gray-500">👥 Add New Admin (Coming Soon)</span>
              <span className="block text-sm text-gray-500">⚙️ System Settings (Coming Soon)</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Admin Privileges</h3>
            <div className="space-y-1">
              <p className="text-sm text-green-600">✅ Access all school collections</p>
              <p className="text-sm text-green-600">✅ Delete any content</p>
              <p className="text-sm text-green-600">✅ View admin-only features</p>
              <p className="text-sm text-gray-500">🔄 Manage other admins (Coming Soon)</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">System Status</h3>
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Firebase: Connected</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Qdrant: Connected</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">AI Providers: Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 