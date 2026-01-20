import { NextRequest, NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code not provided' },
        { status: 400 }
      );
    }

    const oauth2Client = getGoogleOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.json(
        { error: 'No refresh token received. Make sure to revoke previous access and re-authorize with consent prompt.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Authorization successful. Please save the refresh_token to your environment variables.',
      refresh_token: tokens.refresh_token,
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorDetails = error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack
    } : { error: 'Unknown error', raw: String(error) };
    
    // Log the client ID (first part only for security)
    const clientId = process.env.GOOGLE_CLIENT_ID || 'NOT_SET';
    const clientIdPrefix = clientId.split('-')[0] || 'UNKNOWN';
    console.error('Client ID prefix:', clientIdPrefix, 'Client ID length:', clientId.length);
    console.error('Client Secret present:', !!process.env.GOOGLE_CLIENT_SECRET);
    console.error('Redirect URI:', process.env.GOOGLE_REDIRECT_URI);
    
    return NextResponse.json(
      { 
        error: 'Failed to process authorization', 
        details: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local match your Google Cloud Console OAuth client'
      },
      { status: 500 }
    );
  }
}
