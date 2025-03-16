export async function getFunding(asset) {
    const endpoint = `https://api.bitget.com/api/v2/mix/market/history-fund-rate?symbol=${asset}&productType=umcbl&pageSize=1`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Bitget funding API error: ${response.status}`);
    }
    const data = await response.json();
    if (data.code !== "00000" || !data.data || !data.data.length) {
      throw new Error("Bitget funding data unavailable");
    }
    const fundingData = data.data[0];
    return {
      fundingRate: fundingData.fundingRate,
      fundingTime: parseInt(fundingData.settleTime) // Incorrect field
    };
  }