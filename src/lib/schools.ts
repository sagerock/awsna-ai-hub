import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  Timestamp 
} from 'firebase/firestore';

export interface School {
  id: string;
  name: string;
  location: string;
  website?: string;
  logo?: string;
  membershipType: 'full' | 'developing' | 'associate';
  region?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SchoolUser {
  userId: string;
  schoolId: string;
  role: 'admin' | 'teacher' | 'staff' | 'guest';
  displayName: string;
  email: string;
  createdAt: Timestamp;
  addedBy: string;
}

export interface SchoolBot {
  id: string;
  schoolId: string;
  baseId?: string; // If derived from a global bot
  name: string;
  description: string;
  systemPrompt: string;
  avatarUrl: string;
  supportedModels: string[]; // Array of model IDs
  defaultModel: string;
  knowledgeCollections: string[];
  knowledgeSearchStrategy: 'hybrid' | 'semantic' | 'exact';
  category: 'academic' | 'administrative' | 'marketing' | 'accreditation' | 'general';
  tags: string[];
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

/**
 * Create a new school in Firestore
 */
export async function createSchool(schoolData: Omit<School, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    const schoolRef = doc(collection(db, 'schools'));
    const schoolId = schoolRef.id;
    
    await setDoc(schoolRef, {
      id: schoolId,
      ...schoolData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return schoolId;
  } catch (error) {
    console.error('Error creating school:', error);
    throw error;
  }
}

/**
 * Get a school by ID
 */
export async function getSchool(schoolId: string): Promise<School | null> {
  try {
    const schoolRef = doc(db, 'schools', schoolId);
    const schoolDoc = await getDoc(schoolRef);
    
    if (schoolDoc.exists()) {
      return schoolDoc.data() as School;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting school:', error);
    throw error;
  }
}

/**
 * Get all schools for the AWSNA platform
 */
export async function getAllSchools(): Promise<School[]> {
  try {
    const schoolsRef = collection(db, 'schools');
    const schoolsSnapshot = await getDocs(schoolsRef);
    
    return schoolsSnapshot.docs.map(doc => doc.data() as School);
  } catch (error) {
    console.error('Error getting schools:', error);
    throw error;
  }
}

/**
 * Add a user to a school with a specific role
 */
export async function addUserToSchool(
  userId: string, 
  schoolId: string, 
  role: SchoolUser['role'], 
  userData: { displayName: string; email: string }, 
  addedBy: string
) {
  try {
    const userRef = doc(db, 'schools', schoolId, 'users', userId);
    
    await setDoc(userRef, {
      userId,
      schoolId,
      role,
      displayName: userData.displayName,
      email: userData.email,
      createdAt: serverTimestamp(),
      addedBy
    });
    
    return true;
  } catch (error) {
    console.error('Error adding user to school:', error);
    throw error;
  }
}

/**
 * Get all schools that a user belongs to
 */
export async function getUserSchools(userId: string): Promise<{ school: School, role: SchoolUser['role'] }[]> {
  try {
    const results: { school: School, role: SchoolUser['role'] }[] = [];
    
    // Query all schools where this user is a member
    const schoolsRef = collection(db, 'schools');
    const allSchools = await getDocs(schoolsRef);
    
    // For each school, check if the user is a member
    for (const schoolDoc of allSchools.docs) {
      const schoolId = schoolDoc.id;
      const userRef = doc(db, 'schools', schoolId, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as SchoolUser;
        results.push({
          school: schoolDoc.data() as School,
          role: userData.role
        });
      }
    }
    
    // Fallback: If user has no schools, provide default AWSNA access for testing
    if (results.length === 0) {
      console.log('No schools found for user, providing default AWSNA access for testing');
      results.push({
        school: {
          id: 'awsna',
          name: 'AWSNA (Development)',
          location: 'Global',
          website: 'https://waldorf.org',
          membershipType: 'full',
          region: 'Global',
          createdAt: new Date() as any,
          updatedAt: new Date() as any
        },
        role: 'admin' // Give admin role for testing
      });
    }
    
    return results;
  } catch (error) {
    console.error('Error getting user schools:', error);
    throw error;
  }
}

/**
 * Create a school-specific bot
 */
export async function createSchoolBot(
  schoolId: string, 
  botData: Omit<SchoolBot, 'id' | 'schoolId' | 'createdAt' | 'updatedAt'>,
  createdBy: string
) {
  try {
    const botRef = doc(collection(db, 'schools', schoolId, 'bots'));
    const botId = botRef.id;
    
    await setDoc(botRef, {
      id: botId,
      schoolId,
      ...botData,
      createdAt: serverTimestamp(),
      createdBy,
      updatedAt: serverTimestamp()
    });
    
    return botId;
  } catch (error) {
    console.error('Error creating school bot:', error);
    throw error;
  }
}

/**
 * Get all bots for a specific school
 */
export async function getSchoolBots(schoolId: string): Promise<SchoolBot[]> {
  try {
    const botsRef = collection(db, 'schools', schoolId, 'bots');
    const botsSnapshot = await getDocs(botsRef);
    
    return botsSnapshot.docs.map(doc => doc.data() as SchoolBot);
  } catch (error) {
    console.error('Error getting school bots:', error);
    throw error;
  }
}

/**
 * Check if a user has access to a specific school (client-side version)
 * @param userId User ID to check
 * @param schoolId School ID to check access for
 * @returns Boolean indicating if the user has access to the school
 */
export async function getUserSchoolAccess(userId: string, schoolId: string): Promise<boolean> {
  try {
    // Check if user exists in the school's users collection
    const userRef = doc(db, 'schools', schoolId, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    return userDoc.exists();
  } catch (error) {
    console.error('Error checking user school access:', error);
    // Default to no access on error
    return false;
  }
}

