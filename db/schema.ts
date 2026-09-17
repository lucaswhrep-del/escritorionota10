import {integer,sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const campaign=sqliteTable('campaign',{id:text('id').primaryKey(),revision:integer('revision').notNull().default(0),data:text('data').notNull()});
export const evidence=sqliteTable('evidence',{id:text('id').primaryKey(),task:text('task').notNull(),person:text('person').notNull(),name:text('name').notNull(),size:integer('size').notNull(),created:text('created').notNull()});
