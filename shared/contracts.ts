import { z } from 'zod';

// ============================================================================
// API Data Transfer Objects (DTOs) - v1.0
// ============================================================================
// These DTOs define the contract between backend and frontend.
// All API responses MUST conform to these shapes.
// Database field names should NEVER leak through these contracts.
// ============================================================================

// Contact DTO - Clean interface for contact information
export const ContactDTO = z.object({
  id: z.string(),
  type: z.enum(['phone', 'email', 'address']),
  value: z.string(),
  subtype: z.string(),
  isPrimary: z.boolean(),
  purpose: z.string().optional()
});

export type ContactDTO = z.infer<typeof ContactDTO>;

// Customer DTO - Clean interface for customer information
export const CustomerDTO = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  middleName: z.string().optional(),
  dateOfBirth: z.string(), // ISO date string
  ssn: z.string(), // Masked: XXX-XX-1234
  email: z.string(),
  phoneNumber: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zipCode: z.string(),
  createdAt: z.string(), // ISO date string
  updatedAt: z.string().nullable(), // ISO date string or null
  isEmployee: z.boolean().nullable().optional(), // Employee status flag
  vipCustomer: z.boolean().nullable().optional(), // VIP customer flag
  cifNumber: z.string().nullable().optional() // Jack Henry CIF Number
});

export type CustomerDTO = z.infer<typeof CustomerDTO>;

// Account DTO - Clean interface for account information
export const AccountDTO = z.object({
  id: z.string(),
  accountNumber: z.string(), // Masked: ****1234
  accountType: z.string(),
  balance: z.number(),
  status: z.string(),
  openedDate: z.string(), // ISO date string
  closedDate: z.string().nullable(),
  interestRate: z.number().nullable(),
  creditLimit: z.number().nullable(),
  availableCredit: z.number().nullable()
});

export type AccountDTO = z.infer<typeof AccountDTO>;

// Transaction DTO - Clean interface for transaction information
export const TransactionDTO = z.object({
  id: z.string(),
  accountId: z.string(),
  transactionDate: z.string(), // ISO date string
  amount: z.number(),
  type: z.string(),
  description: z.string(),
  category: z.string().nullable(),
  merchantName: z.string().nullable(),
  location: z.string().nullable(),
  status: z.string(),
  referenceNumber: z.string().nullable()
});

export type TransactionDTO = z.infer<typeof TransactionDTO>;

// Household Member DTO
export const HouseholdMemberDTO = z.object({
  id: z.string(),
  name: z.string(),
  relationship: z.string(),
  isPrimary: z.boolean()
});

export type HouseholdMemberDTO = z.infer<typeof HouseholdMemberDTO>;

// Officer DTO - Bank officer assigned to customer
export const OfficerDTO = z.object({
  id: z.string(), // officer_code
  displayName: z.string(),
  title: z.string(),
  department: z.string().nullable(),
  relationshipType: z.enum(['primary', 'secondary']),
  isPrimary: z.boolean(),
  contactChannels: z.object({
    phone: z.string().nullable(),
    email: z.string().nullable()
  }).optional(),
  assignedAt: z.string() // ISO date string
});

export type OfficerDTO = z.infer<typeof OfficerDTO>;

// Standard Response Envelope
export const StandardResponseDTO = z.object({
  data: z.unknown(),
  correlationId: z.string(),
  timestamp: z.string()
});

// Paginated Response
export const PaginatedResponseDTO = z.object({
  data: z.array(z.unknown()),
  page: z.object({
    cursor: z.string().optional(),
    hasMore: z.boolean(),
    total: z.number().optional()
  }),
  correlationId: z.string(),
  timestamp: z.string()
});

// Standard Error Response
export const ErrorResponseDTO = z.object({
  code: z.string(),
  message: z.string(),
  correlationId: z.string(),
  details: z.unknown().optional(),
  timestamp: z.string()
});

export type ErrorResponseDTO = z.infer<typeof ErrorResponseDTO>;

// ============================================================================
// DASHBOARD CARDS API CONTRACTS
// ============================================================================

// Client Engagement DTO - Online banking activity and transaction summaries
// The activity window is selectable (30/60/90 days). `days` echoes back the
// window actually used so the client doesn't need to keep its own bookkeeping.
export const ClientEngagementDTO = z.object({
  loginId: z.string().nullable(),
  lastLoginAt: z.string().nullable(), // PST formatted date/time or null
  days: z.union([z.literal(30), z.literal(60), z.literal(90)]),
  activity: z.object({
    ach: z.number(),
    cash_withdrawal: z.number(),
    check_deposit: z.number(),
    check_payment: z.number(),
    debit_card_payment: z.number(),
    deposit: z.number(),
    lockbox: z.number(),
    transfer: z.number(),
    wire: z.number(),
    zelle: z.number()
  })
});

export type ClientEngagementDTO = z.infer<typeof ClientEngagementDTO>;

// Relationship Summary DTO - Total balances and quarter-over-quarter changes
export const RelationshipSummaryDTO = z.object({
  totalDeposits: z.number(),
  totalLoans: z.number(),
  depositsQoQ: z.object({
    amountChange: z.number(), // Dollar amount change from previous quarter
    percentChange: z.number() // Percentage change from previous quarter
  }),
  loansQoQ: z.object({
    amountChange: z.number(), // Dollar amount change from previous quarter
    percentChange: z.number() // Percentage change from previous quarter
  })
});

export type RelationshipSummaryDTO = z.infer<typeof RelationshipSummaryDTO>;

// Contact History Item DTO - Individual contact record
export const ContactHistoryItemDTO = z.object({
  contactType: z.string(), // phone, email, in_person, meeting
  occurredAt: z.string(), // PST formatted date/time
  employeeName: z.string(),
  contactDescription: z.string().optional()
});

export type ContactHistoryItemDTO = z.infer<typeof ContactHistoryItemDTO>;

// Contact History DTO - Array of recent contacts
export const ContactHistoryDTO = z.object({
  recentContacts: z.array(ContactHistoryItemDTO).max(5) // Latest 5 contacts
});

export type ContactHistoryDTO = z.infer<typeof ContactHistoryDTO>;