const pSymmFIX = require("pSymmFIX");
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

// Test 2: Message with nested groups
const nestedGroupMsg =
  "8=FIX.4.4|9=100|35=D|555=2|" +
  // First leg group with 2 parties
  "600=AAPL|601=100|602=10|453=2|" +
  "448=ID1|447=D|452=1|" +
  "448=ID2|447=D|452=2|" +
  // Second leg group with 1 party
  "600=MSFT|601=200|602=20|453=1|" +
  "448=ID3|447=D|452=3";

console.log("\nTest 2: Nested groups message");
const nestedResult = fix.decode(nestedGroupMsg);
console.log(JSON.stringify(nestedResult));
assert.strictEqual(
  JSON.stringify(nestedResult),
  '{"BeginString":"FIX.4.4","BodyLength":"100","MsgType":"D","LegGroup":[{"LegSymbol":"AAPL","LegPrice":"100","LegQty":"10","Parties":[{"PartyID":"ID1","PartyIDSource":"D","PartyRole":"1"},{"PartyID":"ID2","PartyIDSource":"D","PartyRole":"2"}]},{"LegSymbol":"MSFT","LegPrice":"200","LegQty":"20","Parties":[{"PartyID":"ID3","PartyIDSource":"D","PartyRole":"3"}]}]}'
);
console.log("✓ Nested groups test passed");
