// at repo root
module.exports = {
  ci: {
    collect: {
      // build first in your workflow
      startServerCommand: 'npx serve -s dist -l 33827',
      startServerReadyPattern: 'Accepting connections',
      startServerReadyTimeout: 60000,
      url: ['http://localhost:33827/', 'http://localhost:33827/investments'],
      numberOfRuns: 3,
    },
    assert: { preset: 'lighthouse:recommended' },
    upload: { target: 'temporary-public-storage' } // or your own server
  },
};
