const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!uri || !email || !password) {
    console.log("STATUS=missing-env");
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const users = mongoose.connection.collection("users");
  const existing = await users.findOne({ email });
  if (existing) {
    console.log("STATUS=admin-exists");
  } else {
    const now = new Date();
    await users.insertOne({
      name: "Admin",
      email,
      password_hash: await bcrypt.hash(password, 12),
      role: "admin",
      status: "active",
      created_at: now,
      updated_at: now,
    });
    console.log("STATUS=admin-created");
  }

  const userCount = await users.countDocuments();
  console.log("USER_COUNT=" + userCount);
  console.log("DB_NAME=" + mongoose.connection.name);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.log("STATUS=fail");
  console.log("ERROR=" + sanitize(error.message));
  process.exit(1);
});
