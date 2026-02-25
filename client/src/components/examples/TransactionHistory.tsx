import TransactionHistory from '../TransactionHistory';

export default function TransactionHistoryExample() {
  const mockTransactions = [
    {
      id: 'TXN001',
      date: '2024-03-15',
      description: 'Direct Deposit - Payroll',
      type: 'credit' as const,
      amount: 4500.00,
      balance: 28930.50,
      accountNumber: '1234567890',
      status: 'completed' as const,
      category: 'Income'
    },
    {
      id: 'TXN002',
      date: '2024-03-14',
      description: 'Mortgage Payment',
      type: 'debit' as const,
      amount: 2200.00,
      balance: 24430.50,
      accountNumber: '1234567890',
      status: 'completed' as const,
      category: 'Housing'
    },
    {
      id: 'TXN003',
      date: '2024-03-13',
      description: 'Transfer to Savings',
      type: 'transfer' as const,
      amount: 1000.00,
      balance: 26630.50,
      accountNumber: '1234567890',
      status: 'completed' as const,
      category: 'Transfer'
    },
    {
      id: 'TXN004',
      date: '2024-03-12',
      description: 'Online Purchase - Amazon',
      type: 'debit' as const,
      amount: 89.99,
      balance: 27630.50,
      accountNumber: '1234567890',
      status: 'completed' as const,
      category: 'Shopping'
    },
    {
      id: 'TXN005',
      date: '2024-03-11',
      description: 'Gas Station',
      type: 'debit' as const,
      amount: 65.43,
      balance: 27720.49,
      accountNumber: '1234567890',
      status: 'completed' as const,
      category: 'Transportation'
    },
    {
      id: 'TXN006',
      date: '2024-03-10',
      description: 'Restaurant - Dinner',
      type: 'debit' as const,
      amount: 78.50,
      balance: 27785.92,
      accountNumber: '1234567890',
      status: 'pending' as const,
      category: 'Dining'
    }
  ];

  return (
    <TransactionHistory 
      transactions={mockTransactions}
      onViewTransaction={(transactionId) => console.log('View transaction:', transactionId)}
      onExport={() => console.log('Export transactions triggered')}
    />
  );
}