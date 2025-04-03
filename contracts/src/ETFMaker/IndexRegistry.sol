// ETF.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IndexRegistry
/// @notice This contract is used to store the index data for each index to be compatible with cross-chain deployed indexes
contract IndexRegistry {    
    struct IndexDatas {
        string name;
        string ticker;
        address curator;
        uint256 lastPrice;
        uint256 lastWeightUpdateTimestamp;
        uint256 lastPriceUpdateTimestamp;
        uint256 curatorFee;//hi
    }

    mapping(uint256 => mapping(uint256 => bytes)) public curatorWeights; // timestamp => weights // pct
    mapping(uint256 => mapping(uint256 => uint256)) public curatorPrice; // timestamp => price
    mapping(address => mapping(uint256 => mapping(uint256 => bytes))) public solverWeights; // solver => timestamp => weights // qty
    mapping(address => mapping(uint256 => mapping(uint256 => uint256))) public solverPrice; // solver => index => timestamp => price
    mapping(uint256 => IndexDatas) public indexDatas;
    uint256 public indexDatasCount;

    modifier onlyCurator(uint256 indexId) {
        require(msg.sender == indexDatas[indexId].curator, "Only curator allowed");
        _;
    }

    event IndexDatasSet(uint256 indexed indexId, string name, string ticker, address curator);
    event CuratorWeightsSet(uint256 indexed indexId, uint256 timestamp, bytes weights, uint256 price);
    event SolverWeightsSet(uint256 indexed indexId, address indexed solver, uint256 timestamp, bytes weights, uint256 price);
    event CuratorUpgraded(uint256 indexed indexId, address oldCurator, address newCurator);

    // Set index data (initial setup)
    function registerIndex( string memory _name, string memory _ticker, uint256 _curatorFee) public {
        indexDatasCount++;
        IndexDatas storage indexData = indexDatas[indexDatasCount];
        indexData.name = _name;
        indexData.ticker = _ticker;
        indexData.curator = msg.sender;
        indexData.curatorFee = _curatorFee;
        emit IndexDatasSet(indexDatasCount, _name, _ticker, msg.sender);
    }

    // Set curator weights and price
    function setCuratorWeights(
        uint256 indexId, 
        uint256 timestamp, 
        bytes memory weights,
        uint256 price
    ) public onlyCurator(indexId) {
        curatorWeights[indexId][timestamp] = weights;
        curatorPrice[indexId][timestamp] = price;
        indexDatas[indexId].lastWeightUpdateTimestamp = timestamp;
        indexDatas[indexId].lastPrice = price;
        indexDatas[indexId].lastPriceUpdateTimestamp = timestamp;
        emit CuratorWeightsSet(indexId, timestamp, weights, price);
    }

    // Set solver weights and price (open to anyone, using msg.sender)
    function setSolverWeights(
        uint256 indexId, 
        uint256 timestamp, 
        bytes memory weights,
        uint256 price
    ) public {
        solverWeights[msg.sender][indexId][timestamp] = weights;
        solverPrice[msg.sender][indexId][timestamp] = price;
        emit SolverWeightsSet(indexId, msg.sender, timestamp, weights, price);
    }

    // Upgrade curator
    function upgradeCurator(uint256 indexId, address newCurator) 
        public 
        onlyCurator(indexId) 
    {
        require(newCurator != address(0), "Invalid curator address");
        address oldCurator = indexDatas[indexId].curator;
        indexDatas[indexId].curator = newCurator;
        emit CuratorUpgraded(indexId, oldCurator, newCurator);
    }

    // Get index data
    function getIndexDatas(uint256 indexId) public view returns (
        string memory name,
        string memory ticker,
        address curator,
        uint256 lastPrice,
        uint256 lastWeightUpdateTimestamp,
        uint256 lastPriceUpdateTimestamp,
        uint256 curatorFee
    ) {
        IndexDatas memory data = indexDatas[indexId];
        return (
            data.name,
            data.ticker,
            data.curator,
            data.lastPrice,
            data.lastWeightUpdateTimestamp,
            data.lastPriceUpdateTimestamp,
            data.curatorFee
        );
    }

    // Merged get function for all prices and weights
    function getData(
        uint256 indexId,
        uint256 timestamp,
        address solverAddress
    ) public view returns (
        bytes memory curatorWeightsData,
        uint256 curatorPriceData,
        bytes memory solverWeightsData,
        uint256 solverPriceData
    ) {
        return (
            curatorWeights[indexId][timestamp],
            curatorPrice[indexId][timestamp],
            solverWeights[solverAddress][indexId][timestamp],
            solverPrice[solverAddress][indexId][timestamp]
        );
    }

    // Get last price
    function getLastPrice(uint256 indexId) public view returns (uint256) {
        return indexDatas[indexId].lastPrice;
    }
}