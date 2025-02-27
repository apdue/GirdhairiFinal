import { NextResponse } from 'next/server';
import axios from 'axios';
import { getTokens } from '@/app/lib/tokenStore';
import { getCurrentAccount } from '@/app/lib/accountsHandler';

interface FacebookLeadFormsResponse {
  data: Array<{
    id: string;
    name: string;
    status: string;
    created_time: string;
  }>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const specificPageId = searchParams.get('pageId');
  
  const tokens = getTokens();
  const currentAccount = getCurrentAccount();
  
  // Determine which page ID to use
  let pageId = specificPageId || tokens.pageId;
  let pageToken = tokens.pageToken;
  
  // If a specific page ID is provided but no token in memory, check the account
  if (specificPageId && !pageToken && currentAccount) {
    const page = currentAccount.pages.find(p => p.id === specificPageId);
    if (page) {
      pageToken = page.access_token;
      pageId = page.id;
    }
  }

  if (!pageToken || !pageId) {
    return NextResponse.json(
      { error: 'No page token or page ID available' },
      { status: 400 }
    );
  }

  try {
    const response = await axios.get<FacebookLeadFormsResponse>(
      `https://graph.facebook.com/${pageId}/leadgen_forms?access_token=${pageToken}`
    );

    const forms = response.data.data.map(form => ({
      id: form.id,
      name: form.name,
      status: form.status,
      created_time: form.created_time
    }));

    return NextResponse.json({
      success: true,
      forms,
      pageId
    });
  } catch (error: any) {
    console.error('Error fetching lead forms:', error.response?.data || error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lead forms' },
      { status: 500 }
    );
  }
}

// Add POST handler for manual token submission
export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { pageId, accessToken } = body;
    
    if (!pageId || !accessToken) {
      return NextResponse.json(
        { success: false, error: 'Page ID and access token are required' },
        { status: 400 }
      );
    }
    
    // Make the API call with the provided token
    const response = await axios.get<FacebookLeadFormsResponse>(
      `https://graph.facebook.com/${pageId}/leadgen_forms?access_token=${accessToken}`
    );
    
    const forms = response.data.data.map(form => ({
      id: form.id,
      name: form.name,
      status: form.status,
      created_time: form.created_time
    }));
    
    return NextResponse.json({
      success: true,
      forms,
      pageId
    });
  } catch (error: any) {
    console.error('Error fetching lead forms with manual token:', 
      error.response?.data || error.message);
    
    // Return a more detailed error message
    return NextResponse.json(
      { 
        success: false, 
        error: error.response?.data?.error?.message || 'Failed to fetch forms with manual token' 
      },
      { status: 500 }
    );
  }
} 