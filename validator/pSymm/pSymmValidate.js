async function pSymmValidate(pSymmContract, settlementId) {
  console.log("Validating pSymm settlement", settlementId);
  const data = await pSymmContract.read.getSettlementData([settlementId]);
  console.log(data);
  return true;
}
module.exports = pSymmValidate;
