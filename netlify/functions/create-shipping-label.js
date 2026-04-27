const {
  json,
  normalize,
  parseBody,
  validateRequest,
  destinationAddressFromEnv,
  sendApprovalEmail,
} = require('./lib/label-service');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  const body = parseBody(event);
  if (!body) {
    return json(400, { error: 'Invalid request body.' });
  }

  if (normalize(body.companyWebsite)) {
    return json(400, { error: "We couldn't submit this request right now. Please contact the lab directly." });
  }

  const destination = destinationAddressFromEnv();
  if (destination.missing) {
    return json(500, {
      error: 'Shipping labels are not fully configured yet. Add the Shippo token and lab address environment variables in Netlify before going live.',
      missing: destination.missing,
    });
  }

  const validation = validateRequest(body);
  if (validation.error) {
    return json(400, { error: validation.error });
  }

  try {
    await sendApprovalEmail(validation.normalized);
    return json(200, {
      success: true,
      message: 'Your shipping label request has been submitted for review. Better Way Dental Lab will approve it before a label is generated.',
    });
  } catch (error) {
    return json(500, {
      error: error && error.message ? error.message : 'We could not submit your shipping label request right now. Please contact the lab directly.',
    });
  }
};
