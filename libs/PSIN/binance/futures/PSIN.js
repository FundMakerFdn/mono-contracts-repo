// @ts-check
const fs = require('fs').promises;
const path = require('path');

// Counter for generating unique PSIN identifiers
let psinCounter = 0;

/**
 * Calculates a check digit for the PSIN identifier
 * @param {string} base - The base PSIN string (e.g., "PSYMM0000001")
 * @returns {number} - The calculated check digit
 */
function calculateCheckDigit(base) {
  const sum = base.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return sum % 10;
}

/**
 * Generates a unique PSIN identifier with a check digit
 * @param {number} counter - The current counter value
 * @returns {string} - The generated PSIN (e.g., "PSYMM00000010")
 */
function generatePSIN(counter) {
  const base = `PSYMM${counter.toString().padStart(7, '0')}`;
  const checkDigit = calculateCheckDigit(base);
  return `${base}${checkDigit}`;
}

/**
 * Fetches token data from ParaSwap for a given chain
 * @param {number} chainId
 * @returns {Promise<object[]>}
 */
async function fetchTokensFromParaSwap(chainId) {
  const endpoint = `https://apiv5.paraswap.io/tokens/${chainId}`;
  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`ParaSwap API error: ${response.status}`);
    const data = await response.json();
    return data.tokens.filter(t => t.liquidityUSD && t.liquidityUSD > 0);
  } catch (err) {
    console.warn(`Failed to fetch tokens for chain ${chainId}: ${err.message}`);
    return [];
  }
}

/**
 * Generates PSIN list with >$1M liquidity
 * @returns {Promise<object[]>}
 */
async function generateISNList() {
  const LIQUIDITY_THRESHOLD = 1_000_000;
  const chains = [
    { id: 1, name: 'Ethereum' },
    { id: 137, name: 'Polygon' },
    { id: 56, name: 'BSC' },
    { id: 10, name: 'Optimism' },
    { id: 42161, name: 'Arbitrum' }
  ];

  const defaultPriceSources = [
    '/paraswap/price',
    '/1inch/price',
    '/0x/price'
  ];

  const allTokens = {};
  for (const chain of chains) {
    const tokens = await fetchTokensFromParaSwap(chain.id);
    for (const token of tokens) {
      const key = `${token.symbol}-${token.name}`;
      if (!allTokens[key]) {
        allTokens[key] = {
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          tokenAddresses: {},
          totalLiquidityUSD: 0
        };
      }
      allTokens[key].tokenAddresses[chain.id] = token.address;
      allTokens[key].totalLiquidityUSD += token.liquidityUSD;
    }
  }

  const psinList = [];
  for (const [_, token] of Object.entries(allTokens)) {
    if (token.totalLiquidityUSD >= LIQUIDITY_THRESHOLD) {
      const psin = generatePSIN(psinCounter++);
      psinList.push({
        PSIN: psin,
        AssetType: 'ERC20',
        AssetCategory: 'CRYPTO',
        Note: `${token.name} (${token.symbol}) - Liquidity: $${token.totalLiquidityUSD.toLocaleString()}`,
        TokenAddresses: token.tokenAddresses,
        PriceSources: defaultPriceSources,
        PriceDecimals: token.decimals
      });
    }
  }

  return psinList;
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('Generating PSIN list with >$1M liquidity from ParaSwap pools...');
    const psinList = await generateISNList();
    const filePath = path.resolve(__dirname, './PSIN.json');
    await fs.writeFile(filePath, JSON.stringify(psinList, null, 2));
    console.log(`Generated ${psinList.length} assets in ${filePath}`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateISNList };