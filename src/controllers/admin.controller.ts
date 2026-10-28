import type { Request, Response } from 'express';
import { currentUser } from '../middleware/authorize';
import * as catalog from '../services/catalog.service';
import * as users from '../services/user.service';
import * as messaging from '../services/messaging.service';

type Q = Record<string, unknown>;

// ----- משתמשים -----
export async function listUsers(req: Request, res: Response) {
  res.json(await users.listUsers(currentUser(req).seminarId, req.query as unknown as Parameters<typeof users.listUsers>[1]));
}
export async function getUser(req: Request, res: Response) {
  res.json(await users.getUser(currentUser(req).seminarId, req.params.id as string));
}
export async function createUser(req: Request, res: Response) {
  res.status(201).json(await users.createUser(currentUser(req).seminarId, req.body));
}
export async function updateUser(req: Request, res: Response) {
  res.json(await users.updateUser(currentUser(req), req.params.id as string, req.body));
}

// ----- כיתות ומקצועות -----
export async function listClasses(req: Request, res: Response) {
  res.json(await catalog.listClasses(currentUser(req).seminarId));
}
export async function createClass(req: Request, res: Response) {
  res.status(201).json(await catalog.createClass(currentUser(req).seminarId, req.body));
}
export async function updateClass(req: Request, res: Response) {
  res.json(await catalog.updateClass(currentUser(req).seminarId, req.params.id as string, req.body));
}
export async function listSubjects(req: Request, res: Response) {
  res.json(await catalog.listSubjects(currentUser(req).seminarId));
}
export async function createSubject(req: Request, res: Response) {
  res.status(201).json(await catalog.createSubject(currentUser(req).seminarId, req.body));
}
export async function updateSubject(req: Request, res: Response) {
  res.json(await catalog.updateSubject(currentUser(req).seminarId, req.params.id as string, req.body));
}

// ----- הודעות מהמזכירה -----
export async function createAnnouncement(req: Request, res: Response) {
  res.status(201).json(await messaging.createAnnouncement(currentUser(req), req.body));
}
export async function listAnnouncements(req: Request, res: Response) {
  res.json(await messaging.listAnnouncements(currentUser(req)));
}

// ----- שיחה מורה-מזכירה -----
export async function getThread(req: Request, res: Response) {
  res.json(await messaging.getThread(currentUser(req), (req.query as Q).teacherId as string | undefined));
}
export async function sendThreadMessage(req: Request, res: Response) {
  res.status(201).json(await messaging.sendThreadMessage(currentUser(req), req.body));
}
export async function listThreads(req: Request, res: Response) {
  res.json(await messaging.listThreads(currentUser(req)));
}
