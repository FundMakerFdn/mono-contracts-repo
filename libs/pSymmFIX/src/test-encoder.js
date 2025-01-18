const pSymmFIX = require("./index.js");
const assert = require("assert");

// Initialize FIX parser
const fix = new pSymmFIX("FIX.4.4");

// Test 1: Basic message without groups
console.log("\nTest 1: Basic message");
const basicObj = {
  BeginString: "FIX.4.4",
  BodyLength: "100",
  MsgType: "D"
};
const basicResult = fix.encode(basicObj);
assert.strictEqual(basicResult, "8=FIX.4.4|9=100|35=D");
console.log("✓ Basic message test passed");

// Test 2: Message with single group
console.log("\nTest 2: Single group message");
const groupObj = {
  BeginString: "FIX.4.4",
  LegGroup: [
    {
      LegSymbol: "AAPL",
      LegPrice: "100",
      LegQty: "10"
    },
    {
      LegSymbol: "MSFT", 
      LegPrice: "200",
      LegQty: "20"
    }
  ]
};
const groupResult = fix.encode(groupObj);
assert.strictEqual(groupResult, "8=FIX.4.4|555=2|600=AAPL|601=100|602=10|600=MSFT|601=200|602=20");
console.log("✓ Single group test passed");

// Test 3: Message with nested groups
console.log("\nTest 3: Nested groups message");
const nestedObj = {
  BeginString: "FIX.4.4",
  LegGroup: [
    {
      LegSymbol: "AAPL",
      LegPrice: "100",
      Parties: [
        {
          PartyID: "ID1",
          PartyIDSource: "D",
          PartyRole: "1"
        },
        {
          PartyID: "ID2",
          PartyIDSource: "D", 
          PartyRole: "2"
        }
      ]
    },
    {
      LegSymbol: "MSFT",
      LegPrice: "200",
      Parties: [
        {
          PartyID: "ID3",
          PartyIDSource: "D",
          PartyRole: "3"
        }
      ]
    }
  ]
};
const nestedResult = fix.encode(nestedObj);
assert.strictEqual(nestedResult, 
  "8=FIX.4.4|555=2|600=AAPL|601=100|453=2|448=ID1|447=D|452=1|448=ID2|447=D|452=2|600=MSFT|601=200|453=1|448=ID3|447=D|452=3"
);
console.log("✓ Nested groups test passed");

// Test 4: Empty group
console.log("\nTest 4: Empty group message");
const emptyGroupObj = {
  BeginString: "FIX.4.4",
  MsgType: "D",
  LegGroup: []
};
const emptyGroupResult = fix.encode(emptyGroupObj);
assert.strictEqual(emptyGroupResult, "8=FIX.4.4|35=D|555=0");
console.log("✓ Empty group test passed");

console.log("\nAll tests passed! ✓");
