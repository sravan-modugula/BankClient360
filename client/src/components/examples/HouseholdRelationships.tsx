import HouseholdRelationships from '../HouseholdRelationships';

export default function HouseholdRelationshipsExample() {
  const mockMembers = [
    {
      id: 'MEM001',
      name: 'John Smith',
      relationship: 'Head of Household',
      customerSince: '2018',
      totalAccounts: 4,
      totalBalance: 150430.50,
      isPrimary: true,
      age: 38
    },
    {
      id: 'MEM002',
      name: 'Sarah Smith',
      relationship: 'Spouse',
      customerSince: '2019',
      totalAccounts: 2,
      totalBalance: 45000.00,
      isPrimary: false,
      age: 35
    },
    {
      id: 'MEM003',
      name: 'Emma Smith',
      relationship: 'Child',
      customerSince: '2022',
      totalAccounts: 1,
      totalBalance: 2500.00,
      isPrimary: false,
      age: 16
    },
    {
      id: 'MEM004',
      name: 'Michael Smith',
      relationship: 'Child',
      totalAccounts: 1,
      totalBalance: 1800.00,
      isPrimary: false,
      age: 14
    }
  ];

  return (
    <HouseholdRelationships 
      householdName="The Smith Family"
      members={mockMembers}
      onViewMember={(memberId) => console.log('View member:', memberId)}
      onAddMember={() => console.log('Add member triggered')}
    />
  );
}