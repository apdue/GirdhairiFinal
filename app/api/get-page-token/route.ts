import { NextResponse } from 'next/server';
import axios from 'axios';
import { getTokens, setTokens } from '@/app/lib/tokenStore';
import { getCurrentAccount, updateAccountPage } from '@/app/lib/accountsHandler';

interface FacebookPageResponse {
  data: Array<{
    access_token: string;
    id: string;
    name: string;
  }>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const longLivedToken = searchParams.get('longLivedToken') || getTokens().longLivedToken;
  const specificPageId = searchParams.get('pageId');
  const pageIndex = searchParams.get('pageIndex') ? parseInt(searchParams.get('pageIndex')!, 10) : undefined;
  
  const currentAccount = getCurrentAccount();

  if (!longLivedToken) {
    return NextResponse.json(
      { error: 'No long-lived token provided' },
      { status: 400 }
    );
  }

  if (!currentAccount) {
    return NextResponse.json(
      { error: 'No account selected or available' },
      { status: 400 }
    );
  }

  try {
    const response = await axios.get<FacebookPageResponse>(
      `https://graph.facebook.com/me/accounts?access_token=${longLivedToken}`
    );
    const pages = response.data.data;

    if (!pages || pages.length === 0) {
      return NextResponse.json(
        { error: 'No Pages found' },
        { status: 404 }
      );
    }

    // If a specific page ID is provided, use that
    let page;
    if (specificPageId) {
      page = pages.find(p => p.id === specificPageId);
      if (!page) {
        return NextResponse.json(
          { error: `Page with ID ${specificPageId} not found` },
          { status: 404 }
        );
      }
    } 
    // If a page index is provided, use that
    else if (pageIndex !== undefined && pageIndex >= 0 && pageIndex < pages.length) {
      page = pages[pageIndex];
    }
    // Otherwise use the first page
    else {
      page = pages[0];
    }

    const pageToken = page.access_token;
    const pageId = page.id;
    const pageName = page.name;

    // Store tokens and page ID
    setTokens({
      pageToken,
      pageId,
      longLivedToken,
      pageIndex: pageIndex !== undefined ? pageIndex : 0
    });
    
    // Also update in the accounts.json
    updateAccountPage(currentAccount.id, {
      id: pageId,
      name: pageName,
      access_token: pageToken
    });
    
    console.log(`Stored page token and ID for "${pageName}" (${pageId}) in account: ${currentAccount.name}`);

    return NextResponse.json({
      success: true,
      pageToken,
      pageId,
      pageName
    });
  } catch (error: any) {
    console.error('Error fetching Page token:', error.response?.data || error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Page token' },
      { status: 500 }
    );
  }
} 