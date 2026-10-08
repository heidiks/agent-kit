import os
import sys

sys.dont_write_bytecode = True

from render import CW, FS, LH, PADX, SPIN, THEMES, TOP, W, cell, right, row, runs
import plans

SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
SPIN_STEP = 0.25
TASK, TITLE, CHECKS = 12, 22, 34
OPEN = [('[ ↗ open ]', 'claude'), (' ', 'text'), ('×', 'dim')]
MARKS = {'fail': (' ✗', 'error'), 'run': (' ' + SPIN, 'suggestion'), 'wait': (' ◐', 'warning'), 'ok': (' ✓', 'success')}


def pr_row(state, src, pr, task, repo, title, phase, checks, age):
    phase_color = 'merged' if phase == 'merged' else 'suggestion'
    task_seg = [(task, 'suggestion')] if task else [('-', 'faint')]
    return row(cell([MARKS[state]], 3), cell([(src, 'faint')], 4), cell([(pr, 'link', 'bu')], 8), cell(task_seg, TASK),
               cell([(repo, 'faint')], 16), cell([(title, 'faint')], TITLE), cell([(phase, phase_color)], 9),
               cell(checks, CHECKS), cell(age if isinstance(age, list) else [(age, 'faint')], 6), OPEN)


BUTTONS = ['◎ focus', '▤ table', '⇕ full', '⊞ overview', '⊖ hide']


def header(counts, updated, lit=None, focused=False):
    left = [(' Pull requests', 'claude', 'b')]
    for state, n in counts:
        if n:
            left += [('  ', 'text'), (f'{MARKS[state][0].strip()} {n}', MARKS[state][1])]
    left += [('  ', 'text'), (f'updated {updated}', 'faint')]
    buttons = [('[ ◉ focus ]', 'claude'), ('  ', 'text'), ('⊞ overview', 'dim')] if focused else []
    for label in [] if focused else BUTTONS:
        buttons += [(f'[ {label} ]', 'claude', 'b') if label == lit else (label, 'dim'), ('  ', 'text')]
    return right(left, buttons[:-1] + [(' ', 'text')] if not focused else buttons + [(' ', 'text')])


COLUMNS = row(cell([('', 'text')], 3), cell([('SRC', 'faint', 'b')], 4), cell([('PR', 'faint', 'b')], 8), cell([('TASK', 'faint', 'b')], TASK),
              cell([('REPO', 'faint', 'b')], 16), cell([('TITLE', 'faint', 'b')], TITLE), cell([('PHASE', 'faint', 'b')], 9),
              cell([('CHECKS', 'faint', 'b')], CHECKS), cell([('SINCE', 'faint', 'b')], 6))


def ok(name):
    return [('✓ ', 'success'), (name, 'link', 'u')]


def gap():
    return [('  ', 'text')]


def site(deploy_state):
    checks = ok('test') + gap() + ([(SPIN + ' ', 'suggestion'), ('deploy', 'link', 'u')] if deploy_state == 'run' else ok('deploy'))
    return pr_row(deploy_state, 'gh', '#300', '', 'octo-org/webs…', 'docs: new pricing p…', 'merged', checks, '3m')


API = pr_row('ok', 'ado', '!4199', 'TASK-001', 'api', 'feat(billing): pix …', 'merged', ok('CI') + gap() + ok('CD'), '1d')


def billing(state, phase, checks, age):
    return pr_row(state, 'ado', '!4242', 'TASK-002', 'web-app', 'feat(billing): reco…', phase, checks, age)


def note(segs):
    return row(cell([('', 'text')], 15), segs)


def caption(text):
    return [(' ' + text, 'text')]


REVIEWERS = [('◐ ', 'warning'), ('Code-Reviewers', 'text')]
BUILD_RUNNING = [(SPIN + ' ', 'suggestion'), ('build', 'link', 'u')]

def band(counts, updated, rows, lit=None):
    return [header(counts, updated, lit), COLUMNS, *rows]


FLOW = [
    (2.4, [('run', 1), ('ok', 1)], '4s ago', [site('run'), API],
     '$ az repos pr create --title "feat(billing): reconcile pix payments"'),
    (2.4, [('run', 2), ('ok', 1)], '1s ago', [billing('run', 'gate', BUILD_RUNNING + gap() + REVIEWERS, '0s'), site('run'), API],
     'The PR created in the session is watched right away, with its build and reviewers'),
    (3.4, [('fail', 1), ('ok', 2)], '2s ago', [billing('fail', 'gate', [('✗ ', 'error'), ('build', 'link', 'u')] + gap() + REVIEWERS, '2m'),
                                              note([('└ Run Lint: exit code 2 in internal/pix/match.go', 'error'), ('  ', 'text'), ('⌕ investigate', 'dim')]),
                                              site('ok'), API],
     'A failure shows its reason inline; investigate asks Claude to read the log'),
    (2.4, [('run', 1), ('ok', 2)], '1s ago', [billing('run', 'gate', BUILD_RUNNING + gap() + REVIEWERS, '0s'), site('ok'), API],
     'The fix is pushed and the build runs again'),
    (2.4, [('wait', 1), ('ok', 2)], '3s ago', [billing('wait', 'gate', ok('build') + gap() + REVIEWERS, '6m'), site('ok'), API],
     'Build green, waiting on reviewers'),
    (2.4, [('run', 1), ('ok', 2)], '1s ago', [billing('run', 'merged', ok('CI') + gap() + [(SPIN + ' ', 'suggestion'), ('CD', 'link', 'u')], '0s'), site('ok'), API],
     'Approved and merged: the band follows the pipelines of the merge commit'),
    (2.6, [('wait', 1), ('ok', 2)], '2s ago', [billing('wait', 'merged', ok('CI') + gap() + [('◐ ', 'warning'), ('prod', 'link', 'u'), (' (approval)', 'warning')], '4m'), site('ok'), API],
     'A deploy waiting on approval is flagged, never shown as green'),
    (3.6, [('ok', 3)], '1s ago', [billing('ok', 'merged', ok('CI') + gap() + ok('CD'), '9m'),
                                 note([('└ merged and green: ', 'success'), ('[ ✓ mark TASK-002 done ]', 'claude')]), site('ok'), API],
     'Merged and deployed: one click closes the spec task'),
]

LONG_WAIT = [('! 2d', 'warning', 'b')]

BUSY = [
    pr_row('fail', 'ado', '!4256', 'TASK-004', 'web-app', 'feat(pix): webhook e…', 'gate', [('✗ ', 'error'), ('build', 'link', 'u')] + gap() + REVIEWERS, '12m'),
    note([('└ Run Lint: exit code 2 in internal/pix/webhook.go', 'error'), ('  ', 'text'), ('⌕ investigate', 'dim')]),
    pr_row('wait', 'gh', '#298', '', 'octo-org/webs…', 'fix: checkout redir…', 'merged', ok('build') + gap() + [('◐ ', 'warning'), ('prod', 'link', 'u'), (' (approval)', 'warning')], '2h'),
    pr_row('wait', 'ado', '!4130', '', 'api', 'chore: rotate signi…', 'gate', ok('build') + gap() + REVIEWERS, LONG_WAIT),
    pr_row('run', 'ado', '!4261', '', 'api', 'feat: payout limits', 'gate', BUILD_RUNNING + gap() + REVIEWERS, '3m'),
    pr_row('run', 'gh', '#301', '', 'octo-org/webs…', 'docs: faq update', 'merged', ok('test') + gap() + [(SPIN + ' ', 'suggestion'), ('deploy', 'link', 'u')], '1m'),
    pr_row('ok', 'ado', '!4242', 'TASK-002', 'web-app', 'feat(billing): reco…', 'merged', ok('CI') + gap() + ok('CD'), '1h'),
    note([('└ merged and green: ', 'success'), ('[ ✓ mark TASK-002 done ]', 'claude')]),
]
BUSY_COUNTS = [('fail', 1), ('run', 2), ('wait', 2), ('ok', 1)]

FOCUSED = [
    header(BUSY_COUNTS, '8s ago', focused=True),
    pr_row('fail', 'ado', '!4256', 'TASK-004', 'web-app', 'feat(pix): webhook e…', 'gate', [('✗ ', 'error'), ('build', 'link', 'u')], '12m'),
    BUSY[1],
    pr_row('wait', 'gh', '#298', '', 'octo-org/webs…', 'fix: checkout redir…', 'merged', [('◐ ', 'warning'), ('prod', 'link', 'u'), (' (approval)', 'warning')], '2h'),
    pr_row('wait', 'ado', '!4130', '', 'api', 'chore: rotate signi…', 'gate', REVIEWERS, LONG_WAIT),
    pr_row('ok', 'ado', '!4242', 'TASK-002', 'web-app', 'feat(billing): reco…', 'merged', [], '1h'),
    BUSY[7],
    [(' The rest is on track', 'faint'), ('  ', 'text'), (SPIN + ' 2', 'suggestion')],
]

LAST_FLOW = FLOW[-1]

SCENES = [
    *[(duration, band(counts, updated, rows), text) for duration, counts, updated, rows, text in FLOW],
    (1.6, band(LAST_FLOW[1], LAST_FLOW[2], LAST_FLOW[3], lit='⊞ overview'), '⊞ overview opens every PR with its spec plan'),
    (4.0, plans.LINES, 'Each spec links to its tasks and their PRs: ✓ mark done, + watch PR, what waits on what'),
    (2.6, band(BUSY_COUNTS, '8s ago', BUSY, lit='◎ focus'), 'A busy day: six PRs, most of them just running'),
    (4.0, FOCUSED, '◎ focus keeps only what needs you and folds the rest into one line'),
]


def frames():
    return SCENES


ROWS = max(len(lines) for _, lines, _ in SCENES)


def spinners(segs, y, c):
    out, col = [], 0
    for seg in segs:
        for i, ch in enumerate(seg[0]):
            if ch == SPIN:
                for k, glyph in enumerate(SPINNER):
                    out.append(f'<text class="s" style="animation-delay:{k * SPIN_STEP:.2f}s" x="{PADX + (col + i) * CW:.1f}" y="{y}" fill="{c[seg[1]]}">{glyph}</text>')
        col += len(seg[0])
    return out


def svg(theme):
    c = THEMES[theme]
    shots = frames()
    total = sum(d for d, _, _ in shots)
    width = int(PADX * 2 + W * CW)
    band_bottom = TOP + LH * ROWS
    height = int(band_bottom + LH * 2 + 14)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="pr-watch band following a pull request from creation to deploy, then the overview with spec plans and the focus filter">',
           '<style>', f'.f{{opacity:0;animation:{total:.2f}s step-end infinite}}',
           f'.s{{opacity:0;animation:sp {SPIN_STEP * len(SPINNER):.2f}s step-end infinite}}@keyframes sp{{0%{{opacity:1}}{100 / len(SPINNER):.1f}%{{opacity:0}}100%{{opacity:0}}}}']
    start = 0.0
    for i, (duration, _, _) in enumerate(shots):
        a, b = start / total * 100, (start + duration) / total * 100
        keys = f'0%{{opacity:1}}{b:.3f}%{{opacity:0}}' if i == 0 else f'0%{{opacity:0}}{a:.3f}%{{opacity:1}}{b:.3f}%{{opacity:0}}'
        out.append(f'@keyframes k{i}{{{keys}100%{{opacity:0}}}}.f{i}{{animation-name:k{i}}}')
        start += duration
    out += [f'@media (prefers-reduced-motion:reduce){{.f,.s{{animation:none}}.f{len(shots) - 1}{{opacity:1}}}}', '</style>',
            f'<rect width="{width}" height="{height}" rx="10" fill="{c["panel"]}" stroke="{c["border"]}"/>']
    for i, dot in enumerate(['#ff5f57', '#febc2e', '#28c840']):
        out.append(f'<circle cx="{20 + i * 18}" cy="18" r="6" fill="{dot}"/>')
    out.append(f'<line x1="{PADX}" x2="{width - PADX}" y1="{band_bottom + 4}" y2="{band_bottom + 4}" stroke="{c["border"]}"/>')
    out.append(f'<g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="{FS}">')
    for i, (_, lines, text) in enumerate(shots):
        out.append(f'<g class="f f{i}">')
        for li, segs in enumerate(lines):
            out += runs(segs, TOP + LH * li + FS, c) + spinners(segs, TOP + LH * li + FS, c)
        out += runs(caption(text), band_bottom + LH + FS - 4, c)
        out.append('</g>')
    out.append('</g></svg>')
    return '\n'.join(out)


if __name__ == '__main__':
    dest = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
    for theme in THEMES:
        open(f'{dest}/band-animated-{theme}.svg', 'w').write(svg(theme))
