import fs from 'fs';
import path from 'path';

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

export interface Account {
  id: string;
  name: string;
  appId: string;
  appSecret: string;
  shortLivedToken: string;
  longLivedToken: string;
  longLivedTokenExpiry: string;
  pages: FacebookPage[];
}

export interface AccountsData {
  accounts: Account[];
  currentAccountId: string;
  lastUpdated: string;
}

// In-memory storage for Vercel environment
let inMemoryAccountsData: AccountsData | null = null;

const accountsFilePath = path.join(process.cwd(), 'accounts.json');

// Check if we're in a Vercel serverless environment
const isVercelServerless = process.env.VERCEL === '1';

// Read accounts from JSON file or environment variables
export function getAccountsData(): AccountsData {
  // If we're in Vercel and have in-memory data, use that
  if (isVercelServerless && inMemoryAccountsData) {
    return inMemoryAccountsData;
  }
  
  try {
    // Try to read from file first
    if (fs.existsSync(accountsFilePath)) {
      const fileData = fs.readFileSync(accountsFilePath, 'utf8');
      const data = JSON.parse(fileData) as AccountsData;
      
      // Cache in memory if in Vercel environment
      if (isVercelServerless) {
        inMemoryAccountsData = data;
      }
      
      return data;
    }
    
    // If file doesn't exist, try to use environment variables
    const envAccountId = process.env.FACEBOOK_ACCOUNT_ID;
    const envAppId = process.env.FACEBOOK_APP_ID;
    const envAppSecret = process.env.FACEBOOK_APP_SECRET;
    const envToken = process.env.FACEBOOK_LONG_LIVED_TOKEN;
    const envPageId = process.env.FACEBOOK_PAGE_ID;
    const envPageName = process.env.FACEBOOK_PAGE_NAME;
    const envPageToken = process.env.FACEBOOK_PAGE_TOKEN;
    
    if (envAccountId && envAppId && envAppSecret && envToken && envPageId && envPageName && envPageToken) {
      const envData: AccountsData = {
        accounts: [
          {
            id: envAccountId,
            name: envAccountId,
            appId: envAppId,
            appSecret: envAppSecret,
            shortLivedToken: envToken,
            longLivedToken: envToken,
            longLivedTokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days from now
            pages: [
              {
                id: envPageId,
                name: envPageName,
                access_token: envPageToken
              }
            ]
          }
        ],
        currentAccountId: envAccountId,
        lastUpdated: new Date().toISOString()
      };
      
      // Cache in memory if in Vercel environment
      if (isVercelServerless) {
        inMemoryAccountsData = envData;
      }
      
      return envData;
    }
  } catch (error) {
    console.error('Error reading accounts data:', error);
  }
  
  // Return default structure if all methods fail
  const defaultData = {
    accounts: [],
    currentAccountId: '',
    lastUpdated: ''
  };
  
  // Cache in memory if in Vercel environment
  if (isVercelServerless) {
    inMemoryAccountsData = defaultData;
  }
  
  return defaultData;
}

// Save accounts to JSON file or memory
export function saveAccountsData(data: AccountsData): void {
  // Update in-memory data if in Vercel environment
  if (isVercelServerless) {
    inMemoryAccountsData = data;
  }
  
  try {
    // Only write to file if not in Vercel environment
    if (!isVercelServerless) {
      fs.writeFileSync(accountsFilePath, JSON.stringify(data, null, 2), 'utf8');
    }
  } catch (error) {
    console.error('Error saving accounts data:', error);
  }
}

// Get current account
export function getCurrentAccount(): Account | null {
  const data = getAccountsData();
  if (!data.currentAccountId && data.accounts.length > 0) {
    // Set first account as current if none is set
    data.currentAccountId = data.accounts[0].id;
    saveAccountsData(data);
  }
  
  return data.accounts.find(account => account.id === data.currentAccountId) || null;
}

// Get account by ID
export function getAccountById(accountId: string): Account | null {
  const data = getAccountsData();
  return data.accounts.find(account => account.id === accountId) || null;
}

// Set current account
export function setCurrentAccount(accountId: string): boolean {
  const data = getAccountsData();
  const accountExists = data.accounts.some(account => account.id === accountId);
  
  if (accountExists) {
    data.currentAccountId = accountId;
    saveAccountsData(data);
    return true;
  }
  
  return false;
}

// Update account tokens
export function updateAccountTokens(
  accountId: string, 
  updates: Partial<Account>
): Account | null {
  const data = getAccountsData();
  const accountIndex = data.accounts.findIndex(account => account.id === accountId);
  
  if (accountIndex === -1) {
    return null;
  }
  
  // Update the account
  data.accounts[accountIndex] = {
    ...data.accounts[accountIndex],
    ...updates,
  };
  
  data.lastUpdated = new Date().toISOString();
  saveAccountsData(data);
  
  return data.accounts[accountIndex];
}

// Add or update page for an account
export function updateAccountPage(
  accountId: string,
  page: FacebookPage
): Account | null {
  const data = getAccountsData();
  const accountIndex = data.accounts.findIndex(account => account.id === accountId);
  
  if (accountIndex === -1) {
    return null;
  }
  
  const account = data.accounts[accountIndex];
  const pageIndex = account.pages.findIndex(p => p.id === page.id);
  
  if (pageIndex === -1) {
    // Add new page
    account.pages.push(page);
  } else {
    // Update existing page
    account.pages[pageIndex] = page;
  }
  
  data.lastUpdated = new Date().toISOString();
  saveAccountsData(data);
  
  return account;
} 