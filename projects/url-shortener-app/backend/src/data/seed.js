const seededLinks = [
  {
    shortCode: 'arch01',
    longUrl: 'https://example.com/system-design/url-shortener-overview',
    title: 'URL Shortener Architecture Overview',
    createdAt: '2026-04-01T09:00:00.000Z',
    expiresAt: null,
    clicks: 18,
    lastAccessedAt: '2026-04-05T18:30:00.000Z',
    customAlias: true
  },
  {
    shortCode: 'hld2026',
    longUrl: 'https://example.com/design/high-level-systems',
    title: 'High-Level Design Notes',
    createdAt: '2026-04-02T10:15:00.000Z',
    expiresAt: null,
    clicks: 9,
    lastAccessedAt: '2026-04-06T08:10:00.000Z',
    customAlias: true
  },
  {
    shortCode: 'b62x9k',
    longUrl: 'https://example.com/backend/base62-encoding-explained',
    title: 'Base62 Encoding Explained',
    createdAt: '2026-04-03T07:45:00.000Z',
    expiresAt: null,
    clicks: 4,
    lastAccessedAt: '2026-04-04T12:00:00.000Z',
    customAlias: false
  }
];

const seededEvents = {
  arch01: [
    '2026-04-05T08:00:00.000Z',
    '2026-04-05T11:30:00.000Z',
    '2026-04-05T18:30:00.000Z'
  ],
  hld2026: [
    '2026-04-05T15:00:00.000Z',
    '2026-04-06T08:10:00.000Z'
  ],
  b62x9k: ['2026-04-04T12:00:00.000Z']
};

module.exports = {
  seededLinks,
  seededEvents
};
