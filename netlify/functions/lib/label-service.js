const crypto = require('crypto');

const SHIPPO_API_BASE = 'https://api.goshippo.com';
const RESEND_API_BASE = 'https://api.resend.com';
const APPROVAL_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const PACKAGE_PRESETS = {
  padded_mailer: { label: 'Padded Mailer', length: 9, width: 6, height: 2 },
  small_box: { label: 'Small Box', length: 8, width: 6, height: 4 },
  impression_box: { label: 'Impression / Model Box', length: 10, width: 8, height: 6 },
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  };
}

function normalize(value) {
  return String(value || '').trim();
}

function parseBody(event) {
  if (!event.body) {
    return {};
  }
  try {
    return JSON.parse(event.body);
  } catch (_error) {
    return null;
  }
}

function parseCsvEnv(value) {
  return normalize(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function base64urlEncode(input) {
  return Buffer.from(input).toString('base64url');
}

function base64urlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function createApprovalToken(payload) {
  const secret = normalize(process.env.BWDL_LABEL_APPROVAL_SECRET);
  if (!secret) {
    throw new Error('BWDL_LABEL_APPROVAL_SECRET is not configured.');
  }

  const body = {
    issuedAt: Date.now(),
    payload,
  };
  const encoded = base64urlEncode(JSON.stringify(body));
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return encoded + '.' + signature;
}

function readApprovalToken(token) {
  const secret = normalize(process.env.BWDL_LABEL_APPROVAL_SECRET);
  if (!secret) {
    throw new Error('BWDL_LABEL_APPROVAL_SECRET is not configured.');
  }

  const parts = normalize(token).split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid approval token.');
  }

  const [encoded, providedSignature] = parts;
  const expectedSignature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const expected = Buffer.from(expectedSignature);
  const provided = Buffer.from(providedSignature);

  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    throw new Error('Approval token signature is invalid.');
  }

  const parsed = JSON.parse(base64urlDecode(encoded));
  if (!parsed || typeof parsed !== 'object' || !parsed.issuedAt || !parsed.payload) {
    throw new Error('Approval token is malformed.');
  }

  if (Date.now() - Number(parsed.issuedAt) > APPROVAL_TTL_MS) {
    throw new Error('This approval link has expired. Please request a new label.');
  }

  return parsed.payload;
}

function formatShippoError(payload) {
  if (!payload || typeof payload !== 'object') {
    return 'The shipping service reported an unknown error.';
  }
  if (payload.detail) {
    return payload.detail;
  }
  if (Array.isArray(payload.messages) && payload.messages.length > 0) {
    return payload.messages
      .map((message) => message && (message.text || message.source || message.code))
      .filter(Boolean)
      .join(' ') || 'The shipping service reported an error.';
  }
  if (payload.__all__) {
    return String(payload.__all__);
  }
  return 'The shipping service reported an error.';
}

async function shippoRequest(path, options) {
  const response = await fetch(SHIPPO_API_BASE + path, {
    method: options.method || 'GET',
    headers: {
      Authorization: 'ShippoToken ' + process.env.SHIPPO_API_TOKEN,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(formatShippoError(payload));
  }
  return payload;
}

async function sendResendEmail(message) {
  if (!normalize(process.env.RESEND_API_KEY)) {
    throw new Error('RESEND_API_KEY is not configured.');
  }

  const response = await fetch(RESEND_API_BASE + '/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload && payload.message ? payload.message : 'Email notification failed to send.');
  }
  return payload;
}

function destinationAddressFromEnv() {
  const requiredKeys = [
    'SHIPPO_API_TOKEN',
    'BWDL_LABEL_TO_NAME',
    'BWDL_LABEL_TO_STREET1',
    'BWDL_LABEL_TO_CITY',
    'BWDL_LABEL_TO_STATE',
    'BWDL_LABEL_TO_ZIP',
  ];

  const missing = requiredKeys.filter((key) => !normalize(process.env[key]));
  if (missing.length) {
    return { missing };
  }

  return {
    name: normalize(process.env.BWDL_LABEL_TO_NAME),
    company: normalize(process.env.BWDL_LABEL_TO_COMPANY) || 'Better Way Dental Lab',
    street1: normalize(process.env.BWDL_LABEL_TO_STREET1),
    street2: normalize(process.env.BWDL_LABEL_TO_STREET2),
    city: normalize(process.env.BWDL_LABEL_TO_CITY),
    state: normalize(process.env.BWDL_LABEL_TO_STATE),
    zip: normalize(process.env.BWDL_LABEL_TO_ZIP),
    country: 'US',
    phone: normalize(process.env.BWDL_LABEL_TO_PHONE),
    email: normalize(process.env.BWDL_LABEL_TO_EMAIL),
    is_residential: false,
  };
}

function validateRequest(body) {
  const requiredFields = {
    practiceName: 'Practice name',
    contactName: 'Contact name',
    email: 'Email',
    phone: 'Phone',
    street1: 'Street address',
    city: 'City',
    state: 'State',
    zip: 'ZIP code',
    packageType: 'Package type',
    weightOz: 'Estimated weight',
    contents: 'Contents',
    consent: 'Consent',
  };

  const missingFields = Object.keys(requiredFields).filter((field) => !normalize(body[field]));
  if (missingFields.length) {
    return { error: requiredFields[missingFields[0]] + ' is required.' };
  }

  const packagePreset = PACKAGE_PRESETS[normalize(body.packageType)];
  if (!packagePreset) {
    return { error: 'Please choose a valid package type.' };
  }

  const weightOz = Number(body.weightOz);
  if (!Number.isFinite(weightOz) || weightOz <= 0 || weightOz > 160) {
    return { error: 'Estimated weight must be between 1 and 160 ounces.' };
  }

  return {
    packagePreset,
    weightOz,
    normalized: {
      practiceName: normalize(body.practiceName),
      contactName: normalize(body.contactName),
      email: normalize(body.email),
      phone: normalize(body.phone),
      street1: normalize(body.street1),
      street2: normalize(body.street2),
      city: normalize(body.city),
      state: normalize(body.state).toUpperCase(),
      zip: normalize(body.zip),
      packageType: normalize(body.packageType),
      contents: normalize(body.contents),
      notes: normalize(body.notes),
      consent: normalize(body.consent),
      weightOz: String(weightOz),
      companyWebsite: normalize(body.companyWebsite),
    },
  };
}

function selectRate(rates) {
  const preferredProvider = normalize(process.env.BWDL_SHIPPO_PROVIDER).toLowerCase();
  const preferredServiceToken = normalize(process.env.BWDL_SHIPPO_SERVICELEVEL_TOKEN).toLowerCase();

  const filteredRates = (rates || []).filter((rate) => {
    const provider = normalize(rate.provider).toLowerCase();
    const serviceToken = normalize(rate.servicelevel && rate.servicelevel.token).toLowerCase();
    const providerMatches = !preferredProvider || provider === preferredProvider;
    const serviceMatches = !preferredServiceToken || serviceToken === preferredServiceToken;
    return providerMatches && serviceMatches;
  });

  const candidates = filteredRates.length ? filteredRates : rates || [];
  if (!candidates.length) {
    return null;
  }

  return candidates.reduce((lowest, rate) => {
    if (!lowest) {
      return rate;
    }
    const lowestAmount = Number(lowest.amount || Number.POSITIVE_INFINITY);
    const currentAmount = Number(rate.amount || Number.POSITIVE_INFINITY);
    return currentAmount < lowestAmount ? rate : lowest;
  }, null);
}

function formatAddressHtml(payload) {
  return [
    normalize(payload.street1),
    normalize(payload.street2),
    [normalize(payload.city), normalize(payload.state), normalize(payload.zip)].filter(Boolean).join(' '),
  ].filter(Boolean).join('<br>');
}

function approvalUrlForToken(token) {
  const baseUrl = normalize(process.env.URL) || normalize(process.env.DEPLOY_PRIME_URL) || 'https://www.betterwaydentallab.com';
  return baseUrl.replace(/\/$/, '') + '/.netlify/functions/approve-shipping-label?token=' + encodeURIComponent(token);
}

async function generateShippoLabel(payload) {
  const destination = destinationAddressFromEnv();
  if (destination.missing) {
    throw new Error('Shipping labels are not fully configured yet. Add the Shippo token and lab address environment variables in Netlify before going live.');
  }

  const packagePreset = PACKAGE_PRESETS[payload.packageType];
  const shipmentBody = {
    address_from: {
      name: payload.contactName,
      company: payload.practiceName,
      street1: payload.street1,
      street2: payload.street2,
      city: payload.city,
      state: payload.state,
      zip: payload.zip,
      country: 'US',
      phone: payload.phone,
      email: payload.email,
      is_residential: false,
    },
    address_to: destination,
    parcels: [{
      length: String(packagePreset.length),
      width: String(packagePreset.width),
      height: String(packagePreset.height),
      distance_unit: 'in',
      weight: payload.weightOz,
      mass_unit: 'oz',
    }],
    async: false,
    metadata: [payload.practiceName, payload.contents, payload.notes].filter(Boolean).join(' | ').slice(0, 500),
    label_file_type: 'PDF',
  };

  const carrierAccounts = parseCsvEnv(process.env.BWDL_SHIPPO_CARRIER_ACCOUNTS);
  if (carrierAccounts.length) {
    shipmentBody.carrier_accounts = carrierAccounts;
  }

  const shipment = await shippoRequest('/shipments/', { method: 'POST', body: shipmentBody });
  const selectedRate = selectRate(shipment.rates || []);
  if (!selectedRate || !selectedRate.object_id) {
    throw new Error('No label rate was returned for this shipment. Please double-check the address and package details.');
  }

  const transaction = await shippoRequest('/transactions/', {
    method: 'POST',
    body: {
      rate: selectedRate.object_id,
      async: false,
      label_file_type: 'PDF',
      metadata: [payload.practiceName, payload.contents].filter(Boolean).join(' - ').slice(0, 100),
    },
  });

  if (!transaction.label_url) {
    throw new Error(formatShippoError(transaction));
  }

  return {
    labelUrl: transaction.label_url,
    trackingCode: transaction.tracking_number || '',
    carrier: selectedRate.provider || '',
    service: (selectedRate.servicelevel && selectedRate.servicelevel.name) || '',
    rate: selectedRate.amount || '',
    packageLabel: packagePreset.label,
  };
}

async function sendApprovalEmail(payload) {
  const notifyEmail = normalize(process.env.BWDL_LABEL_NOTIFICATION_EMAIL);
  if (!notifyEmail) {
    throw new Error('BWDL_LABEL_NOTIFICATION_EMAIL is not configured.');
  }

  const token = createApprovalToken(payload);
  const approveUrl = approvalUrlForToken(token);
  const fromAddress = normalize(process.env.BWDL_LABEL_NOTIFICATION_FROM) || 'Better Way Dental Lab <onboarding@resend.dev>';

  return sendResendEmail({
    from: fromAddress,
    to: [notifyEmail],
    subject: 'Approve shipping label request: ' + payload.practiceName,
    reply_to: payload.email,
    html: [
      '<h2>Shipping label request awaiting approval</h2>',
      '<p>A customer requested a prepaid inbound label. No label has been purchased yet.</p>',
      '<ul>',
      '<li><strong>Practice:</strong> ' + payload.practiceName + '</li>',
      '<li><strong>Contact:</strong> ' + payload.contactName + '</li>',
      '<li><strong>Email:</strong> ' + payload.email + '</li>',
      '<li><strong>Phone:</strong> ' + payload.phone + '</li>',
      '<li><strong>Return address:</strong> ' + formatAddressHtml(payload) + '</li>',
      '<li><strong>Contents:</strong> ' + payload.contents + '</li>',
      '<li><strong>Package type:</strong> ' + PACKAGE_PRESETS[payload.packageType].label + '</li>',
      '<li><strong>Weight:</strong> ' + payload.weightOz + ' oz</li>',
      '</ul>',
      payload.notes ? '<p><strong>Notes:</strong> ' + payload.notes + '</p>' : '',
      '<p><a href="' + approveUrl + '" style="display:inline-block;padding:12px 18px;background:#2f87f5;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">Approve and Generate Label</a></p>',
      '<p>If you do not approve this request, no label will be created.</p>',
    ].join(''),
  });
}

async function sendCustomerLabelEmail(payload, labelResult) {
  if (!normalize(process.env.RESEND_API_KEY)) {
    return { skipped: true };
  }

  const fromAddress = normalize(process.env.BWDL_LABEL_NOTIFICATION_FROM) || 'Better Way Dental Lab <onboarding@resend.dev>';
  const notifyEmail = normalize(process.env.BWDL_LABEL_NOTIFICATION_EMAIL);
  const carrierService = [labelResult.carrier, labelResult.service].filter(Boolean).join(' ') || 'Carrier selected automatically';

  return sendResendEmail({
    from: fromAddress,
    to: [payload.email],
    cc: notifyEmail ? [notifyEmail] : undefined,
    subject: 'Your Better Way Dental Lab shipping label is ready',
    reply_to: normalize(process.env.BWDL_LABEL_TO_EMAIL) || notifyEmail,
    html: [
      '<h2>Your prepaid Better Way label is ready</h2>',
      '<p>We approved your shipping label request. Use the link below to download your label.</p>',
      '<p><a href="' + labelResult.labelUrl + '" style="display:inline-block;padding:12px 18px;background:#2f87f5;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;">Download Shipping Label</a></p>',
      '<ul>',
      '<li><strong>Tracking number:</strong> ' + (labelResult.trackingCode || 'Will appear after carrier acceptance') + '</li>',
      '<li><strong>Service:</strong> ' + carrierService + '</li>',
      '<li><strong>Package type:</strong> ' + labelResult.packageLabel + '</li>',
      '</ul>',
      '<p>Please attach the label securely to your package before shipping.</p>',
    ].join(''),
  });
}

function approvalHtml(title, body) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + title + '</title><style>body{font-family:Arial,sans-serif;background:#0e2744;color:#f4f8fd;margin:0;padding:32px}main{max-width:720px;margin:0 auto;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:20px;padding:32px}h1{margin-top:0}a{color:#8fc8ff}</style></head><body><main><h1>' + title + '</h1>' + body + '</main></body></html>';
}

module.exports = {
  PACKAGE_PRESETS,
  json,
  normalize,
  parseBody,
  parseCsvEnv,
  validateRequest,
  destinationAddressFromEnv,
  createApprovalToken,
  readApprovalToken,
  sendApprovalEmail,
  generateShippoLabel,
  sendCustomerLabelEmail,
  approvalHtml,
};
