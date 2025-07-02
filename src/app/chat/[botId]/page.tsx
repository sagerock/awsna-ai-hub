'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getBotConfigById, BotConfig } from '@/lib/bots';
import { getUserSchools, School } from '@/lib/schools';
// Removed: import { listKnowledgeCollections } from '@/lib/qdrant';
import Link from 'next/link';

function ChatPageContent() {
  const params = useParams();
  const botId = typeof params.botId === 'string' ? params.botId : null;
  const router = useRouter();
  const { currentUser, isAdmin } = useAuth();
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [messages, setMessages] = useState<Array<{ 
    role: 'system' | 'user' | 'assistant'; 
    content: string; 
    model?: string; 
    timestamp?: any; 
    knowledgeSources?: string[];
  }>>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [userSchools, setUserSchools] = useState<{school: School, role: string}[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>('');
  const [knowledgeCollections, setKnowledgeCollections] = useState<string[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [useKnowledgeBase, setUseKnowledgeBase] = useState<boolean>(true);
  const [showAllCollections, setShowAllCollections] = useState<boolean>(false); // Admin toggle
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load bot config
  useEffect(() => {
    if (botId) {
      const config = getBotConfigById(botId);
      if (config) {
        setBotConfig(config);
        // Set the default model from the bot config
        setSelectedModel(config.defaultModel);
      } else {
        // Bot not found, redirect to home
        router.push('/');
      }
    } else {
      // No botId in URL, redirect to home
      router.push('/');
    }
    setPageLoading(false);
  }, [botId, router]);

  // Load user's schools
  useEffect(() => {
    const loadUserSchools = async () => {
      if (!currentUser) return;
      
      try {
        const schools = await getUserSchools(currentUser.uid);
        setUserSchools(schools);
        
        // If user has schools, select the first one by default
        if (schools.length > 0) {
          setSelectedSchool(schools[0].school.id);
        }
      } catch (error) {
        console.error('Failed to load user schools:', error);
      }
    };
    
    loadUserSchools();
  }, [currentUser]);
  
  // Load knowledge collections based on selected school and admin settings
  useEffect(() => {
    const loadKnowledgeCollections = async () => {
      if (!currentUser || !selectedSchool) return;
      try {
        const idToken = await currentUser.getIdToken();
        if (!idToken) {
          console.error('Failed to get ID token for fetching collections.');
          setError('Authentication error. Please try refreshing.');
          return;
        }

        // Include schoolId parameter and admin flag to get filtered collections
        const url = new URL('/api/knowledge/collections', window.location.origin);
        url.searchParams.set('schoolId', selectedSchool);
        if (showAllCollections) {
          url.searchParams.set('showAll', 'true');
        }

        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
          throw new Error(errorData.error || `Failed to fetch collections: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Frontend received collections data:', data);
        console.log('Setting knowledge collections to:', data.collections || []);
        setKnowledgeCollections(data.collections || []);
        
        // Reset selected collections when school or admin settings change
        setSelectedCollections([]);
      } catch (error: any) {
        console.error('Failed to load knowledge collections:', error);
        setError(error.message || 'Could not load knowledge collections.');
      }
    };

    loadKnowledgeCollections();
  }, [currentUser, selectedSchool, showAllCollections]);

  // Load conversation history
  useEffect(() => {
    const loadConversationHistory = async () => {
      if (!currentUser?.uid || !botId || !botConfig) {
        setIsLoadingHistory(false); // Ensure loading state is reset if prerequisites not met
        // Initialize with system prompt if botConfig is available, even if other conditions fail early
        if (botConfig?.systemPrompt) {
            setMessages([{ role: 'system', content: botConfig.systemPrompt }]);
        } else {
            setMessages([]);
        }
        return;
      }
      
      setIsLoadingHistory(true);
      setError(null);

      try {
        const idToken = await currentUser.getIdToken();
        if (!idToken) {
          console.error('Failed to get ID token for fetching conversation history.');
          setError('Authentication error. Please try refreshing.');
          setMessages([
            {
              role: 'system',
              content: botConfig.systemPrompt || 'You are a helpful AI assistant.'
            }
          ]);
          return; 
        }

        const response = await fetch(`/api/conversations/${currentUser.uid}/${botId}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
          throw new Error(errorData.error || `Failed to fetch conversation history: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.conversation && data.conversation.messages && data.conversation.messages.length > 0) {
          setMessages(data.conversation.messages);
        } else {
          setMessages([
            {
              role: 'system',
              content: botConfig.systemPrompt || 'You are a helpful AI assistant.'
            }
          ]);
        }
      } catch (err: any) {
        console.error('Failed to load conversation history:', err);
        setError(err.message || 'Could not load conversation history.');
        setMessages([
          {
            role: 'system',
            content: botConfig.systemPrompt || 'You are a helpful AI assistant.'
          }
        ]);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    
    // Ensure botConfig is loaded before attempting to load history or set initial system prompt
    if (botConfig) { 
        loadConversationHistory();
    } else if (!pageLoading && !botConfig && botId) {
        // This case implies botId was provided, but config wasn't found (already handled by redirect in other useEffect)
        // However, as a fallback, set loading to false if it hasn't been.
        setIsLoadingHistory(false);
    }

  }, [currentUser, botId, botConfig, pageLoading]); // Added pageLoading to ensure this runs after botConfig attempt

  // Handle model change
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value);
  };

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentMessage.trim() || !botConfig || isSending || !currentUser?.uid || !botId || !selectedModel) return;

    const newMessage = { role: 'user' as const, content: currentMessage.trim() };
    // Ensure system prompt is not duplicated if it's already the first message
    let currentHistory = messages;
    if (messages.length === 1 && messages[0].role === 'system') {
        currentHistory = []; // Start fresh if only system prompt exists from init
    }
    const updatedMessages = [...currentHistory, newMessage];
    
    setMessages(updatedMessages);
    setCurrentMessage('');
    setIsSending(true);
    setError(null);

    try {
      const idToken = await currentUser.getIdToken(); // Get token for chat API
      if (!idToken) {
        setError('Authentication error. Please try refreshing.');
        setIsSending(false);
        return;
      }

      const apiResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, // Add token to chat API call
        },
        body: JSON.stringify({ 
          messages: updatedMessages.filter(msg => msg.role !== 'system'), // Don't send system prompt to chat API if it's part of messages state
          userId: currentUser?.uid, 
          botId: botId,
          modelId: selectedModel,
          schoolId: selectedSchool,
          useKnowledgeBase: useKnowledgeBase,
          knowledgeCollections: selectedCollections,
          systemPrompt: botConfig.systemPrompt // Explicitly send system prompt from config
        }),
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || `API Error: ${apiResponse.statusText}`);
      }

      const data = await apiResponse.json();
      if (data.response && data.response.content) {
        setMessages(prevMessages => [...prevMessages, { 
          role: 'assistant' as const, 
          content: data.response.content, 
          model: data.response.model, 
          knowledgeSources: data.response.knowledgeSources 
        }]);
      } else {
        throw new Error('Invalid response format from API');
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setError(err.message || 'Failed to get response from the bot.');
      // Rollback user message on error
      setMessages(updatedMessages.slice(0, -1)); 
    } finally {
      setIsSending(false);
    }
  };

  if (pageLoading || (!currentUser && !error)) { // Show loading if page is loading OR currentUser is null AND no specific auth error shown yet
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600 text-lg">Loading chat...</p>
      </div>
    );
  }

  // If there's an auth error from context, it might be displayed by ProtectedRoute or a global handler
  // Or if currentUser is null and there's a specific error related to auth from this page's logic:
  if (!currentUser && error) {
     return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        <p className="text-red-500 text-lg mb-4">Authentication Error: {error}</p>
        <p className="text-gray-600 mb-4">Please try logging in again.</p>
        <Link href="/login" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
          Go to Login
        </Link>
      </div>
    );
  }

  if (!botConfig && !pageLoading) { // if done loading and still no botconfig
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        <p className="text-red-500 text-lg mb-4">Error: Bot configuration not found for ID: {botId}.</p>
        <Link href="/" className="text-indigo-600 hover:text-indigo-800">
          Go back to dashboard
        </Link>
      </div>
    );
  }
  
  // Ensure botConfig is available before rendering the main layout
  if (!botConfig) {
    // This should ideally not be reached if pageLoading and other checks are correct
    // but acts as a final guard.
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <p className="text-gray-600 text-lg">Initializing bot...</p>
        </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="bg-white shadow-md p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-indigo-600 hover:text-indigo-800 font-semibold">
            &larr; Back to Bots
          </Link>
          <h1 className="text-xl font-bold text-gray-800">Chat with {botConfig.name}</h1>
          <div className="flex space-x-4">
            {isAdmin && (
              <Link href="/admin" className="text-red-600 hover:text-red-800 font-medium">
                Admin Panel
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 max-w-4xl w-full mx-auto">
        <div className="bg-white p-6 rounded-lg shadow-md h-full flex flex-col">
          {/* Chat Messages Area */} 
          <div className="flex-grow mb-4 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, index) => {
              if (msg.role === 'system' && index === 0 && messages.length > 1) { // Only hide initial system prompt if other messages exist
                 // If you want to completely hide system messages, use: if (msg.role === 'system') return null;
                 return null; 
              }
              if (msg.role === 'system' && messages.length === 1) { // Show system prompt if it's the only message
                return (
                    <div key={index} className="text-center my-4">
                        <p className="text-sm text-gray-500 italic p-2 bg-gray-50 rounded-md">{msg.content}</p>
                    </div>
                );
              }
              return (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} flex-col`}>
                  <div 
                    className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-xl shadow whitespace-pre-wrap ${ 
                      msg.role === 'user' 
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'assistant' && (
                    <div className="text-xs text-gray-500 mt-1 ml-2 space-y-1">
                      {msg.model && <div className="italic">Model: {msg.model}</div>}
                      {msg.knowledgeSources && msg.knowledgeSources.length > 0 && (
                        <div className="flex flex-col">
                          <span className="font-medium text-indigo-600">Knowledge sources:</span>
                          <ul className="list-disc list-inside pl-2">
                            {msg.knowledgeSources.map((source, idx) => (
                              <li key={idx} className="truncate max-w-xs">{source}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Controls Area */} 
          <div className="mb-4 p-2 border-t border-gray-200 pt-4">
            {userSchools.length > 0 && (
              <div className="mb-4">
                <label htmlFor="school-selector" className="block text-sm font-medium text-gray-700 mb-1">
                  Waldorf School Context:
                </label>
                <div className="flex flex-col space-y-2">
                  <select
                    id="school-selector"
                    value={selectedSchool}
                    onChange={(e) => setSelectedSchool(e.target.value)}
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    disabled={isSending || isLoadingHistory}
                  >
                    {userSchools.map((schoolData) => (
                      <option key={schoolData.school.id} value={schoolData.school.id}>
                        {schoolData.school.name}
                      </option>
                    ))}
                  </select>
                  
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input
                        id="use-knowledge-base"
                        type="checkbox"
                        checked={useKnowledgeBase}
                        onChange={(e) => setUseKnowledgeBase(e.target.checked)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        disabled={isSending || isLoadingHistory}
                      />
                      <label htmlFor="use-knowledge-base" className="ml-2 block text-sm text-gray-900">
                        Use school knowledge base
                      </label>
                    </div>
                    
                    {isAdmin && (
                      <div className="flex items-center">
                        <input
                          id="show-all-collections"
                          type="checkbox"
                          checked={showAllCollections}
                          onChange={(e) => setShowAllCollections(e.target.checked)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          disabled={isSending || isLoadingHistory}
                        />
                        <label htmlFor="show-all-collections" className="ml-2 block text-sm text-gray-900">
                          <span className="text-red-600 font-medium">Admin:</span> Show all school collections
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {useKnowledgeBase && knowledgeCollections.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Knowledge Collections: (Select up to 3)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {knowledgeCollections.map((collection) => (
                    <div key={collection} className="flex items-center">
                      <input
                        id={`collection-${collection}`}
                        type="checkbox"
                        checked={selectedCollections.includes(collection)}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          if (isChecked) {
                            if (selectedCollections.length < 3) {
                                setSelectedCollections([...selectedCollections, collection]);
                            }
                          } else {
                            setSelectedCollections(selectedCollections.filter(c => c !== collection));
                          }
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        disabled={(isSending || isLoadingHistory) || (selectedCollections.length >= 3 && !selectedCollections.includes(collection))}
                      />
                      <label htmlFor={`collection-${collection}`} className="ml-2 block text-sm text-gray-900 capitalize truncate" title={collection}>
                        {collection.replace(/-/g, ' ')}
                      </label>
                    </div>
                  ))}
                </div>
                 {selectedCollections.length >= 3 && <p className="text-xs text-red-500 mt-1">Maximum 3 collections selected.</p>}
              </div>
            )}
            
            <div className="mb-4">
              <label htmlFor="model-selector" className="block text-sm font-medium text-gray-700 mb-1">
                AI Model:
              </label>
              <div className="flex items-center justify-between">
                <select
                  id="model-selector"
                  value={selectedModel}
                  onChange={handleModelChange}
                  className="block w-full md:w-2/3 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  disabled={isSending || isLoadingHistory}
                >
                  {botConfig.supportedModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} - {model.provider}
                    </option>
                  ))}
                </select>
              </div>
              {selectedModel && botConfig.supportedModels.find(m => m.id === selectedModel) && (
                <p className="mt-1 text-xs text-gray-500">
                  {botConfig.supportedModels.find(m => m.id === selectedModel)?.description}
                </p>
              )}
            </div>
          </div>

          {/* Error Display Area */} 
          {error && (
            <div className="p-2 mb-2 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
              <span className="font-medium">Error:</span> {error}
            </div>
          )}

          {/* Message Input Form */} 
          <form onSubmit={handleSendMessage} className="mt-auto flex items-center">
            <input 
              type="text" 
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              placeholder={`Message ${botConfig?.name || 'this bot'}...`}
              className="flex-grow p-3 border border-gray-300 rounded-l-lg focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow duration-150 ease-in-out focus:shadow-md"
              disabled={isSending || isLoadingHistory}
            />
            <button 
              type="submit" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold p-3 rounded-r-lg disabled:opacity-50 transition-colors duration-150 ease-in-out"
              disabled={isSending || isLoadingHistory || !currentMessage.trim()}
            >
              {isSending ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : 'Send'}
            </button>
          </form>
        </div> 
      </main> 
    </div> 
  ); 
}

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatPageContent />
    </ProtectedRoute>
  );
}
