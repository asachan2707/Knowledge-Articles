const initialLinks = [
  {
    shortCode: 'arch01',
    shortUrl: 'http://localhost:4000/r/arch01',
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
    shortUrl: 'http://localhost:4000/r/hld2026',
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
    shortUrl: 'http://localhost:4000/r/b62x9k',
    longUrl: 'https://example.com/backend/base62-encoding-explained',
    title: 'Base62 Encoding Explained',
    createdAt: '2026-04-03T07:45:00.000Z',
    expiresAt: null,
    clicks: 4,
    lastAccessedAt: '2026-04-04T12:00:00.000Z',
    customAlias: false
  }
];

const initialAnalytics = {
  arch01: {
    shortCode: 'arch01',
    totalClicks: 18,
    lastAccessedAt: '2026-04-05T18:30:00.000Z',
    recentEvents: [
      '2026-04-05T18:30:00.000Z',
      '2026-04-05T11:30:00.000Z',
      '2026-04-05T08:00:00.000Z'
    ]
  },
  hld2026: {
    shortCode: 'hld2026',
    totalClicks: 9,
    lastAccessedAt: '2026-04-06T08:10:00.000Z',
    recentEvents: ['2026-04-06T08:10:00.000Z', '2026-04-05T15:00:00.000Z']
  },
  b62x9k: {
    shortCode: 'b62x9k',
    totalClicks: 4,
    lastAccessedAt: '2026-04-04T12:00:00.000Z',
    recentEvents: ['2026-04-04T12:00:00.000Z']
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function summarize(links) {
  const totalLinks = links.length;
  const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0);
  const hottestLink = [...links].sort((a, b) => b.clicks - a.clicks)[0] || null;

  return {
    totalLinks,
    totalClicks,
    hottestLink: hottestLink
      ? {
          shortCode: hottestLink.shortCode,
          clicks: hottestLink.clicks
        }
      : null
  };
}

export function createMockService() {
  const state = {
    links: clone(initialLinks),
    analytics: clone(initialAnalytics),
    counter: 5000
  };

  return {
    listLinks() {
      return {
        links: [...state.links].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        summary: summarize(state.links)
      };
    },
    createLink(payload) {
      const shortCode = payload.customAlias?.trim() || `mock${++state.counter}`;
      if (state.links.some((link) => link.shortCode === shortCode)) {
        throw new Error('Short code already exists.');
      }

      const now = new Date().toISOString();
      const link = {
        shortCode,
        shortUrl: `http://localhost:4000/r/${shortCode}`,
        longUrl: payload.longUrl.trim(),
        title: new URL(payload.longUrl).hostname,
        createdAt: now,
        expiresAt: payload.expiresAt || null,
        clicks: 0,
        lastAccessedAt: null,
        customAlias: Boolean(payload.customAlias)
      };

      state.links.unshift(link);
      state.analytics[shortCode] = {
        shortCode,
        totalClicks: 0,
        lastAccessedAt: null,
        recentEvents: []
      };

      return {
        link,
        summary: summarize(state.links)
      };
    },
    getAnalytics(shortCode) {
      const analytics = state.analytics[shortCode];
      if (!analytics) {
        throw new Error('Short code not found.');
      }

      return { analytics };
    },
    visitLink(shortCode) {
      const link = state.links.find((item) => item.shortCode === shortCode);
      if (!link) {
        throw new Error('Short code not found.');
      }

      const eventTime = new Date().toISOString();
      link.clicks += 1;
      link.lastAccessedAt = eventTime;
      state.analytics[shortCode].totalClicks += 1;
      state.analytics[shortCode].lastAccessedAt = eventTime;
      state.analytics[shortCode].recentEvents.unshift(eventTime);

      return {
        redirectUrl: link.longUrl,
        link,
        analytics: state.analytics[shortCode]
      };
    }
  };
}
