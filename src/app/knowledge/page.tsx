'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getMySchools } from '@/lib/admin';
// import { uploadDocumentToQdrant, DocumentMetadata } from '@/lib/qdrant'; // uploadDocumentToQdrant moved to API route
import { DocumentMetadata } from '@/lib/qdrant'; // DocumentMetadata might still be used for typing if needed elsewhere, or remove if not.
import {
  listKnowledgeDocuments,
  listKnowledgeCollections,
  getDocumentCount,
  deleteKnowledgeDocument
} from '@/lib/knowledgeApi';
import Link from 'next/link';

export default function KnowledgeManagementPage() {
  const router = useRouter();
  const { currentUser, isAdmin } = useAuth();
  
  // Function to format collection display names
  const formatCollectionName = (collection: string): string => {
    const displayNames: { [key: string]: string } = {
      'curriculum': 'Curriculum',
      'accreditation': 'Accreditation',
      'marketing': 'Marketing',
      'administration': 'Administration',
      'general': 'General',
      'school-renewal': 'School Renewal'
    };
    return displayNames[collection] || collection.charAt(0).toUpperCase() + collection.slice(1);
  };
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [userSchools, setUserSchools] = useState<{school: any, role: string}[]>([]);
  const [collections, setCollections] = useState<string[]>([
    'curriculum', 'accreditation', 'marketing', 'administration', 'general', 'school-renewal'
  ]);
  const [selectedCollection, setSelectedCollection] = useState<string>('general');
  const [isUploading, setIsUploading] = useState(false);
  const [fileList, setFileList] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [uploadSuccess, setUploadSuccess] = useState<string[]>([]);
  const [uploadErrors, setUploadErrors] = useState<{[key: string]: string}>({});
  
  // Document listing states
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentCount, setDocumentCount] = useState<number>(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [isDeletingDocument, setIsDeletingDocument] = useState<string | null>(null);
  const [availableCollections, setAvailableCollections] = useState<string[]>([]);

  // Fetch user's schools when component mounts
  useEffect(() => {
    async function fetchUserSchools() {
      if (currentUser?.uid) {
        try {
          const schools = await getMySchools();
          setUserSchools(schools);
          
          // Set the first school as selected by default if user has schools
          if (schools.length > 0) {
            setSelectedSchool(schools[0].school.id);
          } else {
            console.log('No schools found for user - they need to be assigned to schools by an admin');
          }
        } catch (error) {
          console.error('Error fetching schools:', error);
          // Don't set any fallback - let the UI show appropriate message
        }
      }
    }
    
    async function fetchAvailableCollections() {
      try {
        const collections = await listKnowledgeCollections();
        setAvailableCollections(collections);
      } catch (error) {
        console.error('Error fetching collections:', error);
      }
    }
    
    fetchUserSchools();
    fetchAvailableCollections();
  }, [currentUser]);
  
  // Fetch documents when school or collection changes
  useEffect(() => {
    if (selectedSchool && selectedCollection) {
      fetchDocuments();
      fetchDocumentCount();
    }
  }, [selectedSchool, selectedCollection]);

  const handleSchoolChange = (schoolId: string) => {
    setSelectedSchool(schoolId);
    // Reset document list when changing schools
    setDocuments([]);
    setNextOffset(null);
  };

  const handleCollectionChange = (collection: string) => {
    setSelectedCollection(collection);
    // Reset document list when changing collections
    setDocuments([]);
    setNextOffset(null);
  };
  
  const fetchDocuments = async (offset: number = 0) => {
    if (!selectedSchool || !selectedCollection) return;
    
    setIsLoadingDocuments(true);
    
    try {
      const result = await listKnowledgeDocuments(selectedSchool, selectedCollection, 10, offset);
      if (offset === 0) {
        setDocuments(result.documents);
      } else {
        setDocuments(prev => [...prev, ...result.documents]);
      }
      setNextOffset(result.nextOffset);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoadingDocuments(false);
    }
  };
  
  const fetchDocumentCount = async () => {
    if (!selectedSchool || !selectedCollection) return;
    
    try {
      const count = await getDocumentCount(selectedSchool, selectedCollection);
      setDocumentCount(count);
    } catch (error) {
      console.error('Error fetching document count:', error);
    }
  };
  
  const handleDeleteDocument = async (fileName: string) => {
    if (!selectedSchool || !selectedCollection) return;
    
    setIsDeletingDocument(fileName);
    
    try {
      await deleteKnowledgeDocument(selectedSchool, selectedCollection, fileName);
      
      // Update document list by removing the deleted document
      setDocuments(documents.filter(doc => doc.fileName !== fileName));
      
      // Update document count
      fetchDocumentCount();
    } catch (error) {
      console.error('Error deleting document:', error);
    } finally {
      setIsDeletingDocument(null);
    }
  };
  
  const loadMoreDocuments = () => {
    if (nextOffset !== null) {
      fetchDocuments(nextOffset);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFileList(prevFiles => [...prevFiles, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFileList(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (!selectedSchool || !selectedCollection || fileList.length === 0) return;

    setIsUploading(true);
    setUploadSuccess([]);
    setUploadErrors({});
    setUploadProgress({}); // Reset progress

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileName = file.name;

      try {
        // Indicate that this file is starting to upload
        setUploadProgress(prev => ({ ...prev, [fileName]: 0 })); // 0 might mean 'starting'

        const formData = new FormData();
        formData.append('file', file);
        formData.append('collectionName', selectedCollection); // User-facing collection name
        formData.append('schoolId', selectedSchool);
        // The API route will derive uploadedBy from the authenticated session

        // Simulate progress start for UI
        setUploadProgress(prev => ({ ...prev, [fileName]: 10 })); // Small progress to show activity

        const idToken = await currentUser?.getIdToken(); // Get Firebase ID token
        if (!idToken) {
          throw new Error("User not authenticated. Unable to get ID token.");
        }

        const response = await fetch('/api/knowledge/upload', {
          method: 'POST',
          body: formData,
          headers: { // Add Authorization header
            'Authorization': `Bearer ${idToken}`
          }
        });

        // Simulate completion for UI
        setUploadProgress(prev => ({ ...prev, [fileName]: 100 }));

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to upload ${fileName}. Status: ${response.status}`);
        }

        // const result = await response.json(); // Contains { success: true, message: "..." }
        setUploadSuccess(prev => [...prev, fileName]);

      } catch (error) {
        console.error(`Error uploading ${fileName}:`, error);
        setUploadErrors(prev => ({
          ...prev,
          [fileName]: error instanceof Error ? error.message : 'Unknown error'
        }));
        setUploadProgress(prev => ({ ...prev, [fileName]: -1 })); // -1 could indicate an error
      }
    }

    setIsUploading(false);
    // Clear file list after attempting upload (optional, based on desired UX)
    // setFileList([]);
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file content'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
      
      reader.readAsText(file);
    });
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Knowledge Management</h1>
                <p className="text-gray-600 mt-1">Upload and manage Waldorf educational resources</p>
              </div>
              <div className="flex space-x-4">
                {isAdmin && (
                  <Link href="/admin" className="text-red-600 hover:text-red-800 font-medium">
                    Admin Panel
                  </Link>
                )}
                <Link href="/" className="text-indigo-500 hover:text-indigo-600">
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
          
          {/* School selector */}
          {userSchools.length > 0 ? (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Select School</h2>
                {isAdmin && (
                  <span className="text-sm text-red-600 bg-red-100 px-2 py-1 rounded-full font-medium">
                    Admin Mode: Global Access
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-4">
                {userSchools.map(({school, role}) => (
                  <button
                    key={school.id}
                    onClick={() => handleSchoolChange(school.id)}
                    className={`px-4 py-2 rounded-md transition-colors ${selectedSchool === school.id 
                      ? 'bg-indigo-100 border-2 border-indigo-500 text-indigo-800' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                  >
                    <div className="font-medium">{school.name}</div>
                    <div className="text-xs text-gray-500">Role: {role}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">School Selection</h2>
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-md">
                <p className="font-medium">No schools found for your account.</p>
                <p className="text-sm mt-1">Debug: userSchools.length = {userSchools.length}</p>
                <p className="text-sm">Current user: {currentUser?.uid || 'Not logged in'}</p>
                <p className="text-sm">Please contact your administrator to get access to a school.</p>
              </div>
            </div>
          )}
          
          {/* Knowledge collection manager */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Upload Documents</h2>
            
            {/* Collection tabs */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">Select Knowledge Collection</h3>
              <div className="flex flex-wrap gap-2">
                {collections.map((collection) => (
                  <button
                    key={collection}
                    onClick={() => handleCollectionChange(collection)}
                    className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${selectedCollection === collection 
                      ? 'bg-indigo-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                  >
                    {formatCollectionName(collection)}
                  </button>
                ))}
              </div>
            </div>
            
            {/* File upload */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">Upload Files</h3>
              
              <div className="mb-4">
                <div className="flex items-center justify-center w-full">
                  <label 
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg 
                        className="w-8 h-8 mb-4 text-gray-500" 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth="2" 
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                        />
                      </svg>
                      <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                      <p className="text-xs text-gray-500">PDF, TXT, DOCX, or MD files (Max 10MB each)</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={handleFileChange} 
                      multiple 
                      accept=".pdf,.txt,.docx,.md"
                    />
                  </label>
                </div>
              </div>
              
              {/* File list */}
              {fileList.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-md font-medium mb-2">Selected Files</h4>
                  <ul className="space-y-2">
                    {fileList.map((file, index) => (
                      <li key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <svg 
                            className="w-5 h-5 mr-2 text-gray-500" 
                            xmlns="http://www.w3.org/2000/svg" 
                            viewBox="0 0 20 20" 
                            fill="currentColor"
                          >
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm">{file.name}</span>
                        </div>
                        
                        <div className="flex items-center">
                          {uploadProgress[file.name] > 0 && uploadProgress[file.name] < 100 && (
                            <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className="bg-indigo-500 h-2 rounded-full" 
                                style={{ width: `${uploadProgress[file.name]}%` }}
                              ></div>
                            </div>
                          )}
                          
                          {uploadSuccess.includes(file.name) && (
                            <span className="text-green-500 text-sm mr-2">Uploaded</span>
                          )}
                          
                          {uploadErrors[file.name] && (
                            <span className="text-red-500 text-sm mr-2">Error</span>
                          )}
                          
                          <button 
                            onClick={() => removeFile(index)}
                            className="text-red-500 hover:text-red-700"
                            disabled={isUploading}
                          >
                            <svg 
                              className="w-5 h-5" 
                              xmlns="http://www.w3.org/2000/svg" 
                              viewBox="0 0 20 20" 
                              fill="currentColor"
                            >
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              

              
              <button
                onClick={uploadFiles}
                disabled={isUploading || fileList.length === 0 || !selectedSchool || !selectedCollection}
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  isUploading || fileList.length === 0 || !selectedSchool || !selectedCollection
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-indigo-500 hover:bg-indigo-600'
                }`}
              >
                {isUploading ? 'Uploading...' : 'Upload to Collection'}
              </button>
            </div>
          </div>
          
          {/* Knowledge collections overview */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Knowledge Collections</h2>
            
            {/* Collection tabs */}
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                {collections.map((collection) => (
                  <button
                    key={collection}
                    onClick={() => handleCollectionChange(collection)}
                    className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${selectedCollection === collection 
                      ? 'bg-indigo-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                  >
                    {formatCollectionName(collection)}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Knowledge collection details and document list */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">
                  {formatCollectionName(selectedCollection)} Collection
                </h3>
                {selectedSchool && (
                  <span className="text-sm text-gray-500">School: {userSchools.find(s => s.school.id === selectedSchool)?.school.name}</span>
                )}
              </div>
              
              {uploadSuccess.length > 0 && (
                <div className="bg-green-50 border border-green-200 text-green-700 p-4 mb-4 rounded-md">
                  <p className="font-medium">Successfully uploaded {uploadSuccess.length} document(s)!</p>
                  <p className="text-sm">Documents are now available for AI assistants in the {formatCollectionName(selectedCollection)} collection.</p>
                </div>
              )}
              
              {/* Document count */}
              <div className="mb-4 text-sm text-gray-500">
                {documentCount} document{documentCount !== 1 ? 's' : ''} in this collection
              </div>
              
              {/* Document list */}
              {isLoadingDocuments && documents.length === 0 ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                  <p className="mt-2 text-gray-600">Loading documents...</p>
                </div>
              ) : documents.length > 0 ? (
                <div>
                  <div className="divide-y divide-gray-200">
                    {documents.map((doc) => (
                      <div key={doc.fileName} className="py-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{doc.fileName}</h4>
                            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                              <span>Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                              <span>{doc.chunkCount} chunk{doc.chunkCount !== 1 ? 's' : ''}</span>
                              {doc.fileSize && (
                                <span>{Math.round(parseInt(doc.fileSize) / 1024 / 1024 * 100) / 100} MB</span>
                              )}
                              <span className="capitalize">{doc.fileType}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteDocument(doc.fileName)}
                            disabled={isDeletingDocument === doc.fileName}
                            className={`ml-4 text-red-500 hover:text-red-700 ${isDeletingDocument === doc.fileName ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isDeletingDocument === doc.fileName ? (
                              <span className="text-sm">Deleting...</span>
                            ) : (
                              <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <div className="mt-2">
                          <p className="text-sm text-gray-600 italic">"{doc.preview}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {nextOffset !== null && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={loadMoreDocuments}
                        disabled={isLoadingDocuments}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        {isLoadingDocuments ? 'Loading...' : 'Load More Documents'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-600 italic text-center py-8">
                  <p>No documents found in this collection.</p>
                  <p className="mt-2 text-sm">Use the upload form above to add documents.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
