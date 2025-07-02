#!/bin/bash

echo "🚀 Deploying Firestore Rules..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Check if project is initialized
if [ ! -f ".firebaserc" ]; then
    echo "⚙️  Initializing Firebase project..."
    echo "Please run 'firebase login' first if you haven't already."
    firebase init firestore
else
    echo "✅ Firebase project already initialized"
fi

echo "📄 Deploying Firestore rules..."
firebase deploy --only firestore:rules

echo "✅ Firestore rules deployed successfully!"
echo ""
echo "🔧 Next steps:"
echo "1. Test chat functionality in your app"
echo "2. Conversations should now save properly"
echo "3. Check Firebase Console for confirmation" 