import type { ResponseAction } from '@/lib/types';

/** Shared Action Tracker state — used by the Response page and by every report export. */

export const ACTION_TRACKER_STORAGE_KEY = 'logis_response_actions_v2';

export const ACTION_OWNERS = ['Operations Manager', 'Quality Team', 'Warehouse Team', 'Logistics Team', 'Recall Coordinator'];

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

export type TrackedAction = ResponseAction & {
  completed?: boolean;
  completedAt?: string;
  owner?: string;
  dueTime?: string;
  isOverdue?: boolean;
  priorityLevel?: PriorityLevel;
  agentStatus?: 'pending' | 'approved' | 'rejected';
};

export function priorityLevelFor(priority: number): PriorityLevel {
  return priority <= 1 ? 'critical' : priority <= 2 ? 'high' : 'medium';
}

/** Same owner / priority assignment rules as the Response page tracker. */
export function toTrackedActions(actions: ResponseAction[]): TrackedAction[] {
  return actions.map((a, i) => ({
    ...a,
    completed: false,
    agentStatus: 'pending',
    owner: ACTION_OWNERS[i % ACTION_OWNERS.length],
    priorityLevel: priorityLevelFor(a.priority),
  }));
}

export function loadTrackedActions(): TrackedAction[] | null {
  try {
    const saved = localStorage.getItem(ACTION_TRACKER_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}
