const crypto = require("crypto");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { getUserFromContext, hasBearerAuthorization } = require("./_auth");

const ALLOWED_EXTENSIONS = new Set(["stl", "ply", "obj", "zip", "dcm", "dicom", "3mf", "txt"]);
const MAX_FILE_SIZE_BYTES = Number(process.env.MAX_FILE_SIZE_BYTES || 2 * 1024 * 1024 * 1024);

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

function sanitizeFilename(filename) {
  return String(filename || "")
    .replace(/[\\/\x00-\x1F\x7F]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .slice(0, 120);
}

function extensionOf(filename) {
  const clean = sanitizeFilename(filename);
  const idx = clean.lastIndexOf(".");
  if (idx < 0) return "";
  return clean.slice(idx + 1).toLowerCase();
}

function ensureEnv() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE || "false").toLowerCase() === "true",
  };
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

  const filename = sanitizeFilename(payload.filename);
  const contentType = String(payload.contentType || "application/octet-stream").trim();
  const size = Number(payload.size || 0);
  const caseId = String(payload.caseId || "").trim();

  if (!filename || !caseId || !size || !Number.isFinite(size)) {
    return json(400, { error: "Missing filename, caseId, or size." });
  }

  if (size <= 0 || size > MAX_FILE_SIZE_BYTES) {
    return json(400, { error: "File exceeds allowed size." });
  }

  const ext = extensionOf(filename);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return json(400, { error: "Disallowed file type." });
  }

  const cfg = ensureEnv();
  if (!cfg) {
    return json(500, { error: "Storage configuration missing." });
  }

  const safeCaseId = caseId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
  const unique = `${Date.now()}-${crypto.randomUUID()}`;
  const storageKey = `uploads/${user.sub}/${safeCaseId}/${unique}-${filename}`;

  const client = new S3Client({
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    endpoint: cfg.endpoint || undefined,
    forcePathStyle: cfg.forcePathStyle,
  });

  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: storageKey,
    ContentType: contentType,
  });

  try {
    const expiresIn = 600;
    const uploadUrl = await getSignedUrl(client, command, { expiresIn });
    return json(200, {
      uploadUrl,
      storageKey,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    });
  } catch (_err) {
    return json(500, { error: "Unable to create upload URL." });
  }
};
