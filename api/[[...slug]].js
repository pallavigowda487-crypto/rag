import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import app from "../backend/src/server.js";

async function getDebugInfo() {
	const rootPath = path.dirname(fileURLToPath(import.meta.url));
	const rootPkgPath = path.join(rootPath, "package.json");
	const rootPkg = JSON.parse(await readFile(rootPkgPath, "utf-8"));
	const dependencies = [
		...Object.keys(rootPkg.dependencies || {}),
		...Object.keys(rootPkg.devDependencies || {})
	].sort();

	const safeEnv = {};
	const secretPattern = /(?:KEY|TOKEN|SECRET|PASSWORD|API|AUTH|CREDENTIAL)/i;
	for (const [key, value] of Object.entries(process.env)) {
		safeEnv[key] = secretPattern.test(key) ? (value ? "REDACTED" : "missing") : (value ?? "missing");
	}

	return {
		ok: true,
		nodeVersion: process.version,
		platform: process.platform,
		env: safeEnv,
		dependencies,
		note: "Temporary debug endpoint. Do not leave enabled in production."
	};
}

export default async function handler(req, res) {
	try {
		const pathname = new URL(req.url || "/", "http://localhost").pathname;
		if (["/api/debug", "/api/_debug", "/debug", "/_debug"].includes(pathname)) {
			const debugInfo = await getDebugInfo();
			res.setHeader("Content-Type", "application/json; charset=utf-8");
			res.statusCode = 200;
			res.end(JSON.stringify(debugInfo, null, 2));
			return;
		}

		// Keep /api prefix in req.url for Express routes that include /api/ in their path
		// The catch-all route already handles both /api and /api/* requests

		// app is statically imported

		// Call the express app and wait for the response to finish so
		// we can surface any runtime errors back to Vercel.
		await new Promise((resolve, reject) => {
			let settled = false;

			function done(err) {
				if (settled) return;
				settled = true;
				if (err) return reject(err);
				return resolve();
			}

			res.on("finish", () => done());
			res.on("close", () => done());
			res.on("error", (err) => done(err));

			try {
				app(req, res);
			} catch (err) {
				done(err);
			}
		});
		return;
	} catch (err) {
		// Return JSON error response so frontend can parse it correctly
		res.statusCode = 500;
		res.setHeader("Content-Type", "application/json; charset=utf-8");
		res.end(JSON.stringify({ error: err.message || String(err) }));
	}
}
