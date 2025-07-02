# AWSNA AI Center

A comprehensive AI-powered platform for Waldorf schools, providing specialized AI assistants for curriculum planning, accreditation, administration, and marketing.

## Features

- **Multiple AI Models**: Support for OpenAI, Anthropic Claude, and Google Gemini models
- **Specialized Bots**: Waldorf-specific AI assistants for different educational domains
- **Knowledge Management**: Document upload and vector search with Qdrant
- **Multi-school Support**: Namespace isolation for different school organizations
- **Admin System**: Comprehensive admin controls for user and content management

## Admin Features

The platform includes comprehensive admin functionality for system management:

### Admin Access
- **System Admins**: Predefined in `src/lib/admin.ts` (sage@sagerock.com)
- **Automatic Admin Detection**: System automatically grants admin privileges to authorized emails
- **Admin Navigation**: Red "Admin Panel" link appears in navigation for admins
- **Admin Badge**: Visual indicator showing admin status

### Admin Dashboard Features
- **Overview**: System statistics and health monitoring
- **User Management**: Grant/revoke admin permissions (enhanced features coming soon)
- **Content Management**: View and delete any Qdrant collection across all schools
- **Global Access**: Admins can access all school collections and content

### Admin Privileges
- ✅ Access all school collections (bypass school restrictions)
- ✅ Delete any content from any school
- ✅ View admin-only features in UI
- ✅ Special admin controls in chat interface
- 🔄 Add/remove other admins (enhanced features coming soon)

### Security
- Firestore security rules enforce admin-only operations
- Admin collection restricted to authorized users only
- System admin privileges cannot be revoked

## Supported AI Models

### OpenAI Models
- GPT-4o
- GPT-4.1
- GPT-4.1 Mini
- GPT-4.1 Nano
- ChatGPT-4o Latest (default)

### Anthropic Models
- Claude 4 Opus
- Claude 3.7 Sonnet
- Claude 3.5 Sonnet
- Claude 3.5 Haiku

### Google Models
- Gemini 2.5 Pro
- Gemini 2.5 Flash

## Environment Variables

Create a `.env.local` file with the following variables:

```bash
# AI Model API Keys
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_AI_API_KEY=your_google_ai_api_key

# Qdrant Vector Database
QDRANT_URL=your_qdrant_cluster_url
QDRANT_API_KEY=your_qdrant_api_key

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
# ... other Firebase config variables
```

## Getting Started

First, install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
