const fs = require('fs').promises;
const path = require('path');

// Import info.json
const info = require('./info.json');

// Get current timestamp at 00:00 UTC
const currentDate = new Date();
currentDate.setUTCHours(0, 0, 0, 0);
const timestamp = Math.floor(currentDate.getTime() / 1000);

// Function to read JSON file
async function readJsonFile(filename) {
    const filePath = path.resolve(__dirname, filename);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
}

// Function to write CSV
async function writeCsv(filename, rows) {
    const filePath = path.resolve(__dirname, filename);
    const headers = 'timestamp,weights,quantities,price,price\n';
    const csvContent = headers + rows
        .map(row => `${row.timestamp},"${row.weights}",${row.quantities || ''}`)
        .join('\n');
    await fs.writeFile(filePath, csvContent, 'utf8');
}

// Main function
async function processPortfolio() {
    try {
        // Load JSON files
        const pairsWithCategories = await readJsonFile('../../scripts/binance_spot_pairs_with_categories.json');
        const listedPairs = await readJsonFile('../../scripts/binance_spot_pairs_coingecko.json');

        // Use note from info.json as category filter
        const categoryToFilter = info.note;

        // Filter pairs
        const filteredPairs = Object.entries(listedPairs)
            .filter(([pair, status]) => 
                status === 'Listed' && 
                pairsWithCategories[pair] && 
                pairsWithCategories[pair].categories.includes(categoryToFilter)
            )
            .map(([pair]) => pair);

        // Calculate weights with higher precision
        const numPairs = filteredPairs.length;
        const weight = numPairs > 0 ? (1.0 / numPairs).toFixed(2) : '0.00';
        const weightsStr = filteredPairs
            .map(pair => `${pair}:${weight}`)
            .join(',');

        if (numPairs === 0) {
            console.log(`No pairs found with category '${categoryToFilter}'`);
            return;
        }

        // Prepare data
        const csvData = {
            timestamp: timestamp,
            weights: weightsStr,
            quantities: ''
        };

        // Handle only index.csv
        const indexFilename = 'index.csv';
        let indexRows = [];

        try {
            const existingIndexData = await fs.readFile(path.resolve(__dirname, indexFilename), 'utf8');
            indexRows = existingIndexData.split('\n')
                .slice(1)
                .filter(line => line.trim())
                .map(line => {
                    const [ts, w, q] = line.split(/,"|",/);
                    return {
                        timestamp: parseInt(ts),
                        weights: w.replace(/"/g, ''),
                        quantities: q || ''
                    };
                });
        } catch (error) {
            if (error.code !== 'ENOENT') throw error; // Ignore file not found error
        }

        indexRows.push(csvData);
        indexRows.sort((a, b) => a.timestamp - b.timestamp);
        
        console.log(`Writing to ${indexFilename} with ${indexRows.length} rows`);
        await writeCsv(indexFilename, indexRows);

        console.log(`Created/Updated ${indexFilename}`);
        console.log(`Timestamp: ${timestamp}`);
        console.log(`Weights: ${weightsStr}`);

    } catch (error) {
        console.error('Error:', error);
    }
}

// Run the script
processPortfolio();