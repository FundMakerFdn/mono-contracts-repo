// Everything is in seconds
module.exports = {
  mineInterval: 5, // How often to mine new blocks (in seconds)
  settleMaker: {
    // currently we use a function to generate aligned timestamps
    settlementDelay: 31, // should be > duration(settlement + voting) / i.e. far enough
    settlementDuration: 10,
    votingDuration: 10,
  },
  contractsTempFile: "contracts.tmp.txt",
};
