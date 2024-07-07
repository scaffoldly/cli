#!/usr/bin/env node
(async () => {
  const { run } = await import('./awslambda-bootstrap.js');
  try {
    await run();
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
})();
