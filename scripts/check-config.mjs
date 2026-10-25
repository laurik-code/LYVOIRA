import fs from "node:fs";
const required = ["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_KEY","SUPABASE_SERVICE_ROLE_KEY","OPENAI_API_KEY","ADMIN_PASSWORD"];
const env = fs.existsSync(".env.local") ? Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/).filter(x=>x.includes("=")&&!x.trim().startsWith("#")).map(x=>{const i=x.indexOf("=");return [x.slice(0,i).trim(),x.slice(i+1).trim()]})) : {};
const missing = required.filter(k=>!env[k] || /YOUR_|REPLACE_|YOUR_PROJECT/.test(env[k]));
if (missing.length) { console.error("Missing .env.local values:",missing.join(", "));process.exitCode=1; }
else if (env.ADMIN_PASSWORD.length < 16) { console.error("ADMIN_PASSWORD must be at least 16 characters");process.exitCode=1; }
else console.log("Required environment values are present (connectivity not tested).");
