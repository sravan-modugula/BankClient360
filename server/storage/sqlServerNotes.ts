/**
 * SQL Server Notes Operations
 * Customer notes management for MS SQL Server with versioning and audit
 */

import sql from 'mssql';
import type { CreateNoteData, UpdateNoteData, NoteWithCurrentVersion } from '../storage';
import logger from '../services/logger';

const fileLogger = logger.child({ module: 'sqlserver-notes' });

/**
 * Resolve the Jack Henry CIF number for a note's target.
 * Customer-scoped: direct lookup on customer.
 * Account-scoped: resolve via account_ownership.is_primary_owner = 1.
 * Returns null when no CIF can be determined; callers must tolerate NULL.
 */
async function resolveCifNumberSqlServer(
  transaction: sql.Transaction,
  customerId: number | null | undefined,
  accountId: number | null | undefined
): Promise<string | null> {
  if (customerId) {
    const req = new sql.Request(transaction);
    req.input('customerId', sql.BigInt, customerId);
    const r = await req.query(
      `SELECT jack_henry_cif_number FROM customer WHERE customer_id = @customerId`
    );
    return r.recordset[0]?.jack_henry_cif_number ?? null;
  }
  if (accountId) {
    const req = new sql.Request(transaction);
    req.input('accountId', sql.BigInt, accountId);
    const r = await req.query(`
      SELECT TOP 1 c.jack_henry_cif_number
      FROM account_ownership ao
      INNER JOIN customer c ON c.customer_id = ao.customer_id
      WHERE ao.account_id = @accountId AND ao.is_primary_owner = 1
    `);
    return r.recordset[0]?.jack_henry_cif_number ?? null;
  }
  return null;
}

/**
 * Get notes for a customer or account with current version
 */
export async function getNotesSqlServer(
  pool: sql.ConnectionPool,
  params: {
    customerId?: number;
    accountId?: number;
    targetType?: 'customer' | 'account';
    categoryId?: number;
    cifNumber?: string | null;
    limit?: number;
    offset?: number;
  }
): Promise<NoteWithCurrentVersion[]> {
  try {
    const request = pool.request();
    const conditions: string[] = [];

    // Customer-scoped: match by customer_id OR denormalized cif_number so that
    // notes loaded by the external ETL (which anchors on Jack Henry CIF) surface
    // on the same client profile.
    if (params.customerId !== undefined && params.cifNumber) {
      request.input('customerId', sql.BigInt, params.customerId);
      request.input('cifNumber', sql.NVarChar, params.cifNumber);
      conditions.push('(n.customer_id = @customerId OR n.cif_number = @cifNumber)');
    } else if (params.customerId !== undefined) {
      request.input('customerId', sql.BigInt, params.customerId);
      conditions.push('n.customer_id = @customerId');
    }

    if (params.accountId !== undefined) {
      request.input('accountId', sql.BigInt, params.accountId);
      conditions.push('n.account_id = @accountId');
    }

    if (params.targetType) {
      request.input('targetType', sql.NVarChar, params.targetType);
      conditions.push('n.target_type = @targetType');
    }

    if (params.categoryId !== undefined) {
      request.input('categoryId', sql.BigInt, params.categoryId);
      conditions.push('n.category_id = @categoryId');
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    request.input('limit', sql.Int, params.limit || 50);
    request.input('offset', sql.Int, params.offset || 0);

    const result = await request.query(`
      SELECT 
        n.note_id, n.customer_id, n.account_id, n.target_type,
        n.category_id, n.importance, n.visibility, n.legal_hold,
        n.retention_years, n.is_pinned, n.created_at, n.updated_at,
        nc.category_name,
        nv.version_id, nv.version_number, nv.title, nv.body,
        nv.author_employee_id, nv.author_employee_name,
        nv.is_soft_deleted, nv.created_at as version_created_at,
        nv.modified_at as version_modified_at
      FROM note n
      INNER JOIN note_version nv ON nv.note_id = n.note_id AND nv.is_current = 1
      LEFT JOIN note_category nc ON nc.category_id = n.category_id
      ${whereClause}
      ORDER BY n.is_pinned DESC, n.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

    return result.recordset.map(mapNoteWithVersionFromDb);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get notes error');
    throw error;
  }
}

/**
 * Get single note by ID with current version
 */
export async function getNoteSqlServer(
  pool: sql.ConnectionPool,
  noteId: number
): Promise<NoteWithCurrentVersion | undefined> {
  try {
    const request = pool.request();
    request.input('noteId', sql.BigInt, noteId);

    const result = await request.query(`
      SELECT 
        n.note_id, n.customer_id, n.account_id, n.target_type,
        n.category_id, n.importance, n.visibility, n.legal_hold,
        n.retention_years, n.is_pinned, n.created_at, n.updated_at,
        nc.category_name,
        nv.version_id, nv.version_number, nv.title, nv.body,
        nv.author_employee_id, nv.author_employee_name,
        nv.is_soft_deleted, nv.created_at as version_created_at,
        nv.modified_at as version_modified_at
      FROM note n
      INNER JOIN note_version nv ON nv.note_id = n.note_id AND nv.is_current = 1
      LEFT JOIN note_category nc ON nc.category_id = n.category_id
      WHERE n.note_id = @noteId
    `);

    if (result.recordset.length === 0) {
      return undefined;
    }

    return mapNoteWithVersionFromDb(result.recordset[0]);
  } catch (error) {
    fileLogger.error({ err: error }, 'Get note error');
    throw error;
  }
}

/**
 * Create note with initial version
 */
export async function createNoteSqlServer(
  pool: sql.ConnectionPool,
  noteData: CreateNoteData,
  authorEmployeeId: number
): Promise<NoteWithCurrentVersion> {
  const transaction = pool.transaction();

  try {
    await transaction.begin();

    // Get author name
    const authorRequest = new sql.Request(transaction);
    authorRequest.input('employeeId', sql.BigInt, authorEmployeeId);
    const authorResult = await authorRequest.query(`
      SELECT first_name, last_name FROM employee WHERE employee_id = @employeeId
    `);
    const authorName = authorResult.recordset.length > 0
      ? `${authorResult.recordset[0].first_name} ${authorResult.recordset[0].last_name}`
      : null;

    // Resolve denormalized CIF for Operations queries (NULL-tolerant)
    const cifNumber = await resolveCifNumberSqlServer(
      transaction,
      noteData.customerId,
      noteData.accountId
    );

    // Create note
    const noteRequest = new sql.Request(transaction);
    noteRequest.input('customerId', sql.BigInt, noteData.customerId || null);
    noteRequest.input('accountId', sql.BigInt, noteData.accountId || null);
    noteRequest.input('targetType', sql.NVarChar, noteData.targetType);
    noteRequest.input('categoryId', sql.BigInt, noteData.categoryId || null);
    noteRequest.input('importance', sql.NVarChar, noteData.importance || 'medium');
    noteRequest.input('visibility', sql.NVarChar, noteData.visibility || 'internal');
    noteRequest.input('legalHold', sql.Bit, noteData.legalHold ? 1 : 0);
    noteRequest.input('retentionYears', sql.BigInt, noteData.retentionYears || null);
    noteRequest.input('isPinned', sql.Bit, noteData.isPinned ? 1 : 0);
    noteRequest.input('cifNumber', sql.NVarChar, cifNumber);

    const noteResult = await noteRequest.query(`
      INSERT INTO note (
        customer_id, account_id, target_type, category_id,
        importance, visibility, legal_hold, retention_years, is_pinned, cif_number
      )
      OUTPUT INSERTED.*
      VALUES (
        @customerId, @accountId, @targetType, @categoryId,
        @importance, @visibility, @legalHold, @retentionYears, @isPinned, @cifNumber
      )
    `);

    const newNote = noteResult.recordset[0];

    // Create initial version
    const versionRequest = new sql.Request(transaction);
    versionRequest.input('noteId', sql.BigInt, newNote.note_id);
    versionRequest.input('versionNumber', sql.BigInt, 1);
    versionRequest.input('title', sql.NVarChar, noteData.title);
    versionRequest.input('body', sql.NVarChar(sql.MAX), noteData.body);
    versionRequest.input('authorEmployeeId', sql.BigInt, authorEmployeeId);
    versionRequest.input('authorEmployeeName', sql.NVarChar, authorName);
    versionRequest.input('isCurrent', sql.Bit, 1);

    const versionResult = await versionRequest.query(`
      INSERT INTO note_version (
        note_id, version_number, title, body, author_employee_id,
        author_employee_name, is_current
      )
      OUTPUT INSERTED.*
      VALUES (
        @noteId, @versionNumber, @title, @body, @authorEmployeeId,
        @authorEmployeeName, @isCurrent
      )
    `);

    const newVersion = versionResult.recordset[0];

    // Create audit log entry
    const auditRequest = new sql.Request(transaction);
    auditRequest.input('noteId', sql.BigInt, newNote.note_id);
    auditRequest.input('versionId', sql.BigInt, newVersion.version_id);
    auditRequest.input('action', sql.NVarChar, 'create');
    auditRequest.input('actorEmployeeId', sql.BigInt, authorEmployeeId);
    auditRequest.input('actorEmployeeName', sql.NVarChar, authorName);

    await auditRequest.query(`
      INSERT INTO note_audit_log (
        note_id, version_id, action, actor_employee_id, actor_employee_name
      )
      VALUES (
        @noteId, @versionId, @action, @actorEmployeeId, @actorEmployeeName
      )
    `);

    // Get category name if exists
    let categoryName = null;
    if (newNote.category_id) {
      const categoryRequest = new sql.Request(transaction);
      categoryRequest.input('categoryId', sql.BigInt, newNote.category_id);
      const categoryResult = await categoryRequest.query(`
        SELECT category_name FROM note_category WHERE category_id = @categoryId
      `);
      categoryName = categoryResult.recordset.length > 0
        ? categoryResult.recordset[0].category_name
        : null;
    }

    await transaction.commit();

    return {
      noteId: newNote.note_id,
      customerId: newNote.customer_id,
      accountId: newNote.account_id,
      targetType: newNote.target_type,
      categoryId: newNote.category_id,
      categoryName,
      importance: newNote.importance,
      visibility: newNote.visibility,
      legalHold: newNote.legal_hold || false,
      retentionYears: newNote.retention_years,
      isPinned: newNote.is_pinned || false,
      createdAt: newNote.created_at,
      updatedAt: newNote.updated_at,
      currentVersion: {
        versionId: newVersion.version_id,
        versionNumber: newVersion.version_number,
        title: newVersion.title,
        body: newVersion.body,
        authorEmployeeId: newVersion.author_employee_id,
        authorEmployeeName: newVersion.author_employee_name,
        isSoftDeleted: newVersion.is_soft_deleted || false,
        createdAt: newVersion.created_at,
        modifiedAt: newVersion.modified_at
      }
    };
  } catch (error) {
    await transaction.rollback();
    fileLogger.error({ err: error }, 'Create note error');
    throw error;
  }
}

/**
 * Update note (creates new version)
 */
export async function updateNoteSqlServer(
  pool: sql.ConnectionPool,
  noteId: number,
  updateData: UpdateNoteData,
  authorEmployeeId: number
): Promise<NoteWithCurrentVersion | undefined> {
  const transaction = pool.transaction();

  try {
    await transaction.begin();

    // Check if note exists; pull target ids + existing CIF for forward-fill
    const checkRequest = new sql.Request(transaction);
    checkRequest.input('noteId', sql.BigInt, noteId);
    const checkResult = await checkRequest.query(`
      SELECT note_id, customer_id, account_id, cif_number
      FROM note WHERE note_id = @noteId
    `);

    if (checkResult.recordset.length === 0) {
      await transaction.rollback();
      return undefined;
    }

    const existingNoteRow = checkResult.recordset[0];

    // Get author name
    const authorRequest = new sql.Request(transaction);
    authorRequest.input('employeeId', sql.BigInt, authorEmployeeId);
    const authorResult = await authorRequest.query(`
      SELECT first_name, last_name FROM employee WHERE employee_id = @employeeId
    `);
    const authorName = authorResult.recordset.length > 0
      ? `${authorResult.recordset[0].first_name} ${authorResult.recordset[0].last_name}`
      : null;

    // Get current version info
    const currentVersionRequest = new sql.Request(transaction);
    currentVersionRequest.input('noteId', sql.BigInt, noteId);
    const currentVersionResult = await currentVersionRequest.query(`
      SELECT version_number, title, body
      FROM note_version
      WHERE note_id = @noteId AND is_current = 1
    `);

    const currentVersion = currentVersionResult.recordset[0];
    const nextVersionNumber = (currentVersion?.version_number || 0) + 1;

    // Mark current version as not current
    const markOldRequest = new sql.Request(transaction);
    markOldRequest.input('noteId', sql.BigInt, noteId);
    await markOldRequest.query(`
      UPDATE note_version
      SET is_current = 0
      WHERE note_id = @noteId AND is_current = 1
    `);

    // Create new version
    const newVersionRequest = new sql.Request(transaction);
    newVersionRequest.input('noteId', sql.BigInt, noteId);
    newVersionRequest.input('versionNumber', sql.BigInt, nextVersionNumber);
    newVersionRequest.input('title', sql.NVarChar, updateData.title || currentVersion.title);
    newVersionRequest.input('body', sql.NVarChar(sql.MAX), updateData.body || currentVersion.body);
    newVersionRequest.input('authorEmployeeId', sql.BigInt, authorEmployeeId);
    newVersionRequest.input('authorEmployeeName', sql.NVarChar, authorName);
    newVersionRequest.input('isCurrent', sql.Bit, 1);

    const newVersionResult = await newVersionRequest.query(`
      INSERT INTO note_version (
        note_id, version_number, title, body, author_employee_id,
        author_employee_name, is_current
      )
      OUTPUT INSERTED.*
      VALUES (
        @noteId, @versionNumber, @title, @body, @authorEmployeeId,
        @authorEmployeeName, @isCurrent
      )
    `);

    const newVersion = newVersionResult.recordset[0];

    // Forward-fill cif_number when the existing row has none (legacy data)
    let cifBackfill: string | null = null;
    if (!existingNoteRow.cif_number) {
      cifBackfill = await resolveCifNumberSqlServer(
        transaction,
        existingNoteRow.customer_id,
        existingNoteRow.account_id
      );
    }

    // Update note metadata if provided (or if we need to backfill cif_number)
    if (updateData.categoryId !== undefined || updateData.importance !== undefined ||
        updateData.visibility !== undefined || updateData.legalHold !== undefined ||
        updateData.retentionYears !== undefined || updateData.isPinned !== undefined ||
        cifBackfill) {

      const updateFields: string[] = [];
      const updateRequest = new sql.Request(transaction);
      updateRequest.input('noteId', sql.BigInt, noteId);

      if (updateData.categoryId !== undefined) {
        updateRequest.input('categoryId', sql.BigInt, updateData.categoryId);
        updateFields.push('category_id = @categoryId');
      }
      if (updateData.importance !== undefined) {
        updateRequest.input('importance', sql.NVarChar, updateData.importance);
        updateFields.push('importance = @importance');
      }
      if (updateData.visibility !== undefined) {
        updateRequest.input('visibility', sql.NVarChar, updateData.visibility);
        updateFields.push('visibility = @visibility');
      }
      if (updateData.legalHold !== undefined) {
        updateRequest.input('legalHold', sql.Bit, updateData.legalHold ? 1 : 0);
        updateFields.push('legal_hold = @legalHold');
      }
      if (updateData.retentionYears !== undefined) {
        updateRequest.input('retentionYears', sql.BigInt, updateData.retentionYears);
        updateFields.push('retention_years = @retentionYears');
      }
      if (updateData.isPinned !== undefined) {
        updateRequest.input('isPinned', sql.Bit, updateData.isPinned ? 1 : 0);
        updateFields.push('is_pinned = @isPinned');
      }
      if (cifBackfill) {
        updateRequest.input('cifNumber', sql.NVarChar, cifBackfill);
        updateFields.push('cif_number = @cifNumber');
      }

      updateFields.push('updated_at = GETDATE()');

      await updateRequest.query(`
        UPDATE note
        SET ${updateFields.join(', ')}
        WHERE note_id = @noteId
      `);
    }

    // Create audit log entry
    const auditRequest = new sql.Request(transaction);
    auditRequest.input('noteId', sql.BigInt, noteId);
    auditRequest.input('versionId', sql.BigInt, newVersion.version_id);
    auditRequest.input('action', sql.NVarChar, 'update');
    auditRequest.input('actorEmployeeId', sql.BigInt, authorEmployeeId);
    auditRequest.input('actorEmployeeName', sql.NVarChar, authorName);

    await auditRequest.query(`
      INSERT INTO note_audit_log (
        note_id, version_id, action, actor_employee_id, actor_employee_name
      )
      VALUES (
        @noteId, @versionId, @action, @actorEmployeeId, @actorEmployeeName
      )
    `);

    await transaction.commit();

    // Return the updated note
    return await getNoteSqlServer(pool, noteId);
  } catch (error) {
    await transaction.rollback();
    fileLogger.error({ err: error }, 'Update note error');
    throw error;
  }
}

/**
 * Delete note (soft delete via version)
 */
export async function deleteNoteSqlServer(
  pool: sql.ConnectionPool,
  noteId: number,
  deletedByEmployeeId: number
): Promise<boolean> {
  const transaction = pool.transaction();

  try {
    await transaction.begin();

    // Get author name
    const authorRequest = new sql.Request(transaction);
    authorRequest.input('employeeId', sql.BigInt, deletedByEmployeeId);
    const authorResult = await authorRequest.query(`
      SELECT first_name, last_name FROM employee WHERE employee_id = @employeeId
    `);
    const authorName = authorResult.recordset.length > 0
      ? `${authorResult.recordset[0].first_name} ${authorResult.recordset[0].last_name}`
      : null;

    // Soft delete current version
    const deleteRequest = new sql.Request(transaction);
    deleteRequest.input('noteId', sql.BigInt, noteId);
    deleteRequest.input('deletedBy', sql.BigInt, deletedByEmployeeId);

    const result = await deleteRequest.query(`
      UPDATE note_version
      SET is_soft_deleted = 1,
          deleted_at = GETDATE(),
          deleted_by_employee_id = @deletedBy
      WHERE note_id = @noteId AND is_current = 1
    `);

    // Create audit log entry
    const auditRequest = new sql.Request(transaction);
    auditRequest.input('noteId', sql.BigInt, noteId);
    auditRequest.input('action', sql.NVarChar, 'delete');
    auditRequest.input('actorEmployeeId', sql.BigInt, deletedByEmployeeId);
    auditRequest.input('actorEmployeeName', sql.NVarChar, authorName);

    await auditRequest.query(`
      INSERT INTO note_audit_log (
        note_id, action, actor_employee_id, actor_employee_name
      )
      VALUES (
        @noteId, @action, @actorEmployeeId, @actorEmployeeName
      )
    `);

    await transaction.commit();

    return (result.rowsAffected[0] || 0) > 0;
  } catch (error) {
    await transaction.rollback();
    fileLogger.error({ err: error }, 'Delete note error');
    throw error;
  }
}

/**
 * Get note categories
 */
export async function getNoteCategoriesSqlServer(
  pool: sql.ConnectionPool,
  includeInactive: boolean = false
): Promise<Array<{
  categoryId: number;
  categoryName: string;
  categoryDescription: string | null;
  displayOrder: number | null;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}>> {
  try {
    const request = pool.request();

    let query = `
      SELECT 
        category_id, category_name, description,
        display_order, is_active, created_at, updated_at
      FROM note_category
    `;

    if (!includeInactive) {
      query += ' WHERE is_active = 1';
    }

    query += ' ORDER BY display_order, category_name';

    const result = await request.query(query);

    return result.recordset.map(row => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
      categoryDescription: row.description,
      displayOrder: row.display_order,
      isActive: row.is_active || false,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  } catch (error) {
    fileLogger.error({ err: error }, 'Get note categories error');
    throw error;
  }
}

/**
 * Get note versions (version history)
 */
export async function getNoteVersionsSqlServer(
  pool: sql.ConnectionPool,
  noteId: number
): Promise<Array<{
  versionId: number;
  noteId: number;
  versionNumber: number;
  title: string;
  body: string;
  authorEmployeeId: number;
  authorEmployeeName: string | null;
  isCurrent: boolean;
  isSoftDeleted: boolean;
  createdAt: Date;
  modifiedAt: Date | null;
  deletedAt: Date | null;
  deletedByEmployeeId: number | null;
}>> {
  try {
    const request = pool.request();
    request.input('noteId', sql.BigInt, noteId);

    const result = await request.query(`
      SELECT
        version_id, note_id, version_number, title, body,
        author_employee_id, author_employee_name,
        is_current, is_soft_deleted,
        created_at, modified_at,
        deleted_at, deleted_by_employee_id
      FROM note_version
      WHERE note_id = @noteId
      ORDER BY version_number DESC
    `);

    return result.recordset.map(row => ({
      versionId: row.version_id,
      noteId: row.note_id,
      versionNumber: row.version_number,
      title: row.title,
      body: row.body,
      authorEmployeeId: row.author_employee_id,
      authorEmployeeName: row.author_employee_name,
      isCurrent: row.is_current || false,
      isSoftDeleted: row.is_soft_deleted || false,
      createdAt: row.created_at,
      modifiedAt: row.modified_at,
      deletedAt: row.deleted_at,
      deletedByEmployeeId: row.deleted_by_employee_id
    }));
  } catch (error) {
    fileLogger.error({ err: error }, 'Get note versions error');
    throw error;
  }
}

/**
 * Map database row to NoteWithCurrentVersion object
 */
function mapNoteWithVersionFromDb(row: any): NoteWithCurrentVersion {
  return {
    noteId: row.note_id,
    customerId: row.customer_id,
    accountId: row.account_id,
    targetType: row.target_type,
    categoryId: row.category_id,
    categoryName: row.category_name || null,
    importance: row.importance,
    visibility: row.visibility,
    legalHold: row.legal_hold || false,
    retentionYears: row.retention_years,
    isPinned: row.is_pinned || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentVersion: {
      versionId: row.version_id,
      versionNumber: row.version_number,
      title: row.title,
      body: row.body,
      authorEmployeeId: row.author_employee_id,
      authorEmployeeName: row.author_employee_name,
      isSoftDeleted: row.is_soft_deleted || false,
      createdAt: row.version_created_at,
      modifiedAt: row.version_modified_at
    }
  };
}