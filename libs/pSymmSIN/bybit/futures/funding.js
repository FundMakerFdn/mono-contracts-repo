// ./bybit/funding/funding.js
export async function getFunding(asset) {
    const endpoint = `https://api.bybit.com/public/linear/funding/prev-funding-rate?symbol=${asset}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Bybit funding API error: ${response.status}`);
    }
    const data = await response.json();
    if (data.ret_code !== 0 || !data.result) {
      throw new Error("Bybit funding data unavailable");
    }
    return { fundingRate: data.result.funding_rate, fundingTime: data.result.funding_time };
  }
  