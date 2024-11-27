const { shouldDeployPSymm } = require('./pSymm.deployment');
const { shouldDepositAndWithdrawCollateral } = require('./pSymm.collateral');
const { testCustodyRollupId } = require('./utils/custodyRollupId.test');

async function pSymmContractTest() {
  await shouldDeployPSymm();
  await shouldDepositAndWithdrawCollateral();
  await testCustodyRollupId();
}

module.exports = {
  pSymmContractTest
};
