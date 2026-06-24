const express = require('express');
const cors = require('cors');
const { LinkStore } = require('./data/store');

const app = express();
const store = new LinkStore();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: ['http://localhost:5173'],
    credentials: true
  })
);
app.use(express.json());

function serializeLink(link) {
  return {
    shortCode: link.shortCode,
    shortUrl: `http://localhost:${PORT}/r/${link.shortCode}`,
    longUrl: link.longUrl,
    title: link.title,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    clicks: link.clicks,
    lastAccessedAt: link.lastAccessedAt,
    customAlias: link.customAlias
  };
}

function validateCreateRequest(body) {
  if (!body || typeof body.longUrl !== 'string' || !body.longUrl.trim()) {
    const error = new Error('A valid longUrl is required.');
    error.statusCode = 400;
    throw error;
  }

  try {
    const parsedUrl = new URL(body.longUrl);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Unsupported protocol.');
    }
  } catch {
    const error = new Error('longUrl must be a valid http or https URL.');
    error.statusCode = 400;
    throw error;
  }

  if (body.customAlias && !/^[a-zA-Z0-9_-]{4,16}$/.test(body.customAlias)) {
    const error = new Error('customAlias must be 4-16 characters and only use letters, numbers, _ or -.');
    error.statusCode = 400;
    throw error;
  }
}

function getLinkOr404(shortCode) {
  const link = store.findLink(shortCode);

  if (!link) {
    const error = new Error('Short code not found.');
    error.statusCode = 404;
    throw error;
  }

  return link;
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: 'backend'
  });
});

app.get('/api/links', (_req, res) => {
  const links = store.listLinks().map(serializeLink);
  res.json({
    links,
    summary: store.getSummary()
  });
});

app.post('/api/links', (req, res, next) => {
  try {
    validateCreateRequest(req.body);
    const link = store.createLink({
      longUrl: req.body.longUrl.trim(),
      customAlias: req.body.customAlias ? req.body.customAlias.trim() : '',
      expiresAt: req.body.expiresAt || null
    });

    res.status(201).json({
      link: serializeLink(link),
      summary: store.getSummary()
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/links/:shortCode', (req, res, next) => {
  try {
    const link = getLinkOr404(req.params.shortCode);
    res.json({
      link: serializeLink(link)
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/links/:shortCode/analytics', (req, res, next) => {
  try {
    getLinkOr404(req.params.shortCode);
    const analytics = store.getAnalytics(req.params.shortCode);
    res.json({ analytics });
  } catch (error) {
    next(error);
  }
});

app.post('/api/links/:shortCode/visit', (req, res, next) => {
  try {
    const link = getLinkOr404(req.params.shortCode);
    const updatedLink = store.recordClick(link.shortCode);

    res.json({
      redirectUrl: updatedLink.longUrl,
      link: serializeLink(updatedLink),
      analytics: store.getAnalytics(updatedLink.shortCode)
    });
  } catch (error) {
    next(error);
  }
});

app.get('/r/:shortCode', (req, res, next) => {
  try {
    const link = getLinkOr404(req.params.shortCode);
    store.recordClick(link.shortCode);
    res.redirect(link.longUrl);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    error: error.message || 'Unexpected server error.'
  });
});

app.listen(PORT, () => {
  console.log(`URL shortener backend listening on http://localhost:${PORT}`);
});
