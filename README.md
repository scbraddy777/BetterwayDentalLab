# Better Way Dental Lab Website

Static multi-page marketing site for Better Way Dental Lab, deployed on Netlify.

## Pages
- `/index.html`
- `/services.html`
- `/workflow.html`
- `/about.html`
- `/contact.html`
- `/terms-of-service.html`
- `/thank-you.html`
- `/404.html`
- Hidden utility routes:
  - `/case-feedback`
  - `/request-shipping-label`
  - `/connect`

## Workflow
- `Dentist Portal` links to the external Seazona portal:
  - `https://betterwayclient.seazona.app/`
- `Download Lab RX` downloads:
  - `/assets/pdfs/BWDL RX.pdf`
- The general inquiry form posts through Netlify Forms and redirects to `/thank-you.html`.
- The QR-code connect page is a hidden route at `/connect` and downloads the vCard from `/better-way-dental-lab.vcf` for mobile contact saving.

## Netlify Notes
- Netlify config file: `/netlify.toml`
- Shipping label requests use Netlify Functions at `/.netlify/functions/create-shipping-label` and `/.netlify/functions/approve-shipping-label`
- Old `/case-submission`, `/submit-case`, `/account`, `/login`, `/register`, and `/logout` paths redirect to the Dentist Portal.
- To email general inquiry submissions to `BetterWayDentalLab@gmail.com`, configure a Netlify Forms email notification for the `contact-inquiry` form in the Netlify dashboard.

### Shipping Label Environment Variables
Set these in Netlify before using `/request-shipping-label` approval flow:

- `SHIPPO_API_TOKEN`
- `BWDL_LABEL_TO_NAME`
- `BWDL_LABEL_TO_COMPANY`
- `BWDL_LABEL_TO_STREET1`
- `BWDL_LABEL_TO_STREET2` (optional)
- `BWDL_LABEL_TO_CITY`
- `BWDL_LABEL_TO_STATE`
- `BWDL_LABEL_TO_ZIP`
- `BWDL_LABEL_TO_PHONE` (optional)
- `BWDL_LABEL_TO_EMAIL` (optional)

- `BWDL_LABEL_APPROVAL_SECRET` (required, long random secret for signing approval links)
- `BWDL_SHIPPO_PROVIDER` (optional, example: `USPS`)
- `BWDL_SHIPPO_SERVICELEVEL_TOKEN` (optional, example: `usps_ground_advantage`)
- `BWDL_SHIPPO_CARRIER_ACCOUNTS` (optional, comma-separated Shippo carrier account object IDs)

### Shipping Label Notification Variables
Set these in Netlify if you want approval and label emails:

- `RESEND_API_KEY`
- `BWDL_LABEL_NOTIFICATION_EMAIL`
- `BWDL_LABEL_NOTIFICATION_FROM` (optional, defaults to `Better Way Dental Lab <onboarding@resend.dev>`)

## Connect QR Page Notes
- QR code destination: `https://www.betterwaydentallab.com/connect`
- The page is intentionally hidden from nav, footer, and sitemap, and marked `noindex, nofollow`.
- Update contact details in both `/connect.html` and `/public/better-way-dental-lab.vcf` together so the QR page and imported contact card stay in sync.
- Replace the connect-page logo by swapping the image in `/assets/images/Reduced Logo transparent.png` or updating the `<img>` in `/connect.html`.
- Add future action buttons inside the `.connect-primary-actions` block in `/connect.html`.
- The right side of `/connect.html` uses the general inquiry form pattern and submits through Web3Forms for callback requests.
- The vCard file is stored at `/public/better-way-dental-lab.vcf` and is also exposed at `/better-way-dental-lab.vcf` for a cleaner download URL.

## Local Preview
1. Open the project folder.
2. Run a simple local server, for example:
   - `python3 -m http.server 8000`
3. Visit:
   - `http://localhost:8000`

## Tracking
- Optional GA4 tracking uses `window.BWDL_GA4_ID`.
