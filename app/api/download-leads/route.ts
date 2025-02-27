import { NextResponse } from 'next/server';
import axios from 'axios';
import ExcelJS from 'exceljs';
import { getTokens } from '@/app/lib/tokenStore';

interface LeadField {
  name: string;
  values: string[];
}

interface Lead {
  id: string;
  created_time: string;
  field_data: LeadField[];
}

type TimeFilter = 'today' | 'yesterday' | 'all' | 'custom';

interface RequestBody {
  formId: string;
  timeFilter: TimeFilter;
  startDate?: string;
  endDate?: string;
  format?: 'excel' | 'csv';
  maxLeads?: string;
  preFilteredLeads?: Lead[];
  accessToken?: string;
}

interface FacebookAPIResponse {
  data: Lead[];
  paging?: {
    next?: string;
    previous?: string;
  };
}

interface AxiosResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: any;
}

function getDateRange(timeFilter: TimeFilter, startDate?: string, endDate?: string): { startDate: Date, endDate: Date } | null {
  const now = new Date();
  
  // Set time to end of day for today (local time)
  const endOfToday = new Date(now);
  
  switch (timeFilter) {
    case 'today': {
      // Start of today (local time)
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      
      console.log('Date range for TODAY:', {
        start: startOfToday.toISOString(),
        end: now.toISOString(),
        formattedStart: formatDateForFacebook(startOfToday),
        formattedEnd: formatDateForFacebook(now)
      });
      
      return {
        startDate: startOfToday,
        endDate: now  // Use current time instead of end of day
      };
    }
    case 'yesterday': {
      // Get yesterday's date in IST timezone
      const now = new Date();
      
      // Create start/end of yesterday in IST
      const istOptions = { timeZone: 'Asia/Kolkata' };
      const istNowString = now.toLocaleString('en-US', istOptions);
      const istNow = new Date(istNowString);
      
      // Start of yesterday (IST)
      const startOfYesterday = new Date(istNow);
      startOfYesterday.setDate(istNow.getDate() - 1);
      startOfYesterday.setHours(0, 0, 0, 0);
      
      // End of yesterday (IST)
      const endOfYesterday = new Date(istNow);
      endOfYesterday.setDate(istNow.getDate() - 1);
      endOfYesterday.setHours(23, 59, 59, 999);
      
      console.log('Date range for YESTERDAY (IST):', {
        start: startOfYesterday.toISOString(),
        end: endOfYesterday.toISOString(),
        formattedStart: formatDateForFacebook(startOfYesterday),
        formattedEnd: formatDateForFacebook(endOfYesterday)
      });
      
      return {
        startDate: startOfYesterday,
        endDate: endOfYesterday
      };
    }
    case 'all':
      // For 'all', we don't apply date filters
      console.log('No date range for ALL');
      return null;
    case 'custom':
      if (startDate && endDate) {
        try {
          const startDateTime = new Date(startDate);
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);
          
          console.log('Date range for CUSTOM:', {
            start: startDateTime.toISOString(),
            end: endDateTime.toISOString(),
            formattedStart: formatDateForFacebook(startDateTime),
            formattedEnd: formatDateForFacebook(endDateTime),
            providedStart: startDate,
            providedEnd: endDate
          });
          
          return {
            startDate: startDateTime,
            endDate: endDateTime
          };
        } catch (err) {
          console.error('Error parsing custom dates:', { startDate, endDate, error: err });
          return null;
        }
      }
      return null;
    default:
      return null;
  }
}

async function fetchAllLeads(formId: string, pageToken: string, timeFilter: TimeFilter, startDate?: string, endDate?: string, maxLeads: number = 1000): Promise<FacebookAPIResponse> {
  // Create a params object to store all the parameters
  const params: Record<string, string> = {
    access_token: pageToken,
    fields: 'id,created_time,field_data',
    limit: '100' // Ensure limit is a string
  };

  // Add date filter based on timeFilter
  const dateRange = getDateRange(timeFilter, startDate, endDate);
  if (dateRange) {
    // Use string format for date parameters - YYYY-MM-DD only
    if (timeFilter === 'today') {
      // For today, just use the since parameter with today's date
      params['since'] = formatDateForFacebook(dateRange.startDate);
    } else if (timeFilter === 'yesterday') {
      // For yesterday, specify both since and until
      params['since'] = formatDateForFacebook(dateRange.startDate);
      params['until'] = formatDateForFacebook(dateRange.endDate); 
    } else if (timeFilter === 'custom') {
      // For custom, specify both since and until
      params['since'] = formatDateForFacebook(dateRange.startDate);
      params['until'] = formatDateForFacebook(dateRange.endDate);
    }
    
    console.log('Using date filters:', {
      timeFilter,
      params: {
        ...params,
        access_token: params.access_token ? `${params.access_token.substring(0, 10)}...` : 'none'
      },
      originalRange: {
        start: dateRange.startDate.toISOString(),
        end: dateRange.endDate.toISOString()
      }
    });
  }

  // Validate token
  if (!pageToken || pageToken.length < 20) {
    throw new Error('Invalid or missing access token');
  }

  const url = `https://graph.facebook.com/v19.0/${formId}/leads`;
  
  // Log the URL and parameters for debugging
  console.log('Fetching leads page:', {
    url,
    hasDateFilter: !!dateRange,
    params: {
      ...params,
      access_token: '[TOKEN_HIDDEN]'
    },
    maxLeads,
    tokenLength: pageToken.length
  });

  // Array to store all leads
  let allLeads: Lead[] = [];
  let nextUrl: string | null = null;
  let pageCount = 0;

  try {
    // First request
    const response: AxiosResponse<FacebookAPIResponse> = await axios.get(url, { params });
    allLeads = [...allLeads, ...(response.data.data || [])];
    pageCount++;
    
    // Check if there are more leads (pagination)
    nextUrl = response.data.paging?.next || null;
    
    // Continue fetching if there are more pages and we haven't hit our limit
    while (nextUrl && allLeads.length < maxLeads) {
      console.log(`Fetching next page of leads (${pageCount+1}): ${nextUrl.substring(0, 50)}...`);
      const nextResponse: AxiosResponse<FacebookAPIResponse> = await axios.get(nextUrl);
      const newLeads = nextResponse.data.data || [];
      allLeads = [...allLeads, ...newLeads];
      
      if (allLeads.length >= maxLeads) {
        console.log(`Reached maximum lead limit of ${maxLeads}. Stopping pagination.`);
        break;
      }
      
      nextUrl = nextResponse.data.paging?.next || null;
      pageCount++;
      
      // Add a small delay to avoid hitting rate limits
      if (pageCount % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Total leads fetched: ${allLeads.length} (${pageCount} pages)`);
    
    // Truncate if over the limit
    if (allLeads.length > maxLeads) {
      console.log(`Truncating leads to ${maxLeads} records`);
      allLeads = allLeads.slice(0, maxLeads);
    }
    
    return {
      data: allLeads,
      paging: nextUrl ? { next: nextUrl } : undefined // Keep next page URL if there are more results
    };
  } catch (error: any) {
    console.error('Error fetching leads:', {
      message: error.message,
      response: error.response?.data,
      url,
      params: {
        ...params,
        access_token: '[TOKEN_HIDDEN]'
      }
    });
    throw error;
  }
}

// Helper function to format date for Facebook API
function formatDateForFacebook(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function generateExcelFile(leads: Lead[]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Leads');

  // Sort leads by creation time (newest first)
  const sortedLeads = [...leads].sort((a, b) => 
    new Date(b.created_time).getTime() - new Date(a.created_time).getTime()
  );

  // Get all unique field names from all leads
  const allFieldNames = new Set<string>();
  sortedLeads.forEach(lead => {
    lead.field_data.forEach(field => {
      allFieldNames.add(field.name);
    });
  });

  // Define columns with dynamic field columns
  const columns: any[] = [
    { header: 'ID', key: 'id', width: 20 },
    { header: 'Created Time', key: 'created_time', width: 20 },
  ];
  
  // Add all field columns dynamically
  Array.from(allFieldNames).sort().forEach(fieldName => {
    // Convert field name to snake_case for the column key
    const key = fieldName.toLowerCase().replace(/\s+/g, '_');
    columns.push({ 
      header: fieldName, 
      key, 
      width: 20 
    });
  });
  
  worksheet.columns = columns;

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Add data
  sortedLeads.forEach(lead => {
    const rowData: any = {
      id: lead.id,
      created_time: formatDateForDisplay(lead.created_time)
    };

    // Extract all field values
    lead.field_data.forEach(field => {
      const value = field.values[0] || '';
      // Use the same key conversion as the column definition
      const key = field.name.toLowerCase().replace(/\s+/g, '_');
      rowData[key] = value;
    });

    worksheet.addRow(rowData);
  });

  // Format specific columns as text to avoid Excel warnings
  // List of fields that should always be formatted as text
  const textFields = [
    'phone_number', 
    'post_code', 
    'zip_code', 
    'postal_code',
    'email',
    'street_address',
    'address',
    'id'
  ];
  
  // Find and format all text fields
  textFields.forEach(fieldName => {
    const columnIdx = columns.findIndex(col => col.key === fieldName);
    if (columnIdx !== -1) {
      const col = worksheet.getColumn(columnIdx + 1); // +1 because Excel columns are 1-indexed
      col.eachCell({ includeEmpty: false }, (cell) => {
        if (Number(cell.row) > 1) { // Skip header row
          const value = cell.value;
          cell.numFmt = '@'; // Format as text
          cell.value = value;
        }
      });
    }
  });

  // Auto-filter for all columns
  const lastColumn = String.fromCharCode(65 + columns.length - 1);
  worksheet.autoFilter = {
    from: 'A1',
    to: `${lastColumn}1`
  };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// Helper function to format dates in the mm/dd/yyyy, hh:mm AM/PM format
function formatDateForDisplay(dateString: string): string {
  // Parse the date from the string
  const date = new Date(dateString);
  
  // Format as mm/dd/yyyy, hh:mm AM/PM directly using the IST timezone
  // This avoids double conversion since we're setting the timezone directly
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata' // IST timezone
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    // Parse request body
    const body = await request.json();
    console.log('Received request body:', JSON.stringify({
      ...body,
      accessToken: body.accessToken ? `${body.accessToken.substring(0, 10)}...` : undefined
    }));
    
    // Get form ID and time filter from request body
    const { formId, timeFilter, startDate, endDate, format, maxLeads = 300, preFilteredLeads, accessToken } = body;
    
    // Log the request parameters
    console.log('Processing request:', {
      formId,
      timeFilter,
      hasStartDate: !!startDate,
      hasEndDate: !!endDate,
      format,
      maxLeads,
      hasPreFilteredLeads: !!preFilteredLeads,
      preFilteredLeadsCount: preFilteredLeads?.length,
      hasManualToken: !!accessToken,
      tokenLength: accessToken ? accessToken.length : 0
    });
    
    // Validate required fields
    if (!formId) {
      return new Response(JSON.stringify({ error: 'formId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!timeFilter) {
      return new Response(JSON.stringify({ error: 'timeFilter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate timeFilter value
    if (!['today', 'yesterday', 'all', 'custom'].includes(timeFilter)) {
      return new Response(JSON.stringify({ error: 'Invalid timeFilter value' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate date range for custom filter
    if (timeFilter === 'custom' && (!startDate || !endDate)) {
      return new Response(JSON.stringify({ error: 'startDate and endDate are required for custom timeFilter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Ensure maxLeads is a number and within reasonable limits (default to 300 instead of 1000)
    const leadLimit = Math.min(Math.max(parseInt(String(maxLeads), 10) || 300, 100), 5000);
    
    // Get tokens from token store or use provided access token
    let token = accessToken;
    if (!token) {
      const { pageToken } = await getTokens();
      token = pageToken;
    }
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'No access token available. Please provide a manual access token.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate token format
    if (token.length < 20) {
      return new Response(JSON.stringify({ error: 'Invalid access token format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if we have pre-filtered leads (for Feb 24 specific download)
    let leads = [];
    if (preFilteredLeads && preFilteredLeads.length > 0) {
      console.log(`Using ${preFilteredLeads.length} pre-filtered leads instead of fetching from Facebook API`);
      leads = preFilteredLeads;
    } else {
      console.log(`No pre-filtered leads provided, fetching from Facebook API with ${timeFilter} time filter (limit: ${leadLimit})`);
      try {
        // Fetch leads from Facebook using the appropriate token
        const leadsResponse = await fetchAllLeads(
          formId, 
          token, 
          timeFilter as TimeFilter, 
          startDate, 
          endDate,
          leadLimit
        );
        leads = leadsResponse.data;
      } catch (error: any) {
        console.error('Error fetching leads from Facebook:', error.message);
        return new Response(JSON.stringify({ 
          error: 'Failed to fetch leads from Facebook', 
          message: error.message,
          details: error.response?.data?.error?.message 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    console.log(`Processing ${leads.length} leads for ${format || 'json'} output`);
    
    // Check Accept header to determine response format
    const wantsExcel = request.headers.get('Accept')?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    if (wantsExcel || format === 'excel') {
      // Generate Excel file
      const excelBuffer = await generateExcelFile(leads);
      
      // Return Excel file with appropriate headers
      return new Response(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="leads_${new Date().toISOString()}.xlsx"`
        }
      });
    } else {
      // Return JSON response
      return new Response(JSON.stringify(leads), {
        headers: {
          'Content-Type': 'application/json',
        }
      });
    }
  } catch (error: any) {
    console.error('Error in download-leads:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch leads', 
      message: error.message,
      details: error.response?.data?.error?.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 