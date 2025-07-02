import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getBotConfigById, getModelById } from '@/lib/bots';
import { initializeFirebaseAdmin, getFirebaseAdminAuth, getAdminDb } from '@/server/firebase-admin';
import { searchKnowledge } from '@/lib/qdrant';

// Define the structure for the AI's response message payload
interface AssistantMessagePayload {
  role: 'assistant';
  content: string;
  model: string;
  timestamp: string;
  knowledgeSources?: string[]; // Optional: sources used for the response
}

// Ensure the OpenAI API key is available
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OpenAI API key. Make sure OPENAI_API_KEY is set in your .env.local file.');
}

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = process.env.ANTHROPIC_API_KEY 
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) 
  : null;

const googleAI = process.env.GOOGLE_AI_API_KEY 
  ? new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY) 
  : null;

export async function POST(request: NextRequest) {
  try {
    const { messages, userId, botId, modelId, schoolId, useKnowledgeBase, knowledgeCollections } = await request.json();

    console.log(`🔐 Chat API called for user: ${userId}, bot: ${botId}`);

    // Verify Firebase ID token from Authorization header
    const authorization = request.headers.get('Authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      console.error('❌ Missing or invalid authorization header');
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token format' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    console.log(`🔑 Token received, length: ${idToken.length}`);

    let decodedToken;
    try {
      initializeFirebaseAdmin();
      decodedToken = await getFirebaseAdminAuth().verifyIdToken(idToken);
      console.log(`✅ Token verified for user: ${decodedToken.uid}, email: ${decodedToken.email || 'no email'}`);
      
      // Ensure the token user matches the request user
      if (decodedToken.uid !== userId) {
        console.error(`❌ User ID mismatch: token=${decodedToken.uid}, request=${userId}`);
        return NextResponse.json({ error: 'Unauthorized: User ID mismatch' }, { status: 403 });
      }
    } catch (error) {
      console.error('❌ Error verifying token:', error);
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid or missing messages' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!botId) {
      return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 });
    }
    
    if (!modelId) {
      return NextResponse.json({ error: 'Model ID is required' }, { status: 400 });
    }
    
    // Get the selected model configuration
    const selectedModel = getModelById(modelId);
    if (!selectedModel) {
      return NextResponse.json({ error: 'Invalid model ID' }, { status: 400 });
    }

    // Get the user's last message (for potential future use)
    // const userMessage = messages[messages.length - 1].content;

    // Get bot configuration
    const botConfig = getBotConfigById(botId);
    if (!botConfig) {
      return NextResponse.json({ error: 'Invalid bot ID' }, { status: 400 });
    }
    
    // Check if the selected model is supported by the bot
    if (!botConfig.supportedModels.some(model => model.id === modelId)) {
      return NextResponse.json({ 
        error: 'The selected model is not supported by this bot' 
      }, { status: 400 });
    }

    // Prepare messages array with system prompt
    let promptMessages = [];
    
    // Add system prompt
    promptMessages.push({ role: 'system', content: botConfig.systemPrompt });
    
    // Get contextual knowledge if available
    let contextualKnowledge = '';
    let knowledgeSources: string[] = [];
    
    // Retrieve knowledge from Qdrant if enabled
    if (useKnowledgeBase && schoolId) {
      try {
        const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
        
        if (lastUserMessage) {
          const searchResults = await searchKnowledge(
            lastUserMessage,
            knowledgeCollections && knowledgeCollections.length > 0 ? knowledgeCollections : [],
            5, // limit
            schoolId,
            'hybrid' // search strategy
          );
          
          if (searchResults.length > 0) {
            contextualKnowledge = searchResults.map((result) => result.text).join('\n\n');
            knowledgeSources = searchResults.map((result) => {
              const metadata = result.metadata as { fileName?: string; collection?: string } || {};
              return `${metadata.fileName || 'Unknown document'} (${metadata.collection || 'general'})`;
            });
          }
        }
      } catch (error) {
        console.error('Error retrieving knowledge:', error);
        // Continue without knowledge if retrieval fails
      }
    }
    
    // Add contextual knowledge if available
    if (contextualKnowledge) {
      promptMessages.push({ 
        role: 'system', 
        content: `Here is relevant information that may help with the user's query:\n\n${contextualKnowledge}` 
      });
    }
    
    // Add conversation history (excluding any previous system messages)
    promptMessages = [
      ...promptMessages,
      ...messages.filter(msg => msg.role !== 'system')
    ];

    // Validate message format
    for (const message of messages) {
      if (!message.role || !message.content || typeof message.content !== 'string') {
        return NextResponse.json({ error: 'Each message must have a role and content field, and content must be a string.' }, { status: 400 });
      }
    }

    // Process the request based on the model provider
    let aiResponse: AssistantMessagePayload;
    
    try {
      if (selectedModel.provider === 'openai') {
        // OpenAI API call
        // Determine a reasonable max_tokens value
        let effectiveMaxTokens = selectedModel.maxTokens || 1000; // Default to 1000 if not set
        // Cap at 4096 for models like gpt-3.5-turbo (8k/16k) or gpt-4 (8k+), to leave prompt space.
        // If you use models with smaller total context windows (e.g., an older 4k gpt-3.5-turbo), adjust this cap lower.
        if (effectiveMaxTokens > 4096) { 
            console.warn(`Warning: configured maxTokens ${selectedModel.maxTokens} for model ${selectedModel.id} is very high. Capping at 4096 for this request to ensure prompt space.`);
            effectiveMaxTokens = 4096;
        }

        const completion = await openai.chat.completions.create({
          model: selectedModel.id,
          messages: promptMessages,
          temperature: 0.7,
          max_tokens: effectiveMaxTokens, // Use the adjusted value
        });

        const assistantResponseContent = completion.choices[0].message.content || 'No response generated';
        aiResponse = {
          role: 'assistant',
          content: assistantResponseContent,
          model: selectedModel.name,
          timestamp: new Date().toISOString(),
        };
        if (knowledgeSources.length > 0) {
          aiResponse.knowledgeSources = knowledgeSources;
        }
      } 
      else if (selectedModel.provider === 'anthropic' && anthropic) {
        // Anthropic API call
        const anthropicMessages = promptMessages.map(msg => {
          // Convert OpenAI message format to Anthropic format
          if (msg.role === 'system') {
            return { role: 'assistant', content: msg.content };
          }
          return msg;
        });

        const response = await anthropic.messages.create({
          model: selectedModel.id,
          messages: anthropicMessages,
          max_tokens: selectedModel.maxTokens || 1000,
        });

        // Check if response has content and extract the text
        const responseContent = response.content && response.content[0] && 
          'text' in response.content[0] ? response.content[0].text : 'No response generated';

        aiResponse = {
          role: 'assistant',
          content: responseContent,
          model: selectedModel.name,
          timestamp: new Date().toISOString(),
        };
        if (knowledgeSources.length > 0) {
          aiResponse.knowledgeSources = knowledgeSources;
        }
      }
      else if (selectedModel.provider === 'google' && googleAI) {
        // Google Gemini API call
        const model = googleAI.getGenerativeModel({ model: selectedModel.id });
        
        // Convert conversation to Google's format
        const chat = model.startChat({
          history: promptMessages.slice(0, -1).map(msg => ({
            role: msg.role === 'system' ? 'user' : msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          })),
          generationConfig: {
            maxOutputTokens: selectedModel.maxTokens || 1000,
            temperature: 0.7,
          },
        });

        const lastMessage = promptMessages[promptMessages.length - 1].content;
        const result = await chat.sendMessage(lastMessage);
        const response = await result.response;
        const responseContent = response.text() || 'No response generated';

        aiResponse = {
          role: 'assistant',
          content: responseContent,
          model: selectedModel.name,
          timestamp: new Date().toISOString(),
        };
        if (knowledgeSources.length > 0) {
          aiResponse.knowledgeSources = knowledgeSources;
        }
      }
      else {
        const provider = selectedModel.provider;
        const availableProviders = [];
        if (process.env.OPENAI_API_KEY) availableProviders.push('openai');
        if (process.env.ANTHROPIC_API_KEY) availableProviders.push('anthropic');
        if (process.env.GOOGLE_AI_API_KEY) availableProviders.push('google');
        
        throw new Error(`Provider ${provider} is not supported or configured. Available providers: ${availableProviders.join(', ')}`);
      }
    } catch (error: unknown) {
      console.error('Error calling AI provider:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ 
        error: `Error generating response: ${errorMessage}` 
      }, { status: 500 });
    }

    // Save conversation to Firestore using Admin SDK
    try {
      console.log(`Attempting to save conversation for user: ${userId}, bot: ${botId}`);
      
      const adminDb = getAdminDb();
      const conversationRef = adminDb.collection('users').doc(userId).collection('conversations').doc(botId);
      
      // Create a summary of the last message for preview
      const lastMessagePreview = aiResponse.content.substring(0, 100) + 
        (aiResponse.content.length > 100 ? '...' : '');
      
      const conversationData = {
        botId,
        lastUpdated: new Date(), // Use regular Date for admin SDK instead of serverTimestamp()
        messages: [...messages, aiResponse],
        modelId: selectedModel.id,  // Track which model was used
        lastModel: selectedModel.name, // For display purposes
        lastMessage: lastMessagePreview,
        knowledgeUsed: !!contextualKnowledge  // Track if knowledge retrieval was used
      };
      
      console.log('Conversation data to save:', {
        botId: conversationData.botId,
        messagesCount: conversationData.messages.length,
        modelId: conversationData.modelId,
        knowledgeUsed: conversationData.knowledgeUsed
      });
      
      await conversationRef.set(conversationData, { merge: true });
      console.log('✅ Conversation saved successfully to Firestore using Admin SDK');
    } catch (dbError) {
      console.error('❌ Error saving to Firestore:', dbError);
      console.error('Error details:', {
        code: (dbError as Error)?.name,
        message: (dbError as Error)?.message,
        userId,
        botId
      });
      // Continue even if saving fails - don't break the user experience
    }

    return NextResponse.json({ response: aiResponse });
  } catch (error: unknown) {
    console.error('Error:', error);
    // Return a sanitized error message to the client
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
