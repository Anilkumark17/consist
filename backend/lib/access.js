import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { projectMembers, projects } from '../db/schema.js';

export async function accessibleProjectIds(userId) {
  const owned = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.ownerId, userId));
  const member = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));
  return new Set([...owned.map((row) => row.id), ...member.map((row) => row.projectId)]);
}

export async function canAccessProject(userId, projectId) {
  if (!projectId) return false;
  const ids = await accessibleProjectIds(userId);
  return ids.has(projectId);
}

export async function isProjectOwner(userId, projectId) {
  const [owned] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)))
    .limit(1);
  return Boolean(owned);
}
