// ./bybit/funding/funding.js
export async function getFunding(asset) {
    const endpoint = `https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${asset}&limit=1`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Bybit funding API error: ${response.status}`);
    }
    const data = await response.json();
    if (data.retCode !== 0 || !data.result || !data.result.list || data.result.list.length === 0) {
      throw new Error("Bybit funding data unavailable");
    }
    const fundingData = data.result.list[0];
    return { fundingRate: fundingData.fundingRate, fundingTime: fundingData.fundingRateTimestamp };
  }