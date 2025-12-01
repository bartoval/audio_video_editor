function corsHeaders(req, res, next) {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // Skip COEP for SSE endpoints (breaks cross-origin EventSource)
  if (!req.path.includes('/events')) {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  }

  next();
}

module.exports = { corsHeaders };
