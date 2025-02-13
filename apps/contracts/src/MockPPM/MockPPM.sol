// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../SettleMaker/interfaces/ISettlement.sol";
import "./Schnorr.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

using SafeERC20 for IERC20;

contract MockPPM is EIP712 {
	event PPMUpdated(bytes32 indexed id, bytes32 ppm, uint256 timestamp);

    mapping(bytes32 => bytes32) private custodys;
    mapping(bytes32 => mapping(address => uint256)) public custodyBalances; // custodyId => token address => balance
    mapping(bytes32 => mapping(address => bool)) public smaAllowance; // custodyId => deployed SMA address => isAllowed
    mapping(bytes32 => bool) private signatureClaimed;
    mapping(bytes32 => uint256) public lastSMAUpdateTimestamp; // custodyId => timestamp
    mapping(bytes32 => bytes32) private PPMs;
    mapping(bytes32 => uint8) private custodyState;
    // 1 PPM private key is shared inside PPM
    // 2 In case of dispute, we reveal PPM Pk that decode 
    mapping(bytes32 => mapping(uint256 => bytes)) public custodyMsg; // custodyId => token address => balance
    mapping(bytes32 => uint256) private custodyMsgLength;
    // SettleMaker
    mapping(bytes32 => ISettlement) private disputes; // custodyId => Dispute

    constructor() EIP712("MockPPM", "1.0") {}

    modifier checkCustodyState(bytes32 _id) {
        require(custodyState[_id] == 0, "State isn't 0");
        _;
    }
    function createCustody(bytes32 _ppm) external {
        require(_ppm == bytes32(0), "PPM already created");
        custodys[_ppm] = _ppm;
        // @TODO update state
        // @TODO event
    }
    function updatePPM(
        bytes32 _id,
        bytes32 _ppm,
        uint256 _timestamp,
        Schnorr.PublicKey calldata pubKey,
        Schnorr.Signature calldata sig,
        bytes32[] calldata merkleProof
    ) external checkCustodyState(_id) {
        // Verify timestamp
        require(_timestamp <= block.timestamp && _timestamp > lastSMAUpdateTimestamp[_id], "Signature expired");

        // Verify pubkey is whitelisted in current PPM
        bytes32 leaf = keccak256(abi.encode(
			0, "pubKey", block.chainid,
           address(this),
           abi.encode(pubKey.parity, pubKey.x)
        ));
        require(MerkleProof.verify(merkleProof, PPMs[_id], leaf), "Invalid merkle proof");

        // Verify signature
        bytes32 message = keccak256(abi.encode(
            _timestamp,
            "updatePPM",
            _id,
            _ppm
        ));
        require(Schnorr.verify(pubKey, message, sig), "Invalid signature");

        // Update state
        PPMs[_id] = _ppm;
        lastSMAUpdateTimestamp[_id] = _timestamp;

        emit PPMUpdated(_id, _ppm, _timestamp);
    }
}
