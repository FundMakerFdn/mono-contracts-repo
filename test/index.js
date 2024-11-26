//const { shouldDeploySettleMaker } = require("./SettleMaker/SettleMaker.deployment");
const { shouldBehaveLikepSymm } = require("./pSymm/contract/index.js");
const { pSymmValidator } = require("./pSymm/validator/index.js");
const { shouldBehaveLikeSettleMaker } = require("./SettleMaker/index.js");


async function main() {

  await pSymmValidator();
  await shouldBehaveLikepSymm();
  await shouldBehaveLikeSettleMaker();
}

main();