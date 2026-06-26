/**
 * Convention-based mapping from Active Directory group names (delivered in the
 * SAML `role` claim) to ClientIQ application role names.
 *
 * The IdP sends the user's full AD group list. ClientIQ groups follow the
 * convention `<PREFIX>_<ENV>_APP_ClientIQ_<RoleToken>_<Access>`, e.g.
 *   CTRL_PRD_APP_ClientIQ_BranchManager_MOD  -> Branch Manager
 *   CTRL_STG_APP_ClientIQ_Teller_RO          -> Teller
 *   CTRL_TST_APP_ClientIQ_AppAdmin_ADM       -> System Admin
 *   IAM_PRD_APP_RSA_ClientIQ_GEN_EXEC        -> (no role: access entitlement only)
 *
 * The environment segment (DEV/TST/STG/PRD) and the access suffix
 * (RO/RW/MOD/ADM/EXEC) are ignored for role selection — only the RoleToken
 * matters. `GEN` is the "may access the app" entitlement and maps to no role,
 * so a user holding only GEN/RSA access falls back to the default role.
 *
 * No DB table is involved: the resolved role *names* are looked up against the
 * existing `role` table (case-insensitive) by the caller.
 */

/**
 * RoleToken (as it appears in the group name) -> application role name.
 * The right-hand values MUST match rows in the `role` table:
 *   System Admin, Branch Manager, BRS, Teller, Loan Officer, Risk Analyst,
 *   Compliance Officer.
 *
 * Authoritative mapping confirmed by the bank (preprod/prod entitlement list):
 *   APPSVCS / AppAdmin                       -> System Admin       (priv 4)
 *   BranchManager                            -> Branch Manager     (priv 3)
 *   BusinessBanker / AsstManager             -> BRS                (priv 2)
 *   LoanOfficer                              -> Loan Officer
 *   Risk                                     -> Risk Analyst
 *   Compliance                               -> Compliance Officer
 *   Teller / DataAnalyst                     -> Teller             (priv 1)
 *   GEN (+ the IAM RSA access group)         -> no role (app-access entitlement only)
 *
 * Note: the admin group token differs by environment — APPSVCS in preprod
 * (CTRL_PRE_..._APPSVCS_ADM), AppAdmin in dev/test/stg/prod per the IdP list —
 * so both are mapped. The environment segment is ignored by the parser.
 */
export const AD_GROUP_TOKEN_TO_ROLE: Record<string, string> = {
  // Admin (privilege 4)
  appsvcs: 'System Admin',
  appadmin: 'System Admin',
  // Management (privilege 3)
  branchmanager: 'Branch Manager',
  // Business Relationship Specialist tier (privilege 2)
  businessbanker: 'BRS',
  assistantmanager: 'BRS',
  // Dedicated roles — each now has its own row in the role table, so they map
  // directly instead of collapsing into Teller.
  loanofficer: 'Loan Officer',
  risk: 'Risk Analyst',
  compliance: 'Compliance Officer',
  // Teller tier (privilege 1)
  teller: 'Teller',
  dataanalyst: 'Teller',
};

/** Tokens that grant app access but no role of their own. */
const ACCESS_ONLY_TOKENS = new Set(['gen']);

/** Matches `..._ClientIQ_<RoleToken>_<Access>` and captures the RoleToken. */
const CLIENTIQ_GROUP_RE = /_ClientIQ_([A-Za-z]+)_(?:RO|RW|MOD|ADM|EXEC)$/i;

/** Captures the environment segment: `<PREFIX>_<ENV>_APP_..._ClientIQ_...`. */
const GROUP_ENV_RE = /^[A-Za-z]+_(DEV|TST|STG|PRD)_APP_/i;

export type RoleEnv = 'DEV' | 'TST' | 'STG' | 'PRD';

/**
 * Normalize an operator-supplied SAML_ROLE_ENV value to an AD env token.
 * Accepts the AD tokens directly (DEV/TST/STG/PRD) plus common aliases
 * (e.g. "PreProd" -> STG, "Production" -> PRD) so the variable can mirror
 * however the deployment names its environments. Unknown/empty -> null
 * (env scoping disabled; every environment's groups are honored).
 */
export function normalizeRoleEnv(raw: string | null | undefined): RoleEnv | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (['DEV', 'DEVELOPMENT'].includes(v)) return 'DEV';
  if (['TST', 'TEST'].includes(v)) return 'TST';
  if (['STG', 'STAGE', 'STAGING', 'PRE', 'PREPROD', 'PRE-PROD'].includes(v)) return 'STG';
  if (['PRD', 'PROD', 'PRODUCTION'].includes(v)) return 'PRD';
  return null;
}

export interface AdGroupMappingResult {
  /** Distinct application role names the user's AD groups map to. */
  roleNames: string[];
  /** ClientIQ groups that matched the naming convention but no known role token. */
  unmatched: string[];
  /** ClientIQ role groups skipped because they belong to a different environment. */
  ignoredOtherEnv: string[];
}

/**
 * Normalize the raw SAML `role` claim into a clean array of group strings.
 * Accepts either a multi-valued array (one entry per AD group) or a single
 * delimited string (`;`, `,`, or newline separated).
 */
export function normalizeSamlGroups(rawSamlRole: unknown): string[] {
  if (rawSamlRole == null) return [];
  const parts = Array.isArray(rawSamlRole)
    ? rawSamlRole.flatMap((v) => String(v).split(/[;,\n\r]+/))
    : String(rawSamlRole).split(/[;,\n\r]+/);
  // The IdP delivers the group list as a quoted, comma-separated string, e.g.
  //   'CTRL_..._DataAnalyst_RO','IAM_..._GEN_EXEC'
  // Strip surrounding quotes/brackets/whitespace from each entry so the
  // end-anchored group regex matches (a trailing quote would otherwise fail).
  return parts
    .map((g) => g.replace(/^[\s'"\[\]]+|[\s'"\[\]]+$/g, ''))
    .filter((g) => g.length > 0);
}

/**
 * Map a list of AD group strings to the set of ClientIQ role names they grant.
 * Returns deduped role names plus any ClientIQ-looking groups whose token is
 * unknown (for operator visibility). Non-ClientIQ groups are ignored.
 *
 * `roleEnv` scopes mapping to a single deployment environment. Because the bank
 * runs one on-prem AD, a user is a member of the ClientIQ groups for *every*
 * environment (STG and PRD both), so without scoping preprod would honor a
 * user's PRD groups and prod would honor their STG groups. When SAML_ROLE_ENV
 * is set (DEV/TST/STG/PRD), only groups whose env segment matches are honored —
 * so a Teller in STG and a Branch Manager in PRD resolves to Teller in preprod
 * and Branch Manager in prod. When unset, every environment's groups are
 * honored (backwards-compatible).
 */
export function mapAdGroupsToRoleNames(
  groups: string[],
  roleEnv?: string | null,
): AdGroupMappingResult {
  const wantEnv = normalizeRoleEnv(roleEnv);
  const roleNames = new Set<string>();
  const unmatched: string[] = [];
  const ignoredOtherEnv: string[] = [];

  for (const group of groups) {
    const m = group.match(CLIENTIQ_GROUP_RE);
    if (!m) continue; // not a ClientIQ role group

    if (wantEnv) {
      const envMatch = group.match(GROUP_ENV_RE);
      const groupEnv = envMatch ? envMatch[1].toUpperCase() : null;
      if (groupEnv !== wantEnv) {
        ignoredOtherEnv.push(group); // belongs to another environment — skip
        continue;
      }
    }

    const token = m[1].toLowerCase();
    if (ACCESS_ONLY_TOKENS.has(token)) continue; // access entitlement, no role
    const roleName = AD_GROUP_TOKEN_TO_ROLE[token];
    if (roleName) {
      roleNames.add(roleName);
    } else {
      unmatched.push(group);
    }
  }

  return { roleNames: Array.from(roleNames), unmatched, ignoredOtherEnv };
}
