import os
import sys

sys.dont_write_bytecode = True

from render import CW, FS, LH, PADX, THEMES, TOP, cell, row, runs

W = 104
BLANK = [('', 'text')]
TASK_MARKS = {'Done': ('✓', 'success'), 'In Review': ('◐', 'warning'), 'In Progress': ('●', 'suggestion'), 'Todo': ('○', 'faint')}


def task_row(status, task, title, pr=None, phase=None, extra=None):
    icon, color = TASK_MARKS[status]
    pr_segs = [(pr, 'link', 'u'), (f' · {phase}', 'faint')] if pr else []
    return row(cell(BLANK, 3), cell([(icon, color)], 2), cell([(task, 'link', 'u')], 10), cell([(status, color)], 13),
               cell([(title, 'faint')], 33), cell(pr_segs, 17), extra or [])


LINES = [
    row([(' PR overview', 'claude', 'b'), ('  ', 'text'), ('[ all ]', 'claude'), ('  ', 'text'), ('this session (3)', 'dim')],
        [(' ' * 30, 'text'), ('esc to close', 'faint')]),
    BLANK,
    [(' 3 PRs', 'text'), ('  ', 'text'), ('✓ 3 merged', 'success')],
    BLANK,
    [(' PLANS', 'faint', 'b')],
    [(' ', 'text'), ('PRD-20261007-pix-reconciliation', 'link', 'bu'), ('  ', 'text'), ('Pix reconciliation', 'text'), ('  ', 'text'),
     ('1/5 done · In Progress · implement', 'faint')],
    task_row('Done', 'TASK-001', 'Domain model and match rules', '!4199', 'merged'),
    task_row('In Review', 'TASK-002', 'Reconciliation client', '!4242', 'merged', [('[ ✓ mark done ]', 'claude')]),
    task_row('In Review', 'TASK-003', 'Retry queue and worker', extra=[('+ watch PR', 'dim')]),
    task_row('In Progress', 'TASK-004', 'Webhook endpoint'),
    task_row('Todo', 'TASK-005', 'Integration tests and docs', extra=[('(after TASK-003, TASK-004)', 'faint')]),
]


def svg(theme):
    c = THEMES[theme]
    width = int(PADX * 2 + W * CW)
    height = int(TOP + LH * len(LINES) + 16)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="pr-watch overview with the PLANS section: a spec with its tasks, their status, linked pull requests and a mark done button">',
           f'<rect width="{width}" height="{height}" rx="10" fill="{c["panel"]}" stroke="{c["border"]}"/>']
    for i, dot in enumerate(['#ff5f57', '#febc2e', '#28c840']):
        out.append(f'<circle cx="{20 + i * 18}" cy="18" r="6" fill="{dot}"/>')
    out.append(f'<g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="{FS}">')
    for li, segs in enumerate(LINES):
        out += runs(segs, TOP + LH * li + FS, c)
    out.append('</g></svg>')
    return '\n'.join(out)


if __name__ == '__main__':
    dest = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
    for theme in THEMES:
        open(f'{dest}/plans-{theme}.svg', 'w').write(svg(theme))
