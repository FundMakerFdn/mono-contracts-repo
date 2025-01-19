const pSymmFIX = require("pSymmFIX");
const assert = require("assert");

// Initialize FIX parser
const fix = new pSymmFIX("MockFIX");

// Test 1: Basic message without groups
console.log("\nTest 1: Basic message");
const basicObj = {
  BeginString: "MockFIX",
  BodyLength: "100",
  MsgType: "D",
};
const basicResult = fix.encode(basicObj);
console.log(basicResult);
assert.strictEqual(
  JSON.stringify(fix.decode(basicResult)),
  JSON.stringify(basicObj)
);
console.log("✓ Basic message test passed");

// Test 2: Message with nested groups
console.log("\nTest 2: Nested groups message");
const nestedObj = {
  BeginString: "MockFIX",
  BodyLength: "100",
  MsgType: "D",
  LegGroup: [
    {
      LegSymbol: "AAPL",
      LegPrice: "100",
      LegQty: "10",
      Parties: [
        {
          PartyID: "ID1",
          PartyIDSource: "D",
          PartyRole: "1",
        },
        {
          PartyID: "ID2",
          PartyIDSource: "D",
          PartyRole: "2",
        },
      ],
    },
    {
      LegSymbol: "MSFT",
      LegPrice: "200",
      LegQty: "20",
      Parties: [
        {
          PartyID: "ID3",
          PartyIDSource: "D",
          PartyRole: "3",
        },
      ],
    },
  ],
};
const nestedResult = fix.encode(nestedObj);
console.log(nestedResult);
assert.strictEqual(
  JSON.stringify(fix.decode(nestedResult)),
  JSON.stringify(nestedObj)
);
console.log("✓ Nested groups test passed");

// Test 3: Empty group
console.log("\nTest 3: Empty group message");
const emptyGroupObj = {
  BeginString: "MockFIX",
  BodyLength: "100",
  MsgType: "D",
};
const emptyGroupResult = fix.encode(emptyGroupObj);
assert.strictEqual(
  JSON.stringify(fix.decode(emptyGroupResult)),
  JSON.stringify(emptyGroupObj)
);
console.log("✓ Empty group test passed");

console.log("\nAll tests passed! ✓");
