import { Router } from 'express';
import { and, desc, eq, ilike, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { actions, meetings, projectMembers, projects, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { accessibleProjectIds, canAccessProject } from '../lib/access.js';
import { findUserByName } from '../lib/matching.js';
import { progressFromActions, withBoardFields } from '../lib/board.js';

const router = Router();
router.use(requireAuth);

function publicMember(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    userId: row.userId,
    email: row.email || null,
    ready: Boolean(row.userId),
  };
}

router.get('/', async (req, res) => {
  try {
    const ids = [...(await accessibleProjectIds(req.user.userId))];
    if (!ids.length) {
      return res.json({ projects: [] });
    }

    const rows = await db.select().from(projects).orderBy(desc(projects.createdAt));
    const visible = rows.filter((row) => ids.includes(row.id));
    const [meetingRows, actionRows, memberRows] = await Promise.all([
      db.select().from(meetings).where(inArray(meetings.projectId, ids)),
      db
        .select()
        .from(actions)
        .where(and(inArray(actions.projectId, ids), eq(actions.reviewStatus, 'confirmed'))),
      db.select().from(projectMembers).where(inArray(projectMembers.projectId, ids)),
    ]);

    res.json({
      projects: visible.map((project) => {
        const projectMeetings = meetingRows.filter((row) => row.projectId === project.id);
        const work = actionRows.filter((row) => row.projectId === project.id).map(withBoardFields);
        return {
          ...project,
          memberCount: memberRows.filter((row) => row.projectId === project.id).length,
          meetingCount: projectMeetings.length,
          pendingReviews: projectMeetings.filter((row) => row.status === 'pending_review').length,
          progress: progressFromActions(work),
        };
      }),
    });
  } catch (error) {
    console.error('List projects failed:', error);
    res.status(500).json({ error: 'Could not load projects' });
  }
});

router.post('/', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (name.length < 2) {
      return res.status(400).json({ error: 'Project name must be at least 2 characters' });
    }

    const [project] = await db
      .insert(projects)
      .values({ name, ownerId: req.user.userId })
      .returning();

    const [actor] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, req.user.userId))
      .limit(1);

    await db.insert(projectMembers).values({
      projectId: project.id,
      name: actor.name,
      userId: req.user.userId,
      role: 'owner',
    });

    res.status(201).json({
      project: {
        ...project,
        memberCount: 1,
        meetingCount: 0,
        pendingReviews: 0,
        progress: { total: 0, completed: 0, percent: 0 },
      },
    });
  } catch (error) {
    console.error('Create project failed:', error);
    res.status(500).json({ error: 'Could not create project' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await canAccessProject(req.user.userId, id))) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    const [members, meetingRows, work] = await Promise.all([
      db
        .select({
          id: projectMembers.id,
          name: projectMembers.name,
          role: projectMembers.role,
          userId: projectMembers.userId,
          email: users.email,
        })
        .from(projectMembers)
        .leftJoin(users, eq(projectMembers.userId, users.id))
        .where(eq(projectMembers.projectId, id)),
      db.select().from(meetings).where(eq(meetings.projectId, id)).orderBy(desc(meetings.createdAt)),
      db
        .select()
        .from(actions)
        .where(and(eq(actions.projectId, id), eq(actions.reviewStatus, 'confirmed')))
        .orderBy(desc(actions.createdAt)),
    ]);

    const board = work.map(withBoardFields);
    res.json({
      project: {
        ...project,
        members: members.map(publicMember),
        meetings: meetingRows.map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          heldAt: row.heldAt,
          createdAt: row.createdAt,
        })),
        actions: board,
        progress: progressFromActions(board),
      },
    });
  } catch (error) {
    console.error('Get project failed:', error);
    res.status(500).json({ error: 'Could not load project' });
  }
});

router.post('/:id/members', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await canAccessProject(req.user.userId, id))) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ error: 'Name must be 2–80 characters' });
    }

    let matched = null;
    if (email) {
      const [byEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      matched = byEmail || null;
    }
    if (!matched) matched = await findUserByName(name);

    const existing = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, id), ilike(projectMembers.name, name)))
      .limit(1);

    let member;
    if (existing[0]) {
      const [updated] = await db
        .update(projectMembers)
        .set({ userId: matched?.id || existing[0].userId })
        .where(eq(projectMembers.id, existing[0].id))
        .returning();
      member = updated;
    } else {
      const [created] = await db
        .insert(projectMembers)
        .values({
          projectId: id,
          name,
          userId: matched?.id || null,
          role: 'member',
        })
        .returning();
      member = created;
    }

    if (matched) {
      await db
        .update(actions)
        .set({ assigneeId: matched.id, status: 'assigned' })
        .where(
          and(
            eq(actions.projectId, id),
            eq(actions.reviewStatus, 'confirmed'),
            isNull(actions.assigneeId),
            ilike(actions.owner, name),
          ),
        );
    }

    res.status(201).json({
      member: publicMember({ ...member, email: matched?.email || null }),
    });
  } catch (error) {
    console.error('Add member failed:', error);
    res.status(500).json({ error: 'Could not add that person' });
  }
});

export default router;
