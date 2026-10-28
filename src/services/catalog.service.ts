import type { Grade } from '@prisma/client';
import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';

export const listClasses = (seminarId: string) =>
  prisma.class.findMany({ where: { seminarId }, orderBy: [{ grade: 'asc' }, { name: 'asc' }] });

export const createClass = (seminarId: string, data: { name: string; grade: Grade }) =>
  prisma.class.create({ data: { ...data, seminarId } });

export async function updateClass(seminarId: string, id: string, data: { name?: string; grade?: Grade }) {
  const existing = await prisma.class.findFirst({ where: { id, seminarId } });
  if (!existing) throw HttpError.notFound('הכיתה לא נמצאה');
  return prisma.class.update({ where: { id }, data });
}

export const listSubjects = (seminarId: string) =>
  prisma.subject.findMany({ where: { seminarId }, orderBy: { name: 'asc' } });

export const createSubject = (seminarId: string, data: { name: string }) =>
  prisma.subject.create({ data: { ...data, seminarId } });

export async function updateSubject(seminarId: string, id: string, data: { name: string }) {
  const existing = await prisma.subject.findFirst({ where: { id, seminarId } });
  if (!existing) throw HttpError.notFound('המקצוע לא נמצא');
  return prisma.subject.update({ where: { id }, data });
}
