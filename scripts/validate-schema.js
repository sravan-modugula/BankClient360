#!/usr/bin/env node

/**
 * Database Schema Validation Script
 * Ensures schema consistency and prevents unauthorized changes
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🗄️  Database Schema Validation Starting...');

async function validateSchema() {
  try {
    // 1. Check if schema matches Drizzle definition
    console.log('📋 Checking schema consistency...');
    
    try {
      execSync('npm run db:check', { stdio: 'inherit' });
      console.log('✅ Schema matches Drizzle definition');
    } catch (error) {
      console.error('❌ Schema drift detected');
      console.error('🔧 Required action: Run npm run db:push to sync schema');
      process.exit(1);
    }

    // 2. Validate migration history
    console.log('📚 Checking migration history...');
    
    const migrationFiles = fs.readdirSync('./drizzle', { withFileTypes: true })
      .filter(dirent => dirent.isFile() && dirent.name.endsWith('.sql'))
      .map(dirent => dirent.name);
    
    if (migrationFiles.length === 0) {
      console.warn('⚠️  No migration files found - ensure schema changes are tracked');
    } else {
      console.log(`✅ Found ${migrationFiles.length} migration files`);
    }

    // 3. Check for manual schema changes
    console.log('🔍 Checking for unauthorized schema modifications...');
    
    try {
      const result = execSync('git log --oneline --grep="manual.*sql\\|drop.*table\\|create.*table" --since="1 week ago"', 
        { encoding: 'utf8' });
      
      if (result.trim().length > 0) {
        console.warn('⚠️  Detected potential manual SQL changes in recent commits:');
        console.warn(result);
        console.warn('🔧 Ensure all schema changes go through Drizzle governance process');
      }
    } catch (error) {
      // No manual changes found (git grep returns non-zero exit code when no matches)
      console.log('✅ No unauthorized manual schema changes detected');
    }

    // 4. Validate critical tables exist
    console.log('📊 Validating critical table structure...');
    
    const criticalTables = [
      'person',
      'account', 
      'transaction',
      'online_banking_user',
      'contact_history'
    ];

    try {
      const { db } = require('../server/db');
      const { sql } = require('drizzle-orm');
      
      for (const tableName of criticalTables) {
        const result = await db.execute(sql`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        `);
        
        if (result[0].count === 0) {
          throw new Error(`Critical table '${tableName}' is missing`);
        }
      }
      
      console.log('✅ All critical tables present');
      
    } catch (error) {
      console.error('❌ Critical table validation failed:', error.message);
      process.exit(1);
    }

    console.log('🎉 Database schema validation completed successfully');
    
  } catch (error) {
    console.error('❌ Schema validation failed:', error.message);
    process.exit(1);
  }
}

// Run validation if called directly
if (require.main === module) {
  validateSchema();
}

module.exports = { validateSchema };