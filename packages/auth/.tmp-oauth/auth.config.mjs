import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { mcp } from "@better-auth/mcp";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import Database from "better-sqlite3";

export const auth = betterAuth({
  baseURL: "http://localhost:3000",
  secret: "temp-cli-secret-not-used-for-real",
  database: drizzleAdapter(new Database(":memory:"), { provider: "sqlite" }),
  plugins: [
    jwt(),
    mcp({
      loginPage: "/sign-in",
      consentPage: "/consent",
      resource: "http://localhost:3000/mcp",
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      scopes: ["openid", "profile", "email", "offline_access", "mcp:read", "mcp:full"],
    }),
    cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
  ],
});
