const fs = require('fs');
const path = require('path');

// List of VC assets embedded in the script
const datas = [
    {
        "name": "MulticoinIndex",
        "ticker": "SYMC",
        "note": "Multicoin Capital Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "A16zIndex",
        "ticker": "SYAZ",
        "note": "Andreessen Horowitz (a16z) Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "PanteraIndex",
        "ticker": "SYPC",
        "note": "Pantera Capital Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "DelphiIndex",
        "ticker": "SYDV",
        "note": "Delphi Ventures Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "PolychainIndex",
        "ticker": "SYPL",
        "note": "Polychain Capital Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "CoinbaseIndex",
        "ticker": "SYCB",
        "note": "Coinbase Ventures Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "YZiLabsIndex",
        "ticker": "SYYL",
        "note": "YZi Labs (Prev. Binance Labs) Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "CircleIndex",
        "ticker": "SYCI",
        "note": "Circle Ventures Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "DWFIndex",
        "ticker": "SYDW",
        "note": "DWF Labs Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "AnimocaIndex",
        "ticker": "SYAB",
        "note": "Animoca Brands Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "OutlierIndex",
        "ticker": "SYOV",
        "note": "Outlier Ventures Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "WorldLibertyIndex",
        "ticker": "SYWL",
        "note": "World Liberty Financial Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "DragonFlyIndex",
        "ticker": "SYDG",
        "note": "DragonFly Capital Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "OKXIndex",
        "ticker": "SYOK",
        "note": "OKX Ventures Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "ParadigmIndex",
        "ticker": "SYPD",
        "note": "Paradigm Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "BlockchainIndex",
        "ticker": "SYBC",
        "note": "Blockchain Capital Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "GalaxyIndex",
        "ticker": "SYGD",
        "note": "Galaxy Digital Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "DeFianceIndex",
        "ticker": "SYDF",
        "note": "DeFiance Capital Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "eGirlIndex",
        "ticker": "SYEG",
        "note": "eGirl Capital Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    },
    {
        "name": "SequoiaIndex",
        "ticker": "SYSC",
        "note": "Sequoia Capital Portfolio",
        "type": "VC",
        "params": {
            "initialPrice": 1000
        }
    }
];

// Base directory for output
const baseDir = '../etfs';

// Function to create directories and write info.json files
function generateETFStructure() {
    datas.forEach(asset => {
        try {
            const ticker = asset.ticker;
            const dirPath = path.join(baseDir, ticker);
            
            // Create directory if it doesn't exist
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                console.log(`Created directory: ${dirPath}`);
            }
            
            // Write info.json file
            const infoPath = path.join(dirPath, 'info.json');
            fs.writeFileSync(infoPath, JSON.stringify(asset, null, 4));
            console.log(`Wrote info.json for ${ticker} at ${infoPath}`);
        } catch (error) {
            console.error(`Error processing asset ${asset.ticker || 'unknown'}: ${error.message}`);
        }
    });
}

// Execute the function
try {
    generateETFStructure();
    console.log('ETF structure generation completed.');
} catch (error) {
    console.error(`Failed to generate ETF structure: ${error.message}`);
}