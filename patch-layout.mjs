import fs from "fs";

const file = "app/_layout.tsx";
let s = fs.readFileSync(file, "utf8");

const oldBlockRegex = /if\s*\(\s*token\s*\)\s*\{\s*localStorage\.setItem\("sessionToken",\s*token\);\s*url\.searchParams\.delete\("sessionToken"\);\s*window\.history\.replaceState\(\{\},\s*"",\s*url\.toString\(\)\);\s*\}/m;

const newBlock = `if (token) {
  localStorage.setItem("sessionToken", token);

  // IMPORTANT: create the session cookie on the backend using the token
  (async () => {
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: \`Bearer \${token}\`,
        },
        credentials: "include",
      });

      if (!res.ok) {
        console.log("[Auth] establishSession failed:", res.status);
      } else {
        console.log("[Auth] establishSession ok");
      }
    } catch (e) {
      console.log("[Auth] establishSession error:", e);
    } finally {
      // Remove token from URL so it doesn't keep re-triggering
      url.searchParams.delete("sessionToken");
      window.history.replaceState({}, "", url.toString());
    }
  })();
}`;

if (!oldBlockRegex.test(s)) {
  console.error("❌ Could not find the old token block to replace in app/_layout.tsx");
  process.exit(1);
}

s = s.replace(oldBlockRegex, newBlock);
fs.writeFileSync(file, s, "utf8");
console.log("✅ Patched app/_layout.tsx");
