import type { Request, Response } from 'express';
import { currentUser } from '../middleware/authorize';
import * as homework from '../services/homework.service';
import * as submissions from '../services/submission.service';
import { HttpError } from '../utils/httpError';

export async function list(req: Request, res: Response) {
  res.json(await homework.listHomeworks(currentUser(req), req.query as never));
}
export async function getOne(req: Request, res: Response) {
  res.json(await homework.getHomework(currentUser(req), req.params.id as string));
}
export async function create(req: Request, res: Response) {
  res.status(201).json(await homework.createHomework(currentUser(req), req.body));
}
export async function update(req: Request, res: Response) {
  res.json(await homework.updateHomework(currentUser(req), req.params.id as string, req.body));
}
export async function remove(req: Request, res: Response) {
  await homework.deleteHomework(currentUser(req), req.params.id as string);
  res.status(204).end();
}

// ----- הגשות -----
export async function submit(req: Request, res: Response) {
  const files = (req.files ?? []) as Express.Multer.File[];
  const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : undefined;
  if (comment && comment.length > 2000) {
    throw HttpError.badRequest('ההערה ארוכה מדי (עד 2000 תווים)', 'VALIDATION_ERROR');
  }
  const { submission, created } = await submissions.submit(
    currentUser(req),
    req.params.id as string,
    files,
    comment
  );
  res.status(created ? 201 : 200).json(submission);
}
export async function mine(req: Request, res: Response) {
  res.json(await submissions.listMine(currentUser(req)));
}
export async function listForTeacher(req: Request, res: Response) {
  res.json(await submissions.listForTeacher(currentUser(req), req.query as never));
}
export async function getSubmission(req: Request, res: Response) {
  res.json(await submissions.getSubmission(currentUser(req), req.params.id as string));
}
export async function downloadFile(req: Request, res: Response) {
  const file = await submissions.getFile(currentUser(req), req.params.id as string);
  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', String(file.data.length));
  res.attachment(file.fileName);
  res.end(Buffer.from(file.data));
}
export async function saveFeedback(req: Request, res: Response) {
  res.json(await submissions.saveFeedback(currentUser(req), req.params.id as string, req.body.content));
}
export async function getFeedback(req: Request, res: Response) {
  res.json(await submissions.getFeedback(currentUser(req), req.params.id as string));
}
