import * as fs from 'fs';
import * as path from 'path';
import { Strategy as SamlStrategy } from '@node-saml/passport-saml';
import { ValidateInResponseTo } from '@node-saml/node-saml';
import logger from '../services/logger';

const fileLogger = logger.child({ module: 'saml-strategy' });

// SAML_CERT may be inline PEM content or a path to a .pem file (resolved relative to CWD).
function loadSamlCert(): string {
  const value = process.env.SAML_CERT;
  if (!value) {
    throw new Error('SAML_CERT is required when SAML is enabled');
  }
  if (value.includes('BEGIN CERTIFICATE')) {
    return value;
  }
  const certPath = path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
  return fs.readFileSync(certPath, 'utf-8');
}

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
  // Log the resolved config at strategy creation so misconfigured env vars
  // are visible in the server log instead of producing an opaque redirect.
  fileLogger.info({
    entryPoint: process.env.SAML_ENTRYPOINT || '<missing>',
    callbackUrl: process.env.SAML_CALLBACK_URL || '<missing>',
    issuer: process.env.SAML_ISSUER || '<missing>',
    certPathOrInline: process.env.SAML_CERT?.includes('BEGIN CERTIFICATE')
      ? '<inline PEM>'
      : process.env.SAML_CERT || '<missing>',
  }, 'Loading SAML strategy with resolved env config');

  return new SamlStrategy(
    {
      // RSA IdP Configuration - UPDATE with your actual values
      // SP configuration
      issuer: process.env.SAML_ISSUER || 'ClientIQ-Production',
      callbackUrl: process.env.SAML_CALLBACK_URL!,

      // IdP configuration
      entryPoint: process.env.SAML_ENTRYPOINT!,
      idpCert: loadSamlCert(),

      // NameID configuration
      identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',

      // Security — mirror TimeTracker's working RSA IdP config
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: false,
      signatureAlgorithm: 'sha256',

      // Validation — required for IdP-initiated flow with the RSA IdP
      validateInResponseTo: ValidateInResponseTo.never,
      audience: false,
      acceptedClockSkewMs: 10000,

      // Flow optimization
      disableRequestedAuthnContext: true,
      skipRequestCompression: true,
      forceAuthn: false,

      // Passport options
      passReqToCallback: false,
    },
    
    // Verify callback — validate required SAML attributes and pass the user
    // through. The ACS handler in routes/auth.ts is responsible for loading
    // permissions/roles via permissionService (which works on SQL Server).
    // Employee-record upsert and SAML→role auto-mapping are deferred until a
    // SQL Server-aware implementation lands.
    async (profile: any, done: any) => {
      try {
        fileLogger.info({ nameID: profile.nameID, attributes: Object.keys(profile) }, 'Processing authentication for profile');

        const employeeIdStr = profile[ATTRIBUTE_MAP.employeeId];
        const employeeNumber = profile[ATTRIBUTE_MAP.employeeNumber];
        const firstName = profile[ATTRIBUTE_MAP.firstName];
        const lastName = profile[ATTRIBUTE_MAP.lastName];
        const email = profile[ATTRIBUTE_MAP.email] || profile.nameID;
        const department = profile[ATTRIBUTE_MAP.department] || null;
        const samlRoleKey = profile[ATTRIBUTE_MAP.role] || null;

        if (!employeeIdStr || !employeeNumber) {
          fileLogger.error({ employeeId: employeeIdStr, employeeNumber }, 'Missing required SAML attributes');
          return done(new Error('Missing required SAML attributes: employeeId or employeeNumber'));
        }

        const employeeId = parseInt(employeeIdStr, 10);
        if (isNaN(employeeId)) {
          fileLogger.error({ employeeIdStr }, 'Invalid employeeId format');
          return done(new Error('Invalid employeeId format'));
        }

        fileLogger.info({ employeeId, employeeNumber, firstName, lastName, email, department, samlRoleKey }, 'Authentication successful');

        return done(null, {
          employeeId,
          employeeNumber,
          firstName,
          lastName,
          email,
          department,
          samlRoleKey,
        });
      } catch (error) {
        fileLogger.error({ err: error }, 'Authentication error');
        return done(error);
      }
    },

    // Logout verify callback - acknowledges IdP-initiated LogoutResponse
    async (profile: any, done: any) => {
      fileLogger.info({ nameID: profile?.nameID }, 'Processing SAML logout response');
      return done(null, profile || {});
    }
  );
}
