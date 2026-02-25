import AccountSummary from '../AccountSummary';

export default function AccountSummaryExample() {
  const mockAccounts = [
    {
      id: 'ACC001',
      accountNumber: '1234567890',
      accountType: 'Checking',
      productName: 'Premier Checking',
      balance: 25430.50,
      availableBalance: 25430.50,
      status: 'active',
      openDate: '2020-03-15',
      interestRate: 0.05
    },
    {
      id: 'ACC002',
      accountNumber: '1234567891',
      accountType: 'Savings',
      productName: 'High Yield Savings',
      balance: 125000.00,
      availableBalance: 125000.00,
      status: 'active',
      openDate: '2018-06-20',
      interestRate: 2.25
    },
    {
      id: 'ACC003',
      accountNumber: '1234567892',
      accountType: 'Credit',
      productName: 'Platinum Credit Card',
      balance: -2350.75,
      availableBalance: 12649.25,
      status: 'active',
      openDate: '2019-11-10'
    }
  ];

  return (
    <AccountSummary 
      accounts={mockAccounts}
      onViewAccount={(accountId) => console.log('View account:', accountId)}
    />
  );
}