import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Development readiness only. This is not an application health check.
let missing = 0;
function report(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'NEEDED'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) missing++;
}
report('Node.js 24', Number(process.versions.node.split('.')[0]) === 24, process.version);
for (const command of ['git', 'pnpm', 'gh']) {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 10000 });
  report(command, result.status === 0, result.status === 0 ? result.stdout.split('\n')[0] : 'install or add to PATH');
}
if (existsSync('.env.local')) {
  try { process.loadEnvFile('.env.local'); }
  catch { report('.env.local', false, 'could not parse; no contents logged'); }
}
for (const name of ['OPENAI_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
  report(name, Boolean(process.env[name]?.trim()), process.env[name]?.trim() ? 'present; value hidden' : 'set in .env.local');
}
if (process.argv.includes('--api')) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    report('OpenAI model access', false, 'no key; no request sent');
  } else {
    const model = process.env.OPENAI_MODEL || 'gpt-6-astra';
    try {
      const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.json();
      report('OpenAI model metadata', response.ok && body.id === model, `HTTP ${response.status}; inference still requires a separate check`);
    } catch { report('OpenAI model metadata', false, 'network/request failure; no credentials logged'); }
  }
}
console.log('Presence checks do not verify billing, inference, database access, or deployment.');
process.exitCode = missing ? 1 : 0;
