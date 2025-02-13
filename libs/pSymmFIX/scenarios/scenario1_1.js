const scenario10 = require("./scenario1_0.js");

const seq = { b: 8, a: 8 };

// ...same as Scenario 1.0 until 8b.
// 8b. A sends BRJ
//
brj = {
  StandardHeader: scenario10.makeStandardHeader("BRJ", true, seq),
  RefSeqNum: seq.b - 1,
  BusinessRejectReason: 123,
  Text: "Withdraw amount dispute",
  StandardTrailer: scenario10.makeStandardTrailer(true),
};

// 9. A logout
const logout = {
  StandardHeader: scenario10.makeStandardHeader("5", true, seq),
  StandardTrailer: scenario10.makeStandardTrailer(true),
};

/* end */
function main() {
  const all = [...scenario10.commonPart, brj, logout];

  console.log(JSON.stringify(all, null, 4));
}
if (require.main == module) main();
