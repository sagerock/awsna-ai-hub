import { getAdminDb, getFirebaseAdminAuth } from '@/server/firebase-admin'; // Use Admin SDK
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; botId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { userId: routeUserId, botId } = resolvedParams;

    if (!routeUserId || !botId) {
      return NextResponse.json(
        { error: 'User ID and Bot ID from route are required' },
        { status: 400 }
      );
    }

    // Verify Firebase ID token from Authorization header
    const authorization = request.headers.get('Authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token format' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];

    let decodedToken;
    try {
      decodedToken = await getFirebaseAdminAuth().verifyIdToken(idToken);
    } catch (error) {
      console.error('Error verifying token:', error);
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    // Ensure the authenticated user matches the userId in the route
    if (decodedToken.uid !== routeUserId) {
      return NextResponse.json({ error: 'Forbidden: You can only access your own conversations' }, { status: 403 });
    }

    const adminDb = getAdminDb();
    // Get the conversation document using Admin SDK
    const conversationRef = adminDb.collection('users').doc(routeUserId).collection('conversations').doc(botId);
    const conversationSnap = await conversationRef.get();

    if (!conversationSnap.exists) {
      // No conversation found - this is not an error, just return an empty result
      return NextResponse.json({ conversation: null });
    }

    // Return the conversation data
    const conversationData = conversationSnap.data();
    
    return NextResponse.json({ conversation: conversationData });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    );
  }
}
