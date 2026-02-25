import CustomerSearch from '../CustomerSearch';

export default function CustomerSearchExample() {
  return (
    <CustomerSearch 
      onCustomerSelect={(customer) => console.log('Selected customer:', customer)}
    />
  );
}