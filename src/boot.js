(function() {
  const BUILD_TIMESTAMP = 'pipeline-test-v1';
  console.log('[LifeOS] boot loaded:', BUILD_TIMESTAMP);
  const params = new URLSearchParams(window.location.search);
  const tenant = params.get('t');
  const admin = params.get('admin');
  if (admin === '0308') console.log('[LifeOS] admin mode requested');
  else if (tenant) console.log('[LifeOS] tenant:', tenant);
})();
