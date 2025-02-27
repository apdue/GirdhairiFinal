import { NextResponse } from 'next/server';
import axios from 'axios';
import { getTokens } from '@/app/lib/tokenStore';
import { getCurrentAccount, updateAccountPage, getAccountById } from '@/app/lib/accountsHandler';

interface FacebookPagesResponse {
  data: Array<{
    access_token: string;
    name: string;
    id: string;
  }>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  
  // Get the account based on the accountId parameter or use the current account
  const account = accountId 
    ? getAccountById(accountId) 
    : getCurrentAccount();
  
  if (!account) {
    return NextResponse.json(
      { error: 'No account found with the provided ID or no current account available' },
      { status: 400 }
    );
  }
  
  // Use the long-lived token from the account
  const longLivedToken = account.longLivedToken;

  if (!longLivedToken) {
    return NextResponse.json(
      { error: 'No long-lived token available for this account' },
      { status: 400 }
    );
  }

  try {
    // First check if the account already has pages stored
    if (account.pages && account.pages.length > 0) {
      console.log(`Using ${account.pages.length} cached pages for account: ${account.name}`);
      return NextResponse.json({
        success: true,
        pages: account.pages
      });
    }
    
    // If no cached pages, fetch from Facebook
    const response = await axios.get<FacebookPagesResponse>(
      `https://graph.facebook.com/me/accounts?access_token=${longLivedToken}`
    );

    const pages = response.data.data.map(page => ({
      id: page.id,
      name: page.name,
      access_token: page.access_token
    }));

    // Store pages in the account
    if (pages.length > 0) {
      for (const page of pages) {
        updateAccountPage(account.id, page);
      }
      
      console.log(`Updated ${pages.length} pages for account: ${account.name}`);
    }

    return NextResponse.json({
      success: true,
      pages
    });
  } catch (error: any) {
    console.error('Error fetching pages:', error.response?.data || error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pages' },
      { status: 500 }
    );
  }
} 