function formatDate(value) {
  if (!value) {
    return 'Never';
  }

  return new Date(value).toLocaleString();
}

export default function LinksTable({ links, selectedShortCode, onSelect, onOpen }) {
  return (
    <section className="app-card">
      <div className="section-copy">
        <p className="eyebrow-text">Recent links</p>
        <h2>Shortened URLs</h2>
        <p>Review recent short URLs, inspect analytics, and open any link to simulate redirect traffic.</p>
      </div>

      <div className="table-wrap">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Short code</th>
              <th>Target</th>
              <th>Clicks</th>
              <th>Last accessed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link) => (
              <tr
                key={link.shortCode}
                className={selectedShortCode === link.shortCode ? 'is-selected' : ''}
              >
                <td>{link.shortCode}</td>
                <td>
                  <div className="cell-title">{link.title}</div>
                  <div className="cell-subtext">{link.longUrl}</div>
                </td>
                <td>{link.clicks}</td>
                <td>{formatDate(link.lastAccessedAt)}</td>
                <td>
                  <div className="action-group">
                    <button type="button" className="secondary-button" onClick={() => onSelect(link.shortCode)}>
                      Analytics
                    </button>
                    <button type="button" className="secondary-button" onClick={() => onOpen(link.shortCode)}>
                      Open
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
