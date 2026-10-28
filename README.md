# Backend למערכת סנכרון לוח זמנים בסמינר

שרת REST ל־React. מאפשר למזכירה לנהל לוח זמנים, ושולח התראות אוטומטיות לתלמידות ולמורות בכל שינוי. התלמידות מגישות שיעורי בית, והמורות נותנות משוב.

**מי אני?** אם זו הפעם הראשונה שלך, פתחי את [START-HERE.md](START-HERE.md). שם יש הוראות צעד אחר צעד להעלאה ל־GitHub ול־Render.
**כותבת את ה־React?** פתחי את [FRONTEND-API-GUIDE.md](FRONTEND-API-GUIDE.md).

## טכנולוגיות

Node.js 22 (LTS) · Express 4 · TypeScript (strict) · PostgreSQL · Prisma 6 · Zod · JWT · bcryptjs · Swagger (OpenAPI 3) · Vitest

## הפעלה במחשב

נדרשים: Node.js 20 ומעלה, ומסד PostgreSQL (מקומי או בענן).

```bash
npm install
```

העתיקי את `.env.example` לקובץ בשם `.env` ומלאי `DATABASE_URL` ו־`JWT_SECRET`.

```bash
npx prisma migrate deploy
```

```bash
npm run seed
```

```bash
npm run dev
```

השרת עולה על http://localhost:3000. Swagger נמצא ב־http://localhost:3000/api-docs.

### משתמשי הדגמה (רק בפיתוח, אחרי `npm run seed`)

| תפקיד | אימייל | סיסמה |
|---|---|---|
| מזכירה | secretary@example.com | Password123! |
| מורה | rachel.teacher@example.com | Password123! |
| מורה | leah.teacher@example.com | Password123! |
| תלמידה (ה1) | miriam.student@example.com | Password123! |
| תלמידה (ה1) | dina.student@example.com | Password123! |

הנתונים מומצאים. בפרודקשן לא נוצרים חשבונות עם סיסמה ידועה (ראי "משתני סביבה").

## פקודות

| פקודה | מה היא עושה |
|---|---|
| `npm run dev` | שרת פיתוח עם הפעלה מחדש אוטומטית |
| `npm run build` | `prisma generate` והידור TypeScript לתיקיית `dist` |
| `npm start` | הפעלת הגרסה המהודרת |
| `npm run start:render` | מה ש־Render מריץ: Migrations, Seed, והפעלה |
| `npm run typecheck` | בדיקת טיפוסים |
| `npm test` | בדיקות אוטומטיות (דורש מסד בדיקות, ראי למטה) |
| `npm run seed` | נתוני בסיס והדגמה |
| `npm run openapi:export` | מייצר מחדש את `openapi.json` |

## בדיקות

הבדיקות רצות על PostgreSQL אמיתי ו**מוחקות את כל הנתונים בו**. לכן צריך מסד נפרד.

1. צרי מסד ריק, למשל `seminar_test`.
2. העתיקי את `.env.test.example` לשם `.env.test` והגדירי `TEST_DATABASE_URL`.
3. הריצי `npm test`. ה־Migrations מוחלות אוטומטית על מסד הבדיקות.

## משתני סביבה

| משתנה | חובה | תיאור |
|---|:-:|---|
| `DATABASE_URL` | ✅ | Connection String של PostgreSQL |
| `JWT_SECRET` | ✅ | סוד להצפנה. בפרודקשן לפחות 32 תווים |
| `JWT_EXPIRES_IN` | ❌ | תוקף ההתחברות. ברירת מחדל `8h` |
| `PORT` | ❌ | פורט. ב־Render נקבע אוטומטית |
| `CORS_ORIGINS` | ❌ | כתובות ה־React המותרות, מופרדות בפסיק. `*` מתאים רק לפיתוח |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | בפרודקשן | יוצרים את חשבון המזכירה הראשון (נוצר רק אם לא קיים) |
| `SEED_DEMO_DATA`, `SEED_DEMO_PASSWORD` | ❌ | נתוני הדגמה בפרודקשן. דורש סיסמה שאת קובעת |

## מבנה התיקיות

```
src/
  config/       קריאת משתני סביבה
  db/           חיבור Prisma
  middleware/   authenticate, authorize, validate, errorHandler, upload
  validation/   סכמות Zod
  routes/       הגדרת הנתיבים וההרשאות
  controllers/  קבלת בקשה והחזרת תשובה
  services/     כל הלוגיקה והגישה למסד
  docs/         מסמך OpenAPI (Swagger)
  seed/         נתוני בסיס והדגמה
prisma/         schema.prisma ו־migrations
tests/          בדיקות Vitest
docs/           SPEC.md (האפיון) ו־openapi.json
```

## אימות והרשאות

1. `POST /api/auth/login` מחזיר `sessionKey`.
2. כל בקשה פרטית שולחת `Authorization: Bearer <sessionKey>`.
3. ה־JWT נשמר בטבלת `sessions` בשרת. הדפדפן אף פעם לא מקבל אותו.
4. `POST /api/auth/logout` מבטל את המפתח מיד. השבתת משתמשת או איפוס סיסמה מנתקים אותה.
5. בלי מפתח תקין: 401. תפקיד לא מתאים או רשומה של אחרת: 403.

| תפקיד | יכולות עיקריות |
|---|---|
| מזכירה (ADMIN) | לראות ולשנות את כל הלוחות, לשלוח הודעות, לנהל משתמשים. **אינה רואה הגשות, שיעורי בית או הערות** |
| מורה (TEACHER) | לראות את שיעוריה, הערות אישיות, שיעורי בית לשיעור של היום, הגשות של שיעוריה, משוב, שיחה עם המזכירה |
| תלמידה (STUDENT) | מערכת של הכיתה שלה, שיעורי בית, הגשת קבצים, משוב שקיבלה, מחברת אישית |

שיעור מבוטל מוסתר ממורות ותלמידות. שיעור שהועבר מופיע רק ביום החדש.

## אבטחה

- סיסמאות נשמרות כ־hash (bcrypt). אין סיסמאות, hash או סודות בתשובות.
- Zod בודק כל קלט. Helmet מוסיף כותרות אבטחה. הגבלת קצב על ההתחברות.
- הקבצים נשמרים ב־PostgreSQL (עד 5 קבצים, עד 5MB כל אחד, סוגים מוגדרים מראש).
- הרשאות נבדקות בשרת בלבד, והמשתמשת נקבעת לפי ה־token.

## פריסה

ראי [START-HERE.md](START-HERE.md) והקובץ `render.yaml`.
