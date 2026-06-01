let _appPromise = null;

async function loadApp() {
	if (!_appPromise) {
		_appPromise = import("../backend/src/server.js").then(m => m.default);
	}
	return _appPromise;
}

export default async function handler(req, res) {
	try {
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
		res.statusCode = 500;
		const message = `Server import error: ${err.message || String(err)}`;
		res.setHeader("Content-Type", "text/plain; charset=utf-8");
		res.end(message);
	}
}
