import { db } from '../server/db';
import { sql } from 'drizzle-orm';

console.log('🔄 Refreshing database views...');

async function refreshViews() {
  try {
    // Get all materialized views
    const materializedViews = await db.execute(sql`
      SELECT schemaname, matviewname 
      FROM pg_matviews 
      WHERE schemaname = 'public'
    `);
    
    // Get all regular views (for information only)
    const regularViews = await db.execute(sql`
      SELECT schemaname, viewname 
      FROM pg_views 
      WHERE schemaname = 'public'
    `);
    
    console.log(`📊 Found ${regularViews.length} regular views and ${materializedViews.length} materialized views`);
    
    if (regularViews.length > 0) {
      console.log('📋 Regular views (no refresh needed):');
      for (const view of regularViews) {
        console.log(`  - ${view.viewname}`);
      }
    }
    
    if (materializedViews.length > 0) {
      console.log('🔄 Refreshing materialized views:');
      for (const view of materializedViews) {
        try {
          await db.execute(sql`REFRESH MATERIALIZED VIEW ${sql.identifier(view.matviewname)}`);
          console.log(`  ✅ Refreshed ${view.matviewname}`);
        } catch (error) {
          console.log(`  ❌ Failed to refresh ${view.matviewname}: ${error.message}`);
        }
      }
    } else {
      console.log('ℹ️  No materialized views found to refresh');
    }
    
    console.log('✅ View refresh completed');
    
  } catch (error) {
    console.error('❌ Error refreshing views:', error);
    throw error;
  }
}

async function main() {
  try {
    await refreshViews();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to refresh views:', error);
    process.exit(1);
  }
}

main();