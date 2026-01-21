import { intro, outro, confirm, isCancel } from '@clack/prompts';
import pc from 'picocolors';

export async function showManifesto(): Promise<boolean> {
  const introText = pc.cyan('╔════════════════════════════════════════════════════════╗');
  const outroText = pc.cyan('╚══════════════════════════════════════════════════════╝');

  intro({
    title: pc.bold(pc.yellow('THE HOBO MANIFESTO')),
    dir: process.cwd(),
  });

  console.log(`
  ${pc.bold(pc.yellow('═'.repeat(62))}
  ${pc.cyan('║')}  ${pc.bold(pc.white('NOTICE: BEST EFFORT MIGRATION'))}  ${' '.repeat(33)}${pc.cyan('║')}
  ${pc.cyan('║')}  ${pc.dim('This tool provides reasonable best-effort transpilation.')}  ${' '.repeat(21)}${pc.cyan('║')}
  ${pc.cyan('║')}  ${pc.dim('Some GSD features may not translate perfectly.')}       ${' '.repeat(20)}${pc.cyan('║')}
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
  ${pc.bold(pc.yellow('═'.repeat(62)))
  `);

  const accepted = await confirm({
    message: 'Do you accept and wish to continue?',
    initialValue: false,
  });

  if (isCancel(accepted)) {
    outro({
      message: pc.yellow('Manifesto declined. Safe travels, hobo.'),
    });
    return false;
  }

  if (!accepted) {
    outro({
      message: pc.yellow('Manifesto declined. Safe travels, hobo.'),
    });
    return false;
  }

  const timestamp = new Date().toISOString();
  console.log(pc.dim(`[Manifesto accepted at ${timestamp}]`));

  return true;
}