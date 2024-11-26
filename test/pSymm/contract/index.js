const { shouldDeployPSymm } = require('./pSymm.deployment');
const { shouldDepositAndWithdrawCollateral } = require('./pSymm.collateral');

async function shouldBehaveLikepSymm() {
  await shouldDeployPSymm();
  await shouldDepositAndWithdrawCollateral();
}

module.exports = {
  shouldBehaveLikepSymm
};
