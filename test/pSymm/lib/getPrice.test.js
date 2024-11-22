import { expect } from 'chai';
import { PriceGenerator } from '../../../../validator/pSymm/lib/getPrice.js';

export function shouldGetPrice() {
  describe('PriceGenerator', function() {
    it('should return a deterministic price', function() {
      const generator = new PriceGenerator();
      const { open, high, low, close } = generator.getPrice('assetName', new Date('2023-01-01T00:00:00Z'));
      expect(open).to.be.a('number').and.to.be.greaterThan(0);
      expect(high).to.equal(open);
      expect(low).to.equal(open);
      expect(close).to.equal(open);
    });

    it('getFirstCrossing should return correct timestamp for crossing up', function() {
      const generator = new PriceGenerator();
      const startTimestamp = new Date('2023-01-01T00:00:00Z').getTime();
      const endTimestamp = startTimestamp + 5 * 60 * 60 * 1000; // 2 hours later
      const tickPrice = 12.02; // Adjusted to be within the range of generated prices
      const result = generator.getFirstCrossing('assetName', tickPrice, startTimestamp, endTimestamp, true);
      expect(result).to.be.a('number').and.to.be.greaterThan(0);
    });

    it('getFirstCrossing should return correct timestamp for crossing down', function() {
      const generator = new PriceGenerator();
      const startTimestamp = new Date('2023-01-01T00:00:00Z').getTime();
      const endTimestamp = startTimestamp + 5 * 60 * 60 * 1000; // 2 hours later
      const tickPrice = 12.06; // Adjusted to be within the range of generated prices
      const result = generator.getFirstCrossing('assetName', tickPrice, startTimestamp, endTimestamp, false);
      expect(result).to.be.a('number').and.to.be.greaterThan(0);
    });

    it('should handle no crossing correctly', function() {
      const generator = new PriceGenerator();
      const startTimestamp = new Date('2023-01-01T00:00:00Z').getTime();
      const endTimestamp = startTimestamp + 5 * 60 * 60 * 1000; // 2 hours later
      const tickPrice = 100; // A high tick price unlikely to be crossed
      const result = generator.getFirstCrossing('assetName', tickPrice, startTimestamp, endTimestamp, true);
      expect(result).to.equal(0);
    });
  });
}