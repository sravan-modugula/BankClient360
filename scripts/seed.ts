import { faker } from '@faker-js/faker';
import { db } from '../server/db';
import {
  branch, customer, contactInfo, address, household, account, employee,
  entityAddress, entityContact, householdMembership, accountOwnership,
  debitCardLimitProfile, debitCard,
  privilegeLevel, role, permission, rolePermission, employeeRole
} from '../shared/schema';
import { sql } from 'drizzle-orm';

// Set deterministic seed for reproducible data
faker.seed(12345);

const ACCOUNT_TYPES = ['checking', 'savings', 'loan', 'credit_card', 'cd', 'money_market'];
const ACCOUNT_STATUSES = ['active', 'inactive', 'closed'];
const CONTACT_TYPES = ['phone', 'email', 'fax'];
const ADDRESS_TYPES = ['home', 'business', 'mailing'];
const RELATIONSHIP_ROLES = ['head_of_household', 'spouse', 'child', 'parent', 'other'];

console.log('🏦 Starting banking test data generation...');

async function generateBranches() {
  console.log('📍 Generating branches...');
  
  const branches: (typeof branch.$inferInsert)[] = [];
  for (let i = 0; i < 8; i++) {
    branches.push({
      branchName: faker.company.name() + ' Branch',
      branchCode: faker.string.alphanumeric(6).toUpperCase(),
      branchType: faker.helpers.arrayElement(['full_service', 'limited_service', 'drive_through']),
      streetAddress: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      zipCode: faker.location.zipCode(),
      phoneNumber: faker.phone.number(),
      managerName: faker.person.fullName(),
      openDate: faker.date.past({ years: 10 }).toISOString().split('T')[0],
      isActive: true,
      region: faker.helpers.arrayElement(['North', 'South', 'East', 'West', 'Central']),
      timezone: faker.helpers.arrayElement(['EST', 'CST', 'MST', 'PST'])
    });
  }
  
  await db.insert(branch).values(branches);
  console.log(`✅ Generated ${branches.length} branches`);
}

async function generateEmployees() {
  console.log('👥 Generating employees...');
  
  const branchIds = await db.select({ branchId: branch.branchId }).from(branch);
  const employees: (typeof employee.$inferInsert)[] = [];
  
  // Hardcode employee #1 as Sarah Johnson (System Admin) — matches dev mock in server/index.ts
  employees.push({
    employeeNumber: 'SYSADM01',
    firstName: 'Sarah',
    lastName: 'Johnson',
    jobTitle: 'System Admin',
    department: 'Operations',
    email: 'sarah.johnson@bank.com',
    phoneNumber: faker.phone.number(),
    hireDate: faker.date.past({ years: 8 }),
    branchId: branchIds[0].branchId,
    isActive: true,
    managerEmployeeId: null,
    salary: 120000,
    lastReviewDate: faker.date.recent({ days: 365 })
  });

  for (const { branchId } of branchIds) {
    const employeeCount = faker.number.int({ min: 15, max: 35 });

    for (let i = 0; i < employeeCount; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();

      employees.push({
        employeeNumber: faker.string.alphanumeric(8).toUpperCase(),
        firstName,
        lastName,
        jobTitle: faker.helpers.arrayElement([
          'Branch Manager', 'Assistant Manager', 'Loan Officer', 'Teller',
          'Customer Service Rep', 'Business Banker', 'Risk Analyst', 'Compliance Officer'
        ]),
        department: faker.helpers.arrayElement(['Operations', 'Lending', 'Customer Service', 'Risk Management']),
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@bank.com`,
        phoneNumber: faker.phone.number(),
        hireDate: faker.date.past({ years: 8 }),
        branchId,
        isActive: faker.datatype.boolean({ probability: 0.95 }),
        managerEmployeeId: null,
        salary: faker.number.float({ min: 35000, max: 120000, fractionDigits: 2 }),
        lastReviewDate: faker.date.recent({ days: 365 })
      });
    }
  }
  
  await db.insert(employee).values(employees);
  console.log(`✅ Generated ${employees.length} employees across ${branchIds.length} branches`);
}

async function seedRBAC() {
  console.log('🔐 Seeding RBAC tables (privilege levels, roles, permissions)...');

  // Step 1: Privilege levels
  await db.insert(privilegeLevel).values([
    { level: 0, levelName: 'Read-Only',     description: 'Minimal access. View-only on permitted resources.' },
    { level: 1, levelName: 'Staff',         description: 'Basic customer and account operations. No admin access.' },
    { level: 2, levelName: 'Manager',       description: 'Team management. Standard operational access.' },
    { level: 3, levelName: 'Senior/Branch', description: 'Can view employee customer records. Most operational access.' },
    { level: 4, levelName: 'System Admin',  description: 'Everything. User/role management, SAML config, all data.' }
  ]);
  console.log('  ✅ 5 privilege levels');

  // Step 2: Roles
  const insertedRoles = await db.insert(role).values([
    { roleName: 'System Admin',         privilegeLevel: 4, description: 'Full system access. Manages users, roles, SAML mappings.',    isSystemRole: true, isActive: true },
    { roleName: 'Branch Manager',       privilegeLevel: 3, description: 'Branch-level authority. Can view employee customer data.',     isSystemRole: true, isActive: true },
    { roleName: 'Assistant Manager',    privilegeLevel: 2, description: 'Team management. Limited user management.',                    isSystemRole: true, isActive: true },
    { roleName: 'Loan Officer',         privilegeLevel: 2, description: 'Lending operations. Account and customer access.',             isSystemRole: true, isActive: true },
    { roleName: 'Business Banker',      privilegeLevel: 2, description: 'Business relationship management.',                            isSystemRole: true, isActive: true },
    { roleName: 'Teller',               privilegeLevel: 1, description: 'Day-to-day customer and account operations.',                  isSystemRole: true, isActive: true },
    { roleName: 'Customer Service Rep', privilegeLevel: 1, description: 'Basic customer lookup and service.',                           isSystemRole: true, isActive: true },
    { roleName: 'Risk Analyst',         privilegeLevel: 1, description: 'Risk monitoring and review.',                                  isSystemRole: true, isActive: true },
    { roleName: 'Compliance Officer',   privilegeLevel: 1, description: 'Compliance monitoring.',                                       isSystemRole: true, isActive: true }
  ]).returning({ roleId: role.roleId, roleName: role.roleName });
  console.log(`  ✅ ${insertedRoles.length} roles`);

  const roleMap = new Map(insertedRoles.map(r => [r.roleName, r.roleId]));

  // Step 3: Permissions
  const insertedPerms = await db.insert(permission).values([
    { permissionCode: 'accounts.view',                      resource: 'accounts',        action: 'view',                    description: 'View customer accounts and details',            minPrivilegeLevel: 2, isAttributeBased: false, isActive: true },
    { permissionCode: 'account.view.balances',              resource: 'account',         action: 'view.balances',           description: 'View balance and interest rate columns',         minPrivilegeLevel: 2, isAttributeBased: false, isActive: true },
    { permissionCode: 'transaction.view',                   resource: 'transaction',     action: 'view',                    description: 'View transaction history',                       minPrivilegeLevel: 2, isAttributeBased: true,  isActive: true, attributeConfig: {
      conditions: [{
        attribute: 'customer.isEmployee',
        operator: 'equals',
        value: true,
        denyIfMatch: true,
        minPrivilegeOverride: 3,
        reason: 'Employee customer records require Level 3+ access'
      }]
    }},
    { permissionCode: 'customer.view.relationship_summary', resource: 'customer',        action: 'view.relationship_summary', description: 'View relationship summary card',             minPrivilegeLevel: 1, isAttributeBased: false, isActive: true },
    { permissionCode: 'customer.view.recent_activity',      resource: 'customer',        action: 'view.recent_activity',      description: 'View recent activity card',                   minPrivilegeLevel: 1, isAttributeBased: false, isActive: true },
    { permissionCode: 'customer.view.deposits',             resource: 'customer',        action: 'view.deposits',             description: 'View deposits section',                       minPrivilegeLevel: 1, isAttributeBased: false, isActive: true },
    { permissionCode: 'household.view',                     resource: 'household',       action: 'view',                    description: 'View household tab and relationships',           minPrivilegeLevel: 2, isAttributeBased: false, isActive: true },
    { permissionCode: 'users.view',                         resource: 'users',           action: 'view',                    description: 'View user list, details, and roles list',        minPrivilegeLevel: 3, isAttributeBased: false, isActive: true },
    { permissionCode: 'users.assign_roles',                 resource: 'users',           action: 'assign_roles',            description: 'Assign or remove roles from users',              minPrivilegeLevel: 4, isAttributeBased: false, isActive: true },
    { permissionCode: 'user_management.view',               resource: 'user_management', action: 'view',                    description: 'View SAML role mappings',                        minPrivilegeLevel: 4, isAttributeBased: false, isActive: true },
    { permissionCode: 'user_management.assign_roles',       resource: 'user_management', action: 'assign_roles',            description: 'Create, update, delete SAML role mappings',      minPrivilegeLevel: 4, isAttributeBased: false, isActive: true }
  ]).returning({ permissionId: permission.permissionId, permissionCode: permission.permissionCode });
  console.log(`  ✅ ${insertedPerms.length} permissions`);

  const permMap = new Map(insertedPerms.map(p => [p.permissionCode, p.permissionId]));

  // Step 4: Role-permission grants for Level 1 roles
  // Level 2+ already inherit via min_privilege_level on permissions
  const level1Grants: { roleId: number; permissionId: number }[] = [];

  // Teller + CSR get all customer/account permissions
  const tellerCsrPerms = [
    'accounts.view', 'account.view.balances', 'transaction.view',
    'customer.view.relationship_summary', 'customer.view.recent_activity',
    'customer.view.deposits', 'household.view'
  ];
  for (const roleName of ['Teller', 'Customer Service Rep']) {
    for (const permCode of tellerCsrPerms) {
      level1Grants.push({ roleId: roleMap.get(roleName)!, permissionId: permMap.get(permCode)! });
    }
  }

  // Risk Analyst + Compliance Officer get read-only account access
  const analystPerms = [
    'accounts.view', 'account.view.balances',
    'customer.view.relationship_summary', 'customer.view.recent_activity',
    'customer.view.deposits', 'household.view'
  ];
  for (const roleName of ['Risk Analyst', 'Compliance Officer']) {
    for (const permCode of analystPerms) {
      level1Grants.push({ roleId: roleMap.get(roleName)!, permissionId: permMap.get(permCode)! });
    }
  }

  await db.insert(rolePermission).values(level1Grants);
  console.log(`  ✅ ${level1Grants.length} role-permission grants`);

  // Step 5: Assign roles to employees
  const allEmployees = await db.select({
    employeeId: employee.employeeId,
    isActive: employee.isActive
  }).from(employee);

  const roleAssignments: (typeof employeeRole.$inferInsert)[] = [];

  // Distribute roles: employee_id=1 is System Admin (Sarah Johnson),
  // then spread remaining across roles using a realistic distribution
  const roleDistribution = [
    { name: 'Branch Manager',       weight: 0.08 },
    { name: 'Assistant Manager',    weight: 0.08 },
    { name: 'Loan Officer',         weight: 0.10 },
    { name: 'Business Banker',      weight: 0.08 },
    { name: 'Teller',               weight: 0.30 },
    { name: 'Customer Service Rep', weight: 0.20 },
    { name: 'Risk Analyst',         weight: 0.08 },
    { name: 'Compliance Officer',   weight: 0.08 }
  ];

  for (const emp of allEmployees) {
    if (!emp.isActive) continue;

    let assignedRoleId: number;

    if (emp.employeeId === 1) {
      // Sarah Johnson — System Admin
      assignedRoleId = roleMap.get('System Admin')!;
    } else {
      // Weighted random role assignment
      const roll = faker.number.float({ min: 0, max: 1 });
      let cumulative = 0;
      let roleName = 'Teller'; // default fallback
      for (const { name, weight } of roleDistribution) {
        cumulative += weight;
        if (roll < cumulative) {
          roleName = name;
          break;
        }
      }
      assignedRoleId = roleMap.get(roleName)!;
    }

    roleAssignments.push({
      employeeId: emp.employeeId,
      roleId: assignedRoleId,
      isPrimary: true,
      assignedDate: new Date(),
      effectiveDate: new Date().toISOString().split('T')[0],
      expirationDate: null,
      isActive: true,
      notes: 'Assigned by seed script'
    });
  }

  await db.insert(employeeRole).values(roleAssignments);
  console.log(`  ✅ ${roleAssignments.length} employee-role assignments`);
  console.log('🔐 RBAC seeding complete');
}

async function generatePersons() {
  console.log('👤 Generating persons/customers...');
  
  const branchIds = await db.select({ branchId: branch.branchId }).from(branch);
  const persons: (typeof customer.$inferInsert)[] = [];
  
  for (let i = 0; i < 1200; i++) {
    const customerType = faker.helpers.arrayElement(['individual', 'business', 'trust', 'estate']);
    const birthDate = faker.date.birthdate({ min: 18, max: 85, mode: 'age' });
    
    // Polymorphic customer data: individual vs business/trust
    let customerData: any = {
      taxIdentifier: faker.string.numeric(9), // SSN or EIN
      governmentId: faker.string.alphanumeric(12).toUpperCase(),
      jackHenryCifNumber: faker.string.alphanumeric(10).toUpperCase(),
      customerType,
      customerStatus: faker.helpers.arrayElement(['active', 'inactive', 'prospect', 'closed']),
      riskRating: faker.helpers.arrayElement(['low', 'medium', 'high']),
      customerSince: faker.date.past({ years: 15 }).toISOString().split('T')[0],
      kycStatus: faker.helpers.arrayElement(['complete', 'pending', 'incomplete'])
    };
    
    if (customerType === 'individual') {
      // Individual customers: use firstName + lastName
      customerData.firstName = faker.person.firstName();
      customerData.lastName = faker.person.lastName();
      customerData.middleName = faker.datatype.boolean({ probability: 0.3 }) ? faker.person.middleName() : null;
      customerData.dateOfBirth = birthDate.toISOString().split('T')[0];
    } else {
      // Business/trust customers: use businessName
      if (customerType === 'business') {
        customerData.businessName = faker.company.name();
      } else if (customerType === 'trust') {
        customerData.businessName = `${faker.person.lastName()} Family ${faker.helpers.arrayElement(['Trust', 'Revocable Trust', 'Irrevocable Trust'])}`;
      } else {
        // estate
        customerData.businessName = `Estate of ${faker.person.fullName()}`;
      }
    }
    
    persons.push(customerData);
  }
  
  await db.insert(customer).values(persons);
  console.log(`✅ Generated ${persons.length} persons/customers`);
}

async function generateAddressesAndContacts() {
  console.log('📍📞 Generating addresses and contact information...');
  
  const personIds = await db.select({ customerId: customer.customerId }).from(customer);
  const addresses: (typeof address.$inferInsert)[] = [];
  const contacts: (typeof contactInfo.$inferInsert)[] = [];
  const entityAddressLinks: (typeof entityAddress.$inferInsert)[] = [];
  const entityContactLinks: (typeof entityContact.$inferInsert)[] = [];
  
  for (const { customerId } of personIds) {
    // Generate 1-3 addresses per person
    const addressCount = faker.number.int({ min: 1, max: 3 });
    let primaryAddressAssigned = false;
    
    for (let i = 0; i < addressCount; i++) {
      const addressId = addresses.length + 1;
      const isPrimary = !primaryAddressAssigned;
      
      addresses.push({
        streetAddress: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        zipCode: faker.location.zipCode(),
        country: 'US'
      });
      
      entityAddressLinks.push({
        entityType: 'customer',
        entityId: customerId,
        addressId: addressId,
        addressType: addresses[addressId - 1].addressType,
        isPrimary,
        isActive: true,
        effectiveDate: faker.date.past({ years: 5 }),
        expirationDate: null
      });
      
      if (isPrimary) primaryAddressAssigned = true;
    }
    
    // Generate 2-5 contact methods per person
    const contactCount = faker.number.int({ min: 2, max: 5 });
    let primaryContactAssigned = false;
    
    for (let i = 0; i < contactCount; i++) {
      const contactId = contacts.length + 1;
      const contactType = faker.helpers.arrayElement(CONTACT_TYPES);
      const isPrimary = !primaryContactAssigned && contactType !== 'fax';
      
      let contactValue;
      switch (contactType) {
        case 'phone':
          contactValue = faker.phone.number();
          break;
        case 'email':
          contactValue = faker.internet.email();
          break;
        case 'fax':
          contactValue = faker.phone.number();
          break;
        default:
          contactValue = faker.phone.number();
      }
      
      contacts.push({
        contactType,
        contactValue,
        isPreferred: isPrimary,
        isActive: true
      });
      
      entityContactLinks.push({
        entityType: 'customer',
        entityId: customerId,
        contactId: contactId,
        contactType,
        isPrimary,
        isActive: true,
        effectiveDate: faker.date.past({ years: 5 }),
        expirationDate: null
      });
      
      if (isPrimary) primaryContactAssigned = true;
    }
  }
  
  await db.insert(address).values(addresses);
  await db.insert(contactInfo).values(contacts);
  await db.insert(entityAddress).values(entityAddressLinks);
  await db.insert(entityContact).values(entityContactLinks);
  
  console.log(`✅ Generated ${addresses.length} addresses and ${contacts.length} contacts`);
}

async function generateHouseholds() {
  console.log('🏠 Generating households...');
  
  const activePersons = await db.select({ 
    customerId: customer.customerId, 
    firstName: customer.firstName, 
    lastName: customer.lastName 
  }).from(customer).where(sql`is_active = true`);
  
  const employees = await db.select({ employeeId: employee.employeeId }).from(employee);
  const households: (typeof household.$inferInsert)[] = [];
  const memberships = [];
  
  // Create about 400 households
  for (let i = 0; i < 400; i++) {
    const householdName = faker.company.name() + ' Family';
    const relationshipManager = faker.helpers.arrayElement(employees);
    
    households.push({
      householdName,
      householdStatus: faker.helpers.arrayElement(['active', 'inactive']),
      householdType: faker.helpers.arrayElement(['family', 'individual', 'business']),
      relationshipManagerId: relationshipManager.employeeId,
      totalAssets: faker.number.float({ min: 5000, max: 2000000, fractionDigits: 2 }),
      totalLiabilities: faker.number.float({ min: 0, max: 500000, fractionDigits: 2 }),
      riskRating: faker.helpers.arrayElement(['low', 'medium', 'high']),
      establishedDate: faker.date.past({ years: 20 }),
      lastReviewDate: faker.date.recent({ days: 365 }),
      isActive: faker.datatype.boolean({ probability: 0.90 })
    });
  }
  
  await db.insert(household).values(households);
  
  // Assign people to households
  const createdHouseholds = await db.select({ householdId: household.householdId }).from(household);
  let personIndex = 0;
  
  for (const { householdId } of createdHouseholds) {
    const householdSize = faker.number.int({ min: 1, max: 6 });
    const availablePersons = activePersons.slice(personIndex, personIndex + householdSize);
    
    if (availablePersons.length === 0) break;
    
    for (let i = 0; i < availablePersons.length; i++) {
      const person = availablePersons[i];
      let role;
      
      if (i === 0) {
        role = 'head_of_household';
      } else if (i === 1 && householdSize > 1) {
        role = faker.helpers.arrayElement(['spouse', 'partner']);
      } else {
        role = faker.helpers.arrayElement(['child', 'parent', 'other']);
      }
      
      memberships.push({
        householdId,
        customerId: customer.customerId,
        relationshipRole: role,
        isPrimaryMember: i === 0,
        isHeadOfHousehold: i === 0,
        membershipStartDate: faker.date.past({ years: 10 }),
        membershipEndDate: null,
        rollupAccounts: true,
        rollupPercentage: '100.00',
        notes: null
      });
    }
    
    personIndex += householdSize;
  }
  
  await db.insert(householdMembership).values(memberships);
  console.log(`✅ Generated ${households.length} households with ${memberships.length} memberships`);
}

async function generateAccounts() {
  console.log('💰 Generating accounts...');
  
  const personIds = await db.select({ customerId: customer.customerId }).from(customer);
  const branchIds = await db.select({ branchId: branch.branchId }).from(branch);
  const accounts: (typeof account.$inferInsert)[] = [];
  const ownerships: (typeof accountOwnership.$inferInsert)[] = [];
  
  for (const { customerId } of personIds) {
    const accountCount = faker.number.int({ min: 1, max: 5 });
    
    for (let i = 0; i < accountCount; i++) {
      const accountType = faker.helpers.arrayElement(ACCOUNT_TYPES);
      const openDate = faker.date.past({ years: 8 });
      
      let balance, creditLimit, interestRate;
      
      switch (accountType) {
        case 'checking':
          balance = faker.number.float({ min: 100, max: 50000, fractionDigits: 2 });
          creditLimit = null;
          interestRate = faker.number.float({ min: 0.01, max: 0.5, fractionDigits: 3 });
          break;
        case 'savings':
          balance = faker.number.float({ min: 500, max: 100000, fractionDigits: 2 });
          creditLimit = null;
          interestRate = faker.number.float({ min: 0.5, max: 4.5, fractionDigits: 3 });
          break;
        case 'credit_card':
          balance = faker.number.float({ min: 0, max: 15000, fractionDigits: 2 });
          creditLimit = faker.number.float({ min: 1000, max: 25000, fractionDigits: 2 });
          interestRate = faker.number.float({ min: 12.99, max: 29.99, fractionDigits: 2 });
          break;
        case 'loan':
          balance = faker.number.float({ min: 1000, max: 300000, fractionDigits: 2 });
          creditLimit = null;
          interestRate = faker.number.float({ min: 3.5, max: 18.5, fractionDigits: 3 });
          break;
        case 'cd':
          balance = faker.number.float({ min: 1000, max: 100000, fractionDigits: 2 });
          creditLimit = null;
          interestRate = faker.number.float({ min: 2.0, max: 5.5, fractionDigits: 3 });
          break;
        default:
          balance = faker.number.float({ min: 100, max: 50000, fractionDigits: 2 });
          creditLimit = null;
          interestRate = faker.number.float({ min: 0.1, max: 3.0, fractionDigits: 3 });
      }
      
      const accountId = accounts.length + 1;
      
      accounts.push({
        accountNumber: faker.string.numeric(12),
        accountType,
        accountStatus: faker.helpers.arrayElement(ACCOUNT_STATUSES),
        balance,
        availableBalance: balance * faker.number.float({ min: 0.8, max: 1.0 }),
        creditLimit,
        interestRate,
        openedDate: openDate,
        lastTransactionDate: faker.date.recent({ days: 30 }),
        branchId: faker.helpers.arrayElement(branchIds).branchId,
        productCode: faker.string.alphanumeric(6).toUpperCase(),
        isActive: faker.datatype.boolean({ probability: 0.92 })
      });
      
      // Create ownership record
      ownerships.push({
        accountId: accountId,
        customerId: customerId,
        ownershipType: faker.helpers.arrayElement(['primary', 'joint', 'beneficiary']),
        ownershipPercentage: '100.00',
        isPrimaryOwner: true,
        signatureCard: true,
        effectiveDate: openDate,
        expirationDate: null,
        isActive: true
      });
    }
  }
  
  await db.insert(account).values(accounts);
  await db.insert(accountOwnership).values(ownerships);
  
  console.log(`✅ Generated ${accounts.length} accounts with ${ownerships.length} ownership records`);
}

async function generateDebitCardLimitProfiles() {
  console.log('💳 Generating debit card limit profiles...');
  
  const limitProfiles: (typeof debitCardLimitProfile.$inferInsert)[] = [
    // Standard Individual Limit Profile
    {
      profileName: 'Standard Individual',
      profileDescription: 'Standard daily limits for individual checking accounts',
      dailyPurchaseLimit: '2500.00',
      dailyAtmLimit: '500.00',
      singleTransactionLimit: '1000.00',
      monthlyLimit: '50000.00'
    },
    // Premium Individual Limit Profile
    {
      profileName: 'Premium Individual',
      profileDescription: 'Enhanced limits for premium individual customers',
      dailyPurchaseLimit: '10000.00',
      dailyAtmLimit: '1500.00',
      singleTransactionLimit: '5000.00',
      monthlyLimit: '200000.00'
    },
    // Business Standard Limit Profile
    {
      profileName: 'Business Standard',
      profileDescription: 'Standard limits for small business checking accounts',
      dailyPurchaseLimit: '15000.00',
      dailyAtmLimit: '2000.00',
      singleTransactionLimit: '10000.00',
      monthlyLimit: '500000.00'
    },
    // Business Premium Limit Profile
    {
      profileName: 'Business Premium',
      profileDescription: 'High limits for large business and corporate accounts',
      dailyPurchaseLimit: '50000.00',
      dailyAtmLimit: '5000.00',
      singleTransactionLimit: '25000.00',
      monthlyLimit: '2000000.00'
    },
    // VIP Limit Profile
    {
      profileName: 'VIP Elite',
      profileDescription: 'Premium limits for VIP and high-net-worth customers',
      dailyPurchaseLimit: '25000.00',
      dailyAtmLimit: '3000.00',
      singleTransactionLimit: '15000.00',
      monthlyLimit: '1000000.00'
    },
    // Employee Limit Profile
    {
      profileName: 'Employee Banking',
      profileDescription: 'Special limits for bank employee accounts',
      dailyPurchaseLimit: '5000.00',
      dailyAtmLimit: '1000.00',
      singleTransactionLimit: '2500.00',
      monthlyLimit: '100000.00'
    },
    // Student/Youth Limit Profile
    {
      profileName: 'Student Banking',
      profileDescription: 'Conservative limits for student and youth accounts',
      dailyPurchaseLimit: '1000.00',
      dailyAtmLimit: '300.00',
      singleTransactionLimit: '500.00',
      monthlyLimit: '15000.00'
    },
    // Senior Citizen Limit Profile
    {
      profileName: 'Senior Banking',
      profileDescription: 'Tailored limits for senior citizen accounts',
      dailyPurchaseLimit: '3000.00',
      dailyAtmLimit: '800.00',
      singleTransactionLimit: '1500.00',
      monthlyLimit: '75000.00'
    }
  ];
  
  await db.insert(debitCardLimitProfile).values(limitProfiles);
  console.log(`✅ Generated ${limitProfiles.length} debit card limit profiles`);
}

async function generateDebitCards() {
  console.log('💳 Generating debit cards for checking accounts...');
  
  // Get all CHECKING accounts (only checking and business_checking can have debit cards)
  const checkingAccounts = await db.execute(sql`
    SELECT 
      a.account_id,
      a.account_type,
      a.account_status,
      ao.customer_id,
      ao.is_primary_owner,
      c.customer_type,
      c.customer_status
    FROM account a
    INNER JOIN account_ownership ao ON a.account_id = ao.account_id
    INNER JOIN customer c ON ao.customer_id = c.customer_id
    WHERE a.account_type IN ('checking', 'business_checking')
      AND a.account_status = 'active'
      AND ao.is_active = true
      AND c.customer_status = 'active'
    ORDER BY a.account_id, ao.is_primary_owner DESC
  `);
  
  // Get all limit profile IDs
  const limitProfiles = await db.select({ 
    profileId: debitCardLimitProfile.profileId,
    profileName: debitCardLimitProfile.profileName 
  }).from(debitCardLimitProfile);
  
  const profileMap = new Map(limitProfiles.map(p => [p.profileName, p.profileId]));
  
  const debitCards: (typeof debitCard.$inferInsert)[] = [];
  const processedAccounts = new Set<number>();
  
  const cardBrands = ['Visa', 'Mastercard'];
  const cardTypes = ['standard', 'gold', 'platinum', 'business'];
  const cardStatuses = ['active', 'inactive', 'blocked', 'expired'];
  
  for (const row of checkingAccounts.rows) {
    const accountId = row.account_id as number;
    const customerId = row.customer_id as number;
    const isPrimaryOwner = row.is_primary_owner as boolean;
    const customerType = row.customer_type as string;
    
    // Only issue one card per account (to primary owner)
    // But for joint accounts, 30% chance of issuing companion cards
    if (processedAccounts.has(accountId)) {
      // Joint account companion card (30% chance)
      if (!isPrimaryOwner && faker.datatype.boolean({ probability: 0.3 })) {
        const limitProfile = profileMap.get('Standard Individual')!;
        debitCards.push(generateDebitCardData(accountId, customerId, limitProfile, 'companion'));
      }
      continue;
    }
    
    processedAccounts.add(accountId);
    
    // Determine limit profile based on customer type and account type
    let limitProfileName: string;
    let cardType: string;
    
    if (customerType === 'business') {
      // 70% business standard, 30% business premium
      limitProfileName = faker.datatype.boolean({ probability: 0.7 }) 
        ? 'Business Standard' 
        : 'Business Premium';
      cardType = 'business';
    } else {
      // Individual accounts - distribute across different profiles
      const roll = faker.number.float({ min: 0, max: 1 });
      if (roll < 0.50) {
        limitProfileName = 'Standard Individual';
        cardType = 'standard';
      } else if (roll < 0.75) {
        limitProfileName = 'Premium Individual';
        cardType = 'gold';
      } else if (roll < 0.85) {
        limitProfileName = 'Student Banking';
        cardType = 'standard';
      } else if (roll < 0.92) {
        limitProfileName = 'Senior Banking';
        cardType = 'standard';
      } else if (roll < 0.97) {
        limitProfileName = 'VIP Elite';
        cardType = 'platinum';
      } else {
        limitProfileName = 'Employee Banking';
        cardType = 'gold';
      }
    }
    
    const limitProfile = profileMap.get(limitProfileName)!;
    debitCards.push(generateDebitCardData(accountId, customerId, limitProfile, cardType));
  }
  
  await db.insert(debitCard).values(debitCards);
  console.log(`✅ Generated ${debitCards.length} debit cards for ${processedAccounts.size} checking accounts`);
}

function generateDebitCardData(
  accountId: number, 
  customerId: number,
  limitProfileId: number, 
  cardType: string
): typeof debitCard.$inferInsert {
  const now = new Date();
  const cardBrand = faker.helpers.arrayElement(['Visa', 'Mastercard']);
  
  // Generate realistic expiry dates
  const yearsUntilExpiry = faker.number.int({ min: 1, max: 5 });
  const expiryDate = new Date(now);
  expiryDate.setFullYear(expiryDate.getFullYear() + yearsUntilExpiry);
  
  // Determine card status - 85% active, 10% inactive, 3% blocked, 2% expired
  let cardStatus: string;
  const statusRoll = faker.number.float({ min: 0, max: 1 });
  if (statusRoll < 0.85) {
    cardStatus = 'active';
  } else if (statusRoll < 0.95) {
    cardStatus = 'inactive';
  } else if (statusRoll < 0.98) {
    cardStatus = 'blocked';
  } else {
    cardStatus = 'expired';
    // If expired, set expiry date in the past
    expiryDate.setFullYear(now.getFullYear() - faker.number.int({ min: 1, max: 3 }));
  }
  
  // Generate cardholder name
  const cardholderName = faker.person.fullName().toUpperCase();
  
  return {
    accountId,
    customerId,
    limitProfileId,
    cardType,
    cardStatus,
    lastFourDigits: faker.string.numeric(4),
    cardBrand,
    expiryMonth: expiryDate.getMonth() + 1,
    expiryYear: expiryDate.getFullYear(),
    cardholderName,
    jackHenryCardId: `JH${faker.string.alphanumeric(10).toUpperCase()}`,
    silverlakeCardToken: `SLK-${faker.string.alphanumeric(16).toUpperCase()}`
  };
}

async function resetSequences() {
  console.log('🔄 Resetting database sequences...');
  
  const tables = [
    'branch', 'employee', 'person', 'address', 'contact_info',
    'household', 'account', 'entity_address', 'entity_contact',
    'household_membership', 'account_ownership', 'debit_card_limit_profile', 'debit_card',
    'role', 'permission'
  ];
  
  for (const table of tables) {
    try {
      const columnId = `${table.replace('_', '')}_id`;
      await db.execute(
        sql`SELECT setval(
          pg_get_serial_sequence(${table}, ${columnId}), 
          COALESCE((SELECT MAX(${sql.identifier(columnId)}) FROM ${sql.identifier(table)}), 1)
        )`
      );
    } catch (error) {
      console.log(`⚠️  Could not reset sequence for ${table}: ${error.message}`);
    }
  }
  
  console.log('✅ Database sequences reset');
}

async function main() {
  try {
    await generateBranches();
    await generateEmployees();
    await seedRBAC();
    await generatePersons();
    await generateAddressesAndContacts();
    await generateHouseholds();
    await generateAccounts();
    await generateDebitCardLimitProfiles();
    await generateDebitCards();
    await resetSequences();
    
    console.log('🎉 Banking test data generation completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating test data:', error);
    process.exit(1);
  }
}

main();