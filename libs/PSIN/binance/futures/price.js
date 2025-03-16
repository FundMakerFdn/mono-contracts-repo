// ./binance/futures/price.js
export async function getPrice(asset) {
  const endpoint = `https://fapi.binance.com/fapi/v1/ticker/bookTicker?symbol=${asset}`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Binance price API error: ${response.status}`);
  }
  const data = await response.json();
  return { bid: data.bidPrice, ask: data.askPrice };
}