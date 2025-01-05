const { shouldDeployPSymm } = require('./pSymm.deployment');
const { shouldDepositAndWithdrawCollateral } = require('./pSymm.collateral');
const { shouldInitAndTransferRollup } = require('./pSymm.custody');
const { shouldOpenSettlement } = require('./pSymm.settlement');
const { shouldExecuteEarlyAgreement } = require('./pSymm.settlement.earlyAgreement');
const { shouldExecuteInstantWithdraw } = require('./pSymm.settlement.instantWithdraw');

async function pSymmContractTest() {
  await shouldDeployPSymm();
  await shouldDepositAndWithdrawCollateral();
  await shouldInitAndTransferRollup();
  await shouldOpenSettlement();
  await shouldExecuteEarlyAgreement();
  await shouldExecuteInstantWithdraw();
}

module.exports = {
  pSymmContractTest
};
