import app from "../backend/src/server.js";

export default function handler(req, res) {
	// Vercel will route requests like /api/health here. Express app
	// defines routes at /health, /api/* would not match. Strip the
	// leading /api prefix so Express sees the expected paths.
	if (req.url && req.url.startsWith("/api")) {
		req.url = req.url.replace(/^\/api/, "") || "/";
	}

	return app(req, res);
}
