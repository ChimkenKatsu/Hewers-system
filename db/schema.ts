import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const workspaces = sqliteTable('workspaces', {
  owner: text('owner').primaryKey(),
  state: text('state').notNull(),
  revision: integer('revision').notNull().default(0),
});

export const memberships=sqliteTable('memberships',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),email:text('email').notNull(),userId:text('user_id'),name:text('name').notNull(),role:text('role').notNull(),siteIds:text('site_ids').notNull(),active:integer('active').notNull().default(1),created:text('created').notNull(),
},t=>[uniqueIndex('membership_owner_email').on(t.owner,t.email)]);
export const faceTemplates=sqliteTable('face_templates',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),workerId:text('worker_id').notNull(),descriptor:text('descriptor').notNull(),created:text('created').notNull(),actor:text('actor').notNull(),consent:text('consent').notNull(),
},t=>[uniqueIndex('face_owner_worker').on(t.owner,t.workerId)]);
export const faceChallenges=sqliteTable('face_challenges',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),userId:text('user_id').notNull(),workerId:text('worker_id').notNull(),purpose:text('purpose').notNull(),created:integer('created').notNull(),expires:integer('expires').notNull(),used:integer('used').notNull().default(0),
});

export const googleConnections=sqliteTable('google_connections',{
 owner:text('owner').primaryKey(),token:text('token').notNull(),folderId:text('folder_id'),sheetId:text('sheet_id'),lastSync:text('last_sync'),lease:integer('lease').notNull().default(0),
});
