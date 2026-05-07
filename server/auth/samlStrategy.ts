import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Strategy as SamlStrategy } from '@node-saml/passport-saml';
import { ValidateInResponseTo } from '@node-saml/node-saml';
import logger from '../services/logger';

const fileLogger = logger.child({ module: 'saml-strategy' });

// SAML_CERT may be inline PEM content or a path to a .pem file (resolved relative to CWD).
// Mirrors TimeTracker's cert loader (which works against the same RSA IdP):
// trims, normalizes CRLF -> LF, validates markers, logs fingerprint for comparison
// with what the IdP team registered.
function loadSamlCert(): string {
  const value = process.env.SAML_CERT;
  if (!value) {
    throw new Error('SAML_CERT is required when SAML is enabled');
  }

  let certContent: string;
  let hadBom = false;
  if (value.includes('BEGIN CERTIFICATE')) {
    certContent = value;
  } else {
    const certPath = path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
    fileLogger.info({ certPath }, 'Reading SAML cert from file');
    const raw = fs.readFileSync(certPath);
    // Detect & strip BOM (UTF-8: EF BB BF, UTF-16 LE: FF FE, UTF-16 BE: FE FF).
    if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
      hadBom = true;
      certContent = raw.slice(3).toString('utf-8');
    } else if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) {
      hadBom = true;
      certContent = raw.slice(2).toString('utf16le');
    } else {
      certContent = raw.toString('utf-8');
    }
  }

  // Windows-saved files have CRLF, which can break passport-saml PEM parsing.
  certContent = certContent.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (!certContent.includes('-----BEGIN CERTIFICATE-----')) {
    throw new Error('Invalid SAML cert: missing -----BEGIN CERTIFICATE----- marker');
  }
  if (!certContent.includes('-----END CERTIFICATE-----')) {
    throw new Error('Invalid SAML cert: missing -----END CERTIFICATE----- marker');
  }

  const certCount = (certContent.match(/-----BEGIN CERTIFICATE-----/g) || []).length;
  if (certCount > 1) {
    fileLogger.warn({ certCount }, 'SAML cert file contains multiple certificates — only the first will be used for signature verification by passport-saml');
  }

  // Compute SHA-256 fingerprint of the first cert so the operator can verify
  // it matches what the IdP team registered for this SP entry.
  const firstCert = certContent.split(/-----END CERTIFICATE-----/)[0] + '-----END CERTIFICATE-----';
  const der = firstCert
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
  const fingerprint = crypto
    .createHash('sha256')
    .update(Buffer.from(der, 'base64'))
    .digest('hex')
    .toUpperCase()
    .replace(/(.{2})(?=.)/g, '$1:');

  // Parse via X509Certificate (Node 15+) to surface subject/issuer/public-key
  // details. Confirms the PEM is well-formed and shows what the strategy is
  // actually using to verify signatures.
  let certDetails: Record<string, unknown> = {};
  try {
    const x509 = new crypto.X509Certificate(firstCert);
    const pubKeyDer = x509.publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
    const pubKeySha256 = crypto.createHash('sha256').update(pubKeyDer).digest('hex')
      .toUpperCase().replace(/(.{2})(?=.)/g, '$1:');
    certDetails = {
      subject: x509.subject,
      issuer: x509.issuer,
      validFrom: x509.validFrom,
      validTo: x509.validTo,
      serialNumber: x509.serialNumber,
      publicKeyAlgorithm: x509.publicKey.asymmetricKeyType,
      publicKeyBitLength: (x509.publicKey as any).asymmetricKeyDetails?.modulusLength,
      publicKeySha256: pubKeySha256,
    };
  } catch (err: any) {
    certDetails = { parseError: err?.message || String(err) };
  }

  fileLogger.info({
    certLength: certContent.length,
    certCount,
    hadBom,
    sha256Fingerprint: fingerprint,
    ...certDetails,
  }, 'SAML cert loaded — share fingerprint and publicKeySha256 with the IdP team to confirm match');

  return certContent;
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
