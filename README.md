# Better Way Dental Lab Website

Static multi-page website deployed on Netlify with account-gated case submission and authenticated CAD/CAM file uploads.

## Pages
- `/index.html`
- `/services.html`
- `/workflow.html`
- `/case-submission.html`
- `/account.html`
- `/login` (redirects to account login action)
- `/register` (redirects to account signup action)
- `/logout` (redirects to account logout action)
- `/about.html`
- `/contact.html`
- `/thank-you.html`
- `/404.html`

## Stack
- Static HTML/CSS/JS
- Netlify Identity (email/password auth)
- Netlify Functions (authenticated upload URL + authenticated case submission)
- Direct-to-object-storage file uploads via signed URLs
- Optional GA4 tracking via `window.BWDL_GA4_ID`

## Netlify Identity Setup (Required)
1. In Netlify, open: **Project configuration > Identity**.
2. Click **Enable Identity**.
3. Set **Registration preferences** to **Open**.
4. Configure email confirmation behavior in Identity settings as needed.

### Notes on user storage
- User records are managed by Netlify Identity (GoTrue).
- Password hashes are managed by Netlify Identity (no plaintext password storage in this repo).
- No local database migrations are required for user accounts in this stack.

## Netlify Configuration
- Netlify config file: `/netlify.toml`
- Functions directory: `/netlify/functions`
- Authenticated endpoints:
  - `POST /.netlify/functions/create-upload-url`
  - `POST /.netlify/functions/submit-case`
- Auth entry routes:
  - `/login`
  - `/register`
  - `/logout`

### Optional API aliases
- `/api/create-upload-url` -> `/.netlify/functions/create-upload-url`
- `/api/submit-case` -> `/.netlify/functions/submit-case`

## Submission + File Upload Flow
1. Logged-in user opens `/case-submission.html`.
2. Frontend requests signed URLs from `create-upload-url` for each selected file.
3. Frontend uploads file bytes directly to storage using each signed URL (`PUT`).
4. Frontend submits case form + `uploadedFiles[]` metadata to `submit-case`.
5. Function validates auth and payload, then stores/forwards case with:
   - `auth_user_id`
   - `auth_user_email`
   - file metadata/storage keys

## Environment Variables (Netlify UI)
Required for direct uploads:
- `STORAGE_PROVIDER` = `s3` (default)
- `S3_BUCKET`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Optional (for S3-compatible endpoints like Cloudflare R2):
- `S3_ENDPOINT`
- `S3_FORCE_PATH_STYLE` (`true`/`false`)

Optional submission destination:
- `CASE_WEBHOOK_URL` (if omitted, fallback is Netlify Forms schema `case-submission-auth`)

Optional limits:
- `MAX_FILE_SIZE_BYTES` (default 2GB)
- `MAX_FILE_COUNT` (default 10)

## Local Development
1. Install dependencies:
   - `npm install`
2. Run with Netlify:
   - `netlify dev`
3. Test using Netlify Identity + local functions.
4. Create a test user from `/register`, then submit via `/case-submission.html`.

## Security Notes
- No plaintext password storage in site code.
- Auth relies on Netlify Identity JWTs.
- Upload/file APIs enforce auth server-side.
- File bytes are uploaded directly to storage (not through Netlify Functions).
- No case payload/PHI logging is implemented in functions.

## Acceptance Checklist
- [ ] Logged-out user is redirected away from `/case-submission.html`.
- [ ] Logged-out user is redirected to `/login` and can create an account from account actions.
- [ ] Logged-out `create-upload-url` requests return `401`.
- [ ] Logged-out `submit-case` requests return `401`.
- [ ] Logged-in users can upload allowed file types (`.stl,.ply,.obj,.zip,.dcm`).
- [ ] Disallowed file types and oversized files are rejected server-side.
- [ ] Upload progress and status (queued/uploading/done/failed) show in UI.
- [ ] Case submission includes uploaded file metadata and authenticated user identity.
