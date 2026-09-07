const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

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

function sanitize(message) {
  return String(message).replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, "mongodb$1://***@");
}

async function main() {
  loadEnv();
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.log("STATUS=missing");
    process.exit(1);
  }

  const hasDbName = /mongodb\.net\/[^/?]+/.test(uri);
  console.log("URI_SET=yes");
  console.log("HAS_DB_NAME=" + (hasDbName ? "yes" : "no"));

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log("STATUS=ok");
    console.log("DB_NAME=" + (mongoose.connection.name || "test"));
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(
      "COLLECTIONS=" + (collections.map((c) => c.name).join(",") || "(none yet)")
    );
    await mongoose.disconnect();
  } catch (error) {
    console.log("STATUS=fail");
    console.log("ERROR_NAME=" + error.name);
    console.log("ERROR=" + sanitize(error.message));
    process.exit(1);
  }
}

main();
