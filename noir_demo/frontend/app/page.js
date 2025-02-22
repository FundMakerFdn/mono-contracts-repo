'use client'
import { useState, useEffect } from 'react';
import { createPublicClient, http, createWalletClient, custom } from 'viem';
import { hardhat } from 'viem/chains';

export default function Home() {
  const [isDeposited, setIsDeposited] = useState(false);
  const [positions, setPositions] = useState([]);
  const [orderPrice, setOrderPrice] = useState('');
  const [orderQuantity, setOrderQuantity] = useState('');
  const [amount, setAmount] = useState(1000000000000000000);

  const handleDeposit = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask');
        return;
      }

      // Setup clients
      const publicClient = createPublicClient({
        chain: hardhat,
        transport: custom(window.ethereum)
      });

      const walletClient = createWalletClient({
        chain: hardhat,
        transport: custom(window.ethereum)
      });

      const [account] = await walletClient.requestAddresses();

      console.log(account)

      const approveData = {
        address: MOCK_TOKEN_ADDRESS,
        abi: MockTokenAbi,
        functionName: 'approve',
        args: [MOCK_DEPOSIT_ADDRESS, amount],
        account
      };

      const approveTx = await walletClient.writeContract(approveData);

      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      const depositData = {
        address: MOCK_DEPOSIT_ADDRESS,
        abi: MockDepositAbi,
        functionName: 'deposit',
        args: [amount],
        account
      };
  
      const depositTx = await walletClient.writeContract(depositData);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: depositTx });

      console.log('Deposit successful!', receipt);
      
      setIsDeposited(true);
      alert('Deposit successful!');
    } catch (error) {
      console.error('Deposit error:', error);
      alert('Deposit failed');
    }
  };

  const handleBuy = async () => {
    if (!isDeposited) {
      alert('Please deposit first');
      return;
    }

    if (!orderPrice || !orderQuantity) {
      alert('Please enter price and quantity');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/partyA/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          price: orderPrice,
          quantity: orderQuantity
        })
      });
      const data = await response.json();
      alert('Buy order sent!');
    } catch (error) {
      console.error('Buy error:', error);
      alert('Buy failed');
    }
  };

  // Fetch positions periodically
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/partyA/position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        setPositions(data.positions);
      } catch (error) {
        console.error('Error fetching positions:', error);
      }
    };

    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-xl font-medium mb-4">Trading Interface</h2>
        <div className="space-y-4">
          <div>
            <button 
              onClick={handleDeposit}
              disabled={isDeposited}
              className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 disabled:bg-gray-400"
            >
              Deposit
            </button>
          </div>
          <div className="flex gap-2 items-start">
            <input
              type="text"
              placeholder="Price"
              value={orderPrice}
              onChange={(e) => setOrderPrice(e.target.value)}
              className="border rounded p-2 w-32"
            />
            <input
              type="text"
              placeholder="Quantity"
              value={orderQuantity}
              onChange={(e) => setOrderQuantity(e.target.value)}
              className="border rounded p-2 w-32"
            />
            <button
              onClick={handleBuy}
              disabled={!isDeposited}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 disabled:bg-gray-300"
            >
              Buy
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-medium mb-4">Open Positions</h2>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4">Order ID</th>
                <th className="text-left p-4">Side</th>
                <th className="text-left p-4">Quantity</th>
                <th className="text-left p-4">Price</th>
                <th className="text-left p-4">Last Price</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={position.OrderID} className="border-t">
                  <td className="p-4">{position.OrderID}</td>
                  <td className="p-4">{position.Side === '1' ? 'Buy' : 'Sell'}</td>
                  <td className="p-4">{position.CumQty}</td>
                  <td className="p-4">{position.Price}</td>
                  <td className="p-4">{position.LastPx}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}