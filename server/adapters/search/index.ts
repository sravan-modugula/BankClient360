/**
 * Search adapter exports
 * Provides database-agnostic search functionality through the ISearchProvider interface
 */

export type { ISearchProvider, SearchProviderCapabilities } from './ISearchProvider';
export { PostgresSearchProvider } from './PostgresSearchProvider';
export { SqlServerSearchProvider } from './SqlServerSearchProvider';
export { SearchProviderFactory, type DatabaseVendor } from './SearchProviderFactory';
