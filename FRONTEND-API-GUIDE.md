# מדריך ל־React: איך מתחברים לשרת

המסמך מיועד לך, כדי שתכתבי בעצמך את צד ה־React. אין בו קוד React, רק מה השרת מקבל ומחזיר.

## 1. כללים בסיסיים

- **Base URL:** `https://YOUR-APP.onrender.com` (בפיתוח מקומי: `http://localhost:3000`). כל ה־Endpoints מתחילים ב־`/api`.
- **פורמט:** JSON בבקשות ובתשובות (חוץ מהעלאת קבצים, ראי סעיף 8).
- **תיעוד חי ולניסוי:** `BASE_URL/api-docs`
- **שדות תאריך ושעה:** תאריך `YYYY-MM-DD`, שעה `HH:mm`, זמנים מלאים בפורמט ISO (`2026-10-27T08:00:00.000Z`).
- **ימים בשבוע:** `dayOfWeek` הוא מספר: `0` ראשון, `1` שני, `2` שלישי, `3` רביעי, `4` חמישי, `5` שישי.
- **מחזורים:** `HEH` = מחזור ה׳, `VAV` = מחזור ו׳.
- **הרדמה ב־Render חינמי:** הבקשה הראשונה אחרי 15 דקות ללא פעילות יכולה לקחת עד דקה. כדאי להציג למשתמשת טעינה.

## 2. התחברות ו־Authentication

1. שולחים `POST /api/auth/login` עם אימייל וסיסמה.
2. השרת מחזיר `sessionKey`. זה **מפתח אקראי**, לא JWT. ה־JWT עצמו נשמר בשרת בלבד.
3. בכל בקשה מוגנת שולחים את המפתח בכותרת:

```
Authorization: Bearer <sessionKey>
```

4. המפתח תקף עד `expiresAt` (ברירת מחדל 8 שעות). אחרי כן מתקבל 401 וצריך להתחבר מחדש.
5. התנתקות: `POST /api/auth/logout` (מבטל את המפתח בשרת).
6. אל תשלחי מזהה משתמשת מהלקוח. השרת יודע מי את לפי המפתח.
7. איפה לשמור את המפתח: החלטה שלך. שימי לב שמה שנשמר ב־`localStorage` נגיש לכל סקריפט בדף.
8. כדאי לזהות את התפקיד לפי `user.role` שחוזר בהתחברות, ולבנות לפיו את התפריטים.

**Request:**

```json
{ "email": "miriam.student@example.com", "password": "Password123!" }
```

**Response (200):**

```json
{
  "sessionKey": "LYqL4a1q6Alo7Zj7zMGgQnUa7LaIdVc9Zmbe1h3xXEU",
  "expiresAt": "2026-10-28T01:50:42.000Z",
  "user": {
    "id": "c485b8e5-5357-44cf-8a84-1b876809e36d",
    "fullName": "מרים לוי",
    "email": "miriam.student@example.com",
    "role": "STUDENT",
    "classId": "3f1c2b64-8a53-4d1b-9a47-0c2f6e8d1a11",
    "isActive": true,
    "createdAt": "2026-09-01T08:00:00.000Z"
  }
}
```

`role` הוא אחד מ־`ADMIN` (מזכירה), `TEACHER` (מורה), `STUDENT` (תלמידה).

## 3. פורמט שגיאות וקודי סטטוס

כל שגיאה חוזרת באותו מבנה:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "הנתונים שנשלחו אינם תקינים",
    "details": [{ "field": "email", "message": "אימייל לא תקין" }]
  }
}
```

`details` מופיע רק בחלק מהשגיאות. כדי להציג שגיאה ליד שדה בטופס, חפשי ב־`details` את `field`.

| קוד | משמעות | מה לעשות בצד הלקוח |
|---|---|---|
| 200/201/204 | הצלחה (204 = בלי גוף) | |
| 400 | קלט לא תקין | להציג את `message` ואת `details` ליד השדות |
| 401 | אין מפתח, לא תקין או פג תוקף | לנקות את המפתח ולהעביר למסך התחברות |
| 403 | אין הרשאה (תפקיד לא מתאים או רשומה של אחרת) | להציג "אין לך הרשאה" |
| 404 | לא נמצא | להציג "לא נמצא" |
| 409 | התנגשות (שיעור חופף, ערך קיים) | להציג את ההסבר. ב־`LESSON_CONFLICT` יש ב־`details[].reasons` את הסיבות |
| 413 | קובץ גדול מדי | להציג שהמגבלה 5MB |
| 429 | יותר מדי ניסיונות התחברות | להמתין |
| 500 | תקלה בשרת | הודעה כללית |

קודי שגיאה שימושיים ב־`error.code`: `INVALID_CREDENTIALS`, `LESSON_CONFLICT`, `NOT_TODAYS_LESSON`, `LESSON_CANCELLED`, `INVALID_DUE_DATE`, `NO_FILES`, `FILE_TYPE_NOT_ALLOWED`, `FILE_TOO_LARGE`, `TOO_MANY_FILES`, `NO_RECIPIENTS`.

## 4. הרשאות

| פעולה | מזכירה | מורה | תלמידה |
|---|:-:|:-:|:-:|
| לוח זמנים: צפייה | הכול (כולל מבוטלים) | רק שלה | רק של הכיתה שלה |
| לוח זמנים: יצירה, עריכה, מחיקה | ✅ | ❌ | ❌ |
| משתמשים, כיתות ומקצועות: ניהול | ✅ | ❌ | ❌ |
| שליחת הודעה לקבוצה | ✅ | ❌ | ❌ |
| שיחה מורה–מזכירה | ✅ | ✅ | ❌ |
| הערות אישיות | ❌ | ✅ (שלה) | ✅ (שלה) |
| שיעורי בית: יצירה | ❌ | ✅ (לשיעור של היום) | ❌ |
| שיעורי בית: צפייה | ❌ | ✅ | ✅ |
| הגשה | ❌ | ❌ | ✅ |
| צפייה בהגשות | ❌ | ✅ (של שיעוריה) | ✅ (שלה) |
| משוב על הגשה | ❌ | ✅ נותנת וצופה | ✅ צופה בשלה |
| התראות | ✅ | ✅ | ✅ |

## 5. מבני הנתונים (דוגמאות)

**שיעור (Lesson)**

```json
{
  "id": "…",
  "subject": { "id": "…", "name": "מבני נתונים" },
  "teacher": { "id": "…", "fullName": "רחל כהן" },
  "class": { "id": "…", "name": "ה1", "grade": "HEH" },
  "dayOfWeek": 0,
  "startTime": "09:00",
  "endTime": "10:30",
  "room": "101",
  "status": "ACTIVE",
  "changeNote": null
}
```

`status` הוא `ACTIVE` או `CANCELLED`. **תלמידות ומורות לא מקבלות שיעורים מבוטלים בכלל.** רק המזכירה.

**שיעורי בית (Homework)**

```json
{
  "id": "…",
  "title": "תרגיל 3 - מערכים",
  "description": "פתרי את שאלות 1-5 בעמוד 42",
  "lessonDate": "2026-10-26",
  "dueDate": "2026-10-30",
  "createdAt": "2026-10-26T08:00:00.000Z",
  "createdBy": { "id": "…", "fullName": "רחל כהן" },
  "lesson": {
    "id": "…",
    "subject": { "id": "…", "name": "מבני נתונים" },
    "class": { "id": "…", "name": "ה1" },
    "dayOfWeek": 0, "startTime": "09:00", "endTime": "10:30", "room": "101"
  },
  "mySubmission": { "id": "…", "submittedAt": "2026-10-27T10:00:00.000Z" }
}
```

`mySubmission` (או `null`) חוזר לתלמידה. `submissionsCount` חוזר למורה.

**הגשה (Submission)**

```json
{
  "id": "…",
  "comment": "לא הצלחתי את שאלה 5",
  "submittedAt": "2026-10-27T10:00:00.000Z",
  "updatedAt": "2026-10-27T10:00:00.000Z",
  "isLate": false,
  "files": [{ "id": "…", "fileName": "exercise1.zip", "mimeType": "application/zip", "sizeBytes": 20480 }],
  "student": { "id": "…", "fullName": "מרים לוי", "class": { "id": "…", "name": "ה1" } },
  "homework": {
    "id": "…", "title": "תרגיל 3 - מערכים", "dueDate": "2026-10-30",
    "lesson": { "id": "…", "subject": { "id": "…", "name": "מבני נתונים" }, "class": { "id": "…", "name": "ה1" } }
  },
  "feedback": { "content": "עבודה טובה", "createdAt": "…", "updatedAt": "…", "teacher": { "id": "…", "fullName": "רחל כהן" } }
}
```

`feedback` הוא `null` כשעוד אין משוב.

**הערה אישית (Note) - המחברת**

```json
{
  "id": "…",
  "content": "לחזור על רקורסיה לפני המבחן",
  "createdAt": "…",
  "updatedAt": "…",
  "lesson": { "id": "…", "subject": "מבני נתונים", "class": "ה1", "dayOfWeek": 0, "startTime": "09:00" }
}
```

`lesson.subject` הוא התווית של השיעור שבו ההערה נכתבה. ההערות **לא קשורות להגשות**.

**התראה (Notification)**

```json
{
  "id": "…", "type": "LESSON_CHANGED", "title": "שיעור בוטל",
  "body": "מבני נתונים (ה1): השיעור בוטל", "isRead": false, "createdAt": "…"
}
```

`type` הוא אחד מ־`LESSON_CHANGED`, `ANNOUNCEMENT`, `HOMEWORK_ADDED`, `FEEDBACK_ADDED`, `MESSAGE`.

## 6. אילו Endpoints לכל מסך

### משותף
| מסך | Endpoint |
|---|---|
| התחברות | `POST /api/auth/login` |
| פרטי המחוברת | `GET /api/auth/me` |
| התנתקות | `POST /api/auth/logout` |
| שינוי סיסמה | `POST /api/auth/change-password` גוף: `{"currentPassword","newPassword"}` (8 תווים לפחות) |
| פעמון התראות | `GET /api/notifications?unreadOnly=true` מחזיר `{items, unreadCount}`. `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`. כדאי לרענן כל 30 עד 60 שניות |
| הודעות שהתקבלו | `GET /api/announcements` |
| רשימות לבחירה | `GET /api/classes`, `GET /api/subjects` |

### תלמידה
| מסך | Endpoint |
|---|---|
| מערכת שבועית | `GET /api/lessons/week` מחזיר `{days:[{dayOfWeek,name,lessons:[…]}]}` |
| מערכת יומית (לחיצה על יום) | `GET /api/lessons/day/:dayOfWeek` מחזיר `{dayOfWeek,name,lessons:[…]}` עם שם שיעור, שעות וחדר |
| שיעורי בית | `GET /api/homeworks` (אפשר `?upcoming=true`, `?lessonId=`), `GET /api/homeworks/:id` |
| הגשה | `POST /api/homeworks/:id/submission` (סעיף 8) |
| ההגשות שלי והמשוב | `GET /api/submissions/mine` |
| הורדת קובץ שהגשתי | `GET /api/submission-files/:fileId` |
| מחברת אישית | `GET /api/notes` (אפשר `?lessonId=`, `?search=`), `POST /api/notes` גוף `{"lessonId","content"}`, `PATCH /api/notes/:id` גוף `{"content"}`, `DELETE /api/notes/:id` |

### מורה
| מסך | Endpoint |
|---|---|
| המערכת שלי (שבועית) | `GET /api/lessons/week` |
| מערכת יומית (גם היום הנוכחי) | `GET /api/lessons/day/:dayOfWeek` (מקצוע, כיתה, שעות, חדר) |
| פרטי שיעור | `GET /api/lessons/:id` |
| הערות אישיות על שיעור | `GET /api/notes?lessonId=…`, `POST /api/notes`, `PATCH`/`DELETE /api/notes/:id` |
| שיעורי בית לשיעור של היום | `POST /api/homeworks` גוף `{"lessonId","title","description","dueDate"}`. מותר רק לשיעור שלה שמתקיים היום ו־`dueDate` אחרי היום. `PATCH`/`DELETE /api/homeworks/:id` |
| הגשות עם סינון | `GET /api/submissions?classId=&subjectId=&homeworkId=&search=שם&sortBy=studentName&order=asc` |
| הורדת קובץ | `GET /api/submission-files/:fileId` |
| משוב | `PUT /api/submissions/:id/feedback` גוף `{"content"}`, `GET /api/submissions/:id/feedback` |
| שיחה עם המזכירה | `GET /api/teacher-messages`, `POST /api/teacher-messages` גוף `{"body"}` |

### מזכירה
| מסך | Endpoint |
|---|---|
| לוחות זמנים | `GET /api/lessons?classId=&teacherId=&dayOfWeek=&status=` (כולל מבוטלים) |
| הוספת שיעור | `POST /api/lessons` |
| עריכה, העברה וביטול | `PATCH /api/lessons/:id` (למשל `{"status":"CANCELLED"}` או `{"dayOfWeek":2,"room":"14"}`) |
| מחיקה | `DELETE /api/lessons/:id` |
| שליחת הודעה | `POST /api/announcements` |
| שיחות עם מורות | `GET /api/teacher-messages/threads`, `GET /api/teacher-messages?teacherId=`, `POST /api/teacher-messages` גוף `{"teacherId","body"}` |
| ניהול משתמשים | `GET /api/users?role=&classId=&search=&isActive=&page=&limit=`, `POST /api/users`, `GET`/`PATCH /api/users/:id` |
| כיתות ומקצועות | `POST`/`PATCH /api/classes`, `POST`/`PATCH /api/subjects` |

## 7. טפסים: שדות חובה

**התחברות:** `email` (אימייל תקין), `password`.

**שיעור (מזכירה):** `subjectId`, `teacherId`, `classId` (מזהים מהרשימות), `dayOfWeek` (0 עד 5), `startTime`, `endTime` (`HH:mm`, הסיום אחרי ההתחלה), `room`. אופציונלי: `changeNote`.
```json
{ "subjectId": "…", "teacherId": "…", "classId": "…", "dayOfWeek": 0, "startTime": "09:00", "endTime": "10:30", "room": "101" }
```
בעדכון (`PATCH`) שולחים רק מה שמשתנה, ואפשר גם `status` (`ACTIVE`/`CANCELLED`). כל שינוי שולח התראה אוטומטית לתלמידות הכיתה ולמורה.

**משתמשת חדשה (מזכירה):** `fullName`, `email`, `password` (8 תווים לפחות), `role`. תלמידה **חייבת** `classId`. מורה ומזכירה **אסור** להן `classId`.

**שיעורי בית (מורה):** `lessonId`, `title`, `description`, `dueDate`.

**הערה אישית:** `lessonId`, `content`. מורה רשאית לכתוב רק על שיעור שלה, ותלמידה רק על שיעור של הכיתה שלה.

**משוב:** `content`.

**הודעה לקבוצה (מזכירה):** `audience` + `title` + `body`.
```json
{ "audience": "CLASS", "classId": "…", "title": "שינוי במבחן", "body": "המבחן נדחה ליום חמישי" }
```
`audience`: `ALL_STUDENTS`, `ALL_TEACHERS`, `GRADE` (חובה גם `grade`: `HEH` או `VAV`), `CLASS` (חובה גם `classId`).

**הודעה בשיחה:** מורה שולחת `{"body"}`. מזכירה שולחת `{"teacherId","body"}`.

## 8. העלאת קבצים (הגשה)

`POST /api/homeworks/:id/submission` הוא `multipart/form-data` (לא JSON):

- שדה `files`: עד **5 קבצים**, עד **5MB** כל אחד. אפשר לשלוח את אותו שם שדה כמה פעמים.
- שדה `comment`: טקסט אופציונלי (עד 2000 תווים).
- אל תקבעי ידנית את הכותרת `Content-Type`. הדפדפן קובע אותה לבד עם ה־boundary כשמשתמשים ב־`FormData`.
- סוגי קבצים מותרים: `pdf zip txt md png jpg jpeg gif doc docx json html css js ts tsx jsx py java c cpp cs sql`
- הגשה ראשונה מחזירה **201**. הגשה חוזרת לאותו שיעורי בית מחליפה את הקבצים ומחזירה **200**. שליחת `comment` בלבד (בלי קבצים) מעדכנת רק את ההערה.
- אפשר להגיש רק לשיעורי בית של הכיתה שלך.
- הורדת קובץ: `GET /api/submission-files/:fileId` עם הכותרת `Authorization`. התשובה היא הקובץ עצמו (לא JSON). זכרי שקישור רגיל `<a href>` לא ישלח את הכותרת, ולכן צריך לבקש את הקובץ עם `fetch` ולהציג אותו מה־Blob.

## 9. התנהגויות חשובות לממשק

- **שיעור מבוטל** לא מופיע במערכת של תלמידה או מורה. אם המזכירה מבטלת שיעור, הוא פשוט נעלם בבקשה הבאה, וההתראה מסבירה למה.
- **שיעור שהועבר** (שינוי `dayOfWeek`/שעה/חדר) מופיע רק במקום החדש.
- **שיעורי בית** אפשר להוסיף רק לשיעור שמתקיים היום (לפי שעון ישראל). אחרת יחזור `NOT_TODAYS_LESSON`. כדאי לאפשר את הכפתור רק בשיעורי היום ברשימת היום של המורה.
- **`isLate`** בהגשה אומר שהוגשה אחרי תאריך ההגשה.
- **המזכירה לא רואה** הגשות, שיעורי בית והערות. אל תציגי לה אותם.
