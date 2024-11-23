const assert = require('assert');
const MockArweave = require('./mockArweave');

async function test() {
  const arweave = new MockArweave();

  // Test storing and retrieving data
  const testData = { foo: 'bar', baz: 123 };
  const hash = arweave.store(testData);
  
  const retrieved = arweave.get(hash);
  assert.deepEqual(retrieved.data, testData);
  assert(retrieved.timestamp <= Date.now());

  // Test non-existent hash
  assert.equal(arweave.get('nonexistent'), null);

  // Test overwriting same data
  const hash2 = arweave.store(testData);
  assert.equal(hash, hash2);

  arweave.close();
  console.log('All tests passed!');
}

test().catch(console.error);
