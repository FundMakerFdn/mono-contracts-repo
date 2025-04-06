const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');

// Configuration
const CHECKPOINT_FILE = 'checkpoint.json';
const OUTPUT_CSV = 'binance_pairs_data.csv';
const BASE_URL = 'https://data.binance.vision/data/spot/monthly/klines/';

// State management
let processedPairs = [];
let currentIndex = 0;

// Constants
const INTERVAL = '1mo';
const TEMP_DIR = path.join(__dirname, 'temp');

// Make sure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

// Initialize CSV if it doesn't exist
function initializeCsv() {
  if (!fs.existsSync(OUTPUT_CSV)) {
    fs.writeFileSync(OUTPUT_CSV, 'symbol,listing_date,delisting_date\n');
    console.log('CSV file initialized');
  }
}

// Load checkpoint if exists
function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = fs.readFileSync(CHECKPOINT_FILE, 'utf8');
      const checkpoint = JSON.parse(data);
      processedPairs = checkpoint.processedPairs || [];
      currentIndex = checkpoint.currentIndex || 0;
      console.log(`Checkpoint loaded. Resuming from index ${currentIndex}`);
      return true;
    }
  } catch (error) {
    console.error('Error loading checkpoint:', error);
  }
  return false;
}

// Save checkpoint
function saveCheckpoint() {
  try {
    const checkpoint = {
      processedPairs,
      currentIndex
    };
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
    console.log(`Checkpoint saved at index ${currentIndex}`);
  } catch (error) {
    console.error('Error saving checkpoint:', error);
  }
}

// Append data to CSV
function appendToCsv(symbol, listingDate, delistingDate) {
  const csvLine = `${symbol},${listingDate || 'unknown'},${delistingDate || 'active'}\n`;
  fs.appendFileSync(OUTPUT_CSV, csvLine);
  console.log(`Added to CSV: ${symbol},${listingDate || 'unknown'},${delistingDate || 'active'}`);
}

// Get all pairs from Binance using curl
function getAllPairs() {
  try {
    // Use curl to get all symbols
    console.log('Fetching all pairs using curl...');
    
    // Create a temporary file to store the curl output
    const tempFile = path.join(TEMP_DIR, 'pairs_list.html');
    
    // Execute curl command to get the directory listing
    execSync(`curl -s "https://data.binance.vision/data/spot/monthly/klines/" > ${tempFile}`);
    
    // Read the HTML content
    const htmlContent = fs.readFileSync(tempFile, 'utf8');
    
    // Parse the pairs from HTML - look for links in directory listing
    const pairRegex = /<a href="([A-Z0-9]+)\/">/g;
    let matches;
    const pairs = [];
    
    while ((matches = pairRegex.exec(htmlContent)) !== null) {
      pairs.push(matches[1]);
    }
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    // Filter for USDT and USDC pairs
    const filteredPairs = pairs.filter(pair => 
      pair.endsWith('USDT') || pair.endsWith('USDC')
    );
    
    console.log(`Found ${filteredPairs.length} USDT/USDC pairs`);
    return filteredPairs;
  } catch (error) {
    console.error('Error getting all pairs:', error);
    
    // Fallback to a secondary method if the first fails
    console.log('Falling back to direct listing...');
    
    try {
      // Direct way of listing using axios
      console.log('Directly listing common pairs...');
      
      // Start with a list of known common pairs as fallback
      const commonPairs = [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 
        'DOGEUSDT', 'SOLUSDT', 'DOTUSDT', 'LTCUSDT', 'LINKUSDT',
        'UNIUSDT', 'AVAXUSDT', 'MATICUSDT', 'SHIBUSDT', 'ETCUSDT',
        'FILUSDT', 'AAVEUSDT', 'EOSUSDT', 'XLMUSDT', 'BCHUSDT',
        'ATOMUSDT', 'THETAUSDT', 'TRXUSDT',
        // Add USDC pairs
        'BTCUSDC', 'ETHUSDC', 'BNBUSDC', 'ADAUSDC', 'XRPUSDC'
      ];
      
      console.log(`Using ${commonPairs.length} common pairs as fallback`);
      return commonPairs;
    } catch (fallbackError) {
      console.error('Fallback method failed:', fallbackError);
      return [];
    }
  }
}

// Get available data files for a pair
async function getAvailableFiles(pair) {
  try {
    // Use curl to get the list of files
    console.log(`Fetching available files for ${pair}...`);
    
    const tempFile = path.join(TEMP_DIR, `${pair}_files.html`);
    const url = `${BASE_URL}${pair}/${INTERVAL}/`;
    
    // Execute curl command to get the directory listing
    execSync(`curl -s "${url}" > ${tempFile}`);
    
    // Read the HTML content
    const htmlContent = fs.readFileSync(tempFile, 'utf8');
    
    // Parse the zip files from HTML
    const zipRegex = /<a href="([A-Z0-9]+-1mo-\d{4}-\d{2}\.zip)">/g;
    let matches;
    const files = [];
    
    while ((matches = zipRegex.exec(htmlContent)) !== null) {
      files.push(matches[1]);
    }
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    // Sort files by date
    files.sort();
    
    console.log(`Found ${files.length} data files for ${pair}`);
    return files;
  } catch (error) {
    console.error(`Error getting available files for ${pair}:`, error);
    return [];
  }
}

// Extract date from filename (e.g., BTCUSDT-1mo-2017-08.zip -> 2017-08)
function extractDateFromFilename(filename) {
  const match = filename.match(/\d{4}-\d{2}/);
  return match ? match[0] : null;
}

// Process a single pair
async function processPair(pair) {
  console.log(`\nProcessing pair: ${pair}`);
  
  try {
    // Get available files
    const files = await getAvailableFiles(pair);
    
    if (files.length === 0) {
      console.log(`No data files found for ${pair}`);
      return {
        symbol: pair,
        listingDate: null,
        delistingDate: null
      };
    }
    
    // Get first and last file
    const firstFile = files[0];
    const lastFile = files[files.length - 1];
    
    // Extract dates
    const listingDate = extractDateFromFilename(firstFile);
    const delistingDate = extractDateFromFilename(lastFile);
    
    console.log(`${pair}: Listing date = ${listingDate}, Last update = ${delistingDate}`);
    
    return {
      symbol: pair,
      listingDate,
      delistingDate
    };
  } catch (error) {
    console.error(`Error processing ${pair}:`, error);
    return {
      symbol: pair,
      listingDate: null,
      delistingDate: null
    };
  }
}

// Main function
async function main() {
  console.log('Starting Binance pairs processing script...');
  
  // Initialize CSV if needed
  initializeCsv();
  
  // Load checkpoint if exists
  loadCheckpoint();
  
  try {
    // Get all USDT and USDC pairs
    const pairs = getAllPairs();
    
    if (pairs.length === 0) {
      console.error('No pairs found! Check if the API structure has changed.');
      return;
    }
    
    // Process each pair starting from checkpoint
    for (let i = currentIndex; i < pairs.length; i++) {
      const pair = pairs[i];
      currentIndex = i;
      
      // Skip already processed pairs
      if (processedPairs.includes(pair)) {
        console.log(`Skipping already processed pair: ${pair}`);
        continue;
      }
      
      // Process the pair
      const result = await processPair(pair);
      
      // Add to processed list and save to CSV
      processedPairs.push(pair);
      appendToCsv(result.symbol, result.listingDate, result.delistingDate);
      
      // Save checkpoint after each pair
      saveCheckpoint();
      
      console.log(`Completed ${i+1}/${pairs.length} pairs`);
    }
    
    console.log('\nProcessing complete!');
    console.log(`Results saved to ${OUTPUT_CSV}`);
    
    // Clean up checkpoint file if completed successfully
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
      console.log('Checkpoint file removed');
    }
    
  } catch (error) {
    console.error('Error in main process:', error);
    // Save checkpoint on error to allow resuming
    saveCheckpoint();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nProcess interrupted. Saving checkpoint...');
  saveCheckpoint();
  process.exit(0);
});

// Run the script
main().catch(console.error);