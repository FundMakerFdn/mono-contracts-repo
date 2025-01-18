const pSymmFIX = require("./index.js");
const assert = require("assert");

// Initialize FIX parser
const fix = new pSymmFIX("FIX.4.4");

// Test 1: Basic message without groups
const basicMsg = "8=FIX.4.4|9=100|35=D";
console.log("\nTest 1: Basic message");
const basicResult = fix.decode(basicMsg);
assert.strictEqual(basicResult.BeginString, "FIX.4.4");
assert.strictEqual(basicResult.BodyLength, "100");
assert.strictEqual(basicResult.MsgType, "D");
console.log("✓ Basic message test passed");

// Test 2: Message with single group
const singleGroupMsg =
  "8=FIX.4.4|555=2|600=AAPL|601=100|602=10|600=MSFT|601=200|602=20";
console.log("\nTest 2: Single group message");
const groupResult = fix.decode(singleGroupMsg);
console.log(JSON.stringify(groupResult));
assert.strictEqual(groupResult.LegGroup.length, 2);
assert.strictEqual(groupResult.LegGroup[0].LegSymbol, "AAPL");
assert.strictEqual(groupResult.LegGroup[0].LegPrice, "100");
assert.strictEqual(groupResult.LegGroup[1].LegSymbol, "MSFT");
assert.strictEqual(groupResult.LegGroup[1].LegQty, "20");
console.log("✓ Single group test passed");

// Test 3: Message with nested groups
const nestedGroupMsg =
  "8=FIX.4.4|555=2|" +
  // First leg group with 2 parties
  "600=AAPL|601=100|453=2|" +
  "448=ID1|447=D|452=1|" +
  "448=ID2|447=D|452=2|" +
  // Second leg group with 1 party
  "600=MSFT|601=200|453=1|" +
  "448=ID3|447=D|452=3";

console.log("\nTest 3: Nested groups message");
const nestedResult = fix.decode(nestedGroupMsg);
console.log(JSON.stringify(nestedResult));
assert.strictEqual(nestedResult.LegGroup.length, 2);
assert.strictEqual(nestedResult.LegGroup[0].Parties.length, 2);
assert.strictEqual(nestedResult.LegGroup[1].Parties.length, 1);
assert.strictEqual(nestedResult.LegGroup[0].Parties[0].PartyID, "ID1");
assert.strictEqual(nestedResult.LegGroup[1].Parties[0].PartyID, "ID3");
console.log("✓ Nested groups test passed");

// Test 4: Empty group
const emptyGroupMsg = "8=FIX.4.4|555=0|35=D";
console.log("\nTest 4: Empty group message");
const emptyGroupResult = fix.decode(emptyGroupMsg);
assert.strictEqual(Array.isArray(emptyGroupResult.LegGroup), true);
assert.strictEqual(emptyGroupResult.LegGroup.length, 0);
console.log("✓ Empty group test passed");

console.log("\nAll tests passed! ✓");
