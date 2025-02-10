// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IPSYMM {
    function createCustody(bytes32 _ppm) external;
    function updatePPM(bytes32 _id, bytes32 _ppm, uint256 _timestamp) external;
    function addressToCustody(address sender, bytes32 _id, address _token, uint256 _amount, bytes memory signature) external;
    function addressToCustody(bytes32 _id, address _token, uint256 _amount) external;
    function custodyToAddress(address _target, uint256 _id, address _token, uint256 _amount) external;
    function custodyToCustody(bytes32 target, uint256 _id, address _token, uint256 _amount) external;
    function custodyToSMA(address _smaAddress, uint256 _id, address _token, uint256 _amount) external;
    function publishCustodyMsg(bytes memory _msg) external;
    function createDispute(bytes32 _id) external;
    function earlyAgreement() external;
    function instantWithdraw() external;
    function executeDisputeSettlement() external;
    function submitProvisional(bytes32 _id, bytes memory _calldata, bytes memory _msg) external;
    function revokeProvisional(bytes32 _id, bytes memory _calldata, bytes memory _msg) external;
    function discussProvisional(bytes32 _id, bytes memory _msg) external;
    function getBalance(bytes32 _id, address _token) external pure returns (uint256);
}
