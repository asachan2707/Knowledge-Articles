import { useEffect, useMemo, useState } from 'react';
import AnalyticsPanel from './components/AnalyticsPanel';
import CreateLinkForm from './components/CreateLinkForm';
import LinksTable from './components/LinksTable';
import RuntimeBanner from './components/RuntimeBanner';
import {
  createLink,
  getAnalytics,
  getRuntimeMode,
  initializeClient,
  listLinks,
  visitLink
} from './api/client';

export default function App() {
  const [links, setLinks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [selectedShortCode, setSelectedShortCode] = useState('');
  const [runtimeMode, setRuntimeMode] = useState('unknown');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function refreshLinks(preserveSelection = true) {
    const response = await listLinks();
    setLinks(response.links);
    setSummary(response.summary);
    setRuntimeMode(getRuntimeMode());

    if (!preserveSelection && response.links[0]) {
      setSelectedShortCode(response.links[0].shortCode);
      return response.links[0].shortCode;
    }

    if (!selectedShortCode && response.links[0]) {
      setSelectedShortCode(response.links[0].shortCode);
      return response.links[0].shortCode;
    }

    return selectedShortCode || response.links[0]?.shortCode || '';
  }

  async function loadAnalytics(shortCode) {
    if (!shortCode) {
      setAnalytics(null);
      return;
    }

    const response = await getAnalytics(shortCode);
    setAnalytics(response.analytics);
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        setLoading(true);
        setError('');
        const mode = await initializeClient();
        setRuntimeMode(mode);
        const initialShortCode = await refreshLinks(false);
        await loadAnalytics(initialShortCode);
      } catch (bootstrapError) {
        setError(bootstrapError.message);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  async function handleCreateLink(payload) {
    setSubmitting(true);
    setError('');

    try {
      await createLink(payload);
      const latestShortCode = await refreshLinks(false);
      await loadAnalytics(latestShortCode);
    } catch (createError) {
      setError(createError.message);
      throw createError;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSelect(shortCode) {
    setSelectedShortCode(shortCode);
    setError('');

    try {
      await loadAnalytics(shortCode);
    } catch (analyticsError) {
      setError(analyticsError.message);
    }
  }

  async function handleOpen(shortCode) {
    setError('');

    try {
      const response = await visitLink(shortCode);
      window.open(response.redirectUrl, '_blank', 'noopener,noreferrer');
      await refreshLinks(true);
      await loadAnalytics(shortCode);
    } catch (visitError) {
      setError(visitError.message);
    }
  }

  const pageTitle = useMemo(
    () => (runtimeMode === 'mock' ? 'URL Shortener Demo (Mock Fallback)' : 'URL Shortener Demo'),
    [runtimeMode]
  );

  return (
    <div className="app-shell">
      <header className="app-hero">
        <p className="hero-kicker">Learning Project Demo</p>
        <h1>{pageTitle}</h1>
        <p className="hero-copy">
          Explore the core flows of a URL shortener from both the product and architecture side: create links, inspect
          analytics, and understand how the app behaves when the backend is available versus unavailable.
        </p>
      </header>

      <main className="app-main">
        <RuntimeBanner mode={runtimeMode} />

        {error ? <div className="app-error">{error}</div> : null}

        {loading ? (
          <section className="app-card">
            <p>Loading URL shortener demo...</p>
          </section>
        ) : (
          <div className="dashboard-grid">
            <div className="main-column">
              <CreateLinkForm onSubmit={handleCreateLink} isSubmitting={submitting} />
              <LinksTable
                links={links}
                selectedShortCode={selectedShortCode}
                onSelect={handleSelect}
                onOpen={handleOpen}
              />
            </div>

            <div className="side-column">
              <AnalyticsPanel
                summary={summary}
                analytics={analytics}
                selectedShortCode={selectedShortCode}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
