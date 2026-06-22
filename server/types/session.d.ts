import 'express-session';

declare module 'express-session' {
  interface SessionData {
    employeeId: number;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    department: string | null;
    roles: string[];          // Array of role names
    permissions: string[];    // Computed permissions
    samlRoleKey: string | null;
    samlGroups?: string[];    // parsed AD groups from the SAML role claim
    lastActivity: Date;
    defaultRoleMissing?: boolean;  // configured default role absent from role table
  }
}

declare global {
  namespace Express {
    interface Request {
      employeeId?: number;  // Backward compatibility with existing code
    }
    
    interface User {
      employeeId: number;
      employeeNumber: string;
      firstName: string;
      lastName: string;
      email: string;
      department: string | null;
      samlRoleKey: string | null;
      samlGroups?: string[];
    }
  }
}

export {};
