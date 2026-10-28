# התחילי כאן: להעלות את השרת לאינטרנט

המדריך הזה מיועד למי שמעולם לא העלתה שרת לאינטרנט. הוא לוקח בערך שעה בפעם הראשונה.

## לפני שמתחילות: חשוב לדעת

- **שמות הכפתורים באתרים האלה** (GitHub, Neon, Render) נכתבו לפי הידע הנוכחי שלי, ואני **לא יכולה לוודא** שהם זהים בדיוק היום. אתרים משנים את הממשק. אם כפתור נקרא קצת אחרת, חפשי כפתור דומה. אם הכול נראה שונה לגמרי, חפשי באתר את שם הפעולה באנגלית (למשל "New repository").
- **הדברים שנבדקו בפועל:** הבדיקות האוטומטיות, הבנייה, והפעלת השרת מול PostgreSQL במחשב שלי. **לא נבדקה** פריסה אמיתית ל־GitHub, ל־Neon או ל־Render. אם משהו נכשל שם, פתחי את חלק ה' (פתרון תקלות).
- **מסלולים חינמיים עם מגבלות.** בבדיקה של דפי המחירים ב־Render וב־Neon (אוקטובר 2026) נמצא:
  - Render, שרת חינמי: נרדם אחרי 15 דקות בלי פניות, והפנייה הראשונה אחר כך לוקחת בערך דקה. אין בו דיסק קבוע ואין חלון פקודות (Shell). לכן הקבצים שמורים במסד הנתונים והמסד מעודכן אוטומטית בהפעלה.
  - Render, מסד נתונים חינמי: **נמחק אחרי 30 יום**. לכן אנחנו לא משתמשות בו.
  - Neon, מסלול חינמי: 1GB לפרויקט, בלי תפוגה מוצהרת בדף המחירים.
  - מגבלות כאלה משתנות. אם משהו השתנה, אפשר לבחור ספק אחר: הפרויקט עובד עם כל PostgreSQL.
- **אל תשמרי סיסמאות או סודות בקובצי הפרויקט וב־GitHub.** מכניסים אותם רק בלוח הבקרה של Render.

---

## חלק א: GitHub

GitHub הוא האתר ששומר את הקוד. Render קורא את הקוד משם.

1. **פתיחת חשבון.** היכנסי ל־https://github.com ולחצי **Sign up**. הזיני אימייל, סיסמה ושם משתמש, ואמתי את האימייל.
2. **יצירת Repository.** לחצי על סימן **+** בפינה העליונה ואז **New repository**.
   - **Repository name:** `seminar-backend`
   - **Private** (מומלץ, כך רק את רואה את הקוד)
   - **אל תסמני** Add a README, .gitignore או license (הם כבר בפרויקט).
   - לחצי **Create repository**.
3. **חילוץ ה־ZIP.** במחשב: קליק ימני על קובץ ה־ZIP ואז **Extract All** (חלץ הכול). ייפתח תיקייה `backend-project`.
4. **העלאת הקבצים דרך הדפדפן.** בדף ה־Repository החדש לחצי על הקישור **uploading an existing file**.
   - היכנסי לתיקייה `backend-project` שחולצה. סמני **את כל התוכן שלה** (Ctrl+A) וגררי לחלון הדפדפן.
   - חשוב: לגרור את **התוכן** (התיקיות `src`, `prisma` ועוד, והקבצים `package.json` וכו׳), ולא את התיקייה `backend-project` עצמה.
   - **מגבלה ידועה:** GitHub מקבל בהעלאה אחת עד 100 קבצים בערך. אם מופיעה הודעה על יותר מדי קבצים, העלי בכמה סבבים: קודם תיקיית `src`, אחר כך שאר התיקיות והקבצים. כל סבב מסתיים בלחיצה על **Commit changes**.
   - בסוף כל סבב לחצי **Commit changes** (השאירי Commit directly to the main branch).
5. **בדיקה שהכול הועלה.** רענני את דף ה־Repository ובדקי שמופיעים:
   - התיקיות `src`, `prisma`, `tests`, `docs`
   - הקבצים `package.json`, `package-lock.json`, `tsconfig.json`, `render.yaml`, `README.md`, `START-HERE.md`, `.gitignore`, `.env.example`
   - **לא** צריך להופיע: `node_modules` או `.env`.
   - הענף נקרא `main`. אם בראש הדף כתוב משהו אחר (למשל `master`), רשמי לעצמך את שמו.

---

## חלק ב: מסד נתונים PostgreSQL חינמי (Neon)

1. **פתיחת חשבון.** היכנסי ל־https://neon.com ולחצי **Sign up** (אפשר להתחבר עם GitHub).
2. **יצירת פרויקט.** לחצי **Create project** (או New project).
   - **Name:** `seminar`
   - **Region:** בחרי אזור קרוב אליך, למשל **Europe (Frankfurt)**. כדאי שזה יהיה אותו אזור שתבחרי ב־Render.
   - **Postgres version:** אפשר להשאיר ברירת מחדל.
3. **קבלת Connection String.** אחרי היצירה ייפתח חלון **Connect** (או כפתור **Connect** בלוח הבקרה).
   - **כבי** את האפשרות **Connection pooling** (Pooled connection), כדי לקבל חיבור ישיר. ה־Migrations של Prisma עובדות טוב איתו.
   - הכתובת נראית בערך כך: `postgresql://USER:PASSWORD@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   - אם הסיסמה מוסתרת, לחצי **Show password**, ואז העתיקי את כל השורה.
4. **שמירה בטוחה.** הדביקי את הכתובת בקובץ פרטי אצלך (מנהל סיסמאות או פנקס פרטי). **אל** תשלחי אותה בצ'אט, **אל** תעלי אותה ל־GitHub ו**אל** תכתבי אותה בקובץ בפרויקט.
5. **קישור השרת למסד.** תעשי זאת בחלק ג', כמשתנה סביבה בשם `DATABASE_URL`.

**חלופה: Supabase.** אם את מעדיפה את https://supabase.com, צרי פרויקט, ואז **Connect** והעתיקי את מחרוזת ה־**Session pooler** (לא ה־Direct connection, כי הוא עלול לא לעבוד מ־Render). החליפי את `[YOUR-PASSWORD]` בסיסמה שבחרת. חשוב: שרתי Supabase בחינם עלולים להיות מושהים אחרי זמן ללא שימוש.

---

## חלק ג: Render

1. **פתיחת חשבון.** היכנסי ל־https://render.com ולחצי **Get Started** או **Sign Up**. הכי קל להתחבר עם **GitHub**.
2. **חיבור GitHub.** אם Render מבקש גישה, בחרי **Only select repositories** ובחרי רק את `seminar-backend`.
3. **יצירת Web Service.** בלוח הבקרה לחצי **New +** ואז **Web Service**.
4. **בחירת ה־Repository.** בחרי `seminar-backend` ברשימה (או **Connect**).
5. **הגדרות.** מלאי בדיוק:

| שדה | ערך |
|---|---|
| **Name** | `seminar-schedule-backend` (ייקבע גם את הכתובת שלך) |
| **Language** | `Node` |
| **Branch** | `main` |
| **Region** | Frankfurt (אותו אזור כמו המסד, אם אפשר) |
| **Root Directory** | להשאיר ריק |
| **Build Command** | `npm ci --include=dev && npm run build` |
| **Start Command** | `npm run start:render` |
| **Instance Type** | `Free` |

   בקטע **Advanced** מצאי **Health Check Path** והזיני: `/api/health`

6. **משתני סביבה (Environment Variables).** בקטע **Environment Variables** (או Advanced) לחצי **Add Environment Variable** והוסיפי:

| Key | Value |
|---|---|
| `NODE_VERSION` | `22` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | ה־Connection String מחלק ב' |
| `JWT_SECRET` | מחרוזת אקראית ארוכה, לפחות 32 תווים (ראי למטה) |
| `JWT_EXPIRES_IN` | `8h` |
| `CORS_ORIGINS` | כתובת ה־React שלך, למשל `https://my-app.vercel.app`. בפיתוח מקומי אפשר להוסיף גם `http://localhost:5173` (מופרדות בפסיק, בלי רווחים) |
| `SEED_ADMIN_EMAIL` | האימייל של המזכירה הראשונה |
| `SEED_ADMIN_PASSWORD` | סיסמה חזקה שבחרת למזכירה (לפחות 8 תווים) |

   **איך מייצרים `JWT_SECRET`:** השתמשי במחולל סיסמאות של מנהל הסיסמאות שלך וצרי מחרוזת של 48 תווים לפחות. (או בטרמינל: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`). אל תשתפי אותה עם אף אחד.

7. **ה־Migrations (מסד הנתונים).** את לא צריכה להריץ שום דבר ידנית. הפקודה `npm run start:render` מריצה בכל הפעלה `prisma migrate deploy` (יצירת הטבלאות), אחר כך יוצרת כיתות ומקצועות ואת חשבון המזכירה, ורק אז מפעילה את השרת. (בשרת חינמי של Render אין חלון פקודות, ולכן עשינו את זה כך.)
8. **Deploy.** לחצי **Create Web Service** (או **Deploy**). Render יתחיל לבנות. זה לוקח כמה דקות.
9. **בדיקה שהשרת פעיל.** בלשונית **Logs** חכי לשורות:
   - `All migrations have been successfully applied`
   - `השרת רץ על פורט ...`
   - ובראש הדף יופיע **Live** בירוק.

   הכתובת שלך מופיעה בראש הדף, בערך כך: `https://seminar-schedule-backend.onrender.com`

**חלופה עם `render.yaml`:** בפרויקט יש קובץ `render.yaml`. אפשר ב־Render ללחוץ **New +** ואז **Blueprint**, לבחור את ה־Repository, והוא ימלא את ההגדרות לבד. את הערכים הסודיים (`DATABASE_URL`, `CORS_ORIGINS`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`) תצטרכי להזין בעצמך. `JWT_SECRET` ייווצר אוטומטית.

---

## חלק ד: בדיקה שהכול עובד

נניח שהכתובת שלך היא `https://YOUR-APP.onrender.com`.

1. **בדיקת תקינות:** פתחי בדפדפן `https://YOUR-APP.onrender.com/api/health`. אמור להופיע `{"status":"ok","database":"up",...}`. (הפנייה הראשונה אחרי הרדמה לוקחת עד דקה.)
2. **Swagger:** פתחי `https://YOUR-APP.onrender.com/api-docs`. תראי את רשימת כל ה־Endpoints.
3. **התחברות מתוך Swagger:**
   - לחצי על `POST /api/auth/login` ואז **Try it out**.
   - בתיבה שני את ה־JSON ל־`{"email": "האימייל של המזכירה", "password": "הסיסמה שהגדרת"}` ולחצי **Execute**.
4. **קבלת המפתח:** בתשובה (Response body) העתיקי את הערך של `sessionKey` (בלי המרכאות).
5. **Authorize:** לחצי על הכפתור **Authorize** בראש הדף, הדביקי את המפתח (בלי המילה Bearer) ולחצי **Authorize** ואז **Close**.
6. **קריאה ל־Endpoint מוגן:** פתחי `GET /api/auth/me`, לחצי **Try it out** ו־**Execute**. תקבלי את פרטי המזכירה. בלי Authorize תקבלי 401.
7. **הוספת רשומות (כמזכירה):** לפי הסדר:
   - `POST /api/users`, צרי מורה: `{"fullName":"רחל כהן","email":"rachel@example.com","password":"Password123!","role":"TEACHER"}`
   - `GET /api/classes` והעתיקי `id` של כיתה, ו־`GET /api/subjects` והעתיקי `id` של מקצוע.
   - `POST /api/users`, צרי תלמידה עם `"role":"STUDENT"` ו־`"classId":"<ה־id של הכיתה>"`.
   - `POST /api/lessons`, צרי שיעור עם ה־id של המקצוע, המורה והכיתה.
8. **שליפת הרשומה ממסד הנתונים:** `GET /api/lessons` מחזיר את השיעור שיצרת.
9. **בדיקת הרשאות:** לחצי **Authorize** ואז **Logout**, התחברי כתלמידה (התחברות דרך `POST /api/auth/login`), שימי את המפתח שלה ב־Authorize ונסי `POST /api/lessons`. אמור להתקבל **403**. ואז `GET /api/lessons/week` יציג את השיעור שהוספת לכיתה שלה.

---

## חלק ה: פתרון תקלות

| תקלה | סיבה אפשרית | פתרון |
|---|---|---|
| **Build Failed** | פקודת Build שגויה, או קבצים חסרים ב־GitHub | בדקי ש־Build Command הוא בדיוק `npm ci --include=dev && npm run build`, ושקיימים `package.json` ו־`package-lock.json` ב־GitHub. קראי את שורת השגיאה האחרונה ב־Logs |
| `DATABASE_URL שגוי` או `Can't reach database server` | כתובת שגויה, סיסמה שגויה, או רווח בהעתקה | העתיקי שוב את הכתובת בשלמותה. ב־Neon השתמשי בכתובת ה־Direct (בלי pooling). הכתובת צריכה להסתיים ב־`?sslmode=require` |
| `P1001` או `P1000` של Prisma | המסד לא נגיש או אימות נכשל | כנ״ל. ודאי שהפרויקט ב־Neon פעיל (הוא נרדם ומתעורר אוטומטית, נסי שוב אחרי דקה) |
| `Migration failed` או `P3009` | Migration נכשלה באמצע ונשארה מסומנת ככושלת | הדרך הפשוטה: ב־Neon מחקי את ה־Database (או צרי חדש), עדכני `DATABASE_URL` ב־Render ובצעי Deploy מחדש. זה בסדר כשאין עדיין נתונים אמיתיים |
| `Prisma Client` לא נמצא או `@prisma/client did not initialize` | `prisma generate` לא רץ | ודאי שה־Build Command הוא בדיוק כמו שכתוב. הוא מריץ `prisma generate` דרך `npm run build` |
| שגיאה על `JWT_SECRET` חסר או קצר | המשתנה לא הוגדר, או קצר מ־32 תווים | הוסיפי `JWT_SECRET` ב־Environment עם 32 תווים לפחות ובצעי Deploy |
| בקשה מה־React נחסמת: **CORS error** | הכתובת של ה־React לא ברשימה | ב־Render הוסיפי לכתובת ב־`CORS_ORIGINS` את הכתובת המדויקת (עם `https://`, בלי `/` בסוף). אחרי שינוי משתנה Render מפעיל מחדש |
| **401** | אין מפתח, הוא שגוי או פג תוקף (8 שעות), או שהמשתמשת הושבתה | התחברי שוב (`/api/auth/login`) ושלחי `Authorization: Bearer <sessionKey>` |
| **403** | התפקיד לא מתאים, או שזו רשומה של מישהי אחרת | זה תקין לפי ההרשאות. בדקי באיזה תפקיד התחברת (`/api/auth/me`) |
| **Swagger לא נפתח** | השרת עדיין נרדם, או הכתובת שגויה | המתיני דקה ורענני. הכתובת חייבת להסתיים ב־`/api-docs` |
| **השרת לא עולה** (`Exited with status 1`) | משתנה סביבה חסר, או המסד לא נגיש | קראי את הלוג, השורה שמעל `Exited`. בדרך כלל זה `DATABASE_URL` או `JWT_SECRET` |
| התחברות נכשלת אחרי Deploy ראשון | חשבון המזכירה לא נוצר | ודאי ש־`SEED_ADMIN_EMAIL` ו־`SEED_ADMIN_PASSWORD` הוגדרו ושהסיסמה לפחות 8 תווים. בלוג צריכה להופיע השורה `Seed: נוצרה מזכירה` (או `כבר קיימת`) |
| הפנייה הראשונה איטית מאוד | השרת החינמי נרדם | זה תקין ב־Render חינמי. ההרדמה אחרי 15 דקות ללא פניות. הפנייה הראשונה מעירה אותו (עד דקה) |
| הקובץ שהועלה נדחה | סוג או גודל לא מותרים | עד 5 קבצים, עד 5MB כל אחד. סוגים מותרים ב־`FRONTEND-API-GUIDE.md` |

---

## עדכון השרת בהמשך

כל קובץ שתעלי ל־GitHub (בענף `main`) יגרום ל־Render לבנות ולפרוס מחדש אוטומטית (פריסה אוטומטית, ברירת המחדל ב-Render). ה־Migrations החדשות יוחלו לבד בהפעלה.
