'use client';

import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { predefinedBots, getBotsByCategory } from '@/lib/bots';
import { getUserSchools, School } from '@/lib/schools';
import { BotConfig } from '@/lib/bots';
import BotAvatar from '@/components/BotAvatar';

function BotCard({ bot, schoolSpecific = false }: { bot: BotConfig, schoolSpecific?: boolean }) {
  return (
    <Link 
      href={`/chat/${bot.id}`} 
      className="block bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow overflow-hidden"
    >
      <div className="h-3 bg-indigo-500"></div>
      <div className="p-6">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mr-4">
            <BotAvatar botId={bot.id} size={48} />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{bot.name}</h3>
            {schoolSpecific && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">School-specific</span>
            )}
          </div>
        </div>
        <p className="text-gray-600 mb-4 text-sm">{bot.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {bot.tags?.slice(0, 2).map(tag => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{tag}</span>
            ))}
            {bot.tags && bot.tags.length > 2 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">+{bot.tags.length - 2}</span>
            )}
          </div>
          <span className="text-indigo-500 font-medium text-sm">Chat now &rarr;</span>
        </div>
      </div>
    </Link>
  );
}

function HomePageContent() {
  const router = useRouter();
  const { currentUser, logout, isAdmin } = useAuth();
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [userSchools, setUserSchools] = useState<{school: School, role: string}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('general');
  
  // Fetch user's schools when component mounts
  useEffect(() => {
    async function fetchUserSchools() {
      if (currentUser?.uid) {
        try {
          setIsLoading(true);
          const schools = await getUserSchools(currentUser.uid);
          setUserSchools(schools);
          
          // Set the first school as selected by default if user has schools
          if (schools.length > 0) {
            setSelectedSchool(schools[0].school.id);
          }
        } catch (error) {
          console.error('Error fetching schools:', error);
        } finally {
          setIsLoading(false);
        }
      }
    }
    
    fetchUserSchools();
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };
  
  const handleSchoolChange = (schoolId: string) => {
    setSelectedSchool(schoolId);
  };
  
  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
  };

  // Get bots filtered by category and school
  const filteredBots = getBotsByCategory(activeCategory as any);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">AWSNA Waldorf AI Platform</h1>
              <p className="text-gray-600 mt-1">AI assistance for Waldorf schools and educators</p>
            </div>
            {currentUser && (
              <div className="flex items-center">
                <div className="flex space-x-4 mr-6">
                  <Link href="/knowledge" className="text-indigo-600 hover:text-indigo-800 font-medium">
                    Knowledge Management
                  </Link>
                  {isAdmin && (
                    <Link href="/admin" className="text-red-600 hover:text-red-800 font-medium">
                      Admin Panel
                    </Link>
                  )}
                </div>
                <span className="mr-4 text-gray-600">
                  {currentUser.email}
                  {isAdmin && <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">Admin</span>}
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* School selector */}
        {userSchools.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Your Waldorf Schools</h2>
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
            <div className="mt-4 text-sm text-gray-600">
              <p>Select a school to view school-specific AI assistants.</p>
            </div>
          </div>
        )}
        {/* Category tabs */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">AI Assistants by Category</h2>
          <div className="flex flex-wrap gap-2 mb-6">
            {['general', 'academic', 'administrative', 'accreditation', 'marketing'].map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryChange(category)}
                className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${activeCategory === category 
                  ? 'bg-indigo-500 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
          
          {/* Bot cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBots.map((bot) => (
              <BotCard 
                key={bot.id} 
                bot={bot} 
                schoolSpecific={!!(bot.schoolId && selectedSchool && bot.schoolId === selectedSchool)}
              />
            ))}
          </div>
        </div>
        
        
        
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <ProtectedRoute>
      <HomePageContent />
    </ProtectedRoute>
  );
}
