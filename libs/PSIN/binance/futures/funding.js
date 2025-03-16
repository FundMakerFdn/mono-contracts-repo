// ./binance/funding/funding.js
export async function getFunding(asset) {
    const endpoint = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${asset}&limit=1`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Binance funding API error: ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("No Binance funding data available");
    }
    const fundingData = data[0];
    return { fundingRate: fundingData.fundingRate, fundingTime: fundingData.fundingTime };
  }
  