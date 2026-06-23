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
 *   Employee, Teller, BRS, Branch Manager, Ops Manager, Relationship Manager,
 *   Regional Manager, Executive, System Admin.
 *
 * Authoritative mapping confirmed by the bank (preprod/prod entitlement list):
 *   APPSVCS / AppAdmin                          -> System Admin   (priv 4)
 *   BranchManager                               -> Branch Manager (priv 3)
 *   BusinessBanker / LoanOfficer / AsstManager  -> BRS            (priv 2)
 *   Teller / Risk / DataAnalyst / Compliance    -> Teller         (priv 1)
 *   GEN (+ the IAM RSA access group)            -> no role (app-access entitlement only)
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
  loanofficer: 'BRS',
  assistantmanager: 'BRS',
  // Teller tier (privilege 1)
  teller: 'Teller',
  risk: 'Teller',
  dataanalyst: 'Teller',
  compliance: 'Teller',
};

/** Tokens that grant app access but no role of their own. */
const ACCESS_ONLY_TOKENS = new Set(['gen']);

/** Matches `..._ClientIQ_<RoleToken>_<Access>` and captures the RoleToken. */
const CLIENTIQ_GROUP_RE = /_ClientIQ_([A-Za-z]+)_(?:RO|RW|MOD|ADM|EXEC)$/i;

export interface AdGroupMappingResult {
  /** Distinct application role names the user's AD groups map to. */
  roleNames: string[];
  /** ClientIQ groups that matched the naming convention but no known role token. */
  unmatched: string[];
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
  return parts.map((g) => g.trim()).filter((g) => g.length > 0);
}

/**
 * Map a list of AD group strings to the set of ClientIQ role names they grant.
 * Returns deduped role names plus any ClientIQ-looking groups whose token is
 * unknown (for operator visibility). Non-ClientIQ groups are ignored.
 */
export function mapAdGroupsToRoleNames(groups: string[]): AdGroupMappingResult {
  const roleNames = new Set<string>();
  const unmatched: string[] = [];

  for (const group of groups) {
    const m = group.match(CLIENTIQ_GROUP_RE);
    if (!m) continue; // not a ClientIQ role group
    const token = m[1].toLowerCase();
    if (ACCESS_ONLY_TOKENS.has(token)) continue; // access entitlement, no role
    const roleName = AD_GROUP_TOKEN_TO_ROLE[token];
    if (roleName) {
      roleNames.add(roleName);
    } else {
      unmatched.push(group);
    }
  }

  return { roleNames: Array.from(roleNames), unmatched };
}
