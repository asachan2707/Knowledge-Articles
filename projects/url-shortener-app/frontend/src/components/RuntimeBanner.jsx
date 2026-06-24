export default function RuntimeBanner({ mode }) {
  const isMock = mode === 'mock';

  return (
    <div className={`runtime-banner ${isMock ? 'mock' : 'backend'}`}>
      <strong>{isMock ? 'Mock mode active.' : 'Backend mode active.'}</strong>{' '}
      {isMock
        ? 'The frontend could not reach the Node API, so it is using seeded demo data.'
        : 'The React app is connected to the live Node API and in-memory backend store.'}
    </div>
  );
}
