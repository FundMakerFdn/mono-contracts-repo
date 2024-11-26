// Basic deposit, open, close, withdraw scenario

// init custodyRollup
// A deposit 1000 USDC
// B deposit 1000 USDC
// A send rfq/swap/open
// B fill rfqFill/swap/open
// A send quote/swap/open
// B fill quoteFill/swap/open (fill 50% )
// A send quote/swap/cancel
// B withdraw
// A send rfq/swap/close
// B fill rfqFill/swap/close
// A send quote/swap/close
// B fill quoteFill/swap/close
// B withdraw
// A withdraw

