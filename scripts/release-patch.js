import { spawnSync, execSync } from 'node:child_process';

const dry = process.env.DRY_RUN === '1' || process.argv.includes('--dry') || process.argv.includes('--dry-run');
const noPush = process.argv.includes('--no-push') || process.env.NO_PUSH === '1';

function runCmd(cmd, args = [], opts = {}) {
  const display = args.length ? `${cmd} ${args.join(' ')}` : cmd;
  console.log('> ' + display);
  if (dry) {
    console.log('(dry run) skipped');
    return { status: 0 };
  }

  const spawnOpts = Object.assign({ stdio: 'inherit', timeout: 10 * 60 * 1000 }, opts);
  let res = spawnSync(cmd, args, spawnOpts);
  if (res && res.error && res.error.code === 'ENOENT') {
    console.warn(`${cmd} not found in PATH (ENOENT). Retrying with shell mode...`);
    const full = args.length ? `${cmd} ${args.join(' ')}` : cmd;
    const retry = spawnSync(full, { stdio: 'inherit', shell: true, timeout: spawnOpts.timeout });
    if (retry && retry.error) {
      throw retry.error;
    }
    if (retry && typeof retry.status === 'number' && retry.status !== 0) {
      const out = retry.stdout ? retry.stdout.toString() : '';
      const err = retry.stderr ? retry.stderr.toString() : '';
      const msg = `${full} exited with code ${retry.status}\n${out}${err}`;
      const e = new Error(msg);
      e.code = retry.status;
      throw e;
    }
    return retry;
  }
  if (res && res.error) {
    throw res.error;
  }
  if (typeof res.status === 'number' && res.status !== 0) {
    const out = res.stdout ? res.stdout.toString() : '';
    const err = res.stderr ? res.stderr.toString() : '';
    const msg = `${display} exited with code ${res.status}\n${out}${err}`;
    const e = new Error(msg);
    e.code = res.status;
    throw e;
  }
  return res;
}

function printDiagnostics() {
  console.log('--- Git/Env diagnostics ---');
  try { console.log('git --version:', execSync('git --version').toString().trim()); } catch (e) {}
  try { console.log('git remote -v:\n', execSync('git remote -v').toString().trim()); } catch (e) {}
  const interesting = ['GIT_SSH_COMMAND', 'SSH_AUTH_SOCK', 'SSH_AGENT_PID', 'GIT_ASKPASS', 'PATH'];
  for (const k of interesting) {
    if (process.env[k]) console.log(k + '=', process.env[k]);
  }
  console.log('---------------------------');
}

async function main() {
  try {
    if (!dry) runCmd('npm', ['version', 'patch']);
    else console.log('(dry run) would run: npm version patch');

    if (!noPush) {
      try {
        runCmd('git', ['push', 'origin', 'main']);
      } catch (e) {
        console.error('git push origin main failed:', e.message || e);
        console.log('Retrying git push using shell mode (may help with credential helpers)...');
        const retry = spawnSync('git push origin main', { stdio: 'inherit', shell: true, timeout: 10 * 60 * 1000 });
        if (retry.error || retry.status !== 0) {
          console.error('Retry also failed.');
          printDiagnostics();
          throw retry.error || new Error('git push failed with exit code ' + retry.status);
        }
      }
    } else {
      console.log('--no-push set — skipping push to origin/main');
    }

    const tag = execSync('git describe --tags --abbrev=0').toString().trim();
    console.log('Detected tag:', tag);

    if (!noPush) {
      try {
        runCmd('git', ['push', 'origin', tag]);
      } catch (e) {
        console.error('git push tag failed:', e.message || e);
        printDiagnostics();
        throw e;
      }

      try {
        runCmd('gh', ['release', 'create', tag, '--title', `Version ${tag}`, '--notes', 'Patch release']);
      } catch (e) {
        console.error('gh release create failed:', e.message || e);
        printDiagnostics();
        throw e;
      }
    } else {
      console.log('--no-push set — skipping tag push and gh release create');
    }
  } catch (err) {
    console.error('Release script failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();
