import CustomerOverview from '../CustomerOverview';

export default function CustomerOverviewExample() {
  const mockCustomer = {
    id: 'CID123456',
    name: 'John Smith',
    taxId: '123456789',
    dateOfBirth: 'March 15, 1985',
    customerSince: 'January 2018',
    customerType: 'individual',
    status: 'active',
    riskRating: 'low',
    primaryEmail: 'john.smith@email.com',
    primaryPhone: '(555) 123-4567',
    address: '123 Main Street, Anytown, ST 12345',
    relationshipManager: 'Sarah Wilson',
    cifNumber: 'CIF123456'
  };

  return (
    <CustomerOverview 
      customer={mockCustomer}
      onEdit={() => console.log('Edit customer triggered')}
    />
  );
}