import ContactInformation from '../ContactInformation';

export default function ContactInformationExample() {
  const mockContacts = [
    {
      id: 'CONT001',
      type: 'phone' as const,
      subtype: 'mobile',
      value: '(555) 123-4567',
      isPrimary: true,
      purpose: 'primary'
    },
    {
      id: 'CONT002',
      type: 'phone' as const,
      subtype: 'home',
      value: '(555) 987-6543',
      isPrimary: false,
      purpose: 'secondary'
    },
    {
      id: 'CONT003',
      type: 'email' as const,
      subtype: 'personal',
      value: 'john.smith@email.com',
      isPrimary: true,
      purpose: 'primary'
    },
    {
      id: 'CONT004',
      type: 'email' as const,
      subtype: 'work',
      value: 'john.smith@company.com',
      isPrimary: false,
      purpose: 'business'
    },
    {
      id: 'CONT005',
      type: 'address' as const,
      subtype: 'home',
      value: '123 Main Street\nAnytown, ST 12345\nUnited States',
      isPrimary: true,
      purpose: 'primary'
    }
  ];

  return (
    <ContactInformation 
      contacts={mockContacts}
      onEditContact={(contactId) => console.log('Edit contact:', contactId)}
      onDeleteContact={(contactId) => console.log('Delete contact:', contactId)}
      onAddContact={(contact) => console.log('Add contact:', contact)}
    />
  );
}