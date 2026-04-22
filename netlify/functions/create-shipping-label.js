const API_BASE = "https://api.goshippo.com";

const PACKAGE_PRESETS = {
  padded_mailer: {
    label: "Padded Mailer",
    length: 9,
    width: 6,
    height: 2,
  },
  small_box: {
    label: "Small Box",
    length: 8,
    width: 6,
    height: 4,
  },
  impression_box: {
    label: "Impression / Model Box",
    length: 10,
    width: 8,
    height: 6,
  },
};

const RESEND_API_BASE = "https://api.resend.com";

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  };
}

function normalize(value) {
  return String(value || "").trim();
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
    .split(",")
    .map(function (item) {
      return item.trim();
    })
    .filter(Boolean);
}

function formatShippoError(payload) {
  if (!payload || typeof payload !== "object") {
    return "The shipping service reported an unknown error.";
  }

  if (payload.detail) {
    return payload.detail;
  }

  if (Array.isArray(payload.messages) && payload.messages.length > 0) {
    return payload.messages
      .map(function (message) {
        return message && (message.text || message.source || message.code);
      })
      .filter(Boolean)
      .join(" ") || "The shipping service reported an error.";
  }

  if (payload.__all__) {
    return String(payload.__all__);
  }

  return "The shipping service reported an error.";
}

async function shippoRequest(path, options) {
  const response = await fetch(API_BASE + path, {
    method: options.method || "GET",
    headers: {
      Authorization: "ShippoToken " + process.env.SHIPPO_API_TOKEN,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(function () {
    return {};
  });

  if (!response.ok) {
    throw new Error(formatShippoError(payload));
  }

  return payload;
}

async function sendNotificationEmail(details) {
  if (!normalize(process.env.RESEND_API_KEY) || !normalize(process.env.BWDL_LABEL_NOTIFICATION_EMAIL)) {
    return { skipped: true };
  }

  const fromAddress = normalize(process.env.BWDL_LABEL_NOTIFICATION_FROM) || "Better Way Dental Lab <onboarding@resend.dev>";
  const replyTo = normalize(process.env.BWDL_LABEL_TO_EMAIL) || normalize(process.env.BWDL_LABEL_NOTIFICATION_EMAIL);
  const subject = "New shipping label request: " + (details.practiceName || "Unknown practice");
  const html = [
    "<h2>New Better Way shipping label request</h2>",
    "<p>A customer successfully generated a prepaid inbound label.</p>",
    "<ul>",
    "<li><strong>Practice:</strong> " + details.practiceName + "</li>",
    "<li><strong>Contact:</strong> " + details.contactName + "</li>",
    "<li><strong>Email:</strong> " + details.email + "</li>",
    "<li><strong>Phone:</strong> " + details.phone + "</li>",
    "<li><strong>Ship-from address:</strong> " + details.addressHtml + "</li>",
    "<li><strong>Contents:</strong> " + details.contents + "</li>",
    "<li><strong>Package type:</strong> " + details.packageLabel + "</li>",
    "<li><strong>Weight:</strong> " + details.weightOz + " oz</li>",
    "<li><strong>Carrier/service:</strong> " + details.carrierService + "</li>",
    "<li><strong>Tracking number:</strong> " + details.trackingCode + "</li>",
    "<li><strong>Label URL:</strong> <a href=\"" + details.labelUrl + "\">Download label</a></li>",
    "</ul>",
    details.notes ? "<p><strong>Notes:</strong> " + details.notes + "</p>" : "",
  ].join("");

  const response = await fetch(RESEND_API_BASE + "/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [normalize(process.env.BWDL_LABEL_NOTIFICATION_EMAIL)],
      subject: subject,
      html: html,
      reply_to: replyTo,
    }),
  });

  const payload = await response.json().catch(function () {
    return {};
  });

  if (!response.ok) {
    throw new Error(payload && payload.message ? payload.message : "Notification email failed to send.");
  }

  return payload;
}

function selectRate(rates) {
  const preferredProvider = normalize(process.env.BWDL_SHIPPO_PROVIDER).toLowerCase();
  const preferredServiceToken = normalize(process.env.BWDL_SHIPPO_SERVICELEVEL_TOKEN).toLowerCase();

  const filteredRates = (rates || []).filter(function (rate) {
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

  return candidates.reduce(function (lowest, rate) {
    if (!lowest) {
      return rate;
    }

    const lowestAmount = Number(lowest.amount || Number.POSITIVE_INFINITY);
    const currentAmount = Number(rate.amount || Number.POSITIVE_INFINITY);
    return currentAmount < lowestAmount ? rate : lowest;
  }, null);
}

function destinationAddressFromEnv() {
  const requiredKeys = [
    "SHIPPO_API_TOKEN",
    "BWDL_LABEL_TO_NAME",
    "BWDL_LABEL_TO_STREET1",
    "BWDL_LABEL_TO_CITY",
    "BWDL_LABEL_TO_STATE",
    "BWDL_LABEL_TO_ZIP",
  ];

  const missing = requiredKeys.filter(function (key) {
    return !normalize(process.env[key]);
  });

  if (missing.length) {
    return { missing };
  }

  return {
    name: normalize(process.env.BWDL_LABEL_TO_NAME),
    company: normalize(process.env.BWDL_LABEL_TO_COMPANY) || "Better Way Dental Lab",
    street1: normalize(process.env.BWDL_LABEL_TO_STREET1),
    street2: normalize(process.env.BWDL_LABEL_TO_STREET2),
    city: normalize(process.env.BWDL_LABEL_TO_CITY),
    state: normalize(process.env.BWDL_LABEL_TO_STATE),
    zip: normalize(process.env.BWDL_LABEL_TO_ZIP),
    country: "US",
    phone: normalize(process.env.BWDL_LABEL_TO_PHONE),
    email: normalize(process.env.BWDL_LABEL_TO_EMAIL),
    is_residential: false,
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  const body = parseBody(event);
  if (!body) {
    return json(400, { error: "Invalid request body." });
  }

  if (normalize(body.companyWebsite)) {
    return json(400, { error: "We couldn't generate a label right now. Please contact the lab directly." });
  }

  const destination = destinationAddressFromEnv();
  if (destination.missing) {
    return json(500, {
      error: "Shipping labels are not fully configured yet. Add the Shippo token and lab address environment variables in Netlify before going live.",
      missing: destination.missing,
    });
  }

  const requiredFields = {
    practiceName: "Practice name",
    contactName: "Contact name",
    email: "Email",
    phone: "Phone",
    street1: "Street address",
    city: "City",
    state: "State",
    zip: "ZIP code",
    packageType: "Package type",
    weightOz: "Estimated weight",
    contents: "Contents",
    consent: "Consent",
  };

  const missingFields = Object.keys(requiredFields).filter(function (field) {
    return !normalize(body[field]);
  });

  if (missingFields.length) {
    return json(400, {
      error: requiredFields[missingFields[0]] + " is required.",
    });
  }

  const packagePreset = PACKAGE_PRESETS[normalize(body.packageType)];
  if (!packagePreset) {
    return json(400, { error: "Please choose a valid package type." });
  }

  const weightOz = Number(body.weightOz);
  if (!Number.isFinite(weightOz) || weightOz <= 0 || weightOz > 160) {
    return json(400, { error: "Estimated weight must be between 1 and 160 ounces." });
  }

  try {
    const addressHtml = [
      normalize(body.street1),
      normalize(body.street2),
      [normalize(body.city), normalize(body.state).toUpperCase(), normalize(body.zip)].filter(Boolean).join(", ").replace(", ", " "),
    ]
      .filter(Boolean)
      .join("<br>");

    const shipmentBody = {
      address_from: {
        name: normalize(body.contactName),
        company: normalize(body.practiceName),
        street1: normalize(body.street1),
        street2: normalize(body.street2),
        city: normalize(body.city),
        state: normalize(body.state).toUpperCase(),
        zip: normalize(body.zip),
        country: "US",
        phone: normalize(body.phone),
        email: normalize(body.email),
        is_residential: false,
      },
      address_to: destination,
      parcels: [
        {
          length: String(packagePreset.length),
          width: String(packagePreset.width),
          height: String(packagePreset.height),
          distance_unit: "in",
          weight: String(weightOz),
          mass_unit: "oz",
        },
      ],
      async: false,
      metadata: [normalize(body.practiceName), normalize(body.contents), normalize(body.notes)].filter(Boolean).join(" | ").slice(0, 500),
      label_file_type: "PDF",
    };

    const carrierAccounts = parseCsvEnv(process.env.BWDL_SHIPPO_CARRIER_ACCOUNTS);
    if (carrierAccounts.length) {
      shipmentBody.carrier_accounts = carrierAccounts;
    }

    const shipment = await shippoRequest("/shipments/", {
      method: "POST",
      body: shipmentBody,
    });

    const selectedRate = selectRate(shipment.rates || []);
    if (!selectedRate || !selectedRate.object_id) {
      return json(400, {
        error: "No label rate was returned for this shipment. Please double-check the address and package details.",
      });
    }

    const transaction = await shippoRequest("/transactions/", {
      method: "POST",
      body: {
        rate: selectedRate.object_id,
        async: false,
        label_file_type: "PDF",
        metadata: [normalize(body.practiceName), normalize(body.contents)].filter(Boolean).join(" - ").slice(0, 100),
      },
    });

    if (!transaction.label_url) {
      throw new Error(formatShippoError(transaction));
    }

    const carrierService = [selectedRate.provider, selectedRate.servicelevel && selectedRate.servicelevel.name].filter(Boolean).join(" ");

    try {
      await sendNotificationEmail({
        practiceName: normalize(body.practiceName),
        contactName: normalize(body.contactName),
        email: normalize(body.email),
        phone: normalize(body.phone),
        addressHtml: addressHtml,
        contents: normalize(body.contents),
        packageLabel: packagePreset.label,
        weightOz: String(weightOz),
        carrierService: carrierService || "Rate selected automatically",
        trackingCode: transaction.tracking_number || "Not yet assigned",
        labelUrl: transaction.label_url,
        notes: normalize(body.notes),
      });
    } catch (notificationError) {
      console.error("Label notification failed:", notificationError);
    }

    return json(200, {
      success: true,
      labelUrl: transaction.label_url,
      trackingCode: transaction.tracking_number || "",
      carrier: selectedRate.provider || "",
      service: (selectedRate.servicelevel && selectedRate.servicelevel.name) || "",
      rate: selectedRate.amount || "",
      packageLabel: packagePreset.label,
    });
  } catch (error) {
    return json(500, {
      error: error && error.message ? error.message : "We couldn't generate a label right now. Please contact the lab directly.",
    });
  }
};
