import os
import sys
from xml.sax.saxutils import escape

THEMES = {
    'dark': dict(bg='#0d1117', panel='#161b22', border='#30363d', text='#e6edf3', faint='#7d8590', dim='#6e7681',
                 success='#4eba65', error='#ff6b80', warning='#ffc107', suggestion='#b1b9f9', merged='#af87ff', claude='#d77757', link='#79c0ff'),
    'light': dict(bg='#ffffff', panel='#f6f8fa', border='#d0d7de', text='#1f2328', faint='#59636e', dim='#6e7781',
                  success='#1a7f37', error='#cf222e', warning='#9a6700', suggestion='#5769f7', merged='#8250df', claude='#c4562e', link='#0969da'),
}

W = 102

def pad(segs, width):
    n = sum(len(t) for t, *_ in segs)
    return segs + [(' ' * max(0, width - n), 'text')]

def right(left, rightsegs):
    n = sum(len(t) for t, *_ in left) + sum(len(t) for t, *_ in rightsegs)
    return left + [(' ' * max(1, W - n), 'text')] + rightsegs

def cell(segs, width):
    return pad(segs, width)

def row(*cells):
    out = []
    for c in cells:
        out += c
    return out

LINES = [
    right([(' Pull requests', 'claude', 'b'), ('  ', 'text'), ('✗ 1', 'error'), ('  ', 'text'), ('⠹ 1', 'suggestion'), ('  ', 'text'), ('◐ 1', 'warning'), ('  ', 'text'), ('✓ 1', 'success'), ('  ', 'text'), ('updated 12s ago', 'faint')],
          [('▤ table', 'dim'), ('  ', 'text'), ('▴ collapse', 'dim'), ('  ', 'text'), ('⊖ hide', 'dim'), (' ', 'text')]),
    row(cell([('', 'text')], 3), cell([('SRC', 'faint', 'b')], 4), cell([('PR', 'faint', 'b')], 8), cell([('REPO', 'faint', 'b')], 18), cell([('PHASE', 'faint', 'b')], 9),
        cell([('CHECKS', 'faint', 'b')], 38), cell([('SINCE', 'faint', 'b')], 6)),
    row(cell([(' ✗', 'error')], 3), cell([('ado', 'faint')], 4), cell([('!4242', 'link', 'bu')], 8), cell([('web-app', 'faint')], 18), cell([('gate', 'suggestion')], 9),
        cell([('✗ ', 'error'), ('build', 'link', 'u'), ('  ', 'text'), ('◐ ', 'warning'), ('Code-Reviewers', 'text')], 38), cell([('40m', 'faint')], 6), [('[ ↗ open ]', 'claude'), (' ', 'text'), ('×', 'dim')]),
    row(cell([('', 'text')], 15), cell([('└ Run Lint: Bash exited with code \'2\'.', 'error')], 42), [('⌕ investigate', 'dim')]),
    row(cell([(' ⠹', 'suggestion')], 3), cell([('gh', 'faint')], 4), cell([('#300', 'link', 'bu')], 8), cell([('octo-org/website', 'faint')], 18), cell([('merged', 'merged')], 9),
        cell([('✓ ', 'success'), ('test', 'link', 'u'), ('  ', 'text'), ('⠹ ', 'suggestion'), ('deploy', 'link', 'u')], 38), cell([('3m', 'faint')], 6), [('[ ↗ open ]', 'claude'), (' ', 'text'), ('×', 'dim')]),
    row(cell([(' ◐', 'warning')], 3), cell([('gh', 'faint')], 4), cell([('#298', 'link', 'bu')], 8), cell([('octo-org/website', 'faint')], 18), cell([('merged', 'merged')], 9),
        cell([('✓ ', 'success'), ('build', 'link', 'u'), ('  ', 'text'), ('◐ ', 'warning'), ('prod', 'link', 'u'), (' (awaiting approval)', 'warning')], 38), cell([('2h', 'faint')], 6), [('[ ↗ open ]', 'claude'), (' ', 'text'), ('×', 'dim')]),
    row(cell([(' ✓', 'success')], 3), cell([('ado', 'faint')], 4), cell([('!4199', 'link', 'bu')], 8), cell([('api', 'faint')], 18), cell([('merged', 'merged')], 9),
        cell([('✓ ', 'success'), ('CI', 'link', 'u'), ('  ', 'text'), ('✓ ', 'success'), ('CD', 'link', 'u')], 38), cell([('1d', 'faint')], 6), [('remove? ', 'error'), ('yes', 'text'), (' ', 'text'), ('no', 'text')]),
]

CW, LH, FS = 8.4, 21, 14
PADX, TOP = 18, 38

def svg(theme):
    c = THEMES[theme]
    width = int(PADX * 2 + W * CW)
    height = int(TOP + LH * len(LINES) + 16)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="pr-watch band in the Claude Code terminal">',
           f'<rect width="{width}" height="{height}" rx="10" fill="{c["panel"]}" stroke="{c["border"]}"/>']
    for i, dot in enumerate(['#ff5f57', '#febc2e', '#28c840']):
        out.append(f'<circle cx="{20 + i * 18}" cy="18" r="6" fill="{dot}"/>')
    out.append(f'<g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="{FS}">')
    for li, segs in enumerate(LINES):
        y = TOP + LH * li + FS
        col = 0
        for seg in segs:
            text, color = seg[0], seg[1]
            style = seg[2] if len(seg) > 2 else ''
            for ch in text:
                if ch != ' ':
                    attrs = f'x="{PADX + col * CW:.1f}" y="{y}" fill="{c[color]}"'
                    if 'b' in style:
                        attrs += ' font-weight="700"'
                    if 'u' in style:
                        attrs += ' text-decoration="underline"'
                    out.append(f'<text {attrs}>{escape(ch)}</text>')
                col += 1
    out.append('</g></svg>')
    return '\n'.join(out)

dest = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
for theme in THEMES:
    open(f'{dest}/band-{theme}.svg', 'w').write(svg(theme))
