import { NextResponse } from 'next/server';
import { getAccountsData, getCurrentAccount, setCurrentAccount } from '@/app/lib/accountsHandler';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const setCurrentId = searchParams.get('setCurrentId');
    
    // Get all accounts data
    const accountsData = getAccountsData();
    const currentAccount = getCurrentAccount();
    
    // Set current account if requested
    if (setCurrentId) {
      const success = setCurrentAccount(setCurrentId);
      if (!success) {
        return NextResponse.json({ 
          error: 'Account not found with the provided ID' 
        }, { status: 404 });
      }
    }
    
    // Map accounts to a simpler structure for the frontend
    const accounts = accountsData.accounts.map(account => ({
      id: account.id,
      name: account.name,
      pagesCount: account.pages.length,
      isCurrent: account.id === accountsData.currentAccountId
    }));
    
    return NextResponse.json({
      success: true,
      accounts,
      currentAccountId: accountsData.currentAccountId
    });
  } catch (error: any) {
    console.error('Error fetching accounts:', error.message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
} 