import type { Request, Response } from 'express';
import { currentUser } from '../middleware/authorize';
import * as lessons from '../services/lesson.service';
import * as notes from '../services/note.service';
import * as notifications from '../services/notification.service';

export async function list(req: Request, res: Response) {
  res.json(await lessons.listLessons(currentUser(req), req.query as never));
}
export async function week(req: Request, res: Response) {
  res.json(await lessons.weekSchedule(currentUser(req)));
}
export async function day(req: Request, res: Response) {
  res.json(await lessons.daySchedule(currentUser(req), Number(req.params.dayOfWeek)));
}
export async function getOne(req: Request, res: Response) {
  res.json(await lessons.getLesson(currentUser(req), req.params.id as string));
}
export async function create(req: Request, res: Response) {
  res.status(201).json(await lessons.createLesson(currentUser(req).seminarId, req.body));
}
export async function update(req: Request, res: Response) {
  res.json(await lessons.updateLesson(currentUser(req).seminarId, req.params.id as string, req.body));
}
export async function remove(req: Request, res: Response) {
  await lessons.deleteLesson(currentUser(req).seminarId, req.params.id as string);
  res.status(204).end();
}

// ----- הערות אישיות -----
export async function listNotes(req: Request, res: Response) {
  res.json(await notes.listMine(currentUser(req), req.query as never));
}
export async function createNote(req: Request, res: Response) {
  res.status(201).json(await notes.createNote(currentUser(req), req.body));
}
export async function updateNote(req: Request, res: Response) {
  res.json(await notes.updateNote(currentUser(req), req.params.id as string, req.body.content));
}
export async function deleteNote(req: Request, res: Response) {
  await notes.deleteNote(currentUser(req), req.params.id as string);
  res.status(204).end();
}

// ----- התראות -----
export async function listNotifications(req: Request, res: Response) {
  res.json(await notifications.listMine(currentUser(req).id, req.query as never));
}
export async function markNotificationRead(req: Request, res: Response) {
  res.json(await notifications.markRead(currentUser(req).id, req.params.id as string));
}
export async function markAllNotificationsRead(req: Request, res: Response) {
  res.json(await notifications.markAllRead(currentUser(req).id));
}
