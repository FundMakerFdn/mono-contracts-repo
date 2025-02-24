// ATC
// note amount and token check
fn main(
    nullifier: [u8; 32],
    secret_nonce: [u8; 32],
    custody_id: [u8; 32],
    amount: pub [u8; 32],
    token: pub [u8; 32],
    commitment: pub [u8; 32]
) {
    // Verify note commitment
	// we use pub values, therefore it also checks that commitment includes valid amount and token

	// Concatenate
    let mut acc: [u8; 160] = [0; 160]; // 32 * 5 = 160 bytes
    for i in 0..32 {
        acc[i] = nullifier[i];
        acc[i + 32] = amount[i];
        acc[i + 64] = token[i];
        acc[i + 96] = custody_id[i];
        acc[i + 128] = secret_nonce[i];
    }
    // Hash the concatenated array
    let computed_commitment = std::hash::keccak256(acc, acc.len());
    assert(commitment == computed_commitment);
}

