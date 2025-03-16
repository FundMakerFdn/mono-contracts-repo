// @ts-check
const fs = require('fs').promises;
const path = require('path');

/**
 * @typedef {Object} TokenData
 * @property {string} address
 * @property {string} symbol
 * @property {string} name
 * @property {number} decimals
 * @property {number} liquidityUSD
 */

/**
 * @typedef {Object} PsymmObj
 * @property {string} PSIN
 * @property {'ERC20'} AssetType
 * @property {string} AssetCategory
 * @property {string} Note
 * @property {Record<string, string>} TokenAddresses
 * @property {string[]} PriceSources
 * @property {number} PriceDecimals
 */

/**
 * Fetches token data from ParaSwap for a given chain
 * @param {number} chainId
 * @returns {Promise<TokenData[]>}
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
 * @returns {Promise<PsymmObj[]>}
 */
async function generateISNList() {
  const LIQUIDITY_THRESHOLD = 1_000_000;
  const chains = [
    { id: 1, name: 'Ethereum' },
    
    { id: 137, name: 'Polygon' },
    { id: 56, name: 'BSC' },
    { id: 10, name: 'Optimism' },
    { id: 42161, name: 'Arbitrum' },
    { id: 1101, name: 'Base' },
    { id: 8453, name: 'Base' },
    { id: 43114, name: 'Avalanche' }
  ];

  1, 10, 56, 100, 137, 250, 1101, 8453, 42161, 43114

  // Predefined price sources for all assets
  const defaultPriceSources = [
    '/paraswap/price',
    '/1inch/price',
    '/0x/price'
  ];

  const allTokens = {};
  for (const chain of chains) {
    const tokens = await fetchTokensFromParaSwap(chain.id);
    for (const token of tokens) {
      const key = `${token.symbol}-${token.name}`; // Unique key for token across chains
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
  let psinCounter = 1;
  for (const [_, token] of Object.entries(allTokens)) {
    if (token.totalLiquidityUSD >= LIQUIDITY_THRESHOLD) {
      const psin = `PSYMM${String(psinCounter++).padStart(8, '0')}`;
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