import { and, eq, ilike, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { actions, projectMembers, users } from '../db/schema.js';

export function publicAccount(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email };
}

export async function listAccounts() {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .orderBy(users.name);
}

export async function findUserByName(name) {
  const value = String(name || '').trim();
  if (!value) return null;
  const [user] = await db.select().from(users).where(ilike(users.name, value)).limit(1);
  return user || null;
}

export async function matchUsersByNames(names) {
  const unique = [...new Set(names.map((name) => String(name || '').trim()).filter(Boolean))];
  const matches = {};
  for (const name of unique) {
    const user = await findUserByName(name);
    matches[name] = publicAccount(user);
  }
  return matches;
}

export async function claimWorkForUser(user) {
  const members = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(isNull(projectMembers.userId), ilike(projectMembers.name, user.name)));

  if (members.length) {
    await db
      .update(projectMembers)
      .set({ userId: user.id })
      .where(
        inArray(
          projectMembers.id,
          members.map((row) => row.id),
        ),
      );
  }

  await db
    .update(actions)
    .set({ assigneeId: user.id, status: 'assigned' })
    .where(
      and(
        isNull(actions.assigneeId),
        eq(actions.reviewStatus, 'confirmed'),
        ilike(actions.owner, user.name),
      ),
    );
}
