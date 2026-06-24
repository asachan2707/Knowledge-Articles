function formatDate(value) {
  if (!value) {
    return 'No activity yet';
  }

  return new Date(value).toLocaleString();
}

export default function AnalyticsPanel({ summary, analytics, selectedShortCode }) {
  return (
    <section className="app-card">
      <div className="section-copy">
        <p className="eyebrow-text">Analytics</p>
        <h2>System summary</h2>
      </div>

      <div className="stats-grid">
        <div className="stat-box">
          <span className="stat-label">Total links</span>
          <strong>{summary?.totalLinks ?? 0}</strong>
        </div>
        <div className="stat-box">
          <span className="stat-label">Total clicks</span>
          <strong>{summary?.totalClicks ?? 0}</strong>
        </div>
        <div className="stat-box">
          <span className="stat-label">Hottest link</span>
          <strong>{summary?.hottestLink?.shortCode ?? 'N/A'}</strong>
        </div>
      </div>

      <div className="divider-line" />

      <div className="section-copy">
        <h3>Selected link analytics</h3>
        {selectedShortCode ? (
          <>
            <p className="analytics-subhead">Current short code: {selectedShortCode}</p>
            <ul className="analytics-list">
              <li>Total clicks: {analytics?.totalClicks ?? 0}</li>
              <li>Last accessed: {formatDate(analytics?.lastAccessedAt)}</li>
            </ul>
            <h4>Recent click events</h4>
            <ul className="events-list">
              {(analytics?.recentEvents ?? []).length ? (
                analytics.recentEvents.map((eventTime) => <li key={eventTime}>{formatDate(eventTime)}</li>)
              ) : (
                <li>No click events recorded yet.</li>
              )}
            </ul>
          </>
        ) : (
          <p>Select a short link to view its click activity.</p>
        )}
      </div>
    </section>
  );
}
