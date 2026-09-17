import { integer, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  ownerId: integer('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const projectMembers = pgTable('project_members', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  role: varchar('role', { length: 32 }).notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const meetings = pgTable('meetings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  transcript: text('transcript').notNull(),
  heldAt: timestamp('held_at', { withTimezone: true }),
  participants: text('participants'),
  status: varchar('status', { length: 32 }).notNull().default('pending_review'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const decisions = pgTable('decisions', {
  id: serial('id').primaryKey(),
  meetingId: integer('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
});

export const actions = pgTable('actions', {
  id: serial('id').primaryKey(),
  meetingId: integer('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  assigneeId: integer('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  owner: varchar('owner', { length: 120 }).notNull(),
  task: text('task').notNull(),
  detail: text('detail'),
  deadline: varchar('deadline', { length: 120 }),
  priority: varchar('priority', { length: 16 }).notNull().default('medium'),
  followUp: text('follow_up').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('backlog'),
  reviewStatus: varchar('review_status', { length: 32 }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  meetings: many(meetings),
  ownedProjects: many(projects),
  memberships: many(projectMembers),
  assignedActions: many(actions),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  members: many(projectMembers),
  meetings: many(meetings),
  actions: many(actions),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
}));

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  user: one(users, { fields: [meetings.userId], references: [users.id] }),
  project: one(projects, { fields: [meetings.projectId], references: [projects.id] }),
  decisions: many(decisions),
  actions: many(actions),
}));

export const decisionsRelations = relations(decisions, ({ one }) => ({
  meeting: one(meetings, { fields: [decisions.meetingId], references: [meetings.id] }),
}));

export const actionsRelations = relations(actions, ({ one }) => ({
  meeting: one(meetings, { fields: [actions.meetingId], references: [meetings.id] }),
  project: one(projects, { fields: [actions.projectId], references: [projects.id] }),
  assignee: one(users, { fields: [actions.assigneeId], references: [users.id] }),
}));
