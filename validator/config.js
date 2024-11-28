// Everything is in seconds
module.exports = {
  mineInterval: 5, // How often to mine new blocks (in seconds)
  settleMaker: {
    settlementDelay: 31, // should be > duration(settlement + voting) / i.e. far enough
    settlementDuration: 10,
    votingDuration: 10,
  }
};
