const assert = require("node:assert/strict");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox-viem/network-helpers");
const { keccak256, toHex } = require("viem");
const hre = require("hardhat");
const { shouldInsert } = require("./insert.test");
const { shouldCustodyToAddress } = require("./custodyToAddress.test");

//shouldInsert();
shouldCustodyToAddress();

