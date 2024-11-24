const assert = require("assert");
const MockStorage = require("./mockStorage");

async function test() {
  const storage = new MockStorage();

  // Test storing and retrieving data
  const testData = { foo: "bar", baz: 123 };
  const hash = storage.store(testData);

  const retrieved = storage.get(hash);
  assert.deepEqual(retrieved.data, testData);
  assert(retrieved.timestamp <= Date.now());

  // Test non-existent hash
  assert.equal(storage.get("nonexistent"), null);

  // Test overwriting same data
  const hash2 = storage.store(testData);
  assert.equal(hash, hash2);

  storage.close();
  console.log("All tests passed!");
}

test().catch(console.error);
