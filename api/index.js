import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

let _appPromise = null;

async function loadApp() {
	if (!_appPromise) {
		_appPromise = import("../backend/src/server.js").then(m => m.default);
	}
	return _appPromise;
}

async function getDebugInfo() {
	const rootPath = path.dirname(fileURLToPath(new URL("./index.js", import.meta.url)));
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

		// Adjust request path: strip leading /api so Express routes match
		if (req.url && req.url.startsWith("/api")) {
			req.url = req.url.replace(/^\/api/, "") || "/";
		}

		const app = await loadApp();

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
		// Provide a clearer error response for debugging in Vercel logs
		if (req.url && req.url.startsWith("/api") && ['/api/debug', '/api/_debug', '/debug', '/_debug'].includes(new URL(req.url, 'http://localhost').pathname)) {
			const debugInfo = await getDebugInfo();
			res.setHeader("Content-Type", "application/json; charset=utf-8");
			res.statusCode = 500;
			res.end(JSON.stringify({ ok: false, error: err.message || String(err), debug: debugInfo }, null, 2));
			return;
		}
		res.statusCode = 500;
		const message = `Server import error: ${err.message || String(err)}`;
		res.setHeader("Content-Type", "text/plain; charset=utf-8");
		res.end(message);
	}
}
