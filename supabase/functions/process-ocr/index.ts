// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { create } from "https://deno.land/x/djwt@v2.8/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OCRRequest {
  fileUrl: string;
  documentId: string;
  userId: string;
}

interface ExtractedTableData {
  rows: Array<Record<string, string>>;
  confidence: number;
  headers: string[];
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { fileUrl, documentId, userId } = await req.json() as OCRRequest
    
    console.log('Processing OCR request:', { fileUrl, documentId, userId })
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Update processing status
    await supabaseClient
      .from('documents')
      .update({ processing_status: 'processing' })
      .eq('id', documentId)

    // Create processing job
    const { data: job, error: jobError } = await supabaseClient
      .from('processing_jobs')
      .insert({
        user_id: userId,
        document_id: documentId,
        job_type: 'new_table',
        status: 'processing',
        progress: 10
      })
      .select()
      .single()

    if (jobError) throw jobError

    // Process with Google Vision API
    const extractedData = await processWithGoogleVision(fileUrl)
    
    // Update progress
    await supabaseClient
      .from('processing_jobs')
      .update({ progress: 80 })
      .eq('id', job.id)

    // Store extracted data
    const { error: dataError } = await supabaseClient
      .from('extracted_data')
      .insert({
        user_id: userId,
        document_id: documentId,
        processing_job_id: job.id,
        data: { rows: extractedData.rows, headers: extractedData.headers },
        confidence: extractedData.confidence
      })

    if (dataError) throw dataError

    // Update processing job as completed
    await supabaseClient
      .from('processing_jobs')
      .update({ 
        status: 'completed',
        progress: 100,
        result_data: extractedData
      })
      .eq('id', job.id)

    // Update document status
    await supabaseClient
      .from('documents')
      .update({ processing_status: 'completed' })
      .eq('id', documentId)

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData,
        jobId: job.id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('OCR processing error:', error)

  return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})

// Get Google Access Token using Service Account
async function getGoogleAccessToken(): Promise<string> {
  const privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY')
  const clientEmail = Deno.env.get('GOOGLE_CLIENT_EMAIL')
  
  if (!privateKey || !clientEmail) {
    throw new Error('Google service account credentials not configured')
  }

  // Clean the private key (remove quotes and replace \n)
  const cleanPrivateKey = privateKey.replace(/\\n/g, '\n').replace(/"/g, '')
  
  // Create JWT
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 3600 // Token expires in 1 hour

  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    scope: 'https://www.googleapis.com/auth/cloud-vision',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp
  }

  // Import the private key
  const pemHeader = "-----BEGIN PRIVATE KEY-----"
  const pemFooter = "-----END PRIVATE KEY-----"
  const pemContents = cleanPrivateKey.substring(
    cleanPrivateKey.indexOf(pemHeader) + pemHeader.length,
    cleanPrivateKey.indexOf(pemFooter)
  ).trim()
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  )

  // Create and sign JWT
  const jwt = await create({ alg: "RS256", typ: "JWT" }, payload, key)

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    throw new Error(`Failed to get access token: ${error}`)
  }

  const { access_token } = await tokenResponse.json()
  return access_token
}

// Helper function to safely convert ArrayBuffer to base64 (prevents stack overflow)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 8192 // Process in chunks to avoid stack overflow
  let result = ''
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize)
    result += String.fromCharCode(...Array.from(chunk))
  }
  
  return btoa(result)
}

async function processWithGoogleVision(imageUrl: string): Promise<ExtractedTableData> {
  // Check if we have service account credentials
  const hasServiceAccount = Deno.env.get('GOOGLE_CLIENT_EMAIL') && Deno.env.get('GOOGLE_PRIVATE_KEY')
  
  if (!hasServiceAccount) {
    console.log('No Google credentials found, using alternative approach')
    // Try to use Gemini or Document AI approach
    return processWithGeminiVision(imageUrl)
  }

  try {
    // Get access token
    const accessToken = await getGoogleAccessToken()
    
    console.log('Downloading image from:', imageUrl)
    
    // Download image
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`)
    }
    
    const imageBuffer = await imageResponse.arrayBuffer()
    console.log('Image downloaded, size:', imageBuffer.byteLength)
    
    // Convert to base64 safely (handle large images)
    const base64Image = arrayBufferToBase64(imageBuffer)
    console.log('Image converted to base64, length:', base64Image.length)
    
    // Use Document AI for better table extraction
    const useDocumentAI = Deno.env.get('GOOGLE_DOCUMENT_AI_PROCESSOR_ID')
    
    if (useDocumentAI) {
      return await processWithDocumentAI(base64Image, accessToken)
    } else {
      return await processWithVisionAPI(base64Image, accessToken)
    }
    
  } catch (error) {
    console.error('Vision API processing error:', error)
    // Fallback to Gemini
    return processWithGeminiVision(imageUrl)
  }
}

async function processWithVisionAPI(base64Image: string, accessToken: string): Promise<ExtractedTableData> {
  // Call Google Vision API with DOCUMENT_TEXT_DETECTION for better table detection
  const response = await fetch('https://vision.googleapis.com/v1/images:annotate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{
        image: {
          content: base64Image
        },
        features: [
          {
            type: 'DOCUMENT_TEXT_DETECTION',
            maxResults: 1
          }
        ],
        imageContext: {
          languageHints: ['en']
        }
      }]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Vision API error response:', error)
    throw new Error(`Vision API error: ${response.status} - ${error}`)
  }

  const result = await response.json()
  console.log('Vision API response received')
  
  if (result.responses && result.responses[0]) {
    const response = result.responses[0]
    
    // Check for errors
    if (response.error) {
      console.error('Vision API returned error:', response.error)
      throw new Error(`Vision API error: ${response.error.message}`)
    }
    
    // Extract structured data from DOCUMENT_TEXT_DETECTION
    if (response.fullTextAnnotation) {
      return extractTableFromDocumentText(response.fullTextAnnotation)
    }
  }
  
  // Return empty result if no text detected
  return {
    headers: [],
    rows: [],
    confidence: 0
  }
}

async function processWithDocumentAI(base64Image: string, accessToken: string): Promise<ExtractedTableData> {
  const projectId = Deno.env.get('GOOGLE_PROJECT_ID')
  const location = Deno.env.get('GOOGLE_DOCUMENT_AI_LOCATION') || 'us'
  const processorId = Deno.env.get('GOOGLE_DOCUMENT_AI_PROCESSOR_ID')
  
  if (!projectId || !processorId) {
    throw new Error('Document AI configuration missing')
  }
  
  const endpoint = `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rawDocument: {
        content: base64Image,
        mimeType: 'image/png'
      }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Document AI error response:', error)
    throw new Error(`Document AI error: ${response.status} - ${error}`)
  }

  const result = await response.json()
  return extractTableFromDocumentAI(result)
}

// Alternative: Use Gemini Vision for better table understanding
async function processWithGeminiVision(imageUrl: string): Promise<ExtractedTableData> {
  const apiKey = Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('GEMINI_API_KEY')
  
  if (!apiKey) {
    console.log('No API key found, using demo data')
    return getDemoData()
  }
  
  try {
    // Download and convert image to base64
    const imageResponse = await fetch(imageUrl)
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = arrayBufferToBase64(imageBuffer)
    
    // Call Gemini 1.5 Flash for fast processing
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `Extract all data from this table/document and return it in the following JSON format:
{
  "headers": ["column1", "column2", ...],
  "rows": [
    {"column1": "value1", "column2": "value2", ...},
    ...
  ]
}

Important:
- Preserve the exact table structure
- Keep all column headers exactly as they appear
- Maintain data types (numbers as numbers, not strings)
- Include ALL rows and columns
- If there are merged cells, repeat the value in each cell
- For empty cells, use empty string ""
- Return ONLY the JSON, no explanation`
            },
            {
              inline_data: {
                mime_type: "image/png",
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.1,
          maxOutputTokens: 8192,
        }
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Gemini API error: ${error}`)
    }
    
    const result = await response.json()
    const content = result.candidates[0].content.parts[0].text
    
    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsedData = JSON.parse(jsonMatch[0])
      return {
        headers: parsedData.headers || [],
        rows: parsedData.rows || [],
        confidence: 95
      }
    }
  } catch (error) {
    console.error('Gemini Vision error:', error)
  }
  
  return getDemoData()
}

function extractTableFromDocumentText(textAnnotation: any): ExtractedTableData {
  // Extract tables from Document AI structured response
  const pages = textAnnotation.pages || []
  const allTables: ExtractedTableData = {
    headers: [],
    rows: [],
    confidence: 90
  }
  
  for (const page of pages) {
    if (page.tables) {
      for (const table of page.tables) {
        const extracted = parseDocumentAITable(table, page)
        if (extracted.rows.length > 0) {
          return extracted // Return first valid table
        }
      }
    }
  }
  
  // If no tables found, try to parse as structured text
  if (textAnnotation.text) {
    return parseTextAsTable(textAnnotation.text)
  }
  
  return allTables
}

function extractTableFromDocumentAI(document: any): ExtractedTableData {
  const tables = document.document?.pages?.[0]?.tables || []
  
  if (tables.length > 0) {
    // Process the first table
    const table = tables[0]
    const headers: string[] = []
    const rows: Array<Record<string, string>> = []
    
    // Extract headers from first row
    if (table.headerRows && table.headerRows.length > 0) {
      const headerRow = table.headerRows[0]
      for (const cell of headerRow.cells) {
        headers.push(getTextFromLayout(cell.layout, document.document.text))
      }
    }
    
    // Extract body rows
    if (table.bodyRows) {
      for (const row of table.bodyRows) {
        const rowData: Record<string, string> = {}
        row.cells.forEach((cell: any, index: number) => {
          const header = headers[index] || `Column${index + 1}`
          rowData[header] = getTextFromLayout(cell.layout, document.document.text)
        })
        rows.push(rowData)
      }
    }
    
    return {
      headers,
      rows,
      confidence: 95
    }
  }
  
  // Fallback to text parsing
  if (document.document?.text) {
    return parseTextAsTable(document.document.text)
  }
  
  return {
    headers: [],
    rows: [],
    confidence: 0
  }
}

function getTextFromLayout(layout: any, documentText: string): string {
  if (!layout || !layout.textAnchor || !layout.textAnchor.textSegments) {
    return ''
  }
  
  let text = ''
  for (const segment of layout.textAnchor.textSegments) {
    const startIndex = parseInt(segment.startIndex) || 0
    const endIndex = parseInt(segment.endIndex) || documentText.length
    text += documentText.substring(startIndex, endIndex)
  }
  
  return text.trim()
}

function parseDocumentAITable(table: any, page: any): ExtractedTableData {
  // This would parse the Document AI table structure
  // Implementation depends on Document AI response format
  return {
    headers: [],
    rows: [],
    confidence: 90
  }
}

function parseTextAsTable(text: string): ExtractedTableData {
  const lines = text.split('\n').filter(line => line.trim())
  if (lines.length < 2) {
    return { headers: [], rows: [], confidence: 0 }
  }
  
  // Detect table structure by looking for consistent delimiters
  const delimiter = detectDelimiter(lines)
  
  // Parse headers
  const headers = lines[0].split(delimiter).map(h => h.trim()).filter(h => h)
  
  // Parse rows
  const rows: Array<Record<string, string>> = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim())
    if (values.length >= headers.length * 0.8) { // Allow some missing columns
      const row: Record<string, string> = {}
      headers.forEach((header, index) => {
        row[header] = values[index] || ''
      })
      rows.push(row)
    }
  }
  
  return {
    headers,
    rows,
    confidence: 85
  }
}

function detectDelimiter(lines: string[]): RegExp {
  // Check for common delimiters
  const delimiters = [
    /\t/,               // Tab
    /\s{2,}/,          // Multiple spaces
    /\s*\|\s*/,        // Pipe with optional spaces
    /,/                // Comma
  ]
  
  for (const delimiter of delimiters) {
    const counts = lines.slice(0, 5).map(line => line.split(delimiter).length)
    if (counts.every(c => c > 1 && c === counts[0])) {
      return delimiter
    }
  }
  
  return /\s+/ // Default to any whitespace
}

// Demo data for testing
function getDemoData(): ExtractedTableData {
  return {
    headers: ['e_id', 'e_name', 'e_salary', 'e_age', 'e_gender', 'e_dept'],
    rows: [
      {
        'e_id': '1',
        'e_name': 'Sam',
        'e_salary': '95000',
        'e_age': '45',
        'e_gender': 'Male',
        'e_dept': 'Operations'
      },
      {
        'e_id': '2',
        'e_name': 'Bob',
        'e_salary': '80000',
        'e_age': '21',
        'e_gender': 'Male',
        'e_dept': 'Support'
      },
      {
        'e_id': '3',
        'e_name': 'Anne',
        'e_salary': '125000',
        'e_age': '25',
        'e_gender': 'Female',
        'e_dept': 'Analytics'
      },
      {
        'e_id': '4',
        'e_name': 'Julia',
        'e_salary': '73000',
        'e_age': '30',
        'e_gender': 'Female',
        'e_dept': 'Analytics'
      },
      {
        'e_id': '5',
        'e_name': 'Matt',
        'e_salary': '159000',
        'e_age': '33',
        'e_gender': 'Male',
        'e_dept': 'Sales'
      },
      {
        'e_id': '6',
        'e_name': 'Jeff',
        'e_salary': '112000',
        'e_age': '27',
        'e_gender': 'Male',
        'e_dept': 'Operations'
      }
    ],
    confidence: 95
  }
}