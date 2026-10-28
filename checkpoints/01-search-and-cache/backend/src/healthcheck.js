try {
  const response = await fetch(`http://127.0.0.1:${process.argv[2]}/health`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
