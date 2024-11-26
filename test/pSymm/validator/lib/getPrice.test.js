const assert = require('assert');
const { PriceGenerator } = require('../../../../validator/pSymm/lib/getPrice.cjs');

module.exports = { shouldGetPrice };

function shouldGetPrice() {
  describe('PriceGenerator', function() {
    it('should return a deterministic price', function() {
      const generator = new PriceGenerator();
      const { open, high, low, close } = generator.getPrice('assetName', new Date('2023-01-01T00:00:00Z'));
      assert.strictEqual(typeof open, 'number', 'Open price should be a number');
      assert(open > 0, 'Open price should be greater than 0');
      assert.strictEqual(high, open, 'High should equal Open');
      assert.strictEqual(low, open, 'Low should equal Open');
      assert.strictEqual(close, open, 'Close should equal Open');
    });

    it('getFirstCrossing should return correct timestamp for crossing up', function() {
      const generator = new PriceGenerator();
      const startTimestamp = new Date('2023-01-01T00:00:00Z').getTime();
      const endTimestamp = startTimestamp + 5 * 60 * 60 * 1000; // 5 hours later
      const tickPrice = 12.02; // Adjusted to be within the range of generated prices
      const result = generator.getFirstCrossing('assetName', tickPrice, startTimestamp, endTimestamp, true);
      assert.strictEqual(typeof result, 'number', 'Result should be a number');
      assert(result > 0, 'Result should be greater than 0');
    });

    it('getFirstCrossing should return correct timestamp for crossing down', function() {
      const generator = new PriceGenerator();
      const startTimestamp = new Date('2023-01-01T00:00:00Z').getTime();
      const endTimestamp = startTimestamp + 5 * 60 * 60 * 1000; // 5 hours later
      const tickPrice = 12.06; // Adjusted to be within the range of generated prices
      const result = generator.getFirstCrossing('assetName', tickPrice, startTimestamp, endTimestamp, false);
      assert.strictEqual(typeof result, 'number', 'Result should be a number');
      assert(result > 0, 'Result should be greater than 0');
    });

    it('should handle no crossing correctly', function() {
      const generator = new PriceGenerator();
      const startTimestamp = new Date('2023-01-01T00:00:00Z').getTime();
      const endTimestamp = startTimestamp + 5 * 60 * 60 * 1000; // 5 hours later
      const tickPrice = 100; // A high tick price unlikely to be crossed
      const result = generator.getFirstCrossing('assetName', tickPrice, startTimestamp, endTimestamp, true);
      assert.strictEqual(result, 0, 'Result should be 0 when no crossing occurs');
    });
  });
}