import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Strategy as SamlStrategy } from '@node-saml/passport-saml';
import { ValidateInResponseTo } from '@node-saml/node-saml';
import logger from '../services/logger';

const fileLogger = logger.child({ module: 'saml-strategy' });

// SAML_CERT may be inline PEM content or a path to a .pem file (resolved
// relative to CWD). Mirrors TimeTracker's loader: trims, strips BOM,
// normalizes CRLF -> LF, validates markers, logs fingerprint and parsed
// X509 details so the operator can confirm a match with the IdP team.
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

  certContent = certContent.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (!certContent.includes('-----BEGIN CERTIFICATE-----')) {
    throw new Error('Invalid SAML cert: missing -----BEGIN CERTIFICATE----- marker');
  }
  if (!certContent.includes('-----END CERTIFICATE-----')) {
    throw new Error('Invalid SAML cert: missing -----END CERTIFICATE----- marker');
  }

  const certCount = (certContent.match(/-----BEGIN CERTIFICATE-----/g) || []).length;
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
  }, 'SAML cert loaded');

  return certContent;
}

// Long-form claim URLs as fallback. RSA SecurID Access for ClientIQ uses
// short attribute names (NameFormat=basic) — see the verify callback below.
const ATTRIBUTE_MAP = {
  employeeId: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/employeeid',
  employeeNumber: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/employeenumber',
  firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
  lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
  email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  department: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/department',
  role: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role',
};

export function createSamlStrategy() {
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
      issuer: process.env.SAML_ISSUER || 'ClientIQ-Production',
      callbackUrl: process.env.SAML_CALLBACK_URL!,
      entryPoint: process.env.SAML_ENTRYPOINT!,
      idpCert: loadSamlCert(),

      identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',

      // RSA SecurID Access for ClientIQ signs the Response wrapper, not the
      // Assertion. With wantAssertionsSigned=false and wantAuthnResponseSigned=false,
      // passport-saml accepts whichever element is signed (at least one must be).
      wantAssertionsSigned: false,
      wantAuthnResponseSigned: false,
      signatureAlgorithm: 'sha256',

      validateInResponseTo: ValidateInResponseTo.never,
      audience: false,
      acceptedClockSkewMs: 10000,

      disableRequestedAuthnContext: true,
      skipRequestCompression: true,
      forceAuthn: false,

      passReqToCallback: false,
    },

    // Verify — extract attributes and pass through. The ACS handler resolves
    // the SAML user to a DB employee record (via SQL Server-aware lookup).
    async (profile: any, done: any) => {
      try {
        fileLogger.info({ nameID: profile.nameID, attributes: Object.keys(profile) }, 'Processing authentication for profile');

        const samlEmployeeId = profile.employeeId ?? profile[ATTRIBUTE_MAP.employeeId] ?? null;
        const samlEmployeeNumber = profile.employeeNumber ?? profile[ATTRIBUTE_MAP.employeeNumber] ?? null;
        const firstName = profile.firstName ?? profile[ATTRIBUTE_MAP.firstName] ?? null;
        const lastName = profile.lastName ?? profile[ATTRIBUTE_MAP.lastName] ?? null;
        const email = profile.email ?? profile[ATTRIBUTE_MAP.email] ?? profile.nameID ?? null;
        const department = profile.department ?? profile[ATTRIBUTE_MAP.department] ?? null;
        const rawSamlRole = profile.role ?? profile[ATTRIBUTE_MAP.role] ?? null;
        // IdPs occasionally send the user's full AD group list (multi-kilobyte) as the role
        // attribute. Cap defensively so a runaway value can't blow past sensible bounds
        // even after the column was widened to NVARCHAR(MAX).
        const samlRoleKey = typeof rawSamlRole === 'string' && rawSamlRole.length > 4000
          ? rawSamlRole.slice(0, 4000)
          : rawSamlRole;

        if (!email) {
          fileLogger.error({ profileKeys: Object.keys(profile) }, 'SAML profile missing email/nameID');
          return done(new Error('SAML profile missing email/nameID'));
        }

        fileLogger.info({ email, samlEmployeeId, firstName, lastName, department }, 'SAML profile parsed successfully');

        return done(null, {
          samlEmployeeId,
          samlEmployeeNumber,
          firstName,
          lastName,
          email,
          department,
          samlRoleKey,
          ssoSubject: profile.nameID ?? email,
        });
      } catch (error) {
        fileLogger.error({ err: error }, 'Authentication error');
        return done(error);
      }
    },

    // Logout verify — required by passport-saml v5 constructor.
    async (profile: any, done: any) => {
      fileLogger.info({ nameID: profile?.nameID }, 'Processing SAML logout response');
      return done(null, profile || {});
    }
  );
}
