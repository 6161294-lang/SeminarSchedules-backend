import path from 'path';
import multer from 'multer';
import { HttpError } from '../utils/httpError';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES = 5;

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.zip', '.txt', '.md', '.png', '.jpg', '.jpeg', '.gif', '.doc', '.docx',
  '.json', '.html', '.css', '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.c', '.cpp', '.cs', '.sql'
]);

export const submissionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES, fields: 10 },
  fileFilter: (_req, file, cb) => {
    // multer מפענח שמות קבצים כ-latin1, ולכן שמות בעברית נשברים. מתקנים ל-UTF-8
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(
        HttpError.badRequest(
          `סוג הקובץ "${ext || file.originalname}" אינו מותר. סוגים מותרים: ${[...ALLOWED_EXTENSIONS].join(' ')}`,
          'FILE_TYPE_NOT_ALLOWED'
        )
      );
    }
    cb(null, true);
  }
}).array('files', MAX_FILES);
