function getUserFromContext(context) {
  if (context && context.clientContext) {
    if (context.clientContext.user && context.clientContext.user.sub) {
      return context.clientContext.user;
    }

    const encoded = context.clientContext.custom && context.clientContext.custom.netlify;
    if (encoded) {
      try {
        const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
        if (decoded && decoded.user && decoded.user.sub) {
          return decoded.user;
        }
      } catch (_err) {
        return null;
      }
    }
  }

  return null;
}

function getAuthorizationHeader(event) {
  if (!event || !event.headers) {
    return "";
  }

  return String(event.headers.authorization || event.headers.Authorization || "").trim();
}

function hasBearerAuthorization(event) {
  const authHeader = getAuthorizationHeader(event);
  return /^Bearer\s+.+$/i.test(authHeader);
}

module.exports = {
  getUserFromContext,
  hasBearerAuthorization,
};
