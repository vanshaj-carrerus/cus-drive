const fs = require("fs");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");

function loadEnv() {
  const text = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (key) process.env[key] = value;
  }
}

async function main() {
  loadEnv();
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const api_key = process.env.CLOUDINARY_API_KEY?.trim();
  const api_secret = process.env.CLOUDINARY_API_SECRET?.trim();

  console.log("CLOUD_NAME=" + (cloud_name ? "SET" : "MISSING"));
  console.log("API_KEY=" + (api_key ? "SET" : "MISSING"));
  console.log("API_SECRET=" + (api_secret ? "SET" : "MISSING"));

  if (!cloud_name || !api_key || !api_secret) {
    console.log("STATUS=missing");
    process.exit(1);
  }

  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  const result = await cloudinary.api.ping();
  console.log("STATUS=ok");
  console.log("PING=" + result.status);
}

main().catch((error) => {
  console.log("STATUS=fail");
  console.log("ERROR_NAME=" + error.error?.http_code || error.name);
  console.log("ERROR=" + (error.error?.message || error.message));
  process.exit(1);
});
