import { intro, outro, confirm, isCancel } from '@clack/prompts';
import pc from 'picocolors';

export async function showNotice(): Promise<boolean> {
  const introText = pc.cyan('╔════════════════════════════════════════════════════════╗');
  const outroText = pc.cyan('╚══════════════════════════════════════════════════════╝');

  intro({
    title: pc.bold(pc.yellow('GSD OPEN NOTICE')),
    dir: process.cwd(),
  });

  const border = '═'.repeat(62);
  const space33 = ' '.repeat(33);
  const space21 = ' '.repeat(21);
  const space20 = ' '.repeat(20);

  console.log(`
  ${pc.bold(pc.yellow(border))}
  ${pc.cyan('║')}  ${pc.bold(pc.white('NOTICE: BEST EFFORT MIGRATION'))}  ${space33}${pc.cyan('║')}
  ${pc.cyan('║')}  ${pc.dim('This tool provides reasonable best-effort transpilation.')}  ${space21}${pc.cyan('║')}
  ${pc.cyan('║')}  ${pc.dim('Some GSD features may not translate perfectly.')}       ${space20}${pc.cyan('║')}
  ${pc.cyan('║')}                                                          ${pc.cyan('║')}
  ${pc.cyan('║')}  ${pc.yellow('LIMITATIONS:')}                                         ${pc.cyan('║')}
  ${pc.cyan('║')}  ${pc.dim('• Not a 1:1 replacement for Claude Code')}            ${pc.cyan('║')}
  ${pc.cyan('║')}  ${pc.dim('• Some commands/features wont translate')}               ${pc.cyan('║')}
  ${pc.cyan('║')}  ${pc.dim('• OpenCode API changes may break compatibility')}      ${pc.cyan('║')}
  ${pc.cyan('║')}                                                          ${pc.cyan('║')}
  ${pc.cyan('║')}  ${pc.yellow('CREDIT:')}                                           ${pc.cyan('║')}
  ${pc.cyan('║')}  ${pc.dim('GSD context engineering by glittercowboy')}            ${pc.cyan('║')}
  ${pc.cyan('║')}  ${pc.dim('Original framework: Claude Code get-shit-done')}       ${pc.cyan('║')}
  ${pc.cyan('║')}                                                          ${pc.cyan('║')}
  ${pc.bold(pc.yellow(border))}
  `);

  const accepted = await confirm({
    message: 'Do you accept and wish to continue?',
    initialValue: false,
  });

  if (isCancel(accepted)) {
    outro({
      message: pc.yellow('Notice declined. Exiting.'),
    });
    return false;
  }

  if (!accepted) {
    outro({
      message: pc.yellow('Notice declined. Exiting.'),
    });
    return false;
  }

  const timestamp = new Date().toISOString();
  console.log(pc.dim(`[Notice accepted at ${timestamp}]`));

  return true;
}