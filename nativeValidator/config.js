// Everything is in seconds
module.exports = {
  settlementDelay: 31, // should be > duration(settlement + voting) / i.e. far enough
  settlementDuration: 10,
  votingDuration: 10,
  mineInterval: 5, // How often to mine new blocks (in seconds)
};
