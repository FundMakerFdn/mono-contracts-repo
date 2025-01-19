const pSymmFIX = require("./index.js");
const assert = require("assert");

// Initialize FIX parser
const fix = new pSymmFIX("FIX.4.4");

// Test 1: Valid basic NewOrderSingle message
console.log("\nTest 1: Valid basic message");
const validBasic = {
  BeginString: "FIX.4.4",
  BodyLength: "100",
  MsgType: "D",
  LegGroup: [], // Required group but empty is ok
};
assert.strictEqual(fix.validateObj(validBasic), true);
console.log("✓ Valid basic message test passed");

// Test 2: Missing required field
console.log("\nTest 2: Missing required field");
const missingRequired = {
  BeginString: "FIX.4.4",
  BodyLength: "100",
  // Missing MsgType
};
assert.strictEqual(fix.validateObj(missingRequired), false);
console.log("✓ Missing required field test passed");

// Test 3: Valid message with populated groups
console.log("\nTest 3: Valid message with groups");
const validGroups = {
  BeginString: "FIX.4.4",
  BodyLength: "100",
  MsgType: "D",
  LegGroup: [
    {
      LegSymbol: "AAPL",
      LegPrice: "100",
      LegQty: "10",
    },
  ],
};
assert.strictEqual(fix.validateObj(validGroups), true);
console.log("✓ Valid groups test passed");

// Test 4: Invalid group structure (missing required group field)
console.log("\nTest 4: Invalid group structure");
const invalidGroup = {
  BeginString: "FIX.4.4",
  BodyLength: "100",
  MsgType: "D",
  LegGroup: [
    {
      LegSymbol: "AAPL",
      // Missing required LegPrice
      LegQty: "10",
    },
  ],
};
assert.strictEqual(fix.validateObj(invalidGroup), false);
console.log("✓ Invalid group structure test passed");

// Test 5: Valid nested groups
console.log("\nTest 5: Valid nested groups");
const validNested = {
  BeginString: "FIX.4.4",
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
assert.strictEqual(fix.validateObj(validNested), true);
console.log("✓ Valid nested groups test passed");

// Test 6: Invalid nested group (missing required nested group field)
console.log("\nTest 6: Invalid nested groups");
const invalidNested = {
  BeginString: "FIX.4.4",
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
          // Missing required PartyIDSource
          PartyRole: "1",
        },
      ],
    },
  ],
};
assert.strictEqual(fix.validateObj(invalidNested), false);
console.log("✓ Invalid nested groups test passed");

console.log("\nAll validation tests passed! ✓");
