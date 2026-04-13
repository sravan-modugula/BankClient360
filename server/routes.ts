import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { eq, sql, desc } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { isSQLServer } from "./dbConfig";
import { requirePermission } from "./middleware/permissions";
import { roleTestService } from "./services/roleTestService";
import { 
  insertCustomerSchema, 
  searchCustomerSchema,
  smartSearchParamsSchema,
  insertContactInfoSchema,
  insertAddressSchema,
  insertHouseholdSchema,
  insertHouseholdMembershipSchema,
  insertAccountSchema,
  insertAccountOwnershipSchema,
  insertCustomerOfficerAssignmentSchema,
  insertCustomerSicCodeSchema,
  assignRoleSchema,
  removeRoleSchema,
  upsertSsoUserSchema,
  financialTransaction,
  account,
  type Customer,
  type CustomerWithDetails 
} from "@shared/schema";
import {
  ClientEngagementDTO,
  RelationshipSummaryDTO,
  ContactHistoryDTO,
  type ClientEngagementDTO as ClientEngagementType,
  type RelationshipSummaryDTO as RelationshipSummaryType,
  type ContactHistoryDTO as ContactHistoryType
} from "@shared/contracts";
import { DateFormatter } from "@shared/utils/timezone";
import { routeAuditMiddleware } from "./middleware/routeAudit";
import { auditService, emitAuditEvent } from "./services/auditService";
import logger from "./services/logger";
import { AuditEventType, AuditCategory, AuditSeverity, EVENT_CLASSIFICATION } from "@shared/auditEvents";
import type { ClientAuditEvent } from "@shared/auditEvents";

export async function registerRoutes(app: Express): Promise<Server> {

  // Route audit middleware — automatically emits audit events for all /api routes
  app.use('/api', routeAuditMiddleware);

  // ==================================================================================
  // CLIENT EVENT BATCH ENDPOINT
  // ==================================================================================

  app.post("/api/events/batch", (req, res) => {
    const events = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: "Expected non-empty array of events" });
    }

    // Cap at 100 events per batch
    const batch = events.slice(0, 100) as ClientAuditEvent[];

    for (const clientEvent of batch) {
      if (!clientEvent.eventType || !clientEvent.action) continue;

      const classification = EVENT_CLASSIFICATION[clientEvent.eventType as AuditEventType];
      if (!classification) continue;

      auditService.recordEvent({
        eventType: clientEvent.eventType as AuditEventType,
        category: classification.category,
        severity: classification.severity,
        timestamp: clientEvent.timestamp || new Date().toISOString(),
        correlationId: req.correlationId,
        actor: {
          employeeId: req.employeeId,
          ipAddress: req.ip || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
        },
        action: clientEvent.action,
        outcome: clientEvent.outcome || 'success',
        resource: clientEvent.resource,
        metadata: clientEvent.metadata,
        source: 'client',
        module: clientEvent.module,
      });
    }

    res.json({ accepted: batch.length });
  });

  // ==================================================================================
  // PERSON/CUSTOMER API ROUTES
  // ==================================================================================

  // Smart Search API - GET /api/customers/search with auto-detection
  app.get("/api/customers/search", async (req, res) => {
    try {
      // Backward compatibility: support both 'q' and legacy 'query' parameter
      const searchQuery = req.query.q || req.query.query;
      
      const validation = smartSearchParamsSchema.safeParse({
        q: searchQuery,
        fields: req.query.fields ? (req.query.fields as string).split(',') : undefined,
        type: req.query.type,
        entityTypes: req.query.entityTypes ? (req.query.entityTypes as string).split(',') : undefined,
        exact: req.query.exact === 'true',
        fuzzyThreshold: req.query.fuzzyThreshold ? parseFloat(req.query.fuzzyThreshold as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        cursor: req.query.cursor,
        includeTotal: req.query.includeTotal === 'true'
      });

      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid search parameters",
          details: validation.error.errors
        });
      }

      // Use unified search if entityTypes includes household, otherwise use customer-only search for backward compatibility
      const useUnifiedSearch = validation.data.entityTypes && validation.data.entityTypes.includes('household');
      
      if (useUnifiedSearch) {
        const result = await storage.searchEntities(validation.data);
        logger.debug({
          module: 'routes',
          count: result.data.length,
          detectedType: result.diagnostics.detectedType,
          hasMore: result.page.hasMore,
          entityTypes: result.data.reduce((acc, item) => {
            acc[item.entityType] = (acc[item.entityType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }, 'Unified search completed');
        res.json(result);
      } else {
        const result = await storage.smartSearchCustomers(validation.data);
        logger.debug({
          module: 'routes',
          count: result.data.length,
          detectedType: result.diagnostics.detectedType,
          hasMore: result.page.hasMore
        }, 'Smart search completed');
        res.json(result);
      }
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error in smart search');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Advanced Search API - POST /api/customers/search for complex queries
  app.post("/api/customers/search", async (req, res) => {
    try {
      const validation = smartSearchParamsSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid search parameters",
          details: validation.error.errors
        });
      }

      // Use unified search if entityTypes includes household, otherwise use customer-only search for backward compatibility
      const useUnifiedSearch = validation.data.entityTypes && validation.data.entityTypes.includes('household');
      
      if (useUnifiedSearch) {
        const result = await storage.searchEntities(validation.data);
        logger.debug({
          module: 'routes',
          count: result.data.length,
          detectedType: result.diagnostics.detectedType,
          fieldsUsed: result.diagnostics.fieldsUsed,
          entityTypes: result.data.reduce((acc, item) => {
            acc[item.entityType] = (acc[item.entityType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }, 'Advanced unified search completed');
        res.json(result);
      } else {
        const result = await storage.smartSearchCustomers(validation.data);
        logger.debug({
          module: 'routes',
          count: result.data.length,
          detectedType: result.diagnostics.detectedType,
          fieldsUsed: result.diagnostics.fieldsUsed
        }, 'Advanced search completed');
        res.json(result);
      }
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error in advanced search');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/customers/:id - Get person by ID with detailed information (numeric IDs only)
  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      
      const person = await storage.getCustomerWithDetails(customerId);
      if (!person) {
        return res.status(404).json({ 
          code: "PERSON_NOT_FOUND",
          message: "Person not found",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      // Get the raw customer record for the adapter (which needs the database object)
      const customerRecord = await storage.getCustomer(customerId);
      if (!customerRecord) {
        return res.status(404).json({ 
          code: "PERSON_NOT_FOUND",
          message: "Customer record not found",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      // Use the person adapter to transform to DTO with masked PII
      const { mapCustomerToDTO } = await import('./adapters/customerAdapter');
      const { CustomerDTO } = await import('../shared/contracts');
      
      // Prepare contact and address info from CustomerWithDetails
      const contactInfo = {
        email: person.primaryEmail || '',
        phone: person.primaryPhone || ''
      };
      
      // Handle primaryAddress which might be a string or an object
      let addressString = '';
      if (typeof person.primaryAddress === 'string') {
        addressString = person.primaryAddress;
      } else if (person.primaryAddress && typeof person.primaryAddress === 'object' && 'addressLine1' in person.primaryAddress) {
        const addr = person.primaryAddress as any;
        addressString = [addr.addressLine1, addr.addressLine2].filter(Boolean).join(', ');
      }
      
      const addressInfo = {
        address: addressString,
        city: '', // Not available in CustomerWithDetails
        state: '', // Not available in CustomerWithDetails
        zipCode: '' // Not available in CustomerWithDetails
      };
      
      // Pass the raw customer record to the adapter
      const personDTO = mapCustomerToDTO(customerRecord, contactInfo, addressInfo);
      
      // Add additional fields for backward compatibility with UI
      const extendedResponse = {
        ...personDTO,
        customerId: person.customerId, // Keep numeric customerId for backward compatibility
        name: person.customerType === 'business' || person.customerType === 'trust' 
          ? (person.businessName || 'Unknown Business')
          : `${person.firstName || ''} ${person.lastName || ''}`.trim() || 'Unknown Customer',
        preferredName: person.preferredName,
        status: person.customerStatus || 'active',
        customerType: person.customerType || 'individual',
        riskRating: person.riskRating || 'medium',
        customerSince: person.customerSince,
        primaryEmail: person.primaryEmail,
        primaryPhone: person.primaryPhone,
        primaryAddress: person.primaryAddress,
        taxId: personDTO.ssn, // Alias for backward compatibility
        taxIdentifier: personDTO.ssn, // Alias for backward compatibility
        governmentId: person.governmentId ? "****" + person.governmentId.slice(-4) : null,
        gender: person.gender,
        maritalStatus: person.maritalStatus,
        jackHenryCifNumber: person.jackHenryCifNumber,
        silverlakeCustomerId: person.silverlakeCustomerId,
        accountNumber: person.silverlakeCustomerId || person.jackHenryCifNumber,
        totalAssets: 0,
        isHeadOfHousehold: true,
        // Enterprise status flags from DTO (already masked/validated by adapter)
        isEmployee: personDTO.isEmployee,
        vipCustomer: personDTO.vipCustomer,
        // Branch information
        branchName: person.branchName,
        branchCode: person.branchCode
      };
      
      // Runtime validation in development/test environments
      if (process.env.NODE_ENV !== 'production') {
        try {
          // Validate the core DTO part
          CustomerDTO.parse(personDTO);
        } catch (validationError) {
          logger.error({ err: validationError instanceof Error ? validationError : new Error('Unknown error'), module: 'routes' }, 'Person DTO validation failed');
          return res.status(500).json({ 
            code: "DTO_VALIDATION_FAILED",
            message: "Internal data contract violation",
            correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
            timestamp: new Date().toISOString()
          });
        }
      }

      res.json(extendedResponse);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching person');
      res.status(500).json({ 
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /api/customers/:id/details - Get complete customer details (all fields)
  app.get("/api/customers/:id/details", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      
      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ 
          error: "Customer not found"
        });
      }

      // Add fullName field for the modal
      const response = {
        ...customer,
        fullName: customer.fullName || 
                 (customer.businessName ? customer.businessName :
                  [customer.firstName, customer.middleName, customer.lastName].filter(Boolean).join(' '))
      };

      res.json(response);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching customer details');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/customers - Create new person
  app.post("/api/customers", async (req, res) => {
    try {
      const validation = insertCustomerSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid person data",
          details: validation.error.errors
        });
      }

      // Check for duplicate tax identifier
      if (validation.data.taxIdentifier) {
        const existing = await storage.getCustomerByTaxId(validation.data.taxIdentifier);
        if (existing) {
          return res.status(409).json({ error: "Person with this tax identifier already exists" });
        }
      }

      // Check for duplicate CIF number
      if (validation.data.jackHenryCifNumber) {
        const existing = await storage.getCustomerByCifNumber(validation.data.jackHenryCifNumber);
        if (existing) {
          return res.status(409).json({ error: "Person with this CIF number already exists" });
        }
      }

      const person = await storage.createCustomer(validation.data);
      const personWithDetails = await storage.getCustomerWithDetails(person.customerId);
      
      if (!personWithDetails) {
        return res.status(500).json({ error: "Failed to retrieve created person details" });
      }
      
      // Mask sensitive PII data
      const sanitizedPerson = {
        ...personWithDetails,
        taxIdentifier: personWithDetails.taxIdentifier ? "***-**-" + personWithDetails.taxIdentifier.slice(-4) : null,
        governmentId: personWithDetails.governmentId ? "****" + personWithDetails.governmentId.slice(-4) : null
      };
      
      res.status(201).json(sanitizedPerson);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error creating person');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PUT /api/customers/:id - Update person
  app.put("/api/customers/:id", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid person ID" });
      }

      // Check if person exists
      const existingPerson = await storage.getCustomer(customerId);
      if (!existingPerson) {
        return res.status(404).json({ error: "Person not found" });
      }

      const validation = insertCustomerSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid person data",
          details: validation.error.errors
        });
      }

      // Check for duplicate tax identifier (if changing)
      if (validation.data.taxIdentifier && validation.data.taxIdentifier !== existingPerson.taxIdentifier) {
        const existing = await storage.getCustomerByTaxId(validation.data.taxIdentifier);
        if (existing) {
          return res.status(409).json({ error: "Person with this tax identifier already exists" });
        }
      }

      // Check for duplicate CIF number (if changing)
      if (validation.data.jackHenryCifNumber && validation.data.jackHenryCifNumber !== existingPerson.jackHenryCifNumber) {
        const existing = await storage.getCustomerByCifNumber(validation.data.jackHenryCifNumber);
        if (existing) {
          return res.status(409).json({ error: "Person with this CIF number already exists" });
        }
      }

      const updatedPerson = await storage.updateCustomer(customerId, validation.data);
      if (!updatedPerson) {
        return res.status(404).json({ error: "Person not found" });
      }

      const personWithDetails = await storage.getCustomerWithDetails(customerId);
      if (!personWithDetails) {
        return res.status(500).json({ error: "Failed to retrieve updated person details" });
      }
      
      // Mask sensitive PII data
      const sanitizedPerson = {
        ...personWithDetails,
        taxIdentifier: personWithDetails.taxIdentifier ? "***-**-" + personWithDetails.taxIdentifier.slice(-4) : null,
        governmentId: personWithDetails.governmentId ? "****" + personWithDetails.governmentId.slice(-4) : null
      };
      
      res.json(sanitizedPerson);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error updating person');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/customers/tax-id/:taxId - Get person by tax identifier
  app.get("/api/customers/tax-id/:taxId", async (req, res) => {
    try {
      const taxId = req.params.taxId;
      if (!taxId) {
        return res.status(400).json({ error: "Tax identifier is required" });
      }

      const person = await storage.getCustomerByTaxId(taxId);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }

      const personWithDetails = await storage.getCustomerWithDetails(person.customerId);
      if (!personWithDetails) {
        return res.status(500).json({ error: "Failed to retrieve person details" });
      }
      
      // Mask sensitive PII data
      const sanitizedPerson = {
        ...personWithDetails,
        taxIdentifier: personWithDetails.taxIdentifier ? "***-**-" + personWithDetails.taxIdentifier.slice(-4) : null,
        governmentId: personWithDetails.governmentId ? "****" + personWithDetails.governmentId.slice(-4) : null
      };
      
      res.json(sanitizedPerson);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching person by tax ID');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/customers/cif/:cifNumber - Get person by Jack Henry CIF number
  app.get("/api/customers/cif/:cifNumber", async (req, res) => {
    try {
      const cifNumber = req.params.cifNumber;
      if (!cifNumber) {
        return res.status(400).json({ error: "CIF number is required" });
      }

      const person = await storage.getCustomerByCifNumber(cifNumber);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }

      const personWithDetails = await storage.getCustomerWithDetails(person.customerId);
      if (!personWithDetails) {
        return res.status(500).json({ error: "Failed to retrieve person details" });
      }
      
      // Mask sensitive PII data
      const sanitizedPerson = {
        ...personWithDetails,
        taxIdentifier: personWithDetails.taxIdentifier ? "***-**-" + personWithDetails.taxIdentifier.slice(-4) : null,
        governmentId: personWithDetails.governmentId ? "****" + personWithDetails.governmentId.slice(-4) : null
      };
      
      res.json(sanitizedPerson);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching person by CIF number');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/customers/gov-id/:govId - Get person by government ID
  app.get("/api/customers/gov-id/:govId", async (req, res) => {
    try {
      const govId = req.params.govId;
      if (!govId) {
        return res.status(400).json({ error: "Government ID is required" });
      }

      const person = await storage.getCustomerByGovernmentId(govId);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }

      const personWithDetails = await storage.getCustomerWithDetails(person.customerId);
      if (!personWithDetails) {
        return res.status(500).json({ error: "Failed to retrieve person details" });
      }
      
      // Mask sensitive PII data
      const sanitizedPerson = {
        ...personWithDetails,
        taxIdentifier: personWithDetails.taxIdentifier ? "***-**-" + personWithDetails.taxIdentifier.slice(-4) : null,
        governmentId: personWithDetails.governmentId ? "****" + personWithDetails.governmentId.slice(-4) : null
      };
      
      res.json(sanitizedPerson);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching person by government ID');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================================================================================
  // CONTACT MANAGEMENT ROUTES
  // ==================================================================================

  // GET /api/customers/:id/contacts - Get all contacts for a person
  app.get("/api/customers/:id/contacts", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ 
          code: "INVALID_PERSON_ID",
          message: "Invalid person ID",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      // Check if person exists
      const person = await storage.getCustomer(customerId);
      if (!person) {
        return res.status(404).json({ 
          code: "PERSON_NOT_FOUND",
          message: "Person not found",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      // Fetch contacts AND addresses from database
      const { contacts: dbContacts, addresses: dbAddresses } = await storage.getCustomerContactsAndAddresses(customerId);
      
      // Transform to DTOs using the mappers
      const { mapContactArrayToDTO } = await import('./adapters/contactAdapter');
      const { mapAddressArrayToContactDTO } = await import('./adapters/addressAdapter');
      const { ContactDTO } = await import('../shared/contracts');
      
      // Map contacts (emails, phones) to DTOs
      const contactDTOs = mapContactArrayToDTO(dbContacts);
      
      // Map addresses to ContactDTOs (with type='address')
      const addressDTOs = mapAddressArrayToContactDTO(dbAddresses);
      
      // Combine all contact types
      const allContactDTOs = [...contactDTOs, ...addressDTOs];
      
      // Runtime validation - log warnings for invalid records but don't block the response
      const validDTOs: typeof allContactDTOs = [];
      for (const dto of allContactDTOs) {
        const result = ContactDTO.safeParse(dto);
        if (result.success) {
          validDTOs.push(dto);
        } else {
          logger.warn({
            module: 'routes',
            customerId,
            contactId: dto.id,
            contactType: dto.type,
            errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
          }, 'Skipping invalid contact DTO');
        }
      }
      
      res.json(validDTOs);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching person contacts');
      res.status(500).json({ 
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
        timestamp: new Date().toISOString()
      });
    }
  });

  // POST /api/customers/:id/contacts - Add contact to person
  app.post("/api/customers/:id/contacts", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid person ID" });
      }

      // Check if person exists
      const person = await storage.getCustomer(customerId);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }

      const validation = insertContactInfoSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid contact data",
          details: validation.error.errors
        });
      }

      const contact = await storage.addCustomerContact(customerId, validation.data);
      res.status(201).json(contact);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error adding person contact');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================================================================================
  // ADDRESS MANAGEMENT ROUTES
  // ==================================================================================

  // GET /api/customers/:id/addresses - Get all addresses for a person
  app.get("/api/customers/:id/addresses", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid person ID" });
      }

      // Check if person exists
      const person = await storage.getCustomer(customerId);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }

      const addresses = await storage.getCustomerAddresses(customerId);
      res.json(addresses);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching person addresses');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/customers/:id/addresses - Add address to person
  app.post("/api/customers/:id/addresses", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid person ID" });
      }

      // Check if person exists
      const person = await storage.getCustomer(customerId);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }

      const validation = insertAddressSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid address data",
          details: validation.error.errors
        });
      }

      const address = await storage.addCustomerAddress(customerId, validation.data);
      res.status(201).json(address);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error adding person address');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================================================================================
  // CUSTOMER-OFFICER ASSIGNMENT ROUTES
  // ==================================================================================

  // GET /api/customers/:id/officers - Get all officers assigned to a customer with full details
  app.get("/api/customers/:id/officers", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ 
          code: "INVALID_CUSTOMER_ID",
          message: "Invalid customer ID",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      // Check if customer exists
      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ 
          code: "CUSTOMER_NOT_FOUND",
          message: "Customer not found",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      // Fetch officers with employee details using JOIN
      const dbOfficers = await storage.getCustomerOfficersWithDetails(customerId);
      
      // Transform using adapter (defensive coding with null safety)
      const { mapOfficersToDTO } = await import('./adapters/officerAdapter');
      const officerDTOs = mapOfficersToDTO(dbOfficers);
      
      // Return empty array with 200 OK if no officers assigned (valid state)
      res.json(officerDTOs);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching customer officers');
      res.status(500).json({ 
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
        timestamp: new Date().toISOString()
      });
    }
  });

  // POST /api/customers/:id/officers - Add officer to customer
  app.post("/api/customers/:id/officers", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }

      // Check if customer exists
      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const validation = insertCustomerOfficerAssignmentSchema.safeParse({
        ...req.body,
        customerId
      });

      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid officer assignment data",
          details: validation.error.errors
        });
      }

      // Check if employee with officer_code exists
      const employees = await storage.getEmployees();
      const employeeExists = employees.some(emp => emp.officerCode === validation.data.officerCode);
      if (!employeeExists) {
        return res.status(404).json({ error: "Employee with given officer code not found" });
      }

      const assignment = await storage.addCustomerOfficer(validation.data);
      res.status(201).json(assignment);
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error adding customer officer');
      
      // Handle unique constraint violations (duplicate assignment)
      if (error?.code === '23505' || error?.message?.includes('duplicate')) {
        return res.status(409).json({ 
          error: "Officer already assigned to customer",
          details: "This officer is already assigned to this customer"
        });
      }
      
      // Handle filtered unique constraint violation (multiple primary officers)
      if (error?.message?.includes('unq_customer_primary_officer')) {
        return res.status(409).json({ 
          error: "Customer already has a primary officer",
          details: "Cannot assign multiple primary officers to a customer"
        });
      }

      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PUT /api/customers/:customerId/officers/:officerCode - Update officer relationship type
  app.put("/api/customers/:customerId/officers/:officerCode", async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      const officerCode = req.params.officerCode;

      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }

      // Validate relationship type
      const validation = z.object({ 
        relationshipType: z.enum(['primary', 'secondary']) 
      }).safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid relationship type",
          details: validation.error.errors
        });
      }

      const updated = await storage.updateCustomerOfficer(
        customerId,
        officerCode,
        validation.data.relationshipType
      );

      if (!updated) {
        return res.status(404).json({ error: "Officer assignment not found" });
      }

      res.json(updated);
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error updating customer officer');
      
      // Handle filtered unique constraint violation (multiple primary officers)
      if (error?.message?.includes('unq_customer_primary_officer')) {
        return res.status(409).json({ 
          error: "Customer already has a primary officer",
          details: "Cannot have multiple primary officers for a customer"
        });
      }

      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /api/customers/:customerId/officers/:officerCode - Remove officer from customer
  app.delete("/api/customers/:customerId/officers/:officerCode", async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      const officerCode = req.params.officerCode;

      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }

      const removed = await storage.removeCustomerOfficer(customerId, officerCode);

      if (!removed) {
        return res.status(404).json({ error: "Officer assignment not found" });
      }

      res.status(204).end();
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error removing customer officer');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/officers/:officerCode/customers - Get all customers assigned to an officer
  app.get("/api/officers/:officerCode/customers", async (req, res) => {
    try {
      const officerCode = req.params.officerCode;

      // Check if employee with officer_code exists
      const employees = await storage.getEmployees();
      const employeeExists = employees.some(emp => emp.officerCode === officerCode);
      if (!employeeExists) {
        return res.status(404).json({ error: "Employee with given officer code not found" });
      }

      const customers = await storage.getOfficerCustomers(officerCode);
      res.json(customers);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching officer customers');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================================================================================
  // CUSTOMER-SIC CODE ASSIGNMENT ROUTES
  // ==================================================================================

  // GET /api/customers/:id/sic-codes - Get all SIC codes assigned to a customer
  app.get("/api/customers/:id/sic-codes", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }

      // Check if customer exists
      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const sicCodes = await storage.getCustomerSicCodes(customerId);
      res.json(sicCodes);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching customer SIC codes');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/customers/:id/sic-codes - Add SIC code to customer
  app.post("/api/customers/:id/sic-codes", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }

      // Check if customer exists
      const customer = await storage.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const validation = insertCustomerSicCodeSchema.safeParse({
        ...req.body,
        customerId
      });

      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid SIC code assignment data",
          details: validation.error.errors
        });
      }

      const assignment = await storage.addCustomerSicCode(validation.data);
      res.status(201).json(assignment);
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error adding customer SIC code');
      
      // Handle unique constraint violations (duplicate assignment)
      if (error?.code === '23505' || error?.message?.includes('duplicate')) {
        return res.status(409).json({ 
          error: "SIC code already assigned to customer",
          details: "This SIC code is already assigned to this customer"
        });
      }
      
      // Handle foreign key constraint violations (invalid SIC code)
      if (error?.code === '23503' || error?.message?.includes('foreign key')) {
        return res.status(404).json({ 
          error: "SIC code not found",
          details: "The specified SIC code does not exist"
        });
      }

      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /api/customers/:customerId/sic-codes/:sicCode - Remove SIC code from customer
  app.delete("/api/customers/:customerId/sic-codes/:sicCode", async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      const sicCode = parseInt(req.params.sicCode);

      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }

      if (isNaN(sicCode)) {
        return res.status(400).json({ error: "Invalid SIC code" });
      }

      const removed = await storage.removeCustomerSicCode(customerId, sicCode);

      if (!removed) {
        return res.status(404).json({ error: "SIC code assignment not found" });
      }

      res.status(204).end();
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error removing customer SIC code');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================================================================================
  // HOUSEHOLD ROUTES  
  // ==================================================================================

  // GET /api/customers/:id/households - Get households for a person
  app.get("/api/customers/:id/households", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid person ID" });
      }

      // Check if person exists
      const person = await storage.getCustomer(customerId);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }

      const households = await storage.getCustomerHouseholds(customerId);
      res.json(households);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching person households');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/households - Create new household
  app.post("/api/households", async (req, res) => {
    try {
      const validation = insertHouseholdSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid household data",
          details: validation.error.errors
        });
      }

      const household = await storage.createHousehold(validation.data);
      res.status(201).json(household);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error creating household');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/households/:id - Get household by ID
  app.get("/api/households/:id", async (req, res) => {
    try {
      const householdId = parseInt(req.params.id);
      if (isNaN(householdId)) {
        return res.status(400).json({ error: "Invalid household ID" });
      }

      const household = await storage.getHousehold(householdId);
      if (!household) {
        return res.status(404).json({ error: "Household not found" });
      }

      res.json(household);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching household');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/households/:id/members - Get household members
  app.get("/api/households/:id/members", async (req, res) => {
    try {
      const householdId = parseInt(req.params.id);
      if (isNaN(householdId)) {
        return res.status(400).json({ error: "Invalid household ID" });
      }

      // Check if household exists
      const household = await storage.getHousehold(householdId);
      if (!household) {
        return res.status(404).json({ error: "Household not found" });
      }

      const members = await storage.getHouseholdMembers(householdId);
      res.json(members);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching household members');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/households/:id/accounts - Get all accounts for household members
  app.get("/api/households/:id/accounts", async (req, res) => {
    try {
      const householdId = parseInt(req.params.id);
      if (isNaN(householdId)) {
        return res.status(400).json({ error: "Invalid household ID" });
      }

      // Check if household exists
      const household = await storage.getHousehold(householdId);
      if (!household) {
        return res.status(404).json({ error: "Household not found" });
      }

      // Get all household members
      const members = await storage.getHouseholdMembers(householdId);
      
      // Fetch accounts for all members
      const allAccounts = [];
      for (const member of members) {
        const accounts = await storage.getCustomerAccounts(member.customerId);
        allAccounts.push(...accounts);
      }

      res.json(allAccounts);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching household accounts');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/households/:id/subsidiaries - Get subsidiary households (children)
  app.get("/api/households/:id/subsidiaries", async (req, res) => {
    try {
      const householdId = parseInt(req.params.id);
      if (isNaN(householdId)) {
        return res.status(400).json({ error: "Invalid household ID" });
      }

      // Check if household exists
      const household = await storage.getHousehold(householdId);
      if (!household) {
        return res.status(404).json({ error: "Household not found" });
      }

      // Find all households where this household is the parent
      const subsidiaries = await storage.getSubsidiaryHouseholds(householdId);
      res.json(subsidiaries);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching subsidiary households');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/households/customer/:customerId/members - Get household members for a customer
  app.get("/api/households/customer/:customerId/members", async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }

      // Get customer's households
      const households = await storage.getCustomerHouseholds(customerId);
      if (!households || households.length === 0) {
        return res.json([]); // Return empty array if customer has no households
      }

      // Get members from the first (primary) household
      const householdId = households[0].householdId;
      const members = await storage.getHouseholdMembers(householdId);
      res.json(members);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching customer household members');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/households/:id/members - Add member to household
  app.post("/api/households/:id/members", async (req, res) => {
    try {
      const householdId = parseInt(req.params.id);
      if (isNaN(householdId)) {
        return res.status(400).json({ error: "Invalid household ID" });
      }

      // Check if household exists
      const household = await storage.getHousehold(householdId);
      if (!household) {
        return res.status(404).json({ error: "Household not found" });
      }

      const validation = insertHouseholdMembershipSchema.safeParse({
        ...req.body,
        householdId
      });
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid membership data",
          details: validation.error.errors
        });
      }

      // Check if person exists
      const person = await storage.getCustomer(validation.data.customerId);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }

      const membership = await storage.addHouseholdMember(validation.data);
      res.status(201).json(membership);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error adding household member');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================================================================================
  // ACCOUNT ROUTES
  // ==================================================================================

  // GET /api/customers/:id/accounts - Get accounts for a person
  app.get("/api/customers/:id/accounts", 
    requirePermission({
      permissionCode: 'accounts.view',
      contextBuilder: async (req) => {
        const customerId = parseInt(req.params.id);
        if (!isNaN(customerId)) {
          const customer = await storage.getCustomer(customerId);
          if (customer) {
            return { customer };
          }
        }
        return {};
      }
    }),
    async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid person ID" });
      }

      // Check if person exists
      const person = await storage.getCustomer(customerId);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }

      const accounts = await storage.getCustomerAccounts(customerId);
      res.json(accounts);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching person accounts');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/customers/:id/deposit-analytics - Get deposit account analytics
  app.get("/api/customers/:id/deposit-analytics", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid person ID" });
      }

      const person = await storage.getCustomer(customerId);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }

      // SQL Server implementation
      if (isSQLServer()) {
        const { getMssqlPool } = await import('./dbConnection');
        const { getDepositAccountAnalyticsSqlServer } = await import('./storage/sqlServerDashboard');
        const pool = await getMssqlPool();
        const analytics = await getDepositAccountAnalyticsSqlServer(pool, customerId);
        
        return res.json({
          totalBalance: analytics.totalBalance,
          weightedAverageBalance: analytics.trendData.length > 0 
            ? analytics.trendData[analytics.trendData.length - 1].weightedAverage 
            : 0,
          balanceByType: analytics.balanceByType,
          trendData: analytics.trendData,
          recentTransactions: analytics.recentTransactions
        });
      }

      // PostgreSQL implementation
      const analytics = await storage.getDepositAccountAnalytics(customerId);
      
      // Generate REAL trend data from transaction history with continuous 12-month series
      const depositAccountIds = analytics.accounts
        .filter(acc => ['checking', 'deposit checking', 'savings', 'money_market', 'cd'].includes(acc.accountType))
        .map(acc => acc.accountId);

      let trendData: Array<{
        month: string;
        date: string;
        balance: number;
        checking: number;
        savings: number;
        cd: number;
        weightedAverage: number;
        weightedAvgChecking: number;
        weightedAvgSavings: number;
        weightedAvgCD: number;
      }> = [];
      
      if (depositAccountIds.length > 0) {
        // Query to get balances by account and month, then carry forward to fill gaps
        // Also calculate weighted average using account interest rates
        const monthlyData = await db.execute(sql`
          WITH RECURSIVE 
          -- Generate 12-month series
          month_series AS (
            SELECT DATE_TRUNC('month', NOW() - INTERVAL '11 months') + (n || ' month')::interval as month
            FROM generate_series(0, 11) n
          ),
          -- Get last transaction per account per month
          account_monthly_balances AS (
            SELECT DISTINCT ON (ft.account_id, DATE_TRUNC('month', ft.transaction_date))
              ft.account_id,
              a.account_type,
              DATE_TRUNC('month', ft.transaction_date) as month,
              ft.ledger_balance_after
            FROM financial_transaction ft
            INNER JOIN account a ON a.account_id = ft.account_id
            WHERE ft.account_id IN (${sql.join(depositAccountIds, sql`, `)})
              AND ft.transaction_date >= NOW() - INTERVAL '12 months'
            ORDER BY ft.account_id, DATE_TRUNC('month', ft.transaction_date), ft.transaction_date DESC, ft.transaction_id DESC
          ),
          -- Carry forward balances for months with no transactions
          filled_balances AS (
            SELECT 
              ms.month,
              acc.account_id,
              acc.account_type,
              acc.interest_rate,
              COALESCE(
                amb.ledger_balance_after,
                (
                  SELECT amb2.ledger_balance_after
                  FROM account_monthly_balances amb2
                  WHERE amb2.account_id = acc.account_id
                    AND amb2.month < ms.month
                  ORDER BY amb2.month DESC
                  LIMIT 1
                )
              ) as balance
            FROM month_series ms
            CROSS JOIN (
              SELECT account_id, account_type, interest_rate
              FROM account
              WHERE account_id IN (${sql.join(depositAccountIds, sql`, `)})
            ) acc
            LEFT JOIN account_monthly_balances amb 
              ON amb.account_id = acc.account_id 
              AND amb.month = ms.month
          )
          -- Aggregate by month and account type, calculate weighted average
          -- Normalize interest rates: multiply by 100 if stored as decimal (≤1)
          SELECT 
            month,
            account_type,
            SUM(COALESCE(balance, 0)) as balance,
            SUM(COALESCE(balance, 0) * CASE 
              WHEN COALESCE(interest_rate, 0) <= 1 THEN COALESCE(interest_rate, 0) * 100
              ELSE COALESCE(interest_rate, 0)
            END) as weighted_balance_sum,
            SUM(COALESCE(balance, 0)) as total_balance_for_weighted
          FROM filled_balances
          GROUP BY month, account_type
          ORDER BY month ASC, account_type
        `);

        // Build continuous 12-month trend data
        const monthMap = new Map();
        
        // Initialize all 12 months
        for (let i = 11; i >= 0; i--) {
          const monthDate = new Date();
          monthDate.setMonth(monthDate.getMonth() - i);
          monthDate.setDate(1);
          monthDate.setHours(0, 0, 0, 0);
          
          const monthKey = monthDate.toISOString().substring(0, 7); // YYYY-MM
          monthMap.set(monthKey, {
            month: monthDate.toLocaleString('default', { month: 'short', year: '2-digit' }),
            date: monthDate.toISOString(),
            balance: 0,
            checking: 0,
            savings: 0,
            cd: 0,
            weightedBalanceSum: 0,
            totalBalanceForWeighted: 0,
            weightedBalanceSumChecking: 0,
            totalBalanceForWeightedChecking: 0,
            weightedBalanceSumSavings: 0,
            totalBalanceForWeightedSavings: 0,
            weightedBalanceSumCD: 0,
            totalBalanceForWeightedCD: 0
          });
        }

        // Fill in actual data from query
        for (const row of (monthlyData as any).rows) {
          const monthDate = new Date(row.month);
          const monthKey = monthDate.toISOString().substring(0, 7);
          const data = monthMap.get(monthKey);
          
          if (data) {
            const accountType = row.account_type;
            const balance = Number(row.balance) || 0;
            const weightedBalanceSum = Number(row.weighted_balance_sum) || 0;
            const totalBalanceForWeighted = Number(row.total_balance_for_weighted) || 0;
            
            if (accountType === 'checking') {
              data.checking += balance;
              data.weightedBalanceSumChecking += weightedBalanceSum;
              data.totalBalanceForWeightedChecking += totalBalanceForWeighted;
            } else if (accountType === 'savings' || accountType === 'money_market') {
              data.savings += balance;
              data.weightedBalanceSumSavings += weightedBalanceSum;
              data.totalBalanceForWeightedSavings += totalBalanceForWeighted;
            } else if (accountType === 'cd') {
              data.cd += balance;
              data.weightedBalanceSumCD += weightedBalanceSum;
              data.totalBalanceForWeightedCD += totalBalanceForWeighted;
            }
            
            data.balance = data.checking + data.savings + data.cd;
            data.weightedBalanceSum += weightedBalanceSum;
            data.totalBalanceForWeighted += totalBalanceForWeighted;
          }
        }

        // Calculate weighted average for each month and convert to final format
        // Interest rates are already stored as percentages in DB (2.5 for 2.5%)
        trendData = Array.from(monthMap.values()).map(monthData => {
          const weightedAverage = monthData.totalBalanceForWeighted > 0 
            ? monthData.weightedBalanceSum / monthData.totalBalanceForWeighted
            : 0;
          
          const weightedAvgChecking = monthData.totalBalanceForWeightedChecking > 0
            ? monthData.weightedBalanceSumChecking / monthData.totalBalanceForWeightedChecking
            : 0;
          
          const weightedAvgSavings = monthData.totalBalanceForWeightedSavings > 0
            ? monthData.weightedBalanceSumSavings / monthData.totalBalanceForWeightedSavings
            : 0;
          
          const weightedAvgCD = monthData.totalBalanceForWeightedCD > 0
            ? monthData.weightedBalanceSumCD / monthData.totalBalanceForWeightedCD
            : 0;
          
          return {
            month: monthData.month,
            date: monthData.date,
            balance: monthData.balance,
            checking: monthData.checking,
            savings: monthData.savings,
            cd: monthData.cd,
            weightedAverage: weightedAverage,
            weightedAvgChecking: weightedAvgChecking,
            weightedAvgSavings: weightedAvgSavings,
            weightedAvgCD: weightedAvgCD
          };
        });
      }
      
      // If no transaction history, fall back to current balance only
      if (trendData.length === 0) {
        const now = new Date();
        trendData = [{
          month: now.toLocaleString('default', { month: 'short', year: '2-digit' }),
          date: now.toISOString(),
          balance: analytics.totalBalance,
          checking: analytics.balanceByType.checking,
          savings: analytics.balanceByType.savings,
          cd: analytics.balanceByType.cd,
          weightedAverage: 0,
          weightedAvgChecking: 0,
          weightedAvgSavings: 0,
          weightedAvgCD: 0
        }];
      }

      // Fetch real recent transactions from database (5 most recent deposit account transactions)
      let recentTransactions: any[] = [];
      if (depositAccountIds.length > 0) {
        const transactions = await db
          .select({
            accountId: financialTransaction.accountId,
            accountType: account.accountType,
            transactionDate: financialTransaction.transactionDate,
            transactionCode: financialTransaction.transactionCode,
            description: financialTransaction.description,
            amount: financialTransaction.amount,
            balance: financialTransaction.ledgerBalanceAfter
          })
          .from(financialTransaction)
          .innerJoin(account, eq(account.accountId, financialTransaction.accountId))
          .where(sql`${financialTransaction.accountId} IN (${sql.join(depositAccountIds, sql`, `)})`)
          .orderBy(desc(financialTransaction.transactionDate))
          .limit(5);

        recentTransactions = transactions.map(t => ({
          accountType: t.accountType,
          date: t.transactionDate ? t.transactionDate.toISOString() : new Date().toISOString(),
          type: t.transactionCode || 'Transaction',
          description: t.description || 'Transaction',
          amount: Number(t.amount) || 0,
          balance: Number(t.balance) || 0
        }));
      }

      // Don't send raw accounts to minimize data exposure
      const { accounts, ...analyticsData } = analytics;
      
      // Use the most recent trend data point as source of truth for current balances
      // This ensures totalBalance and balanceByType match what's shown in charts
      let finalTotalBalance = analyticsData.totalBalance;
      let finalBalanceByType = analyticsData.balanceByType;
      let finalWeightedAverageBalance = 0;
      
      if (trendData.length > 0) {
        const mostRecentMonth = trendData[trendData.length - 1];
        finalTotalBalance = mostRecentMonth.balance;
        finalBalanceByType = {
          checking: mostRecentMonth.checking,
          savings: mostRecentMonth.savings,
          cd: mostRecentMonth.cd
        };
        finalWeightedAverageBalance = mostRecentMonth.weightedAverage;
      }
      
      res.json({
        totalBalance: finalTotalBalance,
        weightedAverageBalance: finalWeightedAverageBalance,
        balanceByType: finalBalanceByType,
        trendData,
        recentTransactions
      });
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching deposit analytics');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/accounts/:id/balance-history - Get 12-month balance history for a single account
  app.get("/api/accounts/:id/balance-history", async (req, res) => {
    try {
      const accountId = parseInt(req.params.id);
      if (isNaN(accountId)) {
        return res.status(400).json({ error: "Invalid account ID" });
      }

      if (isSQLServer()) {
        const { getMssqlPool } = await import('./dbConnection');
        const { getAccountBalanceHistorySqlServer } = await import('./storage/sqlServerDashboard');
        const pool = await getMssqlPool();
        const trendData = await getAccountBalanceHistorySqlServer(pool, accountId);
        return res.json({ trendData });
      }

      // PostgreSQL implementation
      const monthlyData = await db.execute(sql`
        WITH RECURSIVE
        month_series AS (
          SELECT DATE_TRUNC('month', NOW() - INTERVAL '11 months') + (n || ' month')::interval as month
          FROM generate_series(0, 11) n
        ),
        account_monthly_balances AS (
          SELECT DISTINCT ON (ft.account_id, DATE_TRUNC('month', ft.transaction_date))
            ft.account_id,
            DATE_TRUNC('month', ft.transaction_date) as month,
            ft.ledger_balance_after
          FROM financial_transaction ft
          WHERE ft.account_id = ${accountId}
            AND ft.transaction_date >= NOW() - INTERVAL '12 months'
          ORDER BY ft.account_id, DATE_TRUNC('month', ft.transaction_date), ft.transaction_date DESC, ft.transaction_id DESC
        ),
        filled_balances AS (
          SELECT
            ms.month,
            COALESCE(
              amb.ledger_balance_after,
              (
                SELECT amb2.ledger_balance_after
                FROM account_monthly_balances amb2
                WHERE amb2.month < ms.month
                ORDER BY amb2.month DESC
                LIMIT 1
              )
            ) as balance
          FROM month_series ms
          LEFT JOIN account_monthly_balances amb
            ON amb.month = ms.month
        )
        SELECT
          month,
          COALESCE(balance, 0) as balance
        FROM filled_balances
        ORDER BY month ASC
      `);

      const trendData = (monthlyData as any).rows.map((row: any) => {
        const monthDate = new Date(row.month);
        return {
          month: monthDate.toLocaleString('default', { month: 'short', year: '2-digit' }),
          date: monthDate.toISOString(),
          balance: Number(row.balance) || 0
        };
      });

      // If all balances are 0, fall back to the account's current balance for the latest month
      if (trendData.length > 0 && trendData.every((d: any) => d.balance === 0)) {
        const acctResult = await db.execute(sql`
          SELECT balance FROM account WHERE account_id = ${accountId}
        `);
        const currentBal = Number((acctResult as any).rows?.[0]?.balance) || 0;
        if (currentBal !== 0) {
          trendData[trendData.length - 1].balance = currentBal;
        }
      }

      res.json({ trendData });
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching account balance history');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================================================================================
  // DASHBOARD CARDS API ENDPOINTS
  // ==================================================================================

  // GET /api/customers/:id/client-engagement - Get client engagement metrics
  app.get("/api/customers/:id/client-engagement", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ 
          code: "INVALID_PERSON_ID",
          message: "Invalid person ID",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      // Check if person exists
      const person = await storage.getCustomer(customerId);
      if (!person) {
        return res.status(404).json({ 
          code: "PERSON_NOT_FOUND",
          message: "Person not found",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      const engagement = await storage.getClientEngagement(customerId);
      if (!engagement) {
        return res.status(404).json({ 
          code: "NO_ONLINE_BANKING",
          message: "No online banking user found for this person",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      // Transform to DTO with PST formatting
      const engagementDTO: ClientEngagementType = {
        loginId: engagement.loginId,
        lastLoginAt: engagement.lastLoginAt ? DateFormatter.formatDateTimeWithTZ(engagement.lastLoginAt) : null,
        thirtyDayActivity: {
          direct_deposit: engagement.thirtyDayActivity.direct_deposit || 0,
          atm: engagement.thirtyDayActivity.atm || 0,
          billpay: engagement.thirtyDayActivity.billpay || 0,
          mobile_check_deposit: engagement.thirtyDayActivity.mobile_check_deposit || 0,
          zelle: engagement.thirtyDayActivity.zelle || 0,
          wire: engagement.thirtyDayActivity.wire || 0,
          ach: engagement.thirtyDayActivity.ach || 0
        }
      };

      // Runtime DTO validation in non-production
      if (process.env.NODE_ENV !== 'production') {
        try {
          ClientEngagementDTO.parse(engagementDTO);
        } catch (validationError) {
          logger.error({ err: validationError, module: 'routes' }, 'Client Engagement DTO validation failed');
          return res.status(500).json({ 
            code: "DTO_VALIDATION_FAILED",
            message: "Internal data contract violation",
            correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
            timestamp: new Date().toISOString()
          });
        }
      }

      res.json(engagementDTO);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching client engagement');
      res.status(500).json({ 
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /api/customers/:id/relationship-summary - Get relationship summary metrics
  app.get("/api/customers/:id/relationship-summary", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ 
          code: "INVALID_PERSON_ID",
          message: "Invalid person ID",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      // Check if person exists
      const person = await storage.getCustomer(customerId);
      if (!person) {
        return res.status(404).json({ 
          code: "PERSON_NOT_FOUND",
          message: "Person not found",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      const summary = await storage.getRelationshipSummary(customerId);

      // Transform to DTO (no date formatting needed for this DTO)
      const summaryDTO: RelationshipSummaryType = {
        totalDeposits: summary.totalDeposits,
        totalLoans: summary.totalLoans,
        depositsQoQ: {
          amountChange: summary.depositsQoQ.amountChange,
          percentChange: summary.depositsQoQ.percentChange
        },
        loansQoQ: {
          amountChange: summary.loansQoQ.amountChange,
          percentChange: summary.loansQoQ.percentChange
        }
      };

      // Runtime DTO validation in non-production
      if (process.env.NODE_ENV !== 'production') {
        try {
          RelationshipSummaryDTO.parse(summaryDTO);
        } catch (validationError) {
          logger.error({ err: validationError, module: 'routes' }, 'Relationship Summary DTO validation failed');
          return res.status(500).json({ 
            code: "DTO_VALIDATION_FAILED",
            message: "Internal data contract violation",
            correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
            timestamp: new Date().toISOString()
          });
        }
      }

      res.json(summaryDTO);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching relationship summary');
      res.status(500).json({ 
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /api/customers/:id/contact-history - Get contact history
  app.get("/api/customers/:id/contact-history", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ 
          code: "INVALID_PERSON_ID",
          message: "Invalid person ID",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      // Check if person exists
      const person = await storage.getCustomer(customerId);
      if (!person) {
        return res.status(404).json({ 
          code: "PERSON_NOT_FOUND",
          message: "Person not found",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      const contacts = await storage.getContactHistory(customerId, 5);

      // Transform to DTO with PST formatting
      const contactsDTO: ContactHistoryType = {
        recentContacts: contacts.map(contact => ({
          contactType: contact.contactType,
          occurredAt: DateFormatter.formatDateTimeWithTZ(contact.occurredAt),
          employeeName: contact.employeeName
        }))
      };

      // Runtime DTO validation in non-production
      if (process.env.NODE_ENV !== 'production') {
        try {
          ContactHistoryDTO.parse(contactsDTO);
        } catch (validationError) {
          logger.error({ err: validationError, module: 'routes' }, 'Contact History DTO validation failed');
          return res.status(500).json({ 
            code: "DTO_VALIDATION_FAILED",
            message: "Internal data contract violation",
            correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
            timestamp: new Date().toISOString()
          });
        }
      }

      res.json(contactsDTO);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching contact history');
      res.status(500).json({ 
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
        timestamp: new Date().toISOString()
      });
    }
  });

  // ==================================================================================
  // ACCOUNT MANAGEMENT API ENDPOINTS
  // ==================================================================================

  // GET /api/accounts - List accounts with optional filtering
  app.get("/api/accounts", async (req, res) => {
    try {
      const { accountType, accountStatus, branchId } = req.query;
      
      const filters: any = {};
      if (accountType) filters.accountType = String(accountType);
      if (accountStatus) filters.accountStatus = String(accountStatus);
      if (branchId) {
        const branchIdNum = parseInt(String(branchId));
        if (!isNaN(branchIdNum)) filters.branchId = branchIdNum;
      }
      
      const accounts = await storage.getAccounts(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(accounts);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching accounts');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/accounts/:id - Get specific account details
  app.get("/api/accounts/:id", async (req, res) => {
    try {
      const accountId = parseInt(req.params.id);
      if (isNaN(accountId)) {
        return res.status(400).json({ error: "Invalid account ID" });
      }

      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      res.json(account);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching account');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/accounts/:id/owners - Get account ownership information
  app.get("/api/accounts/:id/owners", async (req, res) => {
    try {
      const accountId = parseInt(req.params.id);
      if (isNaN(accountId)) {
        return res.status(400).json({ error: "Invalid account ID" });
      }

      // Check if account exists
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      const owners = await storage.getAccountOwners(accountId);
      res.json(owners);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching account owners');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/accounts/:id/debit-cards - Get debit cards for account with limit profiles
  app.get("/api/accounts/:id/debit-cards", async (req, res) => {
    try {
      const accountId = parseInt(req.params.id);
      if (isNaN(accountId)) {
        return res.status(400).json({ 
          code: "INVALID_ACCOUNT_ID",
          error: "Invalid account ID",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      // Check if account exists
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ 
          code: "ACCOUNT_NOT_FOUND",
          error: "Account not found",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      // Business rule: Debit cards only exist on checking and business_checking accounts
      // This is enforced by database triggers, but we provide helpful error messages here
      const eligibleAccountTypes = ['checking', 'business_checking'];
      if (!eligibleAccountTypes.includes(account.accountType)) {
        return res.json({ 
          cards: [],
          message: "Debit cards are only available for checking accounts"
        });
      }

      const cards = await storage.getAccountDebitCards(accountId);
      res.json({ 
        cards,
        accountId,
        accountType: account.accountType
      });
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching account debit cards');
      res.status(500).json({ 
        code: "INTERNAL_SERVER_ERROR",
        error: "Internal server error",
        correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
        timestamp: new Date().toISOString()
      });
    }
  });

  // GET /api/accounts/:id/sic-codes - Get SIC codes for account with descriptions
  app.get("/api/accounts/:id/sic-codes", async (req, res) => {
    try {
      const accountId = parseInt(req.params.id);
      if (isNaN(accountId)) {
        return res.status(400).json({ 
          code: "INVALID_ACCOUNT_ID",
          error: "Invalid account ID",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      // Check if account exists
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ 
          code: "ACCOUNT_NOT_FOUND",
          error: "Account not found",
          correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
          timestamp: new Date().toISOString()
        });
      }

      const sicCodes = await storage.getAccountSicCodesWithDescriptions(accountId);
      res.json({ 
        sicCodes,
        accountId
      });
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching account SIC codes');
      res.status(500).json({ 
        code: "INTERNAL_SERVER_ERROR",
        error: "Internal server error",
        correlationId: req.headers['x-correlation-id']?.toString() || 'unknown',
        timestamp: new Date().toISOString()
      });
    }
  });

  // POST /api/accounts/:id/owners - Add account owner
  app.post("/api/accounts/:id/owners", async (req, res) => {
    try {
      const accountId = parseInt(req.params.id);
      if (isNaN(accountId)) {
        return res.status(400).json({ error: "Invalid account ID" });
      }

      // Check if account exists
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: "Account not found" });
      }

      // Validate request body with account ownership schema
      const validation = insertAccountOwnershipSchema.safeParse({
        ...req.body,
        accountId
      });

      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid ownership data", 
          details: validation.error.issues 
        });
      }

      // Check if person exists
      const person = await storage.getCustomer(validation.data.customerId);
      if (!person) {
        return res.status(404).json({ error: "Person not found" });
      }

      const ownership = await storage.addAccountOwner(validation.data);
      res.status(201).json(ownership);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error adding account owner');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PUT /api/accounts/:id - Update account information
  app.put("/api/accounts/:id", async (req, res) => {
    try {
      const accountId = parseInt(req.params.id);
      if (isNaN(accountId)) {
        return res.status(400).json({ error: "Invalid account ID" });
      }

      // Check if account exists
      const existingAccount = await storage.getAccount(accountId);
      if (!existingAccount) {
        return res.status(404).json({ error: "Account not found" });
      }

      // Validate request body with partial account schema
      const validation = insertAccountSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid account data", 
          details: validation.error.issues 
        });
      }

      const updatedAccount = await storage.updateAccount(accountId, validation.data);
      if (!updatedAccount) {
        return res.status(404).json({ error: "Account not found" });
      }

      res.json(updatedAccount);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error updating account');
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ==================================================================================
  // TRANSACTION ROUTES
  // ==================================================================================

  // Diagnostic: Check transaction data integrity for a customer
  app.get("/api/diagnostics/transactions/:customerId", async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      if (isNaN(customerId)) return res.status(400).json({ error: "Invalid customer ID" });

      if (isSQLServer()) {
        const { getMssqlPool } = await import('./dbConnection');
        const mssql = await import('mssql');
        const pool = await getMssqlPool();

        // 1. Get customer's account IDs from account_ownership
        const r1 = pool.request();
        r1.input('custId', mssql.default.BigInt, customerId);
        const ownershipResult = await r1.query(`
          SELECT ao.account_id, a.account_number, a.account_type
          FROM account_ownership ao
          INNER JOIN account a ON a.account_id = ao.account_id
          WHERE ao.customer_id = @custId
        `);
        const customerAccountIds = ownershipResult.recordset.map((r: any) => r.account_id);

        // 2. Check which accounts have transactions
        const accountTxCounts: any[] = [];
        for (const acctId of customerAccountIds.slice(0, 10)) { // Check first 10
          const r2 = pool.request();
          r2.input('acctId', mssql.default.BigInt, acctId);
          const txCount = await r2.query(`SELECT COUNT(*) as cnt FROM financial_transaction WHERE account_id = @acctId`);
          accountTxCounts.push({
            accountId: acctId,
            accountNumber: ownershipResult.recordset.find((r: any) => r.account_id === acctId)?.account_number,
            transactionCount: txCount.recordset[0].cnt
          });
        }

        // 3. Total transactions in table
        const r3 = pool.request();
        const totalTx = await r3.query(`SELECT COUNT(*) as cnt FROM financial_transaction`);

        // 4. Sample account_ids from financial_transaction
        const r4 = pool.request();
        const sampleFt = await r4.query(`SELECT DISTINCT TOP 10 account_id FROM financial_transaction ORDER BY account_id`);

        // 5. Check data types
        const r5 = pool.request();
        const colInfo = await r5.query(`
          SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE COLUMN_NAME = 'account_id' AND TABLE_NAME IN ('financial_transaction', 'account', 'account_ownership')
        `);

        // 6. Direct match: find transactions for this customer via subquery (same as TransactionHistory uses)
        const r6 = pool.request();
        r6.input('custId2', mssql.default.BigInt, customerId);
        const directMatch = await r6.query(`
          SELECT COUNT(*) as cnt FROM financial_transaction ft
          WHERE ft.account_id IN (
            SELECT account_id FROM account_ownership WHERE customer_id = @custId2
          )
        `);

        // 7. Try matching first customer account_id directly in financial_transaction
        let firstAccountDirectCheck = null;
        if (customerAccountIds.length > 0) {
          const r7 = pool.request();
          const firstId = customerAccountIds[0];
          r7.input('firstAcctId', mssql.default.BigInt, firstId);
          const directResult = await r7.query(`SELECT TOP 3 transaction_id, account_id, amount FROM financial_transaction WHERE account_id = @firstAcctId`);
          // Also try with raw SQL to rule out parameterization issues
          const r8 = pool.request();
          const rawResult = await r8.query(`SELECT TOP 3 transaction_id, account_id, amount FROM financial_transaction WHERE account_id = ${Number(firstId)}`);
          firstAccountDirectCheck = {
            accountId: firstId,
            accountIdType: typeof firstId,
            parameterizedCount: directResult.recordset.length,
            rawSqlCount: rawResult.recordset.length,
            parameterizedResults: directResult.recordset,
            rawSqlResults: rawResult.recordset
          };
        }

        return res.json({
          customerId,
          customerAccountCount: customerAccountIds.length,
          customerAccountIds_sample: customerAccountIds.slice(0, 5),
          accountTransactionCounts: accountTxCounts,
          directSubqueryMatchCount: directMatch.recordset[0].cnt,
          firstAccountDirectCheck,
          totalTransactionsInTable: totalTx.recordset[0].cnt,
          sampleAccountIdsInTransactions: sampleFt.recordset.map((r: any) => r.account_id),
          columnDataTypes: colInfo.recordset,
          diagnosis: accountTxCounts.every(a => a.transactionCount === 0)
            ? "MISMATCH: Customer accounts have 0 transactions. The account_id values in financial_transaction likely don't match the account table."
            : "Some accounts have transactions. The issue may be with specific accounts."
        });
      }

      res.json({ error: "Diagnostic only available for SQL Server" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get transactions with flexible filtering
  app.get("/api/transactions", async (req, res) => {
    try {
      const { accountId, customerId, startDate, endDate, limit = 100, offset = 0 } = req.query;
      
      const params: any = {
        limit: Number(limit),
        offset: Number(offset)
      };
      
      if (accountId) params.accountId = Number(accountId);
      if (customerId) params.customerId = Number(customerId);
      if (startDate) params.startDate = new Date(startDate as string);
      if (endDate) params.endDate = new Date(endDate as string);
      
      const result = await storage.getTransactions(params);
      res.json(result);
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching transactions');
      res.status(500).json({ error: error.message || "Failed to fetch transactions" });
    }
  });

  // Get transactions for a specific account
  app.get("/api/accounts/:accountId/transactions",
    requirePermission({
      permissionCode: 'transaction.view',
      contextBuilder: async (req) => {
        const accountId = parseInt(req.params.accountId);
        if (!isNaN(accountId)) {
          // Get account owners to check if any are employee customers
          const owners = await storage.getAccountOwners(accountId);
          if (owners.length > 0) {
            // Check ALL owners - if ANY owner is an employee, apply restriction
            for (const owner of owners) {
              const customer = await storage.getCustomer(owner.customerId);
              if (customer && customer.isEmployee === true) {
                // Found an employee owner - return this customer for ABAC check
                return { customer };
              }
            }
            // No employee owners found - return first owner for context
            const firstCustomer = await storage.getCustomer(owners[0].customerId);
            if (firstCustomer) {
              return { customer: firstCustomer };
            }
          }
        }
        return {};
      }
    }),
    async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const { limit = 100, offset = 0 } = req.query;
      
      const transactions = await storage.getTransactionsByAccount(
        accountId,
        Number(limit),
        Number(offset)
      );
      
      res.json({ transactions });
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching account transactions');
      res.status(500).json({ error: error.message || "Failed to fetch account transactions" });
    }
  });

  // Get transactions for a specific person (all their accounts)
  app.get("/api/customers/:customerId/transactions",
    requirePermission({
      permissionCode: 'transaction.view',
      contextBuilder: async (req) => {
        const customerId = parseInt(req.params.customerId);
        if (!isNaN(customerId)) {
          const customer = await storage.getCustomer(customerId);
          if (customer) {
            return { customer };
          }
        }
        return {};
      }
    }),
    async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      const { limit = 100, offset = 0 } = req.query;
      
      const transactions = await storage.getTransactionsByCustomer(
        customerId,
        Number(limit),
        Number(offset)
      );
      
      // Also get the person's accounts to enrich the transaction data
      const accounts = await storage.getCustomerAccounts(customerId);
      const accountMap = new Map(accounts.map(acc => [acc.accountId, acc]));
      
      // Enrich transactions with account details
      const enrichedTransactions = transactions.map(trans => ({
        ...trans,
        accountNumber: accountMap.get(trans.accountId)?.accountNumber || 'Unknown',
        accountType: accountMap.get(trans.accountId)?.accountType || 'Unknown'
      }));
      
      res.json({ transactions: enrichedTransactions });
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching person transactions');
      res.status(500).json({ error: error.message || "Failed to fetch person transactions" });
    }
  });

  // Get transactions for a specific account
  app.get("/api/accounts/:accountId/transactions",
    requirePermission({
      permissionCode: 'transaction.view',
      contextBuilder: async (req) => {
        const accountId = parseInt(req.params.accountId);
        if (!isNaN(accountId)) {
          // Get account owners to check if any are employee customers
          const owners = await storage.getAccountOwners(accountId);
          if (owners.length > 0) {
            // Check ALL owners - if ANY owner is an employee, apply restriction
            for (const owner of owners) {
              const customer = await storage.getCustomer(owner.customerId);
              if (customer && customer.isEmployee === true) {
                // Found an employee owner - return this customer for ABAC check
                return { customer };
              }
            }
            // No employee owners found - return first owner for context
            const firstCustomer = await storage.getCustomer(owners[0].customerId);
            if (firstCustomer) {
              return { customer: firstCustomer };
            }
          }
        }
        return {};
      }
    }),
    async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const { limit = 100, offset = 0 } = req.query;
      
      const transactions = await storage.getTransactionsByAccount(
        accountId,
        Number(limit),
        Number(offset)
      );
      
      res.json({ transactions });
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching account transactions');
      res.status(500).json({ error: error.message || "Failed to fetch account transactions" });
    }
  });

  // Get transaction categories
  app.get("/api/transaction-categories", async (req, res) => {
    try {
      const categories = await storage.getTransactionCategories();
      res.json({ categories });
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching transaction categories');
      res.status(500).json({ error: error.message || "Failed to fetch categories" });
    }
  });

  // ==================================================================================
  // NOTES MODULE ROUTES
  // ==================================================================================

  // Validation schemas for notes endpoints
  const createNoteSchema = z.object({
    customerId: z.coerce.number().int().positive().optional(),
    accountId: z.coerce.number().int().positive().optional(),
    targetType: z.enum(['customer', 'account']),
    categoryId: z.coerce.number().int().positive().optional(),
    importance: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    visibility: z.enum(['public', 'internal', 'confidential']).default('internal'),
    title: z.string().min(1).max(200),
    body: z.string().min(1),
    legalHold: z.boolean().optional(),
    retentionYears: z.coerce.number().int().positive().optional(),
    isPinned: z.boolean().optional(),
    authorEmployeeId: z.coerce.number().int().positive().optional()
  }).refine(data => {
    if (data.targetType === 'customer') {
      return data.customerId !== undefined && data.accountId === undefined;
    } else {
      return data.accountId !== undefined && data.customerId === undefined;
    }
  }, {
    message: "Must provide either customerId or accountId based on targetType"
  });

  const updateNoteSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    body: z.string().min(1).optional(),
    categoryId: z.coerce.number().int().positive().nullable().optional(),
    importance: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    visibility: z.enum(['public', 'internal', 'confidential']).optional(),
    legalHold: z.boolean().optional(),
    retentionYears: z.coerce.number().int().positive().nullable().optional(),
    isPinned: z.boolean().optional(),
    authorEmployeeId: z.coerce.number().int().positive().optional()
  });

  const pinNoteSchema = z.object({
    isPinned: z.boolean()
  });

  const restoreNoteSchema = z.object({
    employeeId: z.coerce.number().int().positive().optional()
  });

  const searchNotesSchema = z.object({
    q: z.string().optional(),
    targetType: z.enum(['customer', 'account']).optional(),
    targetId: z.coerce.number().int().positive().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    importance: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    visibility: z.enum(['public', 'internal', 'confidential']).optional(),
    authorEmployeeId: z.coerce.number().int().positive().optional(),
    includeDeleted: z.enum(["true","false"]).optional().transform(v => v === "true"),
    limit: z.coerce.number().int().positive().max(100).optional(),
    offset: z.coerce.number().int().min(0).optional()
  });

  // Get all note categories
  app.get("/api/note-categories", async (req, res) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const categories = await storage.getNoteCategories(includeInactive);
      res.json({ categories });
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching note categories');
      res.status(500).json({ error: error.message || "Failed to fetch note categories" });
    }
  });

  // Get customer notes
  app.get("/api/customers/:id/notes", async (req, res) => {
    try {
      const customerId = parseInt(req.params.id);
      if (isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }

      const includeDeleted = req.query.includeDeleted === 'true';
      const notes = await storage.getCustomerNotes(customerId, includeDeleted);
      res.json({ notes });
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching customer notes');
      res.status(500).json({ error: error.message || "Failed to fetch customer notes" });
    }
  });

  // Get account notes
  app.get("/api/accounts/:id/notes", async (req, res) => {
    try {
      const accountId = parseInt(req.params.id);
      if (isNaN(accountId)) {
        return res.status(400).json({ error: "Invalid account ID" });
      }

      const includeDeleted = req.query.includeDeleted === 'true';
      const notes = await storage.getAccountNotes(accountId, includeDeleted);
      res.json({ notes });
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching account notes');
      res.status(500).json({ error: error.message || "Failed to fetch account notes" });
    }
  });

  // Get specific note
  app.get("/api/notes/:id", async (req, res) => {
    try {
      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ error: "Invalid note ID" });
      }

      const note = await storage.getNote(noteId);
      
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      res.json(note);
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching note');
      res.status(500).json({ error: error.message || "Failed to fetch note" });
    }
  });

  // Create new note
  app.post("/api/notes", async (req, res) => {
    try {
      const validation = createNoteSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validation.error.format() 
        });
      }

      const { authorEmployeeId = 1, ...noteData } = validation.data;
      const newNote = await storage.createNote(noteData, authorEmployeeId);
      res.status(201).json(newNote);
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error creating note');
      res.status(500).json({ error: error.message || "Failed to create note" });
    }
  });

  // Update note
  app.patch("/api/notes/:id", async (req, res) => {
    try {
      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ error: "Invalid note ID" });
      }

      const validation = updateNoteSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validation.error.format() 
        });
      }

      const { authorEmployeeId = 1, ...rawUpdateData } = validation.data;
      
      // Coerce null values to undefined for clean database writes
      const updateData: any = {};
      for (const [key, value] of Object.entries(rawUpdateData)) {
        if (value !== null) {
          updateData[key] = value;
        }
      }
      
      const updatedNote = await storage.updateNote(noteId, updateData, authorEmployeeId);
      
      if (!updatedNote) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      res.json(updatedNote);
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error updating note');
      res.status(500).json({ error: error.message || "Failed to update note" });
    }
  });

  // Soft delete note
  app.delete("/api/notes/:id", async (req, res) => {
    try {
      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ error: "Invalid note ID" });
      }

      const employeeIdParam = req.query.employeeId as string;
      const deletedByEmployeeId = employeeIdParam ? parseInt(employeeIdParam) : 1;
      
      if (isNaN(deletedByEmployeeId)) {
        return res.status(400).json({ error: "Invalid employee ID" });
      }

      const success = await storage.softDeleteNote(noteId, deletedByEmployeeId);
      
      if (!success) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      res.json({ success: true, message: "Note deleted successfully" });
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error deleting note');
      res.status(500).json({ error: error.message || "Failed to delete note" });
    }
  });

  // Restore soft-deleted note
  app.post("/api/notes/:id/restore", async (req, res) => {
    try {
      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ error: "Invalid note ID" });
      }

      const validation = restoreNoteSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validation.error.format() 
        });
      }

      const restoredByEmployeeId = validation.data.employeeId || 1;
      const success = await storage.restoreNote(noteId, restoredByEmployeeId);
      
      if (!success) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      res.json({ success: true, message: "Note restored successfully" });
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error restoring note');
      res.status(500).json({ error: error.message || "Failed to restore note" });
    }
  });

  // Pin/unpin note
  app.post("/api/notes/:id/pin", async (req, res) => {
    try {
      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ error: "Invalid note ID" });
      }

      const validation = pinNoteSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validation.error.format() 
        });
      }

      const { isPinned } = validation.data;
      const success = await storage.pinNote(noteId, isPinned);
      
      if (!success) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      res.json({ success: true, message: `Note ${isPinned ? 'pinned' : 'unpinned'} successfully` });
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error pinning/unpinning note');
      res.status(500).json({ error: error.message || "Failed to pin/unpin note" });
    }
  });

  // Get note version history
  app.get("/api/notes/:id/versions", async (req, res) => {
    try {
      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ error: "Invalid note ID" });
      }

      const versions = await storage.getNoteVersions(noteId);
      res.json({ versions });
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching note versions');
      res.status(500).json({ error: error.message || "Failed to fetch note versions" });
    }
  });

  // Search notes
  app.get("/api/notes/search", async (req, res) => {
    try {
      const validation = searchNotesSchema.safeParse(req.query);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid search parameters", 
          details: validation.error.format() 
        });
      }

      const searchParams = {
        query: validation.data.q,
        targetType: validation.data.targetType,
        targetId: validation.data.targetId,
        categoryId: validation.data.categoryId,
        importance: validation.data.importance,
        visibility: validation.data.visibility,
        authorEmployeeId: validation.data.authorEmployeeId,
        includeDeleted: validation.data.includeDeleted || false,
        limit: validation.data.limit || 50,
        offset: validation.data.offset || 0
      };
      
      const result = await storage.searchNotes(searchParams);
      res.json(result);
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error searching notes');
      res.status(500).json({ error: error.message || "Failed to search notes" });
    }
  });

  // ==================================================================================
  // AUTHENTICATION ROUTES
  // ==================================================================================

  // Check if SAML is enabled via environment variable
  const isSamlEnabled = () => {
    return process.env.SAML_ENABLED === 'true' && 
           process.env.SAML_IDP_LOGIN_URL && 
           process.env.SAML_ENTRYPOINT;
  };

  // Login endpoint - Redirects to IdP or returns info for development
  app.get("/api/auth/login", (req, res) => {
    if (isSamlEnabled() && process.env.SAML_IDP_LOGIN_URL) {
      logger.info({ module: 'routes', idpUrl: process.env.SAML_IDP_LOGIN_URL }, 'Redirecting to SAML IdP');
      return res.redirect(process.env.SAML_IDP_LOGIN_URL);
    }
    
    // Development mode - no SAML configured
    logger.info({ module: 'routes' }, 'SAML not configured, returning dev mode response');
    return res.status(200).json({
      message: 'Development mode - SAML not configured',
      samlEnabled: false,
      hint: 'Set SAML_ENABLED=true and configure SAML_IDP_LOGIN_URL for production SSO'
    });
  });

  // Logout endpoint - Destroys session and returns success
  app.post("/api/auth/logout", (req, res) => {
    const employeeId = (req as any).session?.employeeId || req.employeeId;
    logger.info({ module: 'routes', employeeId }, 'Logout requested');
    
    // For now, just return success since session handling is simplified in dev
    return res.json({ success: true, message: 'Logged out successfully' });
  });

  // Get current authentication status
  app.get("/api/auth/status", (req, res) => {
    // In development, check if employeeId is set
    const isAuthenticated = !!req.employeeId;
    
    res.json({
      isAuthenticated,
      employeeId: req.employeeId || null,
      samlEnabled: isSamlEnabled()
    });
  });

  // ==================================================================================
  // RBAC PERMISSION ROUTES
  // ==================================================================================

  app.get("/api/auth/permissions", async (req, res) => {
    try {
      // Support both query param (for checking other users) and session (for current user)
      const employeeId = req.query.employeeId 
        ? parseInt(req.query.employeeId as string) 
        : req.employeeId;

      if (!employeeId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Always get base permissions from storage first
      const basePermissions = await storage.getEmployeePermissions(employeeId);

      // If role testing is enabled, wrap with role test service
      if (roleTestService.isEnabled()) {
        const permissions = await roleTestService.getPermissions(employeeId, basePermissions);
        return res.json(permissions);
      }

      res.json(basePermissions);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching permissions');
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  app.post("/api/auth/check-permission", async (req, res) => {
    try {
      const employeeId = req.employeeId;

      if (!employeeId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { permissionCode, context } = req.body;

      if (!permissionCode) {
        return res.status(400).json({ error: "Permission code is required" });
      }

      const result = await storage.checkPermission(employeeId, permissionCode, context || {});
      res.json(result);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error checking permission');
      res.status(500).json({ error: "Failed to check permission" });
    }
  });

  // ==================================================================================
  // ROLE TESTING ROUTES (Development Only)
  // ==================================================================================

  // Get all available roles for role testing
  app.get("/api/auth/role-test/options", async (req, res) => {
    try {
      if (!roleTestService.isEnabled()) {
        return res.status(403).json({ error: "Role testing is not available in production" });
      }

      const employeeId = req.employeeId;
      if (!employeeId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const roles = await roleTestService.getAllRoles();
      res.json(roles);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching role test options');
      res.status(500).json({ error: "Failed to fetch role options" });
    }
  });

  // Activate role testing for the current user
  app.post("/api/auth/role-test/activate", async (req, res) => {
    try {
      if (!roleTestService.isEnabled()) {
        return res.status(403).json({ error: "Role testing is not available in production" });
      }

      const employeeId = req.employeeId;
      if (!employeeId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { roleId } = req.body;
      if (!roleId) {
        return res.status(400).json({ error: "roleId is required" });
      }

      await roleTestService.setOverride(employeeId, parseInt(roleId));
      const basePermissions = await storage.getEmployeePermissions(employeeId);
      const updatedPermissions = await roleTestService.getPermissions(employeeId, basePermissions);
      
      res.json({ 
        message: "Role testing activated", 
        permissions: updatedPermissions 
      });
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error activating role test');
      res.status(500).json({ error: error.message || "Failed to activate role testing" });
    }
  });

  // Reset role testing for the current user
  app.post("/api/auth/role-test/reset", async (req, res) => {
    try {
      if (!roleTestService.isEnabled()) {
        return res.status(403).json({ error: "Role testing is not available in production" });
      }

      const employeeId = req.employeeId;
      if (!employeeId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      roleTestService.clearOverride(employeeId);
      const updatedPermissions = await storage.getEmployeePermissions(employeeId);
      
      res.json({ 
        message: "Role testing reset", 
        permissions: updatedPermissions 
      });
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error resetting role test');
      res.status(500).json({ error: error.message || "Failed to reset role testing" });
    }
  });

  // ==================================================================================
  // USER MANAGEMENT ROUTES (Level 4 Only)
  // ==================================================================================

  app.get("/api/admin/users", requirePermission({ permissionCode: "users.view" }), async (req, res) => {
    try {
      const { search, roleId, isActive, department } = req.query;
      const filters = {
        search: search as string | undefined,
        roleId: roleId ? parseInt(roleId as string) : undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        department: department as string | undefined
      };
      const users = await storage.listUsers(filters);
      res.json(users);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error listing users');
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/users/:id", requirePermission({ permissionCode: "users.view" }), async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const requestingUserId = req.employeeId!;
      const user = await storage.getUserById(employeeId, requestingUserId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching user');
      res.status(500).json({ error: "Failed to fetch user details" });
    }
  });

  app.post("/api/admin/users/:id/roles", requirePermission({ permissionCode: "users.assign_roles" }), async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const result = assignRoleSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid role assignment data", details: result.error.errors });
      }
      const assignedByUserId = req.employeeId!;
      await storage.assignRole(employeeId, result.data, assignedByUserId);
      res.json({ message: "Role assigned successfully" });
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error assigning role');
      res.status(500).json({ error: error.message || "Failed to assign role" });
    }
  });

  app.delete("/api/admin/users/:id/roles/:roleId", requirePermission({ permissionCode: "users.assign_roles" }), async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const roleId = parseInt(req.params.roleId);
      const result = removeRoleSchema.safeParse({ roleId, ...req.body });
      if (!result.success) {
        return res.status(400).json({ error: "Invalid role removal data", details: result.error.errors });
      }
      const removedByUserId = req.employeeId!;
      await storage.removeRole(employeeId, result.data, removedByUserId);
      res.json({ message: "Role removed successfully" });
    } catch (error: any) {
      logger.error({ err: error, module: 'routes' }, 'Error removing role');
      res.status(500).json({ error: error.message || "Failed to remove role" });
    }
  });

  app.get("/api/admin/roles", requirePermission({ permissionCode: "users.view" }), async (req, res) => {
    try {
      const roles = await storage.getAllRoles();
      res.json(roles);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching roles');
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  // ==================================================================================
  // SAML ROLE MAPPING ROUTES (System Admin Only)
  // ==================================================================================

  app.get("/api/admin/saml-mappings", requirePermission({ permissionCode: "user_management.view" }), async (req, res) => {
    try {
      const { samlRoleMappingService } = await import("./services/samlRoleMappingService");
      const mappings = await samlRoleMappingService.getAllMappings();
      res.json(mappings);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error fetching SAML mappings');
      res.status(500).json({ error: "Failed to fetch SAML role mappings" });
    }
  });

  app.post("/api/admin/saml-mappings", requirePermission({ permissionCode: "user_management.assign_roles" }), async (req, res) => {
    try {
      const { samlRoleKey, roleId, syncMode, description } = req.body;
      
      if (!samlRoleKey || !roleId) {
        return res.status(400).json({ error: "samlRoleKey and roleId are required" });
      }

      const { samlRoleMappingService } = await import("./services/samlRoleMappingService");
      const result = await samlRoleMappingService.createMapping(
        samlRoleKey,
        roleId,
        syncMode || 'initial',
        description,
        req.employeeId
      );

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.json(result);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error creating SAML mapping');
      res.status(500).json({ error: "Failed to create SAML role mapping" });
    }
  });

  app.patch("/api/admin/saml-mappings/:id", requirePermission({ permissionCode: "user_management.assign_roles" }), async (req, res) => {
    try {
      const mappingId = parseInt(req.params.id);
      const updates = req.body;

      const { samlRoleMappingService } = await import("./services/samlRoleMappingService");
      const result = await samlRoleMappingService.updateMapping(mappingId, updates);

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.json(result);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error updating SAML mapping');
      res.status(500).json({ error: "Failed to update SAML role mapping" });
    }
  });

  app.delete("/api/admin/saml-mappings/:id", requirePermission({ permissionCode: "user_management.assign_roles" }), async (req, res) => {
    try {
      const mappingId = parseInt(req.params.id);

      const { samlRoleMappingService } = await import("./services/samlRoleMappingService");
      const result = await samlRoleMappingService.deleteMapping(mappingId);

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.json(result);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error deleting SAML mapping');
      res.status(500).json({ error: "Failed to delete SAML role mapping" });
    }
  });

  // Manual role assignment endpoint (bypasses SAML)
  app.post("/api/admin/users/:id/roles/manual", requirePermission({ permissionCode: "users.assign_roles" }), async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const { roleId, reason } = req.body;

      if (!roleId) {
        return res.status(400).json({ error: "roleId is required" });
      }

      const { samlRoleMappingService } = await import("./services/samlRoleMappingService");
      const result = await samlRoleMappingService.assignRoleManually(
        employeeId,
        roleId,
        req.employeeId!,
        reason
      );

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.json(result);
    } catch (error) {
      logger.error({ err: error, module: 'routes' }, 'Error assigning role manually');
      res.status(500).json({ error: "Failed to assign role" });
    }
  });

  // ==================================================================================
  // HEALTH CHECK ROUTE
  // ==================================================================================

  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      service: "Banking Customer API"
    });
  });

  // API-only 404 handler - MUST be last to catch unmatched API routes
  app.use("/api", (_req, res) => res.status(404).json({ error: "API endpoint not found" }));

  const httpServer = createServer(app);
  return httpServer;
}