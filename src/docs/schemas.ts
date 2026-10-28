// סכמות OpenAPI (components.schemas) עם דוגמאות JSON

type Json = Record<string, unknown>;

export const ref = (name: string): Json => ({ $ref: `#/components/schemas/${name}` });
const array = (items: Json): Json => ({ type: 'array', items });
const str = (example: string, extra: Json = {}): Json => ({ type: 'string', example, ...extra });
const uuid = (example = '3f1c2b64-8a53-4d1b-9a47-0c2f6e8d1a11'): Json => str(example, { format: 'uuid' });
const int = (example: number, extra: Json = {}): Json => ({ type: 'integer', example, ...extra });
const date = (example: string): Json => str(example, { format: 'date' });
const dateTime = (example: string): Json => str(example, { format: 'date-time' });
const bool = (example: boolean): Json => ({ type: 'boolean', example });
const nullable = (s: Json): Json => ({ ...s, nullable: true });
const obj = (properties: Record<string, Json>, required: string[] = Object.keys(properties)): Json => ({
  type: 'object',
  properties,
  // ב-OpenAPI 3.0 אסור למערך required ריק
  ...(required.length > 0 ? { required } : {})
});

const role = { type: 'string', enum: ['ADMIN', 'TEACHER', 'STUDENT'], example: 'STUDENT' };
const grade = { type: 'string', enum: ['HEH', 'VAV'], example: 'HEH', description: 'HEH = מחזור ה׳, VAV = מחזור ו׳' };
const lessonStatus = { type: 'string', enum: ['ACTIVE', 'CANCELLED'], example: 'ACTIVE' };
const time = str('09:00', { pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' });
const day = int(0, { minimum: 0, maximum: 5, description: '0 = ראשון ... 5 = שישי' });

const classRef = obj({ id: uuid(), name: str('ה1'), grade });
const subjectRef = obj({ id: uuid(), name: str('מבני נתונים') });
const fileMeta = obj({
  id: uuid(),
  fileName: str('exercise1.zip'),
  mimeType: str('application/zip'),
  sizeBytes: int(20480)
});

const feedback = obj({
  content: str('עבודה טובה, כדאי לשפר את שמות המשתנים.'),
  createdAt: dateTime('2026-10-28T09:00:00.000Z'),
  updatedAt: dateTime('2026-10-28T09:00:00.000Z'),
  teacher: obj({ id: uuid(), fullName: str('רחל כהן') })
});

const lesson = obj({
  id: uuid(),
  subject: subjectRef,
  teacher: obj({ id: uuid(), fullName: str('רחל כהן') }),
  class: classRef,
  dayOfWeek: day,
  startTime: time,
  endTime: str('10:30'),
  room: str('12'),
  status: lessonStatus,
  changeNote: nullable(str('הועבר מיום שני'))
});

const homework = obj(
  {
    id: uuid(),
    title: str('תרגיל 3 - מערכים'),
    description: str('פתרי את שאלות 1-5 בעמוד 42 והעלי את הקבצים.'),
    lessonDate: date('2026-10-26'),
    dueDate: date('2026-10-30'),
    createdAt: dateTime('2026-10-26T08:00:00.000Z'),
    createdBy: obj({ id: uuid(), fullName: str('רחל כהן') }),
    lesson: obj({
      id: uuid(),
      subject: subjectRef,
      class: obj({ id: uuid(), name: str('ה1') }),
      dayOfWeek: day,
      startTime: time,
      endTime: str('10:30'),
      room: str('12')
    }),
    mySubmission: {
      ...obj({ id: uuid(), submittedAt: dateTime('2026-10-27T10:00:00.000Z') }),
      nullable: true,
      description: 'מוחזר לתלמידה בלבד. null אם עוד לא הוגש'
    },
    submissionsCount: int(12, { description: 'מוחזר למורה בלבד' })
  },
  ['id', 'title', 'description', 'lessonDate', 'dueDate', 'createdAt', 'createdBy', 'lesson']
);

const submission = obj({
  id: uuid(),
  comment: nullable(str('לא הצלחתי את שאלה 5')),
  submittedAt: dateTime('2026-10-27T10:00:00.000Z'),
  updatedAt: dateTime('2026-10-27T10:00:00.000Z'),
  isLate: bool(false),
  files: array(fileMeta),
  student: obj({ id: uuid(), fullName: str('מרים לוי'), class: nullable(obj({ id: uuid(), name: str('ה1') })) }),
  homework: obj({
    id: uuid(),
    title: str('תרגיל 3 - מערכים'),
    dueDate: date('2026-10-30'),
    lesson: obj({ id: uuid(), subject: subjectRef, class: obj({ id: uuid(), name: str('ה1') }) })
  }),
  feedback: nullable(feedback)
});

const user = obj(
  {
    id: uuid(),
    fullName: str('מרים לוי'),
    email: str('miriam@example.com', { format: 'email' }),
    role,
    classId: nullable(uuid()),
    seminarId: uuid(),
    isActive: bool(true),
    createdAt: dateTime('2026-09-01T08:00:00.000Z'),
    class: nullable(classRef)
  },
  ['id', 'fullName', 'email', 'role', 'classId', 'isActive', 'createdAt']
);

const notification = obj(
  {
    id: uuid(),
    userId: uuid(),
    type: {
      type: 'string',
      enum: ['LESSON_CHANGED', 'ANNOUNCEMENT', 'HOMEWORK_ADDED', 'FEEDBACK_ADDED', 'MESSAGE'],
      example: 'LESSON_CHANGED'
    },
    title: str('שיעור בוטל'),
    body: str('מבני נתונים (ה1): השיעור בוטל'),
    lessonId: nullable(uuid()),
    announcementId: nullable(uuid()),
    isRead: bool(false),
    createdAt: dateTime('2026-10-27T07:00:00.000Z')
  },
  ['id', 'userId', 'type', 'title', 'body', 'isRead', 'createdAt']
);

const announcement = obj(
  {
    id: uuid(),
    audience: { type: 'string', enum: ['ALL_STUDENTS', 'ALL_TEACHERS', 'GRADE', 'CLASS'], example: 'CLASS' },
    grade: nullable(grade),
    classId: nullable(uuid()),
    title: str('שינוי בלוח המבחנים'),
    body: str('המבחן ביום רביעי נדחה ליום חמישי.'),
    createdAt: dateTime('2026-10-27T07:00:00.000Z'),
    sender: obj({ id: uuid(), fullName: str('שרה המזכירה') }),
    recipientCount: int(25, { description: 'מוחזר למזכירה בלבד' })
  },
  ['id', 'audience', 'title', 'body', 'createdAt']
);

const threadMessage = obj({
  id: uuid(),
  body: str('שלום, אפשר להחליף חדר ביום שלישי?'),
  createdAt: dateTime('2026-10-27T08:00:00.000Z'),
  readAt: nullable(dateTime('2026-10-27T08:05:00.000Z')),
  sender: obj({ id: uuid(), fullName: str('רחל כהן'), role }),
  isMine: bool(true)
});

export const schemas: Record<string, Json> = {
  Error: obj({
    error: obj(
      {
        code: str('VALIDATION_ERROR'),
        message: str('הנתונים שנשלחו אינם תקינים'),
        details: { type: 'array', items: { type: 'object' }, description: 'פרטים נוספים (לא תמיד קיים)' }
      },
      ['code', 'message']
    )
  }),
  LoginRequest: obj({ email: str('secretary@example.com', { format: 'email' }), password: str('Password123!') }),
  RegisterRequest: obj({
    seminarName: str('סמינר בית יעקב'),
    fullName: str('שרה המזכירה'),
    email: str('new-secretary@example.com', { format: 'email' }),
    password: str('Password123!', { minLength: 8 })
  }),
  LoginResponse: obj({
    sessionKey: str('Zk3v...random-key...', {
      description: 'המפתח לשליחה ב-Authorization: Bearer. ה-JWT עצמו נשמר בשרת בלבד'
    }),
    expiresAt: dateTime('2026-10-27T16:00:00.000Z'),
    user
  }),
  ChangePasswordRequest: obj({ currentPassword: str('OldPassword1!'), newPassword: str('NewPassword2!', { minLength: 8 }) }),
  User: user,
  UserList: obj({ items: array(user), total: int(30), page: int(1), limit: int(100) }),
  CreateUserRequest: obj(
    {
      fullName: str('מרים לוי'),
      email: str('miriam@example.com', { format: 'email' }),
      password: str('Password123!', { minLength: 8 }),
      role,
      classId: { ...uuid(), description: 'חובה לתלמידה, אסור למורה ולמזכירה' }
    },
    ['fullName', 'email', 'password', 'role']
  ),
  UpdateUserRequest: obj(
    {
      fullName: str('מרים לוי'),
      email: str('miriam@example.com', { format: 'email' }),
      password: str('NewPassword2!', { minLength: 8, description: 'איפוס סיסמה על ידי המזכירה' }),
      classId: uuid(),
      isActive: bool(false)
    },
    []
  ),
  Class: classRef,
  ClassRequest: obj({ name: str('ה1'), grade }),
  Subject: subjectRef,
  SubjectRequest: obj({ name: str('פיתוח Web') }),
  Lesson: lesson,
  CreateLessonRequest: obj(
    {
      subjectId: uuid(),
      teacherId: uuid(),
      classId: uuid(),
      dayOfWeek: day,
      startTime: time,
      endTime: str('10:30'),
      room: str('12'),
      changeNote: str('הערה אופציונלית')
    },
    ['subjectId', 'teacherId', 'classId', 'dayOfWeek', 'startTime', 'endTime', 'room']
  ),
  UpdateLessonRequest: obj(
    {
      subjectId: uuid(),
      teacherId: uuid(),
      classId: uuid(),
      dayOfWeek: day,
      startTime: time,
      endTime: str('10:30'),
      room: str('14'),
      status: lessonStatus,
      changeNote: nullable(str('הועבר לחדר 14'))
    },
    []
  ),
  WeekSchedule: obj({
    days: array(obj({ dayOfWeek: day, name: str('ראשון'), lessons: array(lesson) }))
  }),
  DaySchedule: obj({ dayOfWeek: day, name: str('ראשון'), lessons: array(lesson) }),
  Note: obj({
    id: uuid(),
    content: str('לחזור על הרקורסיה לפני המבחן'),
    createdAt: dateTime('2026-10-27T08:00:00.000Z'),
    updatedAt: dateTime('2026-10-27T08:00:00.000Z'),
    lesson: obj({ id: uuid(), subject: str('מבני נתונים'), class: str('ה1'), dayOfWeek: day, startTime: time })
  }),
  NoteRequest: obj({ lessonId: uuid(), content: str('לחזור על הרקורסיה לפני המבחן') }),
  NoteUpdateRequest: obj({ content: str('לחזור על הרקורסיה ועל עצים') }),
  Homework: homework,
  CreateHomeworkRequest: obj({
    lessonId: uuid(),
    title: str('תרגיל 3 - מערכים'),
    description: str('פתרי את שאלות 1-5 בעמוד 42 והעלי את הקבצים.'),
    dueDate: date('2026-10-30')
  }),
  UpdateHomeworkRequest: obj(
    { title: str('תרגיל 3 - מערכים'), description: str('הסבר מעודכן'), dueDate: date('2026-10-31') },
    []
  ),
  SubmissionUploadRequest: {
    type: 'object',
    required: ['files'],
    properties: {
      files: { type: 'array', items: { type: 'string', format: 'binary' }, description: 'עד 5 קבצים, עד 5MB כל אחד' },
      comment: { type: 'string', example: 'לא הצלחתי את שאלה 5', description: 'הערה אופציונלית' }
    }
  },
  SubmissionFile: fileMeta,
  Submission: submission,
  Feedback: feedback,
  FeedbackRequest: obj({ content: str('עבודה טובה, כדאי לשפר את שמות המשתנים.') }),
  Notification: notification,
  NotificationList: obj({ items: array(notification), unreadCount: int(3) }),
  MarkAllReadResponse: obj({ updated: int(3) }),
  Announcement: announcement,
  CreateAnnouncementRequest: obj(
    {
      audience: { type: 'string', enum: ['ALL_STUDENTS', 'ALL_TEACHERS', 'GRADE', 'CLASS'], example: 'CLASS' },
      grade: { ...grade, description: 'חובה כש-audience הוא GRADE' },
      classId: { ...uuid(), description: 'חובה כש-audience הוא CLASS' },
      title: str('שינוי בלוח המבחנים'),
      body: str('המבחן ביום רביעי נדחה ליום חמישי.')
    },
    ['audience', 'title', 'body']
  ),
  ThreadMessage: threadMessage,
  ThreadMessageRequest: obj(
    {
      teacherId: { ...uuid(), description: 'חובה כשהמזכירה שולחת. מורה לא שולחת שדה זה' },
      body: str('שלום, אפשר להחליף חדר ביום שלישי?')
    },
    ['body']
  ),
  ThreadSummary: obj({
    teacher: obj({ id: uuid(), fullName: str('רחל כהן') }),
    lastMessage: obj({ body: str('תודה רבה'), createdAt: dateTime('2026-10-27T08:00:00.000Z'), senderId: uuid() }),
    unreadCount: int(2)
  }),
  Health: obj({ status: str('ok'), database: str('up'), time: dateTime('2026-10-27T08:00:00.000Z') })
};
