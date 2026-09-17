import { Router } from 'express';
import { and, desc, eq, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { actions, meetings, projectMembers, projects } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { BOARD_STATUSES, normalizeBoardStatus, withBoardFields } from '../lib/board.js';

const router = Router();
router.use(requireAuth);

async function canMutateAction(userId, actionId) {
  const [row] = await db
    .select({
      id: actions.id,
      assigneeId: actions.assigneeId,
      status: actions.status,
      meetingUserId: meetings.userId,
      projectOwnerId: projects.ownerId,
      projectId: actions.projectId,
    })
    .from(actions)
    .innerJoin(meetings, eq(actions.meetingId, meetings.id))
    .leftJoin(projects, eq(actions.projectId, projects.id))
    .where(eq(actions.id, actionId))
    .limit(1);

  if (!row) return null;
  if (row.assigneeId === userId || row.meetingUserId === userId || row.projectOwnerId === userId) {
    return row;
  }

  if (row.projectId) {
    const [member] = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, row.projectId), eq(projectMembers.userId, userId)))
      .limit(1);
    if (member) return row;
  }
  return null;
}

router.get('/', async (req, res) => {
  try {
    const rows = await db
      .select({
        id: actions.id,
        meetingId: actions.meetingId,
        projectId: actions.projectId,
        assigneeId: actions.assigneeId,
        owner: actions.owner,
        task: actions.task,
        detail: actions.detail,
        deadline: actions.deadline,
        priority: actions.priority,
        followUp: actions.followUp,
        status: actions.status,
        reviewStatus: actions.reviewStatus,
        createdAt: actions.createdAt,
        meetingTitle: meetings.title,
        projectName: projects.name,
      })
      .from(actions)
      .innerJoin(meetings, eq(actions.meetingId, meetings.id))
      .leftJoin(projects, eq(actions.projectId, projects.id))
      .where(
        and(
          eq(actions.reviewStatus, 'confirmed'),
          or(eq(actions.assigneeId, req.user.userId), eq(meetings.userId, req.user.userId)),
        ),
      )
      .orderBy(desc(actions.createdAt));

    const mine = rows.filter((row) => row.assigneeId === req.user.userId).map(withBoardFields);
    res.json({ actions: mine });
  } catch (error) {
    console.error('List actions failed:', error);
    res.status(500).json({ error: 'Could not load actions' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = normalizeBoardStatus(String(req.body?.status || '').trim());
    if (!BOARD_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Status must be a board column' });
    }

    const existing = await canMutateAction(req.user.userId, id);
    if (!existing) {
      return res.status(404).json({ error: 'Action not found' });
    }

    if (['assigned', 'in_progress', 'review'].includes(status) && !existing.assigneeId) {
      return res.status(400).json({ error: 'Add this person to the team before moving the task' });
    }

    const [updated] = await db.update(actions).set({ status }).where(eq(actions.id, id)).returning();
    res.json({ action: withBoardFields(updated) });
  } catch (error) {
    console.error('Update action failed:', error);
    res.status(500).json({ error: 'Could not update action' });
  }
});

export default router;
