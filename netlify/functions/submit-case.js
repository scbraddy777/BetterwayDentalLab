const { getUserFromContext, hasBearerAuthorization } = require("./_auth");

const OPTION_SETS = {
  restoration_type: new Set(["Crown", "Bridge"]),
  material_selection: new Set([
    "Full Contour Zirconia",
    "Layered Zirconia",
    "Full Lithium Disilicate",
    "Layered Lithium Disilicate",
  ]),
  occlusal_contact: new Set(["In Occlusion", "Light Occlusion", "Out 0.3 mm", "Out 0.5 mm"]),
  interproximal_pressure: new Set(["Normal", "Broad/Tight"]),
  implant_abutment: new Set(["Custom Titanium Abutment", "Custom Zirconia Abutment", "Anodized"]),
  implant_crown_type: new Set(["Screw Retained", "Cement Retained"]),
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function asString(value, maxLen = 2000) {
  return String(value || "").trim().slice(0, maxLen);
}

function sanitizeCaseId(value) {
  const clean = asString(value, 80).replace(/[^A-Za-z0-9_-]/g, "");
  return clean || `case-${Date.now()}`;
}

function ensureAllowedArray(values, set, label) {
  if (!Array.isArray(values)) {
    return `${label} must be an array.`;
  }

  for (const v of values) {
    if (!set.has(String(v))) {
      return `Invalid value in ${label}.`;
    }
  }

  return null;
}

function validateRxSlip(rxSlip) {
  if (!rxSlip || typeof rxSlip !== "object") {
    return "Missing rxSlip payload.";
  }

  const provider = rxSlip.provider_office_info || {};
  const patient = rxSlip.patient_case_info || {};
  const toothShade = rxSlip.tooth_shade || {};
  const implants = rxSlip.implants || {};
  const platform = implants.implant_platform || {};
  const signoff = rxSlip.signoff || {};

  // String bounds/sanitization validation.
  [
    provider.dr,
    provider.office_phone,
    provider.address,
    provider.due_date,
    patient.patient_last,
    patient.patient_first,
    patient.case_number,
    patient.office_use_only,
    toothShade.shade,
    toothShade.tooth_numbers,
    implants.indicate_implant_system,
    platform.size,
    platform.length,
    rxSlip.notes,
    signoff.dr_signature,
    signoff.assistant,
  ].forEach((value) => asString(value));

  const arrayChecks = [
    [rxSlip.restoration_type, OPTION_SETS.restoration_type, "restoration_type"],
    [rxSlip.material_selection, OPTION_SETS.material_selection, "material_selection"],
    [rxSlip.occlusal_contact, OPTION_SETS.occlusal_contact, "occlusal_contact"],
    [rxSlip.interproximal_pressure, OPTION_SETS.interproximal_pressure, "interproximal_pressure"],
    [rxSlip.implant_abutment, OPTION_SETS.implant_abutment, "implant_abutment"],
    [rxSlip.implant_crown_type, OPTION_SETS.implant_crown_type, "implant_crown_type"],
  ];

  for (const [arr, set, label] of arrayChecks) {
    const err = ensureAllowedArray(arr || [], set, label);
    if (err) {
      return err;
    }
  }

  if (!Array.isArray(rxSlip.pontic_design) || rxSlip.pontic_design.length !== 5) {
    return "pontic_design must contain 5 positions.";
  }

  for (let i = 0; i < rxSlip.pontic_design.length; i += 1) {
    const item = rxSlip.pontic_design[i] || {};
    if (Number(item.position) !== i + 1) {
      return "pontic_design positions are invalid.";
    }

    if (typeof item.checked !== "boolean") {
      return "pontic_design checked value must be boolean.";
    }
  }

  return null;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  if (!hasBearerAuthorization(event)) {
    return json(401, { error: "Authentication required." });
  }

  const user = getUserFromContext(context);
  if (!user || !user.sub || !user.email) {
    return json(401, { error: "Authentication required." });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (_err) {
    return json(400, { error: "Malformed JSON." });
  }

  const rxSlip = payload.rxSlip;
  const validationError = validateRxSlip(rxSlip);
  if (validationError) {
    return json(400, { error: validationError });
  }

  const caseId = sanitizeCaseId(payload.caseId);

  const submission = {
    case_id: caseId,
    rx_slip: rxSlip,
    rx_slip_json: JSON.stringify(rxSlip),
    auth_user_id: user.sub,
    auth_user_email: user.email,
    submitted_at: new Date().toISOString(),
  };

  try {
    if (process.env.CASE_WEBHOOK_URL) {
      const webhookRes = await fetch(process.env.CASE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });

      if (!webhookRes.ok) {
        return json(502, { error: "Failed to store case submission." });
      }
      return json(200, { ok: true });
    }

    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
    if (siteUrl) {
      const formPayload = new URLSearchParams({
        "form-name": "case-submission-auth",
        case_id: submission.case_id,
        rx_slip_json: submission.rx_slip_json,
        auth_user_id: submission.auth_user_id,
        auth_user_email: submission.auth_user_email,
        submitted_at: submission.submitted_at,
      });

      const formRes = await fetch(`${siteUrl}/`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formPayload.toString(),
      });

      if (!formRes.ok) {
        return json(502, { error: "Failed to store case submission." });
      }

      return json(200, { ok: true });
    }

    return json(500, { error: "Submission destination is not configured." });
  } catch (_err) {
    return json(500, { error: "Unexpected submission error." });
  }
};
