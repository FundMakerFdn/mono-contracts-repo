// ./paraswap/price.js

/**
 * Fetches token price from ParaSwap API
 * @param {Object} params
 * @param {number} params.chainId - The blockchain network ID (e.g., 1 for Ethereum, 137 for Polygon)
 * @param {string} params.tokenAddress - The token contract address
 * @returns {Promise<{ bid: string, ask: string }>} - Bid and ask prices in USD
 * @throws {Error} If API request fails or data is invalid
 */
export async function getPrice({ chainId, tokenAddress }) {
    // Validate inputs
    if (!Number.isInteger(chainId) || chainId <= 0) {
      throw new Error('Invalid chainId: must be a positive integer');
    }
    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      throw new Error('Invalid tokenAddress: must be a valid Ethereum address');
    }
  
    // ParaSwap API endpoint for price estimation
    const endpoint = `https://apiv5.paraswap.io/prices/?srcToken=${tokenAddress}&destToken=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&amount=1000000000000000000&side=SELL&network=${chainId}&includeDEXS=true`;
  
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json',
        },
      });
  
      if (!response.ok) {
        throw new Error(`ParaSwap API error: ${response.status}`);
      }
  
      const data = await response.json();
  
      // Check if the response contains valid price data
      if (!data.priceRoute || !data.priceRoute.bestRoute || data.priceRoute.bestRoute.length === 0) {
        throw new Error('ParaSwap price data unavailable');
      }
  
      // Get the USD price from the best route
      const priceInEth = data.priceRoute.destAmount; // Amount in ETH (since destToken is ETH)
      const ethUsdPrice = await getEthUsdPrice(chainId); // Helper to get ETH/USD price
  
      // Calculate token price in USD
      // Note: priceInEth is in wei (10^18), so we normalize it
      const tokenPriceUsd = (Number(priceInEth) / 1e18) * ethUsdPrice;
  
      // ParaSwap doesn't provide bid/ask spread directly, so we'll approximate
      // Using a small spread (e.g., 0.5%) as an estimation
      const spread = 0.005; // 0.5%
      const bid = (tokenPriceUsd * (1 - spread)).toFixed(6);
      const ask = (tokenPriceUsd * (1 + spread)).toFixed(6);
  
      return { bid, ask };
    } catch (error) {
      throw new Error(`Failed to fetch ParaSwap price: ${error.message}`);
    }
  }
  
  /**
   * Helper function to get ETH/USD price from ParaSwap
   * @param {number} chainId
   * @returns {Promise<number>}
   * @private
   */
  async function getEthUsdPrice(chainId) {
    // Using USDC as a stablecoin reference (assuming 1 USDC = 1 USD)
    const usdcAddress = getUsdcAddress(chainId);
    const endpoint = `https://apiv5.paraswap.io/prices/?srcToken=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&destToken=${usdcAddress}&amount=1000000000000000000&side=SELL&network=${chainId}`;
  
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`ParaSwap ETH/USD API error: ${response.status}`);
      }
  
      const data = await response.json();
      if (!data.priceRoute || !data.priceRoute.destAmount) {
        throw new Error('ParaSwap ETH/USD price data unavailable');
      }
  
      // destAmount is in USDC (6 decimals), convert to USD price per ETH
      return Number(data.priceRoute.destAmount) / 1e6;
    } catch (error) {
      throw new Error(`Failed to fetch ETH/USD price: ${error.message}`);
    }
  }
  
  /**
   * Returns USDC address for given chain ID
   * @param {number} chainId
   * @returns {string}
   */
  function getUsdcAddress(chainId) {
    const usdcAddresses = {
      1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',    // Ethereum
      137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',  // Polygon
      56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',   // BSC
      10: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',   // Optimism
      42161: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8' // Arbitrum
      // Add more chain IDs as needed
    };
  
    if (!usdcAddresses[chainId]) {
      throw new Error(`USDC address not configured for chainId: ${chainId}`);
    }
    return usdcAddresses[chainId];
  }


  /**
 * Fetches token price from ParaSwap API
 * @param {Object} params
 * @param {number} params.chainId
 * @param {string} params.tokenAddress
 * @returns {Promise<{ bid: string, ask: string }>}
 */
export async function getPrice({ chainId, tokenAddress }) {
    const endpoint = `https://apiv5.paraswap.io/prices/?srcToken=${tokenAddress}&destToken=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&amount=1000000000000000000&side=SELL&network=${chainId}&includeDEXS=true`;
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`ParaSwap API error: ${response.status}`);
    const data = await response.json();
    if (!data.priceRoute || !data.priceRoute.destAmount) {
      throw new Error('ParaSwap price data unavailable');
    }
    const priceInEth = Number(data.priceRoute.destAmount) / 1e18;
    const spread = 0.005;
    return {
      bid: (priceInEth * (1 - spread)).toFixed(6),
      ask: (priceInEth * (1 + spread)).toFixed(6)
    };
  }