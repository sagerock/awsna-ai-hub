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
  createUser,
  deleteUser,
  updateUser,
  listKnowledgeCollections,
  deleteCollection,
  getSchools,
  createSchool,
  updateSchool,
  assignUserToSchool,
  removeUserFromSchool,
  deleteSchool,
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
  
  // User creation
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  
  // Content management
  const [collections, setCollections] = useState<string[]>([]);
  
  // School management
  const [schools, setSchools] = useState<any[]>([]);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolAddress, setNewSchoolAddress] = useState('');
  const [newSchoolWebsite, setNewSchoolWebsite] = useState('');
  const [newSchoolContactEmail, setNewSchoolContactEmail] = useState('');
  
  // Edit school modal
  const [editingSchool, setEditingSchool] = useState<any | null>(null);
  const [editSchoolName, setEditSchoolName] = useState('');
  const [editSchoolAddress, setEditSchoolAddress] = useState('');
  const [editSchoolWebsite, setEditSchoolWebsite] = useState('');
  const [editSchoolContactEmail, setEditSchoolContactEmail] = useState('');
  
  // Loading states
  const [isGrantingAdmin, setIsGrantingAdmin] = useState(false);
  const [isRevokingAdmin, setIsRevokingAdmin] = useState<string | null>(null);
  const [isDeletingCollection, setIsDeletingCollection] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState<string | null>(null);
  const [isCreatingSchool, setIsCreatingSchool] = useState(false);
  const [isUpdatingSchool, setIsUpdatingSchool] = useState(false);
  const [isDeletingSchool, setIsDeletingSchool] = useState<string | null>(null);
  const [isAssigningUser, setIsAssigningUser] = useState<string | null>(null);
  const [showBulkAssignment, setShowBulkAssignment] = useState(false);
  const [bulkAssignmentUser, setBulkAssignmentUser] = useState<string>('');
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);

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
      const [adminsData, collectionsData, schoolsData] = await Promise.all([
        getAllAdmins(),
        listKnowledgeCollections(),
        getSchools()
      ]);
      
      setAdmins(adminsData);
      setCollections(collectionsData);
      setSchools(schoolsData);
      
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

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      alert('Email and password are required');
      return;
    }
    
    try {
      setIsCreatingUser(true);
      await createUser(newUserEmail, newUserPassword, newUserDisplayName);
      alert('User created successfully!');
      
      // Clear form
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserDisplayName('');
      
      loadAdminData(); // Refresh data
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error creating user: ' + (error as Error).message);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = async (targetUserId: string, userEmail: string) => {
    const confirmed = confirm(`Are you sure you want to delete user "${userEmail}"? This action cannot be undone and will remove all their data.`);
    if (!confirmed) return;
    
    try {
      setIsDeletingUser(targetUserId);
      await deleteUser(targetUserId);
      alert('User deleted successfully!');
      loadAdminData(); // Refresh data
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error deleting user: ' + (error as Error).message);
    } finally {
      setIsDeletingUser(null);
    }
  };

  // School Management Functions
  const handleCreateSchool = async () => {
    if (!newSchoolName) {
      alert('School name is required');
      return;
    }
    
    try {
      setIsCreatingSchool(true);
      await createSchool({
        name: newSchoolName,
        address: newSchoolAddress,
        website: newSchoolWebsite,
        contactEmail: newSchoolContactEmail
      });
      alert('School created successfully!');
      
      // Clear form
      setNewSchoolName('');
      setNewSchoolAddress('');
      setNewSchoolWebsite('');
      setNewSchoolContactEmail('');
      
      loadAdminData(); // Refresh data
    } catch (error) {
      console.error('Error creating school:', error);
      alert('Error creating school: ' + (error as Error).message);
    } finally {
      setIsCreatingSchool(false);
    }
  };

  const handleEditSchool = (school: any) => {
    setEditingSchool(school);
    setEditSchoolName(school.name);
    setEditSchoolAddress(school.address || '');
    setEditSchoolWebsite(school.website || '');
    setEditSchoolContactEmail(school.contactEmail || '');
  };

  const handleUpdateSchool = async () => {
    if (!editingSchool || !editSchoolName) {
      alert('School name is required');
      return;
    }
    
    try {
      setIsUpdatingSchool(true);
      await updateSchool(editingSchool.id, {
        name: editSchoolName,
        address: editSchoolAddress,
        website: editSchoolWebsite,
        contactEmail: editSchoolContactEmail
      });
      alert('School updated successfully!');
      
      // Close modal and reset form
      setEditingSchool(null);
      setEditSchoolName('');
      setEditSchoolAddress('');
      setEditSchoolWebsite('');
      setEditSchoolContactEmail('');
      
      loadAdminData(); // Refresh data
    } catch (error) {
      console.error('Error updating school:', error);
      alert('Error updating school: ' + (error as Error).message);
    } finally {
      setIsUpdatingSchool(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingSchool(null);
    setEditSchoolName('');
    setEditSchoolAddress('');
    setEditSchoolWebsite('');
    setEditSchoolContactEmail('');
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    if (schoolId === 'awsna') {
      alert('Cannot delete AWSNA (default school)');
      return;
    }
    
    const confirmed = confirm(`Are you sure you want to delete the school "${schoolName}"? This will remove all user assignments and cannot be undone.`);
    if (!confirmed) return;
    
    try {
      setIsDeletingSchool(schoolId);
      await deleteSchool(schoolId);
      alert('School deleted successfully!');
      loadAdminData(); // Refresh data
    } catch (error) {
      console.error('Error deleting school:', error);
      alert('Error deleting school: ' + (error as Error).message);
    } finally {
      setIsDeletingSchool(null);
    }
  };

  const handleAssignUserToSchool = async (userId: string, schoolId: string, role: string = 'user') => {
    try {
      setIsAssigningUser(userId);
      await assignUserToSchool(userId, schoolId, role);
      alert('User assigned to school successfully!');
      loadAdminData(); // Refresh data
    } catch (error) {
      console.error('Error assigning user to school:', error);
      alert('Error assigning user to school: ' + (error as Error).message);
    } finally {
      setIsAssigningUser(null);
    }
  };

  const handleRemoveUserFromSchool = async (userId: string, schoolId: string, schoolName: string) => {
    if (schoolId === 'awsna') {
      alert('Cannot remove users from AWSNA (default school)');
      return;
    }
    
    const confirmed = confirm(`Are you sure you want to remove this user from "${schoolName}"?`);
    if (!confirmed) return;
    
    try {
      setIsAssigningUser(userId);
      await removeUserFromSchool(userId, schoolId);
      alert('User removed from school successfully!');
      loadAdminData(); // Refresh data
    } catch (error) {
      console.error('Error removing user from school:', error);
      alert('Error removing user from school: ' + (error as Error).message);
    } finally {
      setIsAssigningUser(null);
    }
  };

  const handleBulkAssignment = async () => {
    if (!bulkAssignmentUser || selectedSchools.length === 0) return;

    setIsAssigningUser(bulkAssignmentUser);
    try {
      // Assign to all selected schools
      for (const schoolId of selectedSchools) {
        await assignUserToSchool(bulkAssignmentUser, schoolId);
      }
      
      await loadAdminData();
      setShowBulkAssignment(false);
      setBulkAssignmentUser('');
      setSelectedSchools([]);
    } catch (error) {
      console.error('Error in bulk assignment:', error);
      alert('Error in bulk assignment: ' + (error as Error).message);
    }
    setIsAssigningUser(null);
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
        {/* Header */}
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

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <div className="px-6">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'overview' 
                      ? 'border-indigo-500 text-indigo-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'users' 
                      ? 'border-indigo-500 text-indigo-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  User Management
                </button>
                <button
                  onClick={() => setActiveTab('schools')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'schools' 
                      ? 'border-indigo-500 text-indigo-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  School Management
                </button>
                <button
                  onClick={() => setActiveTab('content')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'content' 
                      ? 'border-indigo-500 text-indigo-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Content Management
                </button>
                <button
                  onClick={() => setActiveTab('system')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'system' 
                      ? 'border-indigo-500 text-indigo-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  System Status
                </button>
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Main Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Total Users</h3>
                    <p className="text-3xl font-bold text-indigo-600">{allUsers.length}</p>
                    <p className="text-sm text-gray-500">Registered users</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Admin Users</h3>
                    <p className="text-3xl font-bold text-green-600">{admins.length}</p>
                    <p className="text-sm text-gray-500">With admin privileges</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Schools</h3>
                    <p className="text-3xl font-bold text-purple-600">{schools.length}</p>
                    <p className="text-sm text-gray-500">Waldorf schools</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Collections</h3>
                    <p className="text-3xl font-bold text-blue-600">{collections.length}</p>
                    <p className="text-sm text-gray-500">Knowledge collections</p>
                  </div>
                </div>

                {/* Multi-School User Analytics */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-4">🔗 Multi-School User Analytics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-lg p-4 border">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Multi-School Users</h4>
                      <p className="text-2xl font-bold text-blue-600">
                        {allUsers.filter(user => ((user as any).schools?.length || 0) > 1).length}
                      </p>
                      <p className="text-xs text-gray-500">Consultants & cross-school staff</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Single School Users</h4>
                      <p className="text-2xl font-bold text-gray-600">
                        {allUsers.filter(user => ((user as any).schools?.length || 0) === 1).length}
                      </p>
                      <p className="text-xs text-gray-500">School-specific users</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Most Connected User</h4>
                      <p className="text-2xl font-bold text-purple-600">
                        {Math.max(...allUsers.map(user => (user as any).schools?.length || 0), 0)}
                      </p>
                      <p className="text-xs text-gray-500">Schools for top consultant</p>
                    </div>
                  </div>
                  
                  {/* Multi-School Users List */}
                  {allUsers.filter(user => ((user as any).schools?.length || 0) > 1).length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-blue-900 mb-3">Current Multi-School Users</h4>
                      <div className="bg-white rounded-lg border overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Schools</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {allUsers
                              .filter(user => ((user as any).schools?.length || 0) > 1)
                              .map(user => {
                                const userSchools = (user as any).schools || [];
                                const hasAdminRole = userSchools.some((s: any) => s.role === 'admin');
                                return (
                                  <tr key={user.uid} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm">
                                      <div>
                                        <div className="font-medium text-gray-900">{user.displayName}</div>
                                        <div className="text-gray-500 text-xs">{user.email}</div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-sm">
                                      <div className="flex flex-wrap gap-1">
                                        {userSchools.map((assignment: any) => (
                                          <span
                                            key={assignment.schoolId}
                                            className={`px-2 py-1 text-xs rounded-full ${
                                              assignment.schoolId === 'awsna'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-blue-100 text-blue-800'
                                            }`}
                                          >
                                            {assignment.schoolName}
                                            {assignment.schoolId === 'awsna' && ' 🏠'}
                                          </span>
                                        ))}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        {userSchools.length} schools
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-sm">
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                        hasAdminRole 
                                          ? 'bg-purple-100 text-purple-800' 
                                          : 'bg-blue-100 text-blue-800'
                                      }`}>
                                        {hasAdminRole ? '👑 Multi-School Admin' : '🔗 Consultant'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-6">
                {/* Create User Section */}
                <div className="bg-green-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Create New User</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <input
                        type="email"
                        placeholder="Email address"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <input
                        type="password"
                        placeholder="Password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Display name (optional)"
                        value={newUserDisplayName}
                        onChange={(e) => setNewUserDisplayName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <button
                        onClick={handleCreateUser}
                        disabled={isCreatingUser || !newUserEmail || !newUserPassword}
                        className="w-full px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isCreatingUser ? 'Creating...' : 'Create User'}
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Created users will need to verify their email address before they can sign in.
                  </p>
                </div>

                {/* Grant Admin Section */}
                <div className="bg-blue-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Grant Admin Permissions</h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <input
                        type="email"
                        placeholder="Enter user email"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      onClick={handleGrantAdmin}
                      disabled={isGrantingAdmin || !newAdminEmail}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isGrantingAdmin ? 'Granting...' : 'Grant Admin'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    User must be registered in the system before granting admin permissions.
                  </p>
                </div>

                {/* Current Admins */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Current Admin Users</h3>
                  <div className="bg-white border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Permissions
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Granted
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {admins.map((admin) => (
                          <tr key={admin.uid}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{admin.displayName}</div>
                                <div className="text-sm text-gray-500">{admin.email}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-wrap gap-1">
                                {admin.permissions.map((perm, idx) => (
                                  <span
                                    key={idx}
                                    className={`px-2 py-1 text-xs rounded-full ${
                                      perm.type === 'system_admin' 
                                        ? 'bg-red-100 text-red-800' 
                                        : 'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    {perm.type.replace('_', ' ')}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : 'Unknown'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {admin.permissions.some(p => p.type === 'system_admin') ? (
                                <span className="text-gray-400">System Admin</span>
                              ) : (
                                <button
                                  onClick={() => handleRevokeAdmin(admin.uid)}
                                  disabled={isRevokingAdmin === admin.uid}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                >
                                  {isRevokingAdmin === admin.uid ? 'Revoking...' : 'Revoke'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* All Users */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">All Registered Users</h3>
                  <div className="bg-white border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Account Info
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {allUsers.map((user) => {
                          const isAdmin = admins.some(admin => admin.uid === user.uid);
                          const isSystemAdmin = admins.some(admin => admin.uid === user.uid && admin.permissions.some(p => p.type === 'system_admin'));
                          
                          return (
                            <tr key={user.uid}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                                  <div className="text-sm text-gray-500">{user.email}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col space-y-1">
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    isAdmin 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {isAdmin ? 'Admin' : 'User'}
                                  </span>
                                  {(user as any).disabled && (
                                    <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                                      Disabled
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex flex-col space-y-1">
                                  <div className="flex items-center">
                                    <span className={`w-2 h-2 rounded-full mr-2 ${(user as any).emailVerified ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                    <span>{(user as any).emailVerified ? 'Verified' : 'Unverified'}</span>
                                  </div>
                                  {(user as any).lastSignInTime && (
                                    <div className="text-xs">
                                      Last: {new Date((user as any).lastSignInTime).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex space-x-2">
                                  {!isAdmin && (
                                    <button
                                      onClick={() => {
                                        setNewAdminEmail(user.email);
                                      }}
                                      className="text-indigo-600 hover:text-indigo-900"
                                    >
                                      Make Admin
                                    </button>
                                  )}
                                  {!isSystemAdmin && (
                                    <button
                                      onClick={() => handleDeleteUser(user.uid, user.email)}
                                      disabled={isDeletingUser === user.uid}
                                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                    >
                                      {isDeletingUser === user.uid ? 'Deleting...' : 'Delete'}
                                    </button>
                                  )}
                                  {isSystemAdmin && (
                                    <span className="text-gray-400">System Admin</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'schools' && (
              <div className="space-y-6">
                {/* Create School Section */}
                <div className="bg-purple-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Create New School</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <input
                        type="text"
                        placeholder="School name *"
                        value={newSchoolName}
                        onChange={(e) => setNewSchoolName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Address"
                        value={newSchoolAddress}
                        onChange={(e) => setNewSchoolAddress(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <input
                        type="url"
                        placeholder="Website"
                        value={newSchoolWebsite}
                        onChange={(e) => setNewSchoolWebsite(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <input
                        type="email"
                        placeholder="Contact email"
                        value={newSchoolContactEmail}
                        onChange={(e) => setNewSchoolContactEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={handleCreateSchool}
                      disabled={isCreatingSchool || !newSchoolName}
                      className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreatingSchool ? 'Creating...' : 'Create School'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    New schools will be created with default knowledge collections (curriculum, accreditation, marketing, administration, general, school-renewal) and will be available for user assignment.
                  </p>
                </div>

                {/* Schools List */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Waldorf Schools</h3>
                  <div className="bg-white border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            School
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Contact
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {schools.map((school) => (
                          <tr key={school.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{school.name}</div>
                                {school.address && (
                                  <div className="text-sm text-gray-500">{school.address}</div>
                                )}
                                {school.website && (
                                  <a 
                                    href={school.website} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-500 hover:text-blue-700"
                                  >
                                    Visit Website
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {school.contactEmail && (
                                <a 
                                  href={`mailto:${school.contactEmail}`}
                                  className="text-sm text-blue-500 hover:text-blue-700"
                                >
                                  {school.contactEmail}
                                </a>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                school.isDefault 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {school.isDefault ? 'Default' : 'School'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEditSchool(school)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  Edit
                                </button>
                                {!school.isDefault && (
                                  <button
                                    onClick={() => handleDeleteSchool(school.id, school.name)}
                                    disabled={isDeletingSchool === school.id}
                                    className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                  >
                                    {isDeletingSchool === school.id ? 'Deleting...' : 'Delete'}
                                  </button>
                                )}
                                {school.isDefault && (
                                  <span className="text-gray-400">Protected</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* User School Assignments */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">User School Assignments</h3>
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => setShowBulkAssignment(true)}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors"
                      >
                        🔗 Bulk Assign Consultant
                      </button>
                      <div className="text-sm text-gray-600">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 mr-2">
                          Multi-School Support
                        </span>
                        Users can be assigned to multiple schools (consultants, administrators, etc.)
                      </div>
                    </div>
                  </div>
                  <div className="bg-white border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            School Assignments
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {allUsers.map((user) => {
                          const userSchools = (user as any).schools || [];
                          const schoolCount = userSchools.length;
                          const isMultiSchool = schoolCount > 1;
                          const hasAdminRole = userSchools.some((s: any) => s.role === 'admin');
                          
                          return (
                            <tr key={user.uid} className={isMultiSchool ? 'bg-blue-50' : ''}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                                  <div className="text-sm text-gray-500">{user.email}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1">
                                  {userSchools.map((assignment: any) => (
                                    <div key={assignment.schoolId} className="flex items-center space-x-1">
                                      <span className={`px-2 py-1 text-xs rounded-full ${
                                        assignment.schoolId === 'awsna'
                                          ? 'bg-green-100 text-green-800 border-2 border-green-300'
                                          : assignment.role === 'admin' 
                                            ? 'bg-purple-100 text-purple-800'
                                            : 'bg-blue-100 text-blue-800'
                                      }`}>
                                        {assignment.schoolName} ({assignment.role})
                                        {assignment.schoolId === 'awsna' && (
                                          <span className="ml-1 text-xs">🏠</span>
                                        )}
                                      </span>
                                      {assignment.schoolId !== 'awsna' && (
                                        <button
                                          onClick={() => handleRemoveUserFromSchool(user.uid, assignment.schoolId, assignment.schoolName)}
                                          disabled={isAssigningUser === user.uid}
                                          className="text-red-500 hover:text-red-700 text-xs ml-1"
                                          title="Remove from school"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  {userSchools.length === 0 && (
                                    <span className="text-sm text-gray-400">No assignments</span>
                                  )}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  {schoolCount} school{schoolCount !== 1 ? 's' : ''}
                                  {isMultiSchool && <span className="text-blue-600 font-medium ml-1">• Multi-School User</span>}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col space-y-1">
                                  {isMultiSchool && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                      🔗 Consultant/Multi-School
                                    </span>
                                  )}
                                  {hasAdminRole && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                                      👑 Administrator
                                    </span>
                                  )}
                                  {!isMultiSchool && !hasAdminRole && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                                      👤 Single School User
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex flex-col space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <select
                                      onChange={(e) => {
                                        const schoolId = e.target.value;
                                        if (schoolId) {
                                          handleAssignUserToSchool(user.uid, schoolId);
                                          e.target.value = '';
                                        }
                                      }}
                                      disabled={isAssigningUser === user.uid}
                                      className="text-sm border rounded px-2 py-1 bg-white"
                                      defaultValue=""
                                    >
                                      <option value="">+ Add School</option>
                                      {schools.filter(school => 
                                        !userSchools.some((assignment: any) => assignment.schoolId === school.id)
                                      ).map(school => (
                                        <option key={school.id} value={school.id}>
                                          {school.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  {isMultiSchool && (
                                    <div className="text-xs text-blue-600">
                                      Access to {schoolCount} schools
                                    </div>
                                  )}
                                  {isAssigningUser === user.uid && (
                                    <span className="text-xs text-gray-500">Processing...</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Multi-School Usage Guide */}
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Multi-School User Guide</h4>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p><strong>Consultants & Multi-School Staff:</strong> Can be assigned to multiple schools for cross-school access</p>
                      <p><strong>AWSNA Access:</strong> 🏠 All users automatically get AWSNA access (shared resources)</p>
                      <p><strong>School-Specific Content:</strong> Users only see knowledge/documents from their assigned schools</p>
                      <p><strong>Admin Privileges:</strong> 👑 Can be granted per school or globally</p>
                    </div>
                  </div>
                </div>

                {/* Bulk Assignment Modal */}
                {showBulkAssignment && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">🔗 Bulk Assign User to Multiple Schools</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Perfect for consultants, administrators, or staff who work across multiple schools.
                      </p>
                      
                      <div className="space-y-4">
                        {/* User Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select User
                          </label>
                          <select
                            value={bulkAssignmentUser}
                            onChange={(e) => setBulkAssignmentUser(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Choose a user...</option>
                            {allUsers.map(user => (
                              <option key={user.uid} value={user.uid}>
                                {user.displayName} ({user.email})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* School Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Schools to Assign
                          </label>
                          <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3 space-y-2">
                            {schools.filter(school => {
                              // Filter out schools the user is already assigned to
                              const userSchools = bulkAssignmentUser ? 
                                (allUsers.find(u => u.uid === bulkAssignmentUser) as any)?.schools || [] : [];
                              return !userSchools.some((assignment: any) => assignment.schoolId === school.id);
                            }).map(school => (
                              <label key={school.id} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={selectedSchools.includes(school.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSchools([...selectedSchools, school.id]);
                                    } else {
                                      setSelectedSchools(selectedSchools.filter(id => id !== school.id));
                                    }
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm">
                                  {school.name}
                                  {school.id === 'awsna' && <span className="text-green-600 ml-1">🏠 (Default)</span>}
                                </span>
                              </label>
                            ))}
                          </div>
                          {selectedSchools.length > 0 && (
                            <p className="text-sm text-blue-600 mt-2">
                              Selected {selectedSchools.length} school{selectedSchools.length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end space-x-3 mt-6">
                        <button
                          onClick={() => {
                            setShowBulkAssignment(false);
                            setBulkAssignmentUser('');
                            setSelectedSchools([]);
                          }}
                          className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleBulkAssignment}
                          disabled={!bulkAssignmentUser || selectedSchools.length === 0 || isAssigningUser === bulkAssignmentUser}
                          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                          {isAssigningUser === bulkAssignmentUser ? 'Assigning...' : 'Assign to Schools'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit School Modal */}
                {editingSchool && (
                  <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                      <div className="mt-3">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                          Edit School: {editingSchool.name}
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              School Name *
                            </label>
                            <input
                              type="text"
                              value={editSchoolName}
                              onChange={(e) => setEditSchoolName(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              disabled={editingSchool.isDefault}
                            />
                            {editingSchool.isDefault && (
                              <p className="text-xs text-gray-500 mt-1">AWSNA school name cannot be changed</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Address
                            </label>
                            <input
                              type="text"
                              value={editSchoolAddress}
                              onChange={(e) => setEditSchoolAddress(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Website
                            </label>
                            <input
                              type="url"
                              value={editSchoolWebsite}
                              onChange={(e) => setEditSchoolWebsite(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Contact Email
                            </label>
                            <input
                              type="email"
                              value={editSchoolContactEmail}
                              onChange={(e) => setEditSchoolContactEmail(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end space-x-3 mt-6">
                          <button
                            onClick={handleCancelEdit}
                            disabled={isUpdatingSchool}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleUpdateSchool}
                            disabled={isUpdatingSchool || !editSchoolName}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isUpdatingSchool ? 'Updating...' : 'Update School'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'content' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-800">Knowledge Collections</h3>
                  <Link 
                    href="/knowledge" 
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Manage Knowledge
                  </Link>
                </div>
                
                <div className="bg-white border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Collection Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {collections.map((collection) => (
                        <tr key={collection}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{collection}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                              {collection.includes('_') ? 'School-specific' : 'Global'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleDeleteCollection(collection)}
                              disabled={isDeletingCollection === collection}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                            >
                              {isDeletingCollection === collection ? 'Deleting...' : 'Delete'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'system' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">System Connections</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Firebase</span>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        <span className="text-sm text-green-600">Connected</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Qdrant Vector DB</span>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        <span className="text-sm text-green-600">Connected</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">OpenAI API</span>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        <span className="text-sm text-green-600">Active</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Users:</span>
                      <span className="text-sm font-medium">{allUsers.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Admin Users:</span>
                      <span className="text-sm font-medium">{admins.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Schools:</span>
                      <span className="text-sm font-medium">{schools.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Collections:</span>
                      <span className="text-sm font-medium">{collections.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 