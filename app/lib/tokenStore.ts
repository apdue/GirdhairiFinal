// Server-side token store for multiple accounts
import { getCurrentAccount, updateAccountTokens, updateAccountPage } from './accountsHandler';
import type { FacebookPage } from './accountsHandler';

interface TokenStore {
  longLivedToken: string;
  pageToken: string;
  pageId: string;
  pageIndex?: number; // For tracking which page is selected
}

// Use global object to persist tokens across hot reloads
declare global {
  var __tokenStore: TokenStore | undefined;
}

if (!global.__tokenStore) {
  global.__tokenStore = {
    longLivedToken: '',
    pageToken: '',
    pageId: ''
  };

  // Initialize with environment variables if available
  if (process.env.FACEBOOK_PAGE_TOKEN && process.env.FACEBOOK_PAGE_ID) {
    global.__tokenStore.pageToken = process.env.FACEBOOK_PAGE_TOKEN;
    global.__tokenStore.pageId = process.env.FACEBOOK_PAGE_ID;
  }
}

export function getTokens(): TokenStore {
  // First, try to get tokens from current account in accounts.json
  const currentAccount = getCurrentAccount();
  
  if (currentAccount && currentAccount.longLivedToken) {
    // If the account has pages and a selected page, use that page's token
    if (currentAccount.pages.length > 0 && global.__tokenStore?.pageIndex !== undefined) {
      const selectedPageIndex = global.__tokenStore.pageIndex;
      
      if (selectedPageIndex >= 0 && selectedPageIndex < currentAccount.pages.length) {
        const selectedPage = currentAccount.pages[selectedPageIndex];
        return {
          longLivedToken: currentAccount.longLivedToken,
          pageToken: selectedPage.access_token,
          pageId: selectedPage.id,
          pageIndex: selectedPageIndex
        };
      }
    }
    
    // If no page is selected or index is invalid, just return the account token
    return {
      longLivedToken: currentAccount.longLivedToken,
      pageToken: global.__tokenStore!.pageToken,
      pageId: global.__tokenStore!.pageId
    };
  }
  
  // Fall back to the global token store if no current account is available
  return global.__tokenStore!;
}

export function setTokens(tokens: Partial<TokenStore>) {
  const oldTokens = { ...global.__tokenStore! };
  global.__tokenStore = { ...oldTokens, ...tokens };
  
  // Log the token changes (safely masking the actual tokens)
  console.log('Token store updated:', {
    longLivedToken: tokens.longLivedToken ? '[updated]' : oldTokens.longLivedToken ? '[unchanged]' : '[empty]',
    pageToken: tokens.pageToken ? '[updated]' : oldTokens.pageToken ? '[unchanged]' : '[empty]',
    pageId: tokens.pageId || oldTokens.pageId || '[empty]',
    pageIndex: tokens.pageIndex !== undefined ? tokens.pageIndex : oldTokens.pageIndex
  });
  
  // Also update the tokens in accounts.json for the current account
  const currentAccount = getCurrentAccount();
  if (currentAccount) {
    if (tokens.longLivedToken) {
      updateAccountTokens(currentAccount.id, {
        longLivedToken: tokens.longLivedToken,
        longLivedTokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days from now
      });
    }
    
    if (tokens.pageToken && tokens.pageId) {
      // Find if the page already exists
      const existingPageIndex = currentAccount.pages.findIndex(p => p.id === tokens.pageId);
      
      if (existingPageIndex !== -1) {
        // Update existing page
        updateAccountPage(currentAccount.id, {
          id: tokens.pageId!,
          name: currentAccount.pages[existingPageIndex].name,
          access_token: tokens.pageToken!
        });
      }
    }
  }
} 