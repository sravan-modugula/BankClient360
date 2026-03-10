import { Strategy as SamlStrategy } from 'passport-saml';
import { db } from '../db';
import { employee } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { samlRoleMappingService } from '../services/samlRoleMappingService';
import logger from '../services/logger';

const fileLogger = logger.child({ module: 'saml-strategy' });

// SAML attribute mappings from RSA IdP
// UPDATE THESE based on your actual RSA IdP attribute names
const ATTRIBUTE_MAP = {
  employeeId: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/employeeid',
  employeeNumber: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/employeenumber',
  firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
  lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
  email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  department: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/department',
  role: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'
};

export function createSamlStrategy() {
  return new SamlStrategy(
    {
      // RSA IdP Configuration - UPDATE with your actual values
      entryPoint: process.env.SAML_ENTRYPOINT!,
      issuer: process.env.SAML_ISSUER || 'ClientIQ-Production',
      callbackUrl: process.env.SAML_CALLBACK_URL!,
      cert: process.env.SAML_CERT!,
      
      // Optional: For encrypted assertions
      decryptionPvk: process.env.SAML_DECRYPT_KEY,
      
      // Security options
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
      wantAssertionsSigned: true,
      
      // NameID format
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      
      // Logout configuration
      logoutUrl: process.env.SAML_LOGOUT_URL,
      logoutCallbackUrl: process.env.SAML_LOGOUT_CALLBACK_URL,
      
      // Audience/Issuer validation
      audience: process.env.SAML_ISSUER || 'ClientIQ-Production',
      
      // Accept clock skew (in seconds)
      acceptedClockSkewMs: 5 * 60 * 1000, // 5 minutes
      
      // IdP-Initiated SSO Support
      // Set to 'never' to allow SAML assertions without a corresponding AuthnRequest
      // This is required for IdP-initiated flows where the IdP sends users directly to us
      validateInResponseTo: 'never' as const,
      
      // Passport options
      passReqToCallback: false
    },
    
    // Verify callback - called after successful assertion validation
    async (profile: any, done: any) => {
      try {
        fileLogger.info({ nameID: profile.nameID, attributes: Object.keys(profile) }, 'Processing authentication for profile');

        // Extract attributes from SAML assertion
        const employeeIdStr = profile[ATTRIBUTE_MAP.employeeId];
        const employeeNumber = profile[ATTRIBUTE_MAP.employeeNumber];
        const firstName = profile[ATTRIBUTE_MAP.firstName];
        const lastName = profile[ATTRIBUTE_MAP.lastName];
        const email = profile[ATTRIBUTE_MAP.email] || profile.nameID;
        const department = profile[ATTRIBUTE_MAP.department] || null;
        const samlRoleKey = profile[ATTRIBUTE_MAP.role] || null;
        
        // Validate required attributes
        if (!employeeIdStr || !employeeNumber) {
          fileLogger.error({ employeeId: employeeIdStr, employeeNumber }, 'Missing required SAML attributes');
          return done(new Error('Missing required SAML attributes: employeeId or employeeNumber'));
        }
        
        const employeeId = parseInt(employeeIdStr, 10);
        
        if (isNaN(employeeId)) {
          fileLogger.error({ employeeIdStr }, 'Invalid employeeId format');
          return done(new Error('Invalid employeeId format'));
        }

        fileLogger.info({ employeeId, employeeNumber, firstName, lastName, email, department, samlRoleKey }, 'Extracted SAML attributes');
        
        // Lookup existing employee
        const existingEmployee = await db
          .select()
          .from(employee)
          .where(eq(employee.employeeId, employeeId))
          .limit(1);
        
        const isFirstLogin = existingEmployee.length === 0;
        
        fileLogger.info({ employeeId, isFirstLogin, exists: !isFirstLogin }, 'Employee lookup result');
        
        // Upsert employee record
        await db
          .insert(employee)
          .values({
            employeeId,
            employeeNumber,
            firstName,
            lastName,
            email,
            department,
            lastSeenSamlRole: samlRoleKey,
            lastLoginAt: new Date()
          })
          .onConflictDoUpdate({
            target: employee.employeeId,
            set: {
              firstName,
              lastName,
              email,
              department,
              lastSeenSamlRole: samlRoleKey,
              lastLoginAt: new Date()
            }
          });

        fileLogger.info('Employee record upserted successfully');
        
        // Process SAML role mapping (auto-assign roles)
        try {
          const roleResult = await samlRoleMappingService.processSamlRole(
            employeeId,
            samlRoleKey,
            isFirstLogin
          );
          
          fileLogger.info({ success: roleResult.success, assigned: roleResult.assigned, roleName: roleResult.roleName, source: roleResult.source, message: roleResult.message }, 'Role processing result');
        } catch (roleError) {
          // Log error but don't block login - admin can manually assign role
          fileLogger.error({ err: roleError }, 'Failed to process SAML role');
        }
        
        // Return user object for session
        const user = {
          employeeId,
          employeeNumber,
          firstName,
          lastName,
          email,
          department,
          samlRoleKey
        };

        fileLogger.info({ employeeId }, 'Authentication successful');
        return done(null, user);
        
      } catch (error) {
        fileLogger.error({ err: error }, 'Authentication error');
        return done(error);
      }
    }
  );
}
