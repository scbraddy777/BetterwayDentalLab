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

## Workflow
- `Dentist Portal` links to the external Seazona portal:
  - `https://betterwayclient.seazona.app/`
- `Download Lab RX` downloads:
  - `/assets/pdfs/BWDL RX.pdf`
- The general inquiry form posts through Netlify Forms and redirects to `/thank-you.html`.

## Netlify Notes
- Netlify config file: `/netlify.toml`
- Old `/case-submission`, `/submit-case`, `/account`, `/login`, `/register`, and `/logout` paths redirect to the Dentist Portal.
- To email general inquiry submissions to `BetterWayDentalLab@gmail.com`, configure a Netlify Forms email notification for the `contact-inquiry` form in the Netlify dashboard.

## Local Preview
1. Open the project folder.
2. Run a simple local server, for example:
   - `python3 -m http.server 8000`
3. Visit:
   - `http://localhost:8000`

## Tracking
- Optional GA4 tracking uses `window.BWDL_GA4_ID`.
