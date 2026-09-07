import { getAuthTables } from "better-auth/db";
import { jwt } from "better-auth/plugins";
import { mcp } from "@better-auth/mcp";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";

const tables = getAuthTables({
  plugins: [
    jwt(),
    mcp({
      loginPage: "/sign-in",
      consentPage: "/consent",
      resource: "http://localhost:3000/mcp",
      scopes: ["openid", "profile", "email", "offline_access", "mcp:read", "mcp:full"],
    }),
    cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
  ],
});
for (const [name, t] of Object.entries(tables)) {
  if (!/^oauth|jwks/.test(name)) continue;
  console.log(`TABLE ${name} (modelName=${t.modelName || name})`);
  for (const [f, def] of Object.entries(t.fields || {})) {
    console.log(`  ${f}: type=${def.type} required=${!!def.required} unique=${!!def.unique} default=${JSON.stringify(def.defaultValue)} ref=${def.references ? def.references.model + '.' + def.references.field : '-'}`);
  }
}
