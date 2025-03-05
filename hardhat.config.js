require("@nomicfoundation/hardhat-viem");
require("@nomicfoundation/hardhat-ignition-viem");

task("validator", "Run the validator")
  .addPositionalParam("walletId", "The wallet ID to use")
  .setAction(async (taskArgs, hre) => {
    // Force localhost network
    if (hre.network.name !== "localhost") {
      console.error("This task must be run on localhost network");
      process.exit(1);
    }
    const validatorTask = require("#root/apps/validator/SettleMaker/validator.task.js");
    await validatorTask([taskArgs.walletId], hre);
  });

task("read", "Read a contract function")
  .addPositionalParam("contractName", "The name of the contract")
  .addPositionalParam("functionName", "The name of the function to read")
  .addVariadicPositionalParam("args", "Function arguments", [])
  .setAction(async (taskArgs, hre) => {
    const readTask = require("#root/demo/utils/read.task.js");
    await readTask(
      [taskArgs.contractName, taskArgs.functionName, ...taskArgs.args],
      hre
    );
  });

task("write", "Write to a contract function")
  .addPositionalParam("walletId", "The wallet ID to use")
  .addPositionalParam("contractName", "The name of the contract")
  .addPositionalParam("functionName", "The name of the function to write")
  .addVariadicPositionalParam("args", "Function arguments", [])
  .setAction(async (taskArgs, hre) => {
    const writeTask = require("#root/demo/utils/write.task.js");
    await writeTask(
      [
        taskArgs.walletId,
        taskArgs.contractName,
        taskArgs.functionName,
        ...taskArgs.args,
      ],
      hre
    );
  });

task("addSymm", "Mint SYMM tokens to a wallet")
  .addPositionalParam("walletId", "The wallet ID to receive SYMM")
  .addOptionalPositionalParam(
    "amount",
    "Amount of SYMM to mint in ether units",
    "1000"
  )
  .setAction(async (taskArgs, hre) => {
    const addSymmTask = require("#root/demo/utils/addSymm.task.js");
    await addSymmTask([taskArgs.walletId, taskArgs.amount], hre);
  });

// To exclude files from compilation for debug purposes:
const {
  TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
} = require("hardhat/builtin-tasks/task-names");

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(
  async (_, __, runSuper) => {
    const paths = await runSuper();
    return paths.filter(
      // filter unfinished ETFMaker
      (p) => !p.includes("/ETFMaker/")
    );
    // return paths.filter((p) => p.includes("/NoirTest/"));
  }
);

const verifierConf = {
  version: "0.8.27",
  settings: {
    optimizer: {
      enabled: true,
      runs: 2000,
    },
  },
};

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.27",
        settings: {
          viaIR: true,
          optimizer: { enabled: false },
        },
      },
    ],
    overrides: {
      "contracts/src/NoirTest/NoirTest.sol": verifierConf,
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      port: 8545,
    },
  },
  paths: {
    sources: "./contracts/src/",
    tests: "./contracts/test/",
    cache: "./dist/hardhat/cache",
    artifacts: "./dist/hardhat/artifacts",
  },
  mocha: {
    timeout: 100000000,
  },
};
