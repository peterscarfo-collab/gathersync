import { config } from "dotenv";
config({ path: "./server/.env" });
import { sdk } from "./server/_core/sdk.js";

// Mock ENV
import { ENV } from "./server/_core/env.js";
ENV.cookieSecret = "test-secret-key-that-is-long-enough";
ENV.appId = "60c16f5e-9cfa-4e25-bd1e-a68d1cdcb925";

async function run() {
  try {
    const token = await sdk.createSessionToken("test-open-id", { name: "Test User" });
    console.log("Token:", token);

    const response = await fetch("https://gathersync-api.onrender.com/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response:", text);
  } catch (e) {
    console.error(e);
  }
}

run();