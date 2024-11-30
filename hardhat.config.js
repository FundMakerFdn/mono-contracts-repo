require("@nomicfoundation/hardhat-viem");
require("@nomicfoundation/hardhat-ignition-viem");

task("validator", "Run the validator")
  .addParam("walletId", "The wallet ID to use")
  .setAction(async (taskArgs, hre) => {
    // Force localhost network
    if (hre.network.name !== "localhost") {
      console.error("This task must be run on localhost network");
      process.exit(1);
    }
    const validatorTask = require("./validator/SettleMaker/validator.task.js");
    await validatorTask(taskArgs, hre);
  });

// To exclude files from compilation for debug purposes:
// const {
//   TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
// } = require("hardhat/builtin-tasks/task-names");

// subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(
//   async (_, __, runSuper) => {
//     const paths = await runSuper();
//     return paths.filter((p) => !p.includes("/pSymm/"));
//   }
// );

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.27",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
};
