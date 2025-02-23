const { expect } = require("chai");
const { ethers } = require("hardhat");

const secp256k1 = require("secp256k1");

const arrayify = ethers.utils.arrayify;

function challenge(R, m, publicKey) {
  // convert R to address
  // see https://github.com/ethereum/go-ethereum/blob/eb948962704397bb861fd4c0591b5056456edd4d/crypto/crypto.go#L275
  var R_uncomp = secp256k1.publicKeyConvert(R, false);
  var R_addr = arrayify(ethers.utils.keccak256(R_uncomp.slice(1, 65))).slice(
    12,
    32
  );

  // e = keccak256(address(R) || compressed publicKey || m)
  var e = arrayify(
    ethers.utils.solidityKeccak256(
      ["address", "uint8", "bytes32", "bytes32"],
      [R_addr, publicKey[0] + 27 - 2, publicKey.slice(1, 33), m]
    )
  );

  return e;
}
const publicKey = arrayify(
  "0x02740ebacb7a00b0c7b22aea629d2d74bf4b4c59ae37121c4efcb52d81430db5f4"
);

const message = arrayify(
  "0xba237fc01888d45db054e8a251920b50d6e2655f84023948f720960f47b954aa"
);

const sig = {
  s: arrayify(
    "0x0cf8fb8f362144532f3de305c07dbf04c654ede665d3403a0f06f22deeb49da6"
  ),
  challenge: arrayify(
    "0x4c7c0549e542ba4c929937f5d558eaaeccfbcfcdcb64a611d36e4bda6fb36bbd"
  ),
};

describe("Schnorr", function () {
  it("Should verify example signature", async function () {
    const Schnorr = await ethers.getContractFactory("Schnorr");
    const schnorr = await Schnorr.deploy();
    await schnorr.deployed();

    let gas = await schnorr.estimateGas.verify(
      publicKey[0] - 2 + 27,
      publicKey.slice(1, 33),
      message,
      sig.challenge,
      sig.s
    );
    console.log("verify gas cost:", gas);

    expect(
      await schnorr.verify(
        publicKey[0] - 2 + 27,
        publicKey.slice(1, 33),
        message,
        sig.challenge,
        sig.s
      )
    ).to.equal(true);
  });
});
