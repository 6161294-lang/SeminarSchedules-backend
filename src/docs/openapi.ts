import { ref, schemas } from './schemas';

type Json = Record<string, unknown>;

// ---------- עזרים לבניית המסמך ----------

const ID = '3f1c2b64-8a53-4d1b-9a47-0c2f6e8d1a11';

const errorResponses: Record<string, Json> = {
  '400': {
    description: 'בקשה שגויה או ולידציה נכשלה',
    content: {
      'application/json': {
        schema: ref('Error'),
        example: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'הנתונים שנשלחו אינם תקינים',
            details: [{ field: 'email', message: 'אימייל לא תקין' }]
          }
        }
      }
    }
  },
  '401': {
    description: 'חסר מפתח התחברות, או שהוא לא תקין או פג תוקף',
    content: {
      'application/json': {
        schema: ref('Error'),
        example: { error: { code: 'UNAUTHORIZED', message: 'חסר מפתח התחברות' } }
      }
    }
  },
  '403': {
    description: 'אין הרשאה לפעולה (תפקיד לא מתאים או רשומה של משתמשת אחרת)',
    content: {
      'application/json': {
        schema: ref('Error'),
        example: { error: { code: 'FORBIDDEN', message: 'אין לך הרשאה לבצע פעולה זו' } }
      }
    }
  },
  '404': {
    description: 'המשאב לא נמצא',
    content: {
      'application/json': {
        schema: ref('Error'),
        example: { error: { code: 'NOT_FOUND', message: 'המשאב לא נמצא' } }
      }
    }
  },
  '409': {
    description: 'התנגשות (למשל שיעור חופף או ערך קיים)',
    content: {
      'application/json': {
        schema: ref('Error'),
        example: { error: { code: 'LESSON_CONFLICT', message: 'יש התנגשות עם שיעור קיים במערכת' } }
      }
    }
  },
  '413': {
    description: 'קובץ גדול מדי',
    content: {
      'application/json': {
        schema: ref('Error'),
        example: { error: { code: 'FILE_TOO_LARGE', message: 'הקובץ גדול מדי (עד 5MB לקובץ)' } }
      }
    }
  }
};

const jsonContent = (schema: Json, example?: unknown): Json => ({
  'application/json': { schema, ...(example !== undefined ? { example } : {}) }
});
const ok = (description: string, schema: Json, example?: unknown): Json => ({
  description,
  content: jsonContent(schema, example)
});
const arrayOf = (name: string): Json => ({ type: 'array', items: ref(name) });
const body = (schemaName: string, example: unknown): Json => ({
  required: true,
  content: jsonContent(ref(schemaName), example)
});
const noContent = (description: string): Json => ({ description });

const pathId = (description = 'מזהה (UUID)'): Json => ({
  name: 'id',
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', format: 'uuid', example: ID }
});
const query = (name: string, schema: Json, description: string): Json => ({
  name,
  in: 'query',
  required: false,
  description,
  schema
});
const uuidQuery = (name: string, description: string) => query(name, { type: 'string', format: 'uuid' }, description);

interface OpInput {
  tags: string[];
  summary: string;
  description?: string;
  /** תפקידים מורשים. ריק או חסר = ציבורי */
  roles?: string[];
  /** ברירת מחדל: כל התפקידים המחוברים */
  anyLoggedIn?: boolean;
  parameters?: Json[];
  requestBody?: Json;
  responses: Record<string, Json>;
  errors?: string[];
}

const roleNames: Record<string, string> = { ADMIN: 'מזכירה', TEACHER: 'מורה', STUDENT: 'תלמידה' };

function op(i: OpInput): Json {
  const isPublic = !i.roles && !i.anyLoggedIn;
  const who = isPublic
    ? 'ציבורי (בלי התחברות)'
    : i.roles
      ? `דורש התחברות. הרשאה: ${i.roles.map((r) => roleNames[r]).join(', ')}`
      : 'דורש התחברות. כל התפקידים';
  const errors = new Set(i.errors ?? []);
  if (!isPublic) {
    errors.add('401');
    if (i.roles) errors.add('403');
  }
  if (i.requestBody || i.parameters?.some((p) => p.in === 'query')) errors.add('400');
  const responses: Record<string, Json> = { ...i.responses };
  for (const code of [...errors].sort()) {
    if (!responses[code]) responses[code] = { $ref: `#/components/responses/E${code}` };
  }
  return {
    tags: i.tags,
    summary: i.summary,
    description: [i.description, `**הרשאות:** ${who}`].filter(Boolean).join('\n\n'),
    ...(isPublic ? { security: [] } : { security: [{ bearerAuth: [] }] }),
    ...(i.parameters ? { parameters: i.parameters } : {}),
    ...(i.requestBody ? { requestBody: i.requestBody } : {}),
    responses
  };
}

const A = ['ADMIN'];
const T = ['TEACHER'];
const TS = ['TEACHER', 'STUDENT'];

// ---------- הנתיבים ----------

const paths: Record<string, Json> = {
  '/api/health': {
    get: op({
      tags: ['מערכת'],
      summary: 'בדיקת תקינות השרת והמסד',
      responses: { '200': ok('השרת והמסד פעילים', ref('Health')), '503': noContent('מסד הנתונים לא זמין') }
    })
  },

  // ----- אימות -----
  '/api/auth/login': {
    post: op({
      tags: ['אימות'],
      summary: 'התחברות',
      description:
        'מחזיר `sessionKey`. את המפתח שולחים בכל בקשה ככותרת `Authorization: Bearer <sessionKey>`. ב-Swagger: לוחצים Authorize ומדביקים את המפתח.',
      requestBody: body('LoginRequest', { email: 'secretary@example.com', password: 'Password123!' }),
      responses: { '200': ok('התחברות הצליחה', ref('LoginResponse')) },
      errors: ['401']
    })
  },
  '/api/auth/register': {
    post: op({
      tags: ['אימות'],
      summary: 'הרשמת מזכירה: יוצרת סמינר חדש וריק',
      description:
        'רק מזכירה נרשמת. נוצר סמינר מבודד וריק, והיא מזכירה שלו ומגדירה בו מורות, תלמידות, כיתות ומקצועות. מחזיר התחברות כמו `/api/auth/login`.',
      requestBody: body('RegisterRequest', {
        seminarName: 'סמינר בית יעקב',
        fullName: 'שרה המזכירה',
        email: 'new-secretary@example.com',
        password: 'Password123!'
      }),
      responses: { '201': ok('ההרשמה הצליחה', ref('LoginResponse')) },
      errors: ['409']
    })
  },
  '/api/auth/logout': {
    post: op({
      tags: ['אימות'],
      summary: 'התנתקות (מבטלת את המפתח בשרת)',
      anyLoggedIn: true,
      responses: { '204': noContent('התנתקת בהצלחה') }
    })
  },
  '/api/auth/me': {
    get: op({
      tags: ['אימות'],
      summary: 'פרטי המשתמשת המחוברת',
      anyLoggedIn: true,
      responses: { '200': ok('המשתמשת המחוברת', ref('User')) }
    })
  },
  '/api/auth/change-password': {
    post: op({
      tags: ['אימות'],
      summary: 'שינוי סיסמה (מנתק התחברויות אחרות)',
      anyLoggedIn: true,
      requestBody: body('ChangePasswordRequest', { currentPassword: 'OldPassword1!', newPassword: 'NewPassword2!' }),
      responses: { '204': noContent('הסיסמה שונתה') }
    })
  },

  // ----- משתמשים -----
  '/api/users': {
    get: op({
      tags: ['משתמשים'],
      summary: 'רשימת משתמשים עם סינון וחיפוש',
      roles: A,
      parameters: [
        query('role', { type: 'string', enum: ['ADMIN', 'TEACHER', 'STUDENT'] }, 'סינון לפי תפקיד'),
        uuidQuery('classId', 'סינון תלמידות לפי כיתה'),
        query('isActive', { type: 'boolean' }, 'פעילות או מושבתות'),
        query('search', { type: 'string' }, 'חיפוש לפי שם או אימייל'),
        query('page', { type: 'integer', default: 1 }, 'מספר עמוד'),
        query('limit', { type: 'integer', default: 100, maximum: 200 }, 'כמות בעמוד')
      ],
      responses: { '200': ok('רשימת משתמשים', ref('UserList')) }
    }),
    post: op({
      tags: ['משתמשים'],
      summary: 'יצירת משתמשת',
      roles: A,
      requestBody: body('CreateUserRequest', {
        fullName: 'מרים לוי',
        email: 'miriam@example.com',
        password: 'Password123!',
        role: 'STUDENT',
        classId: ID
      }),
      responses: { '201': ok('המשתמשת נוצרה', ref('User')) },
      errors: ['409']
    })
  },
  '/api/users/{id}': {
    get: op({
      tags: ['משתמשים'],
      summary: 'פרטי משתמשת',
      roles: A,
      parameters: [pathId()],
      responses: { '200': ok('המשתמשת', ref('User')) },
      errors: ['404']
    }),
    patch: op({
      tags: ['משתמשים'],
      summary: 'עדכון, השבתה או איפוס סיסמה',
      description: 'השבתה או איפוס סיסמה מנתקים את כל ההתחברויות של המשתמשת.',
      roles: A,
      parameters: [pathId()],
      requestBody: body('UpdateUserRequest', { isActive: false }),
      responses: { '200': ok('המשתמשת אחרי העדכון', ref('User')) },
      errors: ['404', '409']
    })
  },

  // ----- כיתות ומקצועות -----
  '/api/classes': {
    get: op({
      tags: ['כיתות ומקצועות'],
      summary: 'רשימת כיתות',
      anyLoggedIn: true,
      responses: { '200': ok('כיתות', arrayOf('Class')) }
    }),
    post: op({
      tags: ['כיתות ומקצועות'],
      summary: 'יצירת כיתה',
      roles: A,
      requestBody: body('ClassRequest', { name: 'ה1', grade: 'HEH' }),
      responses: { '201': ok('הכיתה נוצרה', ref('Class')) },
      errors: ['409']
    })
  },
  '/api/classes/{id}': {
    patch: op({
      tags: ['כיתות ומקצועות'],
      summary: 'עדכון כיתה',
      roles: A,
      parameters: [pathId()],
      requestBody: body('ClassRequest', { name: 'ה1' }),
      responses: { '200': ok('הכיתה אחרי העדכון', ref('Class')) },
      errors: ['404', '409']
    })
  },
  '/api/subjects': {
    get: op({
      tags: ['כיתות ומקצועות'],
      summary: 'רשימת מקצועות',
      anyLoggedIn: true,
      responses: { '200': ok('מקצועות', arrayOf('Subject')) }
    }),
    post: op({
      tags: ['כיתות ומקצועות'],
      summary: 'יצירת מקצוע',
      roles: A,
      requestBody: body('SubjectRequest', { name: 'פיתוח Web' }),
      responses: { '201': ok('המקצוע נוצר', ref('Subject')) },
      errors: ['409']
    })
  },
  '/api/subjects/{id}': {
    patch: op({
      tags: ['כיתות ומקצועות'],
      summary: 'עדכון מקצוע',
      roles: A,
      parameters: [pathId()],
      requestBody: body('SubjectRequest', { name: 'פיתוח Web מתקדם' }),
      responses: { '200': ok('המקצוע אחרי העדכון', ref('Subject')) },
      errors: ['404', '409']
    })
  },

  // ----- לוח זמנים -----
  '/api/lessons': {
    get: op({
      tags: ['לוח זמנים'],
      summary: 'רשימת שיעורים',
      description:
        'מזכירה רואה את כל השיעורים (כולל מבוטלים) ויכולה לסנן. מורה רואה את שלה, ותלמידה את אלו של הכיתה שלה. **שיעורים מבוטלים מוסתרים ממורות ותלמידות.**',
      anyLoggedIn: true,
      parameters: [
        uuidQuery('classId', 'סינון לפי כיתה (מזכירה בלבד)'),
        uuidQuery('teacherId', 'סינון לפי מורה (מזכירה בלבד)'),
        query('dayOfWeek', { type: 'integer', minimum: 0, maximum: 5 }, 'יום בשבוע: 0 ראשון עד 5 שישי'),
        query('status', { type: 'string', enum: ['ACTIVE', 'CANCELLED'] }, 'סטטוס (מזכירה בלבד)')
      ],
      responses: { '200': ok('שיעורים לפי יום ושעה', arrayOf('Lesson')) }
    }),
    post: op({
      tags: ['לוח זמנים'],
      summary: 'יצירת שיעור',
      description: 'שולחת התראה לתלמידות הכיתה ולמורה. מחזיר 409 אם יש התנגשות של מורה, כיתה או חדר.',
      roles: A,
      requestBody: body('CreateLessonRequest', {
        subjectId: ID,
        teacherId: ID,
        classId: ID,
        dayOfWeek: 0,
        startTime: '09:00',
        endTime: '10:30',
        room: '12'
      }),
      responses: { '201': ok('השיעור נוצר', ref('Lesson')) },
      errors: ['409']
    })
  },
  '/api/lessons/week': {
    get: op({
      tags: ['לוח זמנים'],
      summary: 'מערכת שבועית',
      description: 'מחזיר ימים 0-5 עם השיעורים של כל יום, בלי שיעורים מבוטלים.',
      roles: TS,
      responses: { '200': ok('המערכת השבועית', ref('WeekSchedule')) }
    })
  },
  '/api/lessons/day/{dayOfWeek}': {
    get: op({
      tags: ['לוח זמנים'],
      summary: 'מערכת יומית',
      description: 'שיעורי היום בלבד: מקצוע, כיתה, שעות וחדר. שיעורים מבוטלים לא מוצגים.',
      roles: TS,
      parameters: [
        {
          name: 'dayOfWeek',
          in: 'path',
          required: true,
          description: '0 = ראשון ... 5 = שישי',
          schema: { type: 'integer', minimum: 0, maximum: 5, example: 0 }
        }
      ],
      responses: { '200': ok('המערכת היומית', ref('DaySchedule')) },
      errors: ['400']
    })
  },
  '/api/lessons/{id}': {
    get: op({
      tags: ['לוח זמנים'],
      summary: 'פרטי שיעור',
      anyLoggedIn: true,
      parameters: [pathId()],
      responses: { '200': ok('השיעור', ref('Lesson')) },
      errors: ['404']
    }),
    patch: op({
      tags: ['לוח זמנים'],
      summary: 'עדכון שיעור (העברה, ביטול או שינוי חדר)',
      description:
        'שינוי יום, שעה או חדר מעביר את השיעור (הוא יופיע רק ביום החדש). `status: CANCELLED` מבטל אותו והוא נעלם ממורות ותלמידות. כל שינוי שולח התראה לתלמידות הכיתה ולמורה.',
      roles: A,
      parameters: [pathId()],
      requestBody: body('UpdateLessonRequest', { dayOfWeek: 2, startTime: '11:00', endTime: '12:30', room: '14' }),
      responses: { '200': ok('השיעור אחרי העדכון', ref('Lesson')) },
      errors: ['404', '409']
    }),
    delete: op({
      tags: ['לוח זמנים'],
      summary: 'מחיקת שיעור',
      roles: A,
      parameters: [pathId()],
      responses: { '204': noContent('השיעור נמחק') },
      errors: ['404']
    })
  },

  // ----- הערות אישיות -----
  '/api/notes': {
    get: op({
      tags: ['הערות אישיות'],
      summary: 'ההערות שלי (המחברת)',
      description: 'כל משתמשת רואה רק הערות שכתבה בעצמה.',
      roles: TS,
      parameters: [
        uuidQuery('lessonId', 'סינון לפי שיעור'),
        query('search', { type: 'string' }, 'חיפוש בתוכן ההערה')
      ],
      responses: { '200': ok('הערות עם תווית השיעור', arrayOf('Note')) }
    }),
    post: op({
      tags: ['הערות אישיות'],
      summary: 'הוספת הערה לשיעור',
      description: 'מורה רשאית להוסיף רק לשיעורים שלה, ותלמידה רק לשיעורי הכיתה שלה.',
      roles: TS,
      requestBody: body('NoteRequest', { lessonId: ID, content: 'לחזור על הרקורסיה לפני המבחן' }),
      responses: { '201': ok('ההערה נוצרה', ref('Note')) },
      errors: ['404']
    })
  },
  '/api/notes/{id}': {
    patch: op({
      tags: ['הערות אישיות'],
      summary: 'עריכת הערה (הכותבת בלבד)',
      roles: TS,
      parameters: [pathId()],
      requestBody: body('NoteUpdateRequest', { content: 'לחזור על רקורסיה ועל עצים' }),
      responses: { '200': ok('ההערה אחרי העדכון', ref('Note')) },
      errors: ['404']
    }),
    delete: op({
      tags: ['הערות אישיות'],
      summary: 'מחיקת הערה (הכותבת בלבד)',
      roles: TS,
      parameters: [pathId()],
      responses: { '204': noContent('ההערה נמחקה') },
      errors: ['404']
    })
  },

  // ----- שיעורי בית -----
  '/api/homeworks': {
    get: op({
      tags: ['שיעורי בית'],
      summary: 'רשימת שיעורי בית',
      description:
        'מורה רואה את שיעורי הבית של השיעורים שלה (עם `submissionsCount`). תלמידה רואה את אלו של הכיתה שלה (עם `mySubmission`). המזכירה אינה רואה שיעורי בית.',
      roles: TS,
      parameters: [
        uuidQuery('lessonId', 'סינון לפי שיעור'),
        query('upcoming', { type: 'boolean' }, 'רק שיעורי בית שמועד ההגשה שלהם עוד לא עבר')
      ],
      responses: { '200': ok('שיעורי בית', arrayOf('Homework')) }
    }),
    post: op({
      tags: ['שיעורי בית'],
      summary: 'יצירת שיעורי בית לשיעור של היום',
      description:
        'המורה יכולה להוסיף שיעורי בית רק לשיעור שלה שמתקיים **היום** (שעון ישראל). תאריך ההגשה חייב להיות אחרי היום. תלמידות הכיתה מקבלות התראה.',
      roles: T,
      requestBody: body('CreateHomeworkRequest', {
        lessonId: ID,
        title: 'תרגיל 3 - מערכים',
        description: 'פתרי את שאלות 1-5 בעמוד 42 והעלי את הקבצים.',
        dueDate: '2026-10-30'
      }),
      responses: { '201': ok('שיעורי הבית נוצרו', ref('Homework')) },
      errors: ['404']
    })
  },
  '/api/homeworks/{id}': {
    get: op({
      tags: ['שיעורי בית'],
      summary: 'פרטי שיעורי בית',
      roles: TS,
      parameters: [pathId()],
      responses: { '200': ok('שיעורי הבית', ref('Homework')) },
      errors: ['404']
    }),
    patch: op({
      tags: ['שיעורי בית'],
      summary: 'עריכת שיעורי בית (היוצרת בלבד)',
      roles: T,
      parameters: [pathId()],
      requestBody: body('UpdateHomeworkRequest', { dueDate: '2026-10-31' }),
      responses: { '200': ok('שיעורי הבית אחרי העדכון', ref('Homework')) },
      errors: ['404']
    }),
    delete: op({
      tags: ['שיעורי בית'],
      summary: 'מחיקת שיעורי בית (כולל ההגשות)',
      roles: T,
      parameters: [pathId()],
      responses: { '204': noContent('נמחק') },
      errors: ['404']
    })
  },
  '/api/homeworks/{id}/submission': {
    post: op({
      tags: ['הגשות'],
      summary: 'הגשת שיעורי בית (העלאת קבצים)',
      description:
        'בקשת `multipart/form-data` עם עד 5 קבצים בשדה `files` (עד 5MB כל אחד) והערה אופציונלית בשדה `comment`. הגשה חוזרת מחליפה את הקבצים. סוגי קבצים מותרים: pdf, zip, txt, md, תמונות, doc/docx, וקובצי קוד נפוצים. ההגשה אינה קשורה למחברת האישית.',
      roles: ['STUDENT'],
      parameters: [pathId('מזהה שיעורי הבית')],
      requestBody: {
        required: true,
        content: { 'multipart/form-data': { schema: ref('SubmissionUploadRequest') } }
      },
      responses: {
        '201': ok('הגשה חדשה נוצרה', ref('Submission')),
        '200': ok('הגשה קיימת עודכנה', ref('Submission'))
      },
      errors: ['404', '413']
    })
  },

  // ----- הגשות ומשוב -----
  '/api/submissions/mine': {
    get: op({
      tags: ['הגשות'],
      summary: 'ההגשות שלי (כולל משוב)',
      roles: ['STUDENT'],
      responses: { '200': ok('ההגשות של התלמידה', arrayOf('Submission')) }
    })
  },
  '/api/submissions': {
    get: op({
      tags: ['הגשות'],
      summary: 'הגשות התלמידות שלי עם סינון, חיפוש ומיון',
      description: 'המורה רואה רק הגשות של שיעורים שהיא מלמדת. המזכירה אינה רואה הגשות כלל.',
      roles: T,
      parameters: [
        uuidQuery('classId', 'סינון לפי כיתה'),
        uuidQuery('subjectId', 'סינון לפי מקצוע'),
        uuidQuery('homeworkId', 'סינון לפי שיעורי בית'),
        query('search', { type: 'string' }, 'חיפוש לפי שם תלמידה'),
        query('sortBy', { type: 'string', enum: ['submittedAt', 'studentName'], default: 'submittedAt' }, 'מיון לפי'),
        query('order', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }, 'כיוון המיון')
      ],
      responses: { '200': ok('הגשות', arrayOf('Submission')) }
    })
  },
  '/api/submissions/{id}': {
    get: op({
      tags: ['הגשות'],
      summary: 'פרטי הגשה (התלמידה שהגישה או מורת השיעור)',
      roles: TS,
      parameters: [pathId()],
      responses: { '200': ok('ההגשה', ref('Submission')) },
      errors: ['404']
    })
  },
  '/api/submission-files/{id}': {
    get: op({
      tags: ['הגשות'],
      summary: 'הורדת קובץ הגשה (התלמידה שהגישה או מורת השיעור)',
      roles: TS,
      parameters: [pathId('מזהה הקובץ')],
      responses: {
        '200': {
          description: 'תוכן הקובץ',
          content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } }
        }
      },
      errors: ['404']
    })
  },
  '/api/submissions/{id}/feedback': {
    put: op({
      tags: ['הגשות'],
      summary: 'מתן או עדכון משוב על הגשה (מורת השיעור)',
      description: 'רק התלמידה והמורה רואות את המשוב. התלמידה מקבלת התראה.',
      roles: T,
      parameters: [pathId('מזהה ההגשה')],
      requestBody: body('FeedbackRequest', { content: 'עבודה טובה, כדאי לשפר את שמות המשתנים.' }),
      responses: { '200': ok('המשוב נשמר', ref('Feedback')) },
      errors: ['404']
    }),
    get: op({
      tags: ['הגשות'],
      summary: 'קריאת המשוב על הגשה',
      roles: TS,
      parameters: [pathId('מזהה ההגשה')],
      responses: { '200': ok('המשוב', ref('Feedback')) },
      errors: ['404']
    })
  },

  // ----- התראות והודעות -----
  '/api/notifications': {
    get: op({
      tags: ['התראות והודעות'],
      summary: 'ההתראות שלי',
      anyLoggedIn: true,
      parameters: [
        query('unreadOnly', { type: 'boolean' }, 'רק התראות שלא נקראו'),
        query('limit', { type: 'integer', default: 50, maximum: 100 }, 'כמות מקסימלית')
      ],
      responses: { '200': ok('התראות וכמות שלא נקראו', ref('NotificationList')) }
    })
  },
  '/api/notifications/read-all': {
    post: op({
      tags: ['התראות והודעות'],
      summary: 'סימון כל ההתראות כנקראו',
      anyLoggedIn: true,
      responses: { '200': ok('כמה התראות עודכנו', ref('MarkAllReadResponse')) }
    })
  },
  '/api/notifications/{id}/read': {
    patch: op({
      tags: ['התראות והודעות'],
      summary: 'סימון התראה כנקראה',
      anyLoggedIn: true,
      parameters: [pathId()],
      responses: { '200': ok('ההתראה', ref('Notification')) },
      errors: ['404']
    })
  },
  '/api/announcements': {
    post: op({
      tags: ['התראות והודעות'],
      summary: 'שליחת הודעה לקבוצה (מזכירה)',
      description: 'קהל: כל התלמידות, כל המורות, מחזור או כיתה. כל נמענת מקבלת התראה.',
      roles: A,
      requestBody: body('CreateAnnouncementRequest', {
        audience: 'CLASS',
        classId: ID,
        title: 'שינוי בלוח המבחנים',
        body: 'המבחן ביום רביעי נדחה ליום חמישי.'
      }),
      responses: { '201': ok('ההודעה נשלחה', ref('Announcement')) }
    }),
    get: op({
      tags: ['התראות והודעות'],
      summary: 'הודעות: מזכירה רואה את ששלחה, אחרות את שקיבלו',
      anyLoggedIn: true,
      responses: { '200': ok('הודעות', arrayOf('Announcement')) }
    })
  },
  '/api/teacher-messages/threads': {
    get: op({
      tags: ['שיחה מורה-מזכירה'],
      summary: 'רשימת שיחות עם מורות (מזכירה)',
      roles: A,
      responses: { '200': ok('שיחות עם הודעה אחרונה ומספר שלא נקראו', arrayOf('ThreadSummary')) }
    })
  },
  '/api/teacher-messages': {
    get: op({
      tags: ['שיחה מורה-מזכירה'],
      summary: 'הודעות בשיחה',
      description: 'מורה רואה את השיחה שלה. מזכירה חייבת לשלוח `teacherId`. פתיחת השיחה מסמנת הודעות של הצד השני כנקראו.',
      roles: ['TEACHER', 'ADMIN'],
      parameters: [uuidQuery('teacherId', 'חובה למזכירה')],
      responses: { '200': ok('הודעות מהישנה לחדשה', arrayOf('ThreadMessage')) }
    }),
    post: op({
      tags: ['שיחה מורה-מזכירה'],
      summary: 'שליחת הודעה בשיחה',
      description: 'מורה שולחת למזכירה (בלי teacherId). מזכירה חייבת לציין teacherId.',
      roles: ['TEACHER', 'ADMIN'],
      requestBody: body('ThreadMessageRequest', { body: 'שלום, אפשר להחליף חדר ביום שלישי?' }),
      responses: { '201': ok('ההודעה נשלחה', ref('ThreadMessage')) }
    })
  }
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'API - מערכת סנכרון לוח זמנים בסמינר',
    version: '1.0.0',
    description: [
      'ה-API של מערכת לוח הזמנים. שלוש הרשאות: מזכירה (ADMIN), מורה (TEACHER), תלמידה (STUDENT).',
      '',
      '**איך מתחברים ב-Swagger:**',
      '1. פותחים `POST /api/auth/login` ולוחצים Try it out ואז Execute.',
      '2. מעתיקים את הערך של `sessionKey` מהתשובה.',
      '3. לוחצים על הכפתור **Authorize** למעלה ומדביקים את המפתח (בלי המילה Bearer).',
      '4. עכשיו אפשר להפעיל Endpoints מוגנים. בלי מפתח מתקבל 401, ובלי הרשאה מתאימה 403.',
      '',
      'ה-JWT נשמר בשרת בלבד. הלקוח מקבל ושולח רק מפתח אקראי (`sessionKey`).'
    ].join('\n')
  },
  servers: [{ url: '/', description: 'השרת הנוכחי' }],
  tags: [
    { name: 'מערכת' },
    { name: 'אימות' },
    { name: 'משתמשים' },
    { name: 'כיתות ומקצועות' },
    { name: 'לוח זמנים' },
    { name: 'הערות אישיות' },
    { name: 'שיעורי בית' },
    { name: 'הגשות' },
    { name: 'התראות והודעות' },
    { name: 'שיחה מורה-מזכירה' }
  ],
  paths,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'SessionKey',
        description:
          'המפתח (`sessionKey`) שהתקבל מ-/api/auth/login. השרת מחזיק את ה-JWT עצמו ומוצא אותו לפי המפתח.'
      }
    },
    responses: Object.fromEntries(Object.entries(errorResponses).map(([code, r]) => [`E${code}`, r])),
    schemas
  }
};

export function listDocumentedOperations(): string[] {
  const out: string[] = [];
  for (const [path, item] of Object.entries(paths)) {
    for (const method of Object.keys(item)) out.push(`${method.toUpperCase()} ${path}`);
  }
  return out.sort();
}
