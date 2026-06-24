import { useState } from 'react';

const initialForm = {
  longUrl: '',
  customAlias: ''
};

export default function CreateLinkForm({ onSubmit, isSubmitting }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!form.longUrl.trim()) {
      setError('Please enter a long URL.');
      return;
    }

    try {
      await onSubmit({
        longUrl: form.longUrl.trim(),
        customAlias: form.customAlias.trim()
      });
      setForm(initialForm);
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <section className="app-card">
      <div className="section-copy">
        <p className="eyebrow-text">Create</p>
        <h2>Create a short URL</h2>
        <p>
          Create a new short code from any long URL. Add a custom alias if you want a readable, branded short code.
        </p>
      </div>

      <form className="stack-form" onSubmit={handleSubmit}>
        <label>
          <span>Long URL</span>
          <input
            name="longUrl"
            type="url"
            placeholder="https://example.com/very/long/path"
            value={form.longUrl}
            onChange={handleChange}
          />
        </label>

        <label>
          <span>Custom alias (optional)</span>
          <input
            name="customAlias"
            type="text"
            placeholder="launch-2026"
            value={form.customAlias}
            onChange={handleChange}
          />
        </label>

        {error ? <p className="inline-error">{error}</p> : null}

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create short URL'}
        </button>
      </form>
    </section>
  );
}
