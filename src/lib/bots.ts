export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description: string;
  maxTokens?: number;
  contextWindow?: number;
}

export interface BotConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  avatarUrl: string;
  supportedModels: ModelOption[];
  defaultModel: string;
  // New fields for Waldorf platform
  schoolId?: string; // null/undefined for global bots available to all schools
  knowledgeCollections?: string[]; // Qdrant collections to search
  knowledgeSearchStrategy?: 'hybrid' | 'semantic' | 'exact';
  category?: 'academic' | 'administrative' | 'marketing' | 'accreditation' | 'general';
  tags?: string[];
}

// Common models that can be shared across different bots
export const availableModels: ModelOption[] = [
  // OpenAI Models
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Advanced multimodal model with improved reasoning and efficiency.',
    maxTokens: 4096,
    contextWindow: 128000
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    description: 'Enhanced version of GPT-4 with improved capabilities.',
    maxTokens: 4096,
    contextWindow: 128000
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    provider: 'openai',
    description: 'Compact version of GPT-4.1 optimized for speed and efficiency.',
    maxTokens: 4096,
    contextWindow: 32768
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    provider: 'openai',
    description: 'Ultra-compact version of GPT-4.1 for simple tasks.',
    maxTokens: 2048,
    contextWindow: 16384
  },
  {
    id: 'chatgpt-4o-latest',
    name: 'ChatGPT-4o Latest',
    provider: 'openai',
    description: 'Latest ChatGPT-4o model with the most recent improvements (default).',
    maxTokens: 4096,
    contextWindow: 128000
  },
  
  // Anthropic Models
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude 4 Opus',
    provider: 'anthropic',
    description: 'Most capable Claude model with exceptional reasoning and creative abilities.',
    maxTokens: 4096,
    contextWindow: 200000
  },
  {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    description: 'Enhanced Claude 3.5 Sonnet with improved performance and capabilities.',
    maxTokens: 4096,
    contextWindow: 200000
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'Balanced performance and intelligence with nuanced understanding.',
    maxTokens: 4096,
    contextWindow: 200000
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    description: 'Fast and efficient model for everyday tasks and simple queries.',
    maxTokens: 4096,
    contextWindow: 200000
  },
  
  // Google Models
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'Google\'s most capable multimodal model with advanced reasoning.',
    maxTokens: 4096,
    contextWindow: 1000000
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    description: 'Fast and efficient version of Gemini 2.5 for quick responses.',
    maxTokens: 4096,
    contextWindow: 1000000
  }
];

// AWSNA Waldorf Specialized Bots
export const predefinedBots: BotConfig[] = [
  // General Bots - Available to all schools
  {
    id: 'waldorf-general-assistant',
    name: 'Waldorf General Assistant',
    description: 'A helpful AI assistant trained on Waldorf educational principles.',
    systemPrompt: 'You are a helpful AI assistant for Waldorf schools, developed by AWSNA. You understand Waldorf pedagogy, anthroposophy, and the developmental approach of Waldorf education. Answer questions accurately, be friendly, and align responses with Waldorf educational philosophy and values. Emphasize the integration of arts, practical work, and academics.',
    avatarUrl: '/bot-avatars/general-assistant.png',
    supportedModels: [
      availableModels[4], // ChatGPT-4o Latest
      availableModels[0], // GPT-4o
      availableModels[1], // GPT-4.1
      availableModels[7], // Claude 3.5 Sonnet
      availableModels[5], // Claude 4 Opus
      availableModels[9], // Gemini 2.5 Pro
    ],
    defaultModel: 'chatgpt-4o-latest',
    knowledgeCollections: ['waldorf-general-knowledge', 'steiner-philosophy'],
    knowledgeSearchStrategy: 'semantic',
    category: 'general',
    tags: ['waldorf', 'general', 'education'],
  },
  
  // Accreditation Bots
  {
    id: 'accreditation-assistant',
    name: 'Accreditation Assistant',
    description: 'Helps schools navigate the AWSNA accreditation process.',
    systemPrompt: 'You are an AWSNA Accreditation Assistant. You help Waldorf schools understand and navigate the AWSNA accreditation process. Provide accurate information about accreditation requirements, documentation, self-study processes, and visiting team procedures. Refer to specific AWSNA guidelines and standards when appropriate. Your goal is to support schools in preparing for and maintaining AWSNA accreditation.',
    avatarUrl: '/bot-avatars/accreditation.png',
    supportedModels: [
      availableModels[4], // ChatGPT-4o Latest
      availableModels[0], // GPT-4o
      availableModels[7], // Claude 3.5 Sonnet
      availableModels[5], // Claude 4 Opus
      availableModels[9], // Gemini 2.5 Pro
    ],
    defaultModel: 'chatgpt-4o-latest',
    knowledgeCollections: ['awsna-accreditation-docs', 'waldorf-standards'],
    knowledgeSearchStrategy: 'hybrid',
    category: 'accreditation',
    tags: ['accreditation', 'standards', 'evaluation'],
  },
  
  // Teacher Planning
  {
    id: 'curriculum-planner',
    name: 'Waldorf Curriculum Planner',
    description: 'Assists teachers with Waldorf-specific lesson and block planning.',
    systemPrompt: 'You are a Waldorf Curriculum Planning Assistant. Help teachers develop lesson plans and block rotations aligned with Waldorf developmental principles. Integrate artistic elements, movement, and experiential learning into academic subjects. Provide age-appropriate content suggestions for each grade level based on Waldorf developmental understanding. Remember the importance of rhythm in the school day, week, and year. Suggest main lesson book formats, artistic activities, and assessment approaches consistent with Waldorf pedagogy.',
    avatarUrl: '/bot-avatars/curriculum.png',
    supportedModels: [
      availableModels[4], // ChatGPT-4o Latest
      availableModels[0], // GPT-4o
      availableModels[1], // GPT-4.1
      availableModels[7], // Claude 3.5 Sonnet
      availableModels[6], // Claude 3.7 Sonnet
      availableModels[9], // Gemini 2.5 Pro
    ],
    defaultModel: 'chatgpt-4o-latest',
    knowledgeCollections: ['waldorf-curriculum', 'steiner-education', 'waldorf-lesson-plans'],
    knowledgeSearchStrategy: 'semantic',
    category: 'academic',
    tags: ['curriculum', 'planning', 'lessons', 'blocks'],
  },
  
  // Administrative
  {
    id: 'school-administration',
    name: 'School Administration Guide',
    description: 'Provides guidance on Waldorf school governance, administration, and operations.',
    systemPrompt: 'You are a Waldorf School Administration Assistant. Provide guidance on governance structures, collegial leadership, committee work, faculty meetings, and administrative processes typical in Waldorf schools. Help with questions about school policies, parent communications, enrollment, financial sustainability, and strategic planning. Your advice should reflect the collaborative and mission-driven nature of Waldorf school leadership while acknowledging practical operational needs.',
    avatarUrl: '/bot-avatars/admin.png',
    supportedModels: [
      availableModels[4], // ChatGPT-4o Latest
      availableModels[0], // GPT-4o
      availableModels[7], // Claude 3.5 Sonnet
      availableModels[5], // Claude 4 Opus
      availableModels[9], // Gemini 2.5 Pro
    ],
    defaultModel: 'chatgpt-4o-latest',
    knowledgeCollections: ['waldorf-administration', 'waldorf-governance', 'awsna-guidelines'],
    knowledgeSearchStrategy: 'hybrid',
    category: 'administrative',
    tags: ['administration', 'governance', 'leadership'],
  },
  
  // Marketing
  {
    id: 'marketing-advisor',
    name: 'Waldorf Marketing Advisor',
    description: 'Helps schools with marketing strategies, parent communications, and community outreach.',
    systemPrompt: 'You are a Waldorf School Marketing and Communications Advisor. Help schools develop effective marketing strategies, enrollment materials, website content, social media approaches, and parent communications that authentically represent Waldorf education. Provide guidance on explaining Waldorf pedagogy to prospective families, hosting school tours and events, and community outreach. Your suggestions should maintain the integrity of Waldorf principles while effectively communicating the value of Waldorf education to diverse audiences.',
    avatarUrl: '/bot-avatars/marketing.png',
    supportedModels: [
      availableModels[4], // ChatGPT-4o Latest
      availableModels[0], // GPT-4o
      availableModels[1], // GPT-4.1
      availableModels[2], // GPT-4.1 Mini
      availableModels[7], // Claude 3.5 Sonnet
      availableModels[10], // Gemini 2.5 Flash
    ],
    defaultModel: 'chatgpt-4o-latest',
    knowledgeCollections: ['waldorf-marketing', 'waldorf-messaging', 'enrollment-resources'],
    knowledgeSearchStrategy: 'semantic',
    category: 'marketing',
    tags: ['marketing', 'communications', 'enrollment'],
  }
];

export const getBotConfigById = (id: string): BotConfig | undefined => {
  return predefinedBots.find(bot => bot.id === id);
};

export const getBotsByCategory = (category: BotConfig['category']): BotConfig[] => {
  return predefinedBots.filter(bot => bot.category === category);
};

export const getBotsBySchool = (schoolId: string | null): BotConfig[] => {
  // If schoolId is null, return global bots (available to all)
  if (schoolId === null) {
    return predefinedBots.filter(bot => !bot.schoolId);
  }
  
  // Return global bots + school-specific bots
  return predefinedBots.filter(bot => !bot.schoolId || bot.schoolId === schoolId);
};

export const getModelById = (modelId: string): ModelOption | undefined => {
  return availableModels.find(model => model.id === modelId);
};
