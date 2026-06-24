const { seededLinks, seededEvents } = require('./seed');

const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function encodeBase62(value) {
  if (value === 0) {
    return '0';
  }

  let current = value;
  let encoded = '';

  while (current > 0) {
    encoded = BASE62_ALPHABET[current % 62] + encoded;
    current = Math.floor(current / 62);
  }

  return encoded;
}

function cloneLinks() {
  return seededLinks.map((link) => ({ ...link }));
}

function cloneEvents() {
  return Object.fromEntries(
    Object.entries(seededEvents).map(([shortCode, events]) => [shortCode, [...events]])
  );
}

class LinkStore {
  constructor() {
    this.links = new Map();
    this.clickEvents = cloneEvents();
    this.counter = 5000;

    cloneLinks().forEach((link) => {
      this.links.set(link.shortCode, link);
    });
  }

  listLinks() {
    return Array.from(this.links.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  findLink(shortCode) {
    return this.links.get(shortCode) || null;
  }

  createLink({ longUrl, customAlias, expiresAt }) {
    const shortCode = customAlias || encodeBase62(++this.counter);

    if (this.links.has(shortCode)) {
      const error = new Error('Short code already exists.');
      error.statusCode = 409;
      throw error;
    }

    const now = new Date().toISOString();
    const link = {
      shortCode,
      longUrl,
      title: this.buildTitle(longUrl),
      createdAt: now,
      expiresAt: expiresAt || null,
      clicks: 0,
      lastAccessedAt: null,
      customAlias: Boolean(customAlias)
    };

    this.links.set(shortCode, link);
    this.clickEvents[shortCode] = [];

    return link;
  }

  recordClick(shortCode) {
    const link = this.findLink(shortCode);

    if (!link) {
      return null;
    }

    const eventTime = new Date().toISOString();
    link.clicks += 1;
    link.lastAccessedAt = eventTime;
    this.clickEvents[shortCode] = this.clickEvents[shortCode] || [];
    this.clickEvents[shortCode].push(eventTime);

    return link;
  }

  getAnalytics(shortCode) {
    const link = this.findLink(shortCode);

    if (!link) {
      return null;
    }

    const events = this.clickEvents[shortCode] || [];

    return {
      shortCode,
      totalClicks: link.clicks,
      lastAccessedAt: link.lastAccessedAt,
      recentEvents: events.slice(-10).reverse()
    };
  }

  getSummary() {
    const links = this.listLinks();
    const totalLinks = links.length;
    const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0);
    const hottestLink = links.reduce((best, link) => {
      if (!best || link.clicks > best.clicks) {
        return link;
      }

      return best;
    }, null);

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

  buildTitle(longUrl) {
    try {
      const parsedUrl = new URL(longUrl);
      return parsedUrl.hostname;
    } catch {
      return 'Custom URL';
    }
  }
}

module.exports = {
  LinkStore
};
