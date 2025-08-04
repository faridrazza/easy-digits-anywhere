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
  fileType?: string;
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
    const { fileUrl, documentId, userId, fileType } = await req.json() as OCRRequest
    
    console.log('Processing OCR request:', { fileUrl, documentId, userId, fileType })
    
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

    // Process based on file type
    let extractedData: ExtractedTableData;
    if (fileType === 'application/pdf') {
      console.log('Processing PDF file with Gemini API')
      extractedData = await processWithGeminiPDF(fileUrl)
    } else {
      console.log('Processing image file with Google Vision API')
      extractedData = await processWithGoogleVision(fileUrl)
    }
    
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
  
  // Always try Gemini first for better table extraction
  console.log('Attempting Gemini Vision processing for better table extraction')
  const geminiResult = await processWithGeminiVision(imageUrl)
  
  // If Gemini returns good data, use it
  if (geminiResult.rows.length > 0) {
    console.log('Gemini Vision successful, using results')
    return geminiResult
  }
  
  if (!hasServiceAccount) {
    console.log('No Google credentials found and Gemini failed, returning empty')
    return getEmptyData()
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
    // Return empty data since Gemini was already tried first
    return getEmptyData()
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
    console.log('No API key found, returning empty data')
    return getEmptyData()
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
              text: `Extract the table data from this image and return it as JSON.

Format (no markdown, no explanation):
{
  "headers": ["Column1", "Column2", "Column3"],
  "rows": [
    {"Column1": "value1", "Column2": "value2", "Column3": "value3"},
    {"Column1": "value4", "Column2": "value5", "Column3": "value6"}
  ]
}

RULES:
1. Use exact header names from the image
2. Include all rows of data
3. All values as strings
4. Empty cells = ""
5. NO demo/test data

Example: For this table:
CustomerID | CustomerName | LastName | Country | Age
    1      |   Shubham    |  Thakur  |  India  | 23
    2      |    Aman      |  Chopra  |Australia| 21

Return:
{"headers": ["CustomerID", "CustomerName", "LastName", "Country", "Age"], "rows": [{"CustomerID": "1", "CustomerName": "Shubham", "LastName": "Thakur", "Country": "India", "Age": "23"}, {"CustomerID": "2", "CustomerName": "Aman", "LastName": "Chopra", "Country": "Australia", "Age": "21"}]}`
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
  
  return getEmptyData()
}

// Process PDF files directly with Gemini 2.5 Flash
async function processWithGeminiPDF(pdfUrl: string): Promise<ExtractedTableData> {
  const apiKey = Deno.env.get('GOOGLE_API_KEY') || Deno.env.get('GEMINI_API_KEY')
  
  if (!apiKey) {
    console.log('No Gemini API key found, returning empty data')
    return getEmptyData()
  }
  
  try {
    // Download PDF file
    console.log('Downloading PDF from:', pdfUrl)
    const pdfResponse = await fetch(pdfUrl)
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF: ${pdfResponse.status} ${pdfResponse.statusText}`)
    }
    
    const pdfBuffer = await pdfResponse.arrayBuffer()
    const base64PDF = arrayBufferToBase64(pdfBuffer)
    console.log('PDF downloaded and converted to base64, size:', pdfBuffer.byteLength)
    
    // Call Gemini 2.5 Flash for PDF processing (using the latest model for better PDF support)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `Extract all table data from this PDF document and return it as JSON.

Format (no markdown, no explanation):
{
  "headers": ["Column1", "Column2", "Column3"],
  "rows": [
    {"Column1": "value1", "Column2": "value2", "Column3": "value3"},
    {"Column1": "value4", "Column2": "value5", "Column3": "value6"}
  ]
}

RULES:
1. Extract all tables found in the PDF
2. Use exact header names from the document
3. Include all rows of data from all tables
4. All values as strings
5. Empty cells = ""
6. If multiple tables exist, combine them if they have the same structure, otherwise use the largest/most complete table
7. NO demo/test data - only extract what's actually in the PDF

For handwritten registers or forms:
- Recognize handwritten text accurately
- Maintain proper data relationships
- Handle multiple pages if present`
            },
            {
              inline_data: {
                mime_type: "application/pdf",
                data: base64PDF
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
      throw new Error(`Gemini PDF API error: ${error}`)
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
        confidence: 90 // Slightly lower confidence than images as PDFs can be more complex
      }
    }
  } catch (error) {
    console.error('Gemini PDF processing error:', error)
  }
  
  return getEmptyData()
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
  console.log('Parsing OCR text:', text)
  
  // Split into words and clean up
  const words = text.split(/\s+/).filter(word => word.trim() && word.length > 0)
  
  if (words.length < 6) { // Need at least headers + one row
    return { headers: [], rows: [], confidence: 0 }
  }
  
  // Use intelligent parsing based on common table patterns
  return parseTableByPattern(words)
}

function parseTableByPattern(words: string[]): ExtractedTableData {
  console.log('All extracted words:', words)
  
  // Strategy: Auto-detect table structure by finding numeric row indicators
  const numericPattern = /^\d+$/
  
  // Find row numbers to determine table structure
  const rowNumbers: number[] = []
  const nonNumericWords: string[] = []
  
  words.forEach(word => {
    if (numericPattern.test(word)) {
      const num = parseInt(word)
      if (num >= 1 && num <= 20) { // Reasonable row number range
        rowNumbers.push(num)
      }
    } else {
      nonNumericWords.push(word)
    }
  })
  
  console.log('Row numbers found:', rowNumbers.sort((a, b) => a - b))
  console.log('Non-numeric words:', nonNumericWords)
  
  // If we have sequential row numbers, we can determine column count
  if (rowNumbers.length >= 2) {
    const sortedRowNumbers = rowNumbers.sort((a, b) => a - b)
    const maxRowNumber = sortedRowNumbers[sortedRowNumbers.length - 1]
    const minRowNumber = sortedRowNumbers[0]
    
    // Check if we have reasonable sequential numbers
    const numberOfRows = maxRowNumber - minRowNumber + 1
    const isSequential = sortedRowNumbers.length === numberOfRows
    
    console.log(`Row analysis: min=${minRowNumber}, max=${maxRowNumber}, total=${numberOfRows}, sequential=${isSequential}`)
    
    if (isSequential) {
      // More sophisticated column calculation
      // Find first row number position to help estimate structure
      const firstRowIndex = words.findIndex(word => word === '1')
      if (firstRowIndex > 0) {
        // Headers are before first row number
        const headerCount = firstRowIndex
        console.log(`Header count from structure: ${headerCount}`)
        
        if (headerCount >= 2 && headerCount <= 10) {
          return parseWithKnownStructure(words, headerCount, numberOfRows)
        }
      }
      
      // Fallback calculation
      const totalDataWords = nonNumericWords.length
      const estimatedColumns = Math.round(totalDataWords / numberOfRows)
      
      console.log(`Fallback calculation: ${totalDataWords} data words / ${numberOfRows} rows = ${estimatedColumns} columns`)
      
      if (estimatedColumns >= 2 && estimatedColumns <= 10) {
        return parseWithKnownStructure(words, estimatedColumns, numberOfRows)
      }
    }
  }
  
  // Fallback: Try common table patterns
  console.log('Using pattern detection fallback')
  return parseWithPatternDetection(words)
}

function parseWithKnownStructure(words: string[], columnCount: number, rowCount: number): ExtractedTableData {
  console.log(`=== PARSING DEBUG ===`)
  console.log('Input words:', words)
  console.log(`Expected: ${columnCount} columns, ${rowCount} rows`)
  
  // Find the exact pattern: headers followed by row data
  const firstRowNumIndex = words.findIndex(word => word === '1')
  console.log('First row number "1" found at index:', firstRowNumIndex)
  
  if (firstRowNumIndex === -1) {
    console.log('No row number "1" found, using fallback parsing')
    return parseWithPatternDetection(words)
  }
  
  // Headers are everything before the first row number
  const headers = words.slice(0, firstRowNumIndex).filter(word => word.trim().length > 0)
  console.log('Extracted headers:', headers)
  
  // Validate header count matches expected columns
  if (headers.length !== columnCount) {
    console.log(`Header count mismatch: got ${headers.length}, expected ${columnCount}`)
    // Adjust column count to match actual headers
    columnCount = headers.length
  }
  
  // Extract all data after headers (including row numbers)
  const allDataWords = words.slice(firstRowNumIndex)
  console.log('All data words:', allDataWords)
  
  // Parse row by row, expecting: rowNumber, col1, col2, col3, col4
  const rows: Array<Record<string, string>> = []
  let currentIndex = 0
  
  for (let rowNum = 1; rowNum <= rowCount && currentIndex < allDataWords.length; rowNum++) {
    console.log(`\n--- Processing Row ${rowNum} ---`)
    
    // Skip the row number if it matches expected
    if (allDataWords[currentIndex] === rowNum.toString()) {
      console.log(`Skipping row number: ${allDataWords[currentIndex]}`)
      currentIndex++
    }
    
    // Extract data for this row
    const rowData: Record<string, string> = {}
    let hasData = false
    
    for (let col = 0; col < columnCount && currentIndex < allDataWords.length; col++) {
      const value = allDataWords[currentIndex] || ''
      
      // Skip if this looks like the next row number
      if (/^\d+$/.test(value) && parseInt(value) === rowNum + 1) {
        console.log(`Found next row number ${value}, stopping current row`)
        break
      }
      
      rowData[headers[col] || `Column${col + 1}`] = value
      if (value.trim()) hasData = true
      
      console.log(`  ${headers[col] || `Column${col + 1}`}: "${value}"`)
      currentIndex++
    }
    
    if (hasData) {
      rows.push(rowData)
      console.log('Added row:', rowData)
    }
  }
  
  console.log('=== FINAL RESULT ===')
  console.log('Headers:', headers)
  console.log('Rows:', rows)
  console.log('==================')
  
  return {
    headers,
    rows,
    confidence: 95
  }
}

function parseWithPatternDetection(words: string[]): ExtractedTableData {
  // Try to detect common table patterns when structure is unclear
  const headerPatterns = [
    /customer/i, /name/i, /id$/i, /age$/i, /country/i, /email/i, 
    /phone/i, /amount/i, /price/i, /total/i, /date/i, /status/i
  ]
  
  const headers: string[] = []
  const dataWords: string[] = []
  
  // Find header-like words in first part of text
  for (let i = 0; i < Math.min(10, words.length); i++) {
    const word = words[i]
    const isLikelyHeader = headerPatterns.some(pattern => pattern.test(word)) ||
                          (word.length > 2 && !/^\d+$/.test(word))
    
    if (isLikelyHeader && headers.length < 8) {
      headers.push(word)
    }
  }
  
  // If no clear headers, return empty
  if (headers.length === 0) {
    return { headers: [], rows: [], confidence: 0 }
  }
  
  // Get remaining words as data
  dataWords.push(...words.slice(headers.length))
  
  // Group into rows
  const rows: Array<Record<string, string>> = []
  const colCount = headers.length
  
  for (let i = 0; i < dataWords.length; i += colCount) {
    const row: Record<string, string> = {}
    
    for (let j = 0; j < colCount; j++) {
      row[headers[j]] = dataWords[i + j] || ''
    }
    
    if (Object.values(row).some(v => v.trim())) {
      rows.push(row)
    }
  }
  
  return {
    headers,
    rows,
    confidence: 75
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

// Return empty data instead of demo data
function getEmptyData(): ExtractedTableData {
  return {
    headers: [],
    rows: [],
    confidence: 0
  }
}