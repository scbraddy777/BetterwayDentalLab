const {
  readApprovalToken,
  generateShippoLabel,
  sendCustomerLabelEmail,
  approvalHtml,
  normalize,
} = require('./lib/label-service');

exports.handler = async function (event) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: approvalHtml('Method not allowed', '<p>This approval link must be opened in a browser.</p>'),
    };
  }

  const token = normalize(event.queryStringParameters && event.queryStringParameters.token);
  if (!token) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: approvalHtml('Missing approval token', '<p>This approval link is incomplete. Please request a new approval email.</p>'),
    };
  }

  try {
    const payload = readApprovalToken(token);
    const labelResult = await generateShippoLabel(payload);
    try {
      await sendCustomerLabelEmail(payload, labelResult);
    } catch (emailError) {
      console.error('Customer label email failed:', emailError);
    }

    const body = [
      '<p>The shipping label request for <strong>' + payload.practiceName + '</strong> has been approved.</p>',
      '<p>The customer has been sent their label by email.</p>',
      '<ul>',
      '<li><strong>Tracking number:</strong> ' + (labelResult.trackingCode || 'Will appear after carrier acceptance') + '</li>',
      '<li><strong>Service:</strong> ' + ([labelResult.carrier, labelResult.service].filter(Boolean).join(' ') || 'Carrier selected automatically') + '</li>',
      '<li><strong>Label:</strong> <a href="' + labelResult.labelUrl + '">Download PDF label</a></li>',
      '</ul>',
      '<p>This approval link can create another label if it is used again before it expires, so treat it like a payment link.</p>',
    ].join('');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: approvalHtml('Shipping label approved', body),
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: approvalHtml('Approval failed', '<p>' + (error && error.message ? error.message : 'We could not approve this label request.') + '</p>'),
    };
  }
};
