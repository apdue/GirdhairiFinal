import { NextResponse } from 'next/server';
import axios from 'axios';
import { setTokens } from '../../lib/tokenStore';
import { getCurrentAccount, updateAccountTokens } from '../../lib/accountsHandler';

interface FacebookTokenResponse {
  access_token: string;
}

export async function GET() {
  // Get current account from accounts.json
  const currentAccount = getCurrentAccount();
  
  if (!currentAccount) {
    return NextResponse.json(
      { error: 'No account selected or available' },
      { status: 400 }
    );
  }
  
  const appId = currentAccount.appId;
  const appSecret = currentAccount.appSecret;
  const shortLivedToken = currentAccount.shortLivedToken;

  if (!appId || !appSecret || !shortLivedToken) {
    return NextResponse.json(
      { error: 'Missing credentials in the current account' },
      { status: 400 }
    );
  }

  try {
    const response = await axios.get<FacebookTokenResponse>(
      `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`
    );

    const longLivedToken = response.data.access_token;
    
    // Store the token in both global and account-specific storage
    setTokens({ longLivedToken });
    
    // Also update in the accounts.json
    updateAccountTokens(currentAccount.id, {
      longLivedToken,
      longLivedTokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days from now
    });
    
    console.log('Stored long-lived token for account:', currentAccount.name);

    return NextResponse.json({ success: true, longLivedToken });
  } catch (error: any) {
    console.error('Error converting token:', error.response?.data || error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to convert token' },
      { status: 500 }
    );
  }
} 