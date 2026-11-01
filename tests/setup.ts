process.env.APP_BASE_URL = "https://usage.example.test";
process.env.APP_TIMEZONE = "Asia/Tehran";
process.env.BIFROST_BASE_URL = "http://127.0.0.1:8080";
process.env.BIFROST_ADMIN_USERNAME = "test-admin";
process.env.BIFROST_ADMIN_PASSWORD = "test-password";
process.env.ACCESS_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString(
  "base64url",
);
process.env.SESSION_ENCRYPTION_KEY = Buffer.alloc(32, 2).toString("base64url");
