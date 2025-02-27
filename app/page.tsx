'use client';

import { useState, useEffect } from 'react';

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

interface LeadForm {
  id: string;
  name: string;
  status: string;
}

interface Lead {
  id: string;
  created_time: string;
  field_data: Array<{
    name: string;
    values: string[];
  }>;
}

type TimeFilter = 'today' | 'yesterday' | 'all' | 'custom';

interface DownloadRequestBody {
  formId: string;
  timeFilter: TimeFilter;
  format?: 'excel' | 'csv';
  startDate?: string;
  endDate?: string;
  preFilteredLeads?: Lead[];
  accessToken?: string;
}

interface Account {
  id: string;
  name: string;
  pagesCount: number;
  isCurrent: boolean;
}

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<FacebookPage | null>(null);
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [selectedForm, setSelectedForm] = useState<LeadForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadStatus, setDownloadStatus] = useState('');
  const [downloadFormat, setDownloadFormat] = useState<'excel' | 'csv'>('excel');
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [leadsPerPage] = useState(10);
  const [displayedLeads, setDisplayedLeads] = useState<Lead[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fetch accounts when component mounts
  useEffect(() => {
    fetchAccounts();
  }, []);

  // Fetch pages when an account is selected
  useEffect(() => {
    if (selectedAccountId) {
      fetchPages();
    }
  }, [selectedAccountId]);

  // Fetch forms when a page is selected
  useEffect(() => {
    if (selectedPage) {
      fetchForms();
    }
  }, [selectedPage]);

  // Fetch leads when a form is selected or when time filter changes
  useEffect(() => {
    if (selectedForm) {
      fetchAllLeads();
    }
  }, [selectedForm, timeFilter]);
  
  // For custom date range, only fetch when dates are selected and user clicks a button
  useEffect(() => {
    if (timeFilter !== 'custom' && selectedForm) {
      fetchAllLeads();
    }
  }, [timeFilter]);

  // Add new useEffect for pagination with better logging
  useEffect(() => {
    if (allLeads.length > 0) {
      const startIndex = (currentPage - 1) * leadsPerPage;
      const endIndex = startIndex + leadsPerPage;
      const newDisplayedLeads = allLeads.slice(startIndex, endIndex);
      setDisplayedLeads(newDisplayedLeads);
      console.log(`Displaying leads ${startIndex + 1} to ${Math.min(endIndex, allLeads.length)} of ${allLeads.length}`, {
        pageSize: leadsPerPage,
        currentPage,
        totalPages: Math.ceil(allLeads.length / leadsPerPage),
        displayedLeadsCount: newDisplayedLeads.length
      });
    } else {
      setDisplayedLeads([]);
    }
  }, [currentPage, allLeads, leadsPerPage]);

  const fetchAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/get-accounts');
      const data = await res.json();
      
      if (!data.success) {
        throw new Error('Failed to fetch accounts');
      }

      setAccounts(data.accounts);
      
      // If accounts exist and current account is set, select it
      if (data.accounts.length > 0) {
        const currentAccount = data.accounts.find((acc: Account) => acc.isCurrent);
        if (currentAccount) {
          setSelectedAccountId(currentAccount.id);
        } else {
          setSelectedAccountId(data.accounts[0].id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchPages = async () => {
    if (!selectedAccountId) return;

    setLoading(true);
    setError('');
    setSelectedPage(null);
    setForms([]);
    setSelectedForm(null);
    
    try {
      // First set the current account
      await fetch(`/api/get-accounts?setCurrentId=${selectedAccountId}`);

      // Then get the pages directly (the API will use the account's token from accounts.json)
      const pagesRes = await fetch(`/api/get-pages?accountId=${selectedAccountId}`);
      const pagesData = await pagesRes.json();
      
      if (!pagesData.success) {
        throw new Error('Failed to fetch pages');
      }

      setPages(pagesData.pages);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pages');
    } finally {
      setLoading(false);
    }
  };

  const fetchForms = async () => {
    if (!selectedPage) return;

    setLoading(true);
    setError('');
    setSelectedForm(null);
    
    try {
      // Always use the access token directly from the selected page
      console.log('Using page access token directly for form fetching');
      
      const response = await fetch('/api/fetch-lead-forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageId: selectedPage.id,
          accessToken: selectedPage.access_token
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch forms';
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch forms');
      }
      
      setForms(data.forms);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch forms');
      
      // If this is the Anamika page and we got an error, suggest using manual token
      if (selectedPage.name === 'आयुर्वेदिक नुस्खे Anamika') {
        setError(`${err.message || 'Failed to fetch forms'}. Try using a manual access token.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccountSelect = (accountId: string) => {
    if (accountId !== selectedAccountId) {
      setSelectedAccountId(accountId);
      setSelectedPage(null);
      setForms([]);
      setSelectedForm(null);
      setAllLeads([]);
      setDisplayedLeads([]);
    }
  };

  const handlePageSelect = (page: FacebookPage) => {
    setSelectedPage(page);
    setForms([]); // Clear forms when selecting a new page
    setSelectedForm(null); // Clear selected form
    setAllLeads([]); // Clear leads
    setDisplayedLeads([]);
  };

  const handleFormSelect = (form: LeadForm) => {
    setSelectedForm(form);
    setAllLeads([]); // Clear previous leads
  };

  const fetchAllLeads = async () => {
    if (!selectedForm || !selectedPage) return;
    
    setIsLoadingLeads(true);
    setError('');
    setDownloadStatus('Loading leads...');
    
    // Get date range based on time filter
    let dateParams = {};
    if (timeFilter === 'custom') {
      if (startDate) dateParams = { ...dateParams, startDate };
      if (endDate) dateParams = { ...dateParams, endDate };
    }

    try {
      console.log('Fetching leads with params:', { 
        formId: selectedForm.id, 
        timeFilter,
        ...dateParams
      });
      
      // Show user a better loading message
      const loadingMessages = [
        'Connecting to Facebook...',
        'Fetching leads...',
        'Processing data...',
        'Almost there...',
        'This may take a moment for large datasets...'
      ];
      
      let msgIndex = 0;
      const loadingInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % loadingMessages.length;
        setDownloadStatus(loadingMessages[msgIndex]);
      }, 3000);
      
      // Always use the access token directly from the selected page
      const accessToken = selectedPage.access_token;
      
      // Prepare request body with access token
      const requestBody = {
        formId: String(selectedForm.id),
        timeFilter: String(timeFilter),
        maxLeads: "300", // Limit to 300 leads for better performance
        ...dateParams,
        accessToken: accessToken // Explicitly include the access token
      };
      
      console.log('Sending request with token length:', accessToken ? accessToken.length : 0);
      
      const response = await fetch('/api/download-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      clearInterval(loadingInterval);
      
      if (!response.ok) {
        let errorMessage = 'Failed to fetch leads';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (e) {
          // If JSON parsing fails, try to get text
          errorMessage = await response.text() || `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        setDownloadStatus('No leads found for the selected time period.');
        setAllLeads([]);
        return;
      }
      
      // Sort leads by creation time (newest first)
      const sortedLeads = [...data].sort((a, b) => {
        return new Date(b.created_time).getTime() - new Date(a.created_time).getTime();
      });
      
      setAllLeads(sortedLeads);
      setCurrentPage(1); // Reset to first page
      setDownloadStatus(`${sortedLeads.length} leads loaded successfully. Ready to download.`);
      console.log(`Loaded ${sortedLeads.length} leads successfully`);
    } catch (error: any) {
      console.error('Error fetching leads:', error.message);
      setError(`Error fetching leads: ${error.message}`);
      setDownloadStatus('Error loading leads');
    } finally {
      setIsLoadingLeads(false);
    }
  };

  const handleDownloadLeads = async () => {
    if (!selectedForm || !allLeads.length) return;

    setLoading(true);
    setDownloadStatus(`Preparing leads for download...`);
    setError(''); // Clear any previous errors
    
    try {
      // Use the already loaded leads data from allLeads state
      const requestBody: DownloadRequestBody = {
        formId: String(selectedForm.id), // Ensure formId is a string
        timeFilter,
        format: downloadFormat,
        ...(timeFilter === 'custom' && {
          startDate: startDate || undefined,
          endDate: endDate || undefined
        }),
        preFilteredLeads: allLeads, // Use leads already loaded in state
        accessToken: selectedPage?.access_token // Include the access token
      };

      console.log('Download request:', {
        formId: requestBody.formId,
        timeFilter: requestBody.timeFilter,
        format: requestBody.format,
        hasStartDate: !!requestBody.startDate,
        hasEndDate: !!requestBody.endDate,
        leadsCount: allLeads.length,
        hasAccessToken: !!requestBody.accessToken
      });

      const response = await fetch('/api/download-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || `Failed to download leads: ${response.status}`);
        } catch {
          throw new Error(`Failed to download leads: ${errorText || response.statusText}`);
        }
      }

      const contentType = response.headers.get('content-type');
      console.log('Response content type:', contentType);

      if (contentType?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') || 
          contentType?.includes('application/octet-stream')) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads_${selectedForm.name}_${timeFilter}_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setDownloadStatus('Download complete!');
      } else {
        // Try to parse as JSON to get error message
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Unexpected response format');
        } catch (e) {
          throw new Error('Failed to download: Unexpected response format');
        }
      }
    } catch (err: any) {
      console.error('Error in handleDownloadLeads:', {
        message: err.message,
        stack: err.stack
      });
      setError(err.message || 'Failed to download leads');
      setDownloadStatus('Download failed');
    } finally {
      setLoading(false);
    }
  };

  // New function specifically for yesterday's leads
  const handleDownloadYesterdayLeads = async () => {
    if (!selectedForm || !selectedPage) return;

    // Save the current timeFilter
    const previousTimeFilter = timeFilter;
    
    try {
      setLoading(true);
      setDownloadStatus(`Preparing yesterday's leads for download...`);
      setError(''); // Clear any previous errors
      
      // If we don't have leads loaded yet, fetch them first with 'all' timeFilter
      if (allLeads.length === 0) {
        setTimeFilter('all');
        await fetchAllLeads();
        
        if (allLeads.length === 0) {
          throw new Error('No leads available. Please try loading leads first.');
        }
      }
      
      // Get yesterday's date in IST timezone
      const now = new Date();
      const istOptions = { timeZone: 'Asia/Kolkata' };
      const istNowString = now.toLocaleString('en-US', istOptions);
      const istNow = new Date(istNowString);
      
      // Yesterday in IST
      const yesterday = new Date(istNow);
      yesterday.setDate(istNow.getDate() - 1);
      
      // Format yesterday's date for comparison and display
      const yesterdayFormatted = yesterday.toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      console.log(`Filtering leads for yesterday: ${yesterdayFormatted}`);
      
      // Filter the already loaded leads to get only those from yesterday
      const yesterdayLeads = allLeads.filter((lead: Lead) => {
        // Use consistent timezone handling with toLocaleString
        const leadDateInIST = new Date(lead.created_time).toLocaleString('en-US', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        
        // Debug log to see what dates we're processing
        console.log(`Lead date IST: ${leadDateInIST} from original ${lead.created_time}`);
        
        // Check if it matches yesterday's date
        return leadDateInIST === yesterdayFormatted;
      });
      
      console.log(`Filtered ${allLeads.length} leads down to ${yesterdayLeads.length} leads from yesterday (${yesterdayFormatted})`);
      
      if (yesterdayLeads.length === 0) {
        setError(`No leads found for yesterday (${yesterdayFormatted})`);
        setDownloadStatus('No leads to download');
        return;
      }
      
      // Now get the Excel file with filtered leads
      const requestBodyForExcel = {
        formId: String(selectedForm.id),
        timeFilter: 'yesterday',
        format: downloadFormat,
        preFilteredLeads: yesterdayLeads, // Add the filtered leads to the request
        accessToken: selectedPage.access_token // Include the access token
      };
      
      const response = await fetch('/api/download-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        },
        body: JSON.stringify(requestBodyForExcel),
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || `Failed to download leads: ${response.status}`);
        } catch {
          throw new Error(`Failed to download leads: ${errorText || response.statusText}`);
        }
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') || 
          contentType?.includes('application/octet-stream')) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Format yesterday's date for the filename
        const yesterdayForFilename = yesterday.toLocaleString('en-US', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).replace(/\//g, '-');
        
        a.download = `leads_${selectedForm.name}_${yesterdayForFilename}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setDownloadStatus(`${yesterdayLeads.length} leads from yesterday (${yesterdayFormatted}) downloaded successfully!`);
      } else {
        // Try to parse as JSON to get error message
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Unexpected response format');
        } catch (e) {
          throw new Error('Failed to download: Unexpected response format');
        }
      }
    } catch (err: any) {
      console.error('Error in handleDownloadYesterdayLeads:', {
        message: err.message,
        stack: err.stack
      });
      setError(err.message || 'Failed to download yesterday\'s leads');
      setDownloadStatus('Download failed');
    } finally {
      // Restore the previous timeFilter
      setTimeFilter(previousTimeFilter);
      setLoading(false);
    }
  };

  // Add function to format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    
    // Format in mm/dd/yyyy, hh:mm AM/PM using IST timezone directly
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  };

  // Add pagination controls component
  const PaginationControls = () => {
    const totalPages = Math.ceil(allLeads.length / leadsPerPage);
    
    return (
      <div className="flex items-center justify-between mt-6 bg-white p-4 border border-gray-200 rounded-lg shadow-sm">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{displayedLeads.length}</span> of <span className="font-medium">{allLeads.length}</span> leads
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="btn-modern flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
          <span className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-md border border-gray-200">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="btn-modern flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  const renderLeadList = () => {
    if (selectedForm && displayedLeads.length > 0) {
      return (
        <div className="mb-6 overflow-hidden">
          <div className="modern-table">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  {displayedLeads[0]?.field_data.map((field, i) => (
                    <th 
                      key={i} 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
                    >
                      {field.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayedLeads.map((lead, index) => (
                  <tr key={lead.id || index} className="hover:bg-gray-50 transition-colors duration-150">
                    {lead.field_data.map((field, i) => (
                      <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {field.values.join(', ')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center mt-6 bg-white p-4 border border-gray-200 rounded-lg shadow-sm">
            <div className="mb-4 sm:mb-0">
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{((currentPage - 1) * leadsPerPage) + 1}</span> to{' '}
                <span className="font-medium">{Math.min(currentPage * leadsPerPage, allLeads.length)}</span> of{' '}
                <span className="font-medium">{allLeads.length}</span> leads
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="btn-modern flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(allLeads.length / leadsPerPage)))}
                disabled={currentPage * leadsPerPage >= allLeads.length}
                className="btn-modern flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
        <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-gray-600 font-medium">
          {allLeads.length === 0 ? "No leads available" : "Select a form to view leads"}
        </p>
        <p className="text-gray-500 mt-2 text-sm">
          {allLeads.length === 0 ? "Try changing the time filter or selecting a different form" : ""}
        </p>
      </div>
    );
  };

  return (
    <main className="flex flex-col min-h-screen">
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-indigo-900 mb-2 pb-0 border-0">Facebook Lead Forms Manager</h1>
            <p className="text-gray-600 max-w-2xl">Efficiently manage and download your Facebook lead form data</p>
          </div>
          <div className="mt-4 md:mt-0">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 8 8">
                  <circle cx="4" cy="4" r="3" />
                </svg>
                Connected
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          {/* Account Selection */}
          <div className="card hover-card glass-card">
            <h2 className="section-title">
              <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Select Account
            </h2>
            <div className="relative">
              <select
                className="form-select"
                value={selectedAccountId}
                onChange={(e) => handleAccountSelect(e.target.value)}
                disabled={loading}
              >
                <option value="">Select an account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.pagesCount} pages)
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Page Selection */}
          <div className="card hover-card glass-card">
            <h2 className="section-title">
              <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Select Page
            </h2>
            <div className="relative">
              <select
                className="form-select"
                value={selectedPage?.id || ''}
                onChange={(e) => {
                  const page = pages.find(p => p.id === e.target.value);
                  if (page) handlePageSelect(page);
                }}
                disabled={loading || !selectedAccountId || pages.length === 0}
              >
                <option value="">Select a page</option>
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Form Selection */}
          <div className="card hover-card glass-card">
            <h2 className="section-title">
              <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Select Form
            </h2>
            <div className="space-y-4">
              <div className="relative">
                <select
                  className="form-select"
                  value={selectedForm?.id || ''}
                  onChange={(e) => {
                    const form = forms.find(f => f.id === e.target.value);
                    if (form) handleFormSelect(form);
                  }}
                  disabled={loading || !selectedPage || forms.length === 0}
                >
                  <option value="">Select a form</option>
                  {forms.map((form) => (
                    <option key={form.id} value={form.id}>
                      {form.name} ({form.status})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={fetchForms}
                  className="btn-modern btn-modern-primary w-3/4 flex items-center justify-center"
                  disabled={loading || !selectedPage}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Forms
                </button>
              </div>
            </div>
          </div>

          {/* Time Filter Options */}
          <div className="card hover-card glass-card">
            <h2 className="section-title">
              <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Select Time Filter
            </h2>
            <div className="flex flex-col gap-4">
              <div className="relative">
                <select
                  className="form-select"
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="all">All</option>
                  <option value="custom">Custom</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
              </div>
              
              {timeFilter === 'custom' && (
                <div className="grid grid-cols-1 gap-4 mt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                      />
                    </div>
                  </div>
                  <div className="flex justify-center mt-2">
                    <button
                      onClick={fetchAllLeads}
                      disabled={!startDate || !endDate || loading}
                      className="btn-modern btn-modern-primary w-3/4 flex items-center justify-center"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Apply Date Filter
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="card hover-card glass-card">
            <h2 className="section-title">
              <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Actions
            </h2>
            <div className="flex flex-col gap-4">
              <button
                onClick={fetchAccounts}
                className="btn-modern bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white focus:ring-blue-500 flex items-center justify-center"
                disabled={loading}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Accounts
              </button>
              
              <button
                onClick={fetchPages}
                className="btn-modern bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white focus:ring-purple-500 flex items-center justify-center"
                disabled={loading || !selectedAccountId}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Pages
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Download Options */}
          <div className="card hover-card glass-card">
            <h2 className="section-title">
              <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Options
            </h2>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700">Format:</label>
                  <div className="relative">
                    <select
                      value={downloadFormat}
                      onChange={(e) => setDownloadFormat(e.target.value as 'excel' | 'csv')}
                      className="appearance-none block w-36 px-3 py-2.5 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value="excel">Excel (.xlsx)</option>
                      <option value="csv">CSV</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Lead Count Display */}
                {allLeads.length > 0 && (
                  <div className="text-sm bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-md flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Total leads available: <span className="font-bold ml-1">{allLeads.length}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={handleDownloadLeads}
                  disabled={loading || !allLeads.length || (timeFilter === 'custom' && (!startDate || !endDate))}
                  className="btn-modern btn-modern-primary flex items-center justify-center py-3"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Leads
                </button>
                
                {/* Yesterday's Leads Download Button */}
                <button
                  onClick={handleDownloadYesterdayLeads}
                  disabled={loading}
                  className="btn-modern btn-modern-secondary flex items-center justify-center py-3"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Download Yesterday's Leads
                </button>
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {downloadStatus && (
            <div className="bg-indigo-50 border-l-4 border-indigo-500 text-indigo-700 p-4 rounded-lg shadow-sm">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium">Status</p>
              </div>
              <p className="mt-1 ml-7">{downloadStatus}</p>
            </div>
          )}

          {/* Lead Preview */}
          {selectedForm && (
            <div className="card hover-card glass-card">
              <h2 className="section-title">
                <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Lead Preview
              </h2>
              {isLoadingLeads ? (
                <div className="flex flex-col items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-700"></div>
                  <p className="mt-4 text-indigo-700 font-medium">Loading leads...</p>
                </div>
              ) : (
                renderLeadList()
              )}
            </div>
          )}
        </div>
      </div>
      
      {loading && (
        <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-50 z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-lg shadow-xl flex items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-700 mr-4"></div>
            <p className="text-lg font-medium">Loading...</p>
          </div>
        </div>
      )}
      
      <footer className="mt-auto py-8 text-center text-gray-600 border-t border-gray-200 bg-gray-50 rounded-lg mt-8">
        <div className="max-w-6xl mx-auto px-4">
          <p className="font-medium text-gray-700">Facebook Lead Forms Manager &copy; {new Date().getFullYear()}</p>
          <p className="text-sm mt-2 text-gray-500">Efficiently manage and download your Facebook leads</p>
        </div>
      </footer>
    </main>
  );
}
