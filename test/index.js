//const { shouldDeploySettleMaker } = require("./SettleMaker/SettleMaker.deployment");
const { pSymmContractTest } = require("./pSymm/contract/index.js");
const { pSymmValidatorTest } = require("./pSymm/validator/index.js");
const { shouldBehaveLikeSettleMaker } = require("./SettleMaker/index.js");

async function main() {
  await pSymmValidatorTest();
  await pSymmContractTest();
  await shouldBehaveLikeSettleMaker();
}

main();