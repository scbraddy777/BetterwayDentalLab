const API_BASE = "https://api.easypost.com/v2";

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

function formatEasyPostError(payload) {
  if (!payload || typeof payload !== "object") {
    return "The shipping service returned an unknown error.";
  }
  if (payload.error && payload.error.message) {
    return payload.error.message;
  }
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    return payload.errors[0].message || payload.errors[0].field || "The shipping service reported an error.";
  }
  if (Array.isArray(payload.messages) && payload.messages.length > 0) {
    return payload.messages[0].text || "The shipping service reported an error.";
  }
  return "The shipping service reported an error.";
}

async function easypostRequest(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    method: options.method || "GET",
    headers: {
      Authorization: "Basic " + Buffer.from(process.env.EASYPOST_API_KEY + ":").toString("base64"),
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(function () {
    return {};
  });

  if (!response.ok) {
    throw new Error(formatEasyPostError(payload));
  }

  return payload;
}

function selectRate(rates) {
  const preferredCarrier = normalize(process.env.BWDL_LABEL_CARRIER).toLowerCase();
  const preferredService = normalize(process.env.BWDL_LABEL_SERVICE).toLowerCase();

  const filteredRates = (rates || []).filter(function (rate) {
    const carrier = normalize(rate.carrier).toLowerCase();
    const service = normalize(rate.service).toLowerCase();
    const carrierMatches = !preferredCarrier || carrier === preferredCarrier;
    const serviceMatches = !preferredService || service === preferredService;
    return carrierMatches && serviceMatches;
  });

  const candidates = filteredRates.length ? filteredRates : rates || [];

  if (!candidates.length) {
    return null;
  }

  return candidates.reduce(function (lowest, rate) {
    if (!lowest) {
      return rate;
    }
    return Number(rate.rate) < Number(lowest.rate) ? rate : lowest;
  }, null);
}

function destinationAddressFromEnv() {
  const requiredKeys = [
    "BWDL_LABEL_TO_NAME",
    "BWDL_LABEL_TO_STREET1",
    "BWDL_LABEL_TO_CITY",
    "BWDL_LABEL_TO_STATE",
    "BWDL_LABEL_TO_ZIP",
  ];

  const missing = requiredKeys.filter(function (key) {
    return !normalize(process.env[key]);
  });

  if (!normalize(process.env.EASYPOST_API_KEY)) {
    missing.unshift("EASYPOST_API_KEY");
  }

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
      error: "Shipping labels are not fully configured yet. Add the EasyPost and lab address environment variables in Netlify before going live.",
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
    const shipment = await easypostRequest("/shipments", {
      method: "POST",
      body: {
        shipment: {
          to_address: destination,
          from_address: {
            name: normalize(body.contactName),
            company: normalize(body.practiceName),
            street1: normalize(body.street1),
            street2: normalize(body.street2),
            city: normalize(body.city),
            state: normalize(body.state),
            zip: normalize(body.zip),
            country: "US",
            phone: normalize(body.phone),
            email: normalize(body.email),
          },
          parcel: {
            length: packagePreset.length,
            width: packagePreset.width,
            height: packagePreset.height,
            weight: weightOz,
          },
          options: {
            label_format: "PDF",
          },
          reference: [normalize(body.practiceName), normalize(body.contents)].filter(Boolean).join(" - "),
        },
      },
    });

    const selectedRate = selectRate(shipment.rates || []);
    if (!selectedRate) {
      return json(400, {
        error: "No label rate was returned for this shipment. Please double-check the address and package details.",
      });
    }

    const purchasedShipment = await easypostRequest("/shipments/" + shipment.id + "/buy", {
      method: "POST",
      body: {
        rate: {
          id: selectedRate.id,
        },
      },
    });

    const postageLabel = purchasedShipment.postage_label || {};
    const labelUrl = postageLabel.label_pdf_url || postageLabel.label_url || postageLabel.label_zpl_url || "";

    if (!labelUrl) {
      return json(500, {
        error: "The label was purchased, but no printable file was returned. Please contact the lab.",
      });
    }

    return json(200, {
      success: true,
      labelUrl,
      trackingCode: purchasedShipment.tracking_code || "",
      carrier: selectedRate.carrier || "",
      service: selectedRate.service || "",
      rate: selectedRate.rate || "",
      packageLabel: packagePreset.label,
    });
  } catch (error) {
    return json(500, {
      error: error && error.message ? error.message : "We couldn't generate a label right now. Please contact the lab directly.",
    });
  }
};
