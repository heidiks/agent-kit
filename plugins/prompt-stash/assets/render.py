import os
import sys
from xml.sax.saxutils import escape

THEMES = {
    'dark': dict(panel='#161b22', border='#30363d', text='#e6edf3', faint='#7d8590', dim='#6e7681',
                 warning='#ffc107', claude='#d77757', error='#ff6b80'),
    'light': dict(panel='#f6f8fa', border='#d0d7de', text='#1f2328', faint='#59636e', dim='#6e7781',
                  warning='#9a6700', claude='#c4562e', error='#cf222e'),
}

CW, LH, FS = 8.4, 21, 14
PADX, TOP = 18, 38
BLANK = [('', 'text')]


def right(width, left, rightsegs):
    n = sum(len(t) for t, *_ in left) + sum(len(t) for t, *_ in rightsegs)
    return left + [(' ' * max(1, width - n), 'text')] + rightsegs


def runs(segs, y, c):
    out, col = [], 0
    for seg in segs:
        text, color = seg[0], seg[1]
        style = seg[2] if len(seg) > 2 else ''
        word, start = '', 0
        for i, ch in enumerate(text + ' '):
            if ch != ' ' and not word:
                start = col + i
            if ch != ' ':
                word += ch
                continue
            if word:
                xs = ' '.join(f'{PADX + (start + k) * CW:.1f}' for k in range(len(word)))
                attrs = f'x="{xs}" y="{y}" fill="{c[color]}"'
                if 'b' in style:
                    attrs += ' font-weight="700"'
                if 'u' in style:
                    attrs += ' text-decoration="underline"'
                out.append(f'<text {attrs}>{escape(word)}</text>')
                word = ''
        col += len(text)
    return out


BAND_W = 96
BAND = [
    [('⏺ ', 'text'), ('Retry now backs off exponentially; the flaky test passes 20 runs in a row.', 'text')],
    BLANK,
    right(BAND_W, [('✎ 2 stashed', 'dim'), ('  ', 'text'), ('⊕ stash draft', 'dim'), ('  ', 'text'), ('≡ list', 'claude', 'u')], [('[-]', 'dim')]),
    right(BAND_W, BLANK, [('› stashed', 'faint')]),
    [('─' * BAND_W, 'border')],
    [('❯ ', 'text'), ('also log the attempt count on each retry', 'text')],
    [('─' * BAND_W, 'border')],
    [('  ', 'text'), ('⏵⏵ auto mode on', 'warning'), (' (shift+tab to cycle)', 'faint')],
]

LIST_W = 84


def item(text, age, project):
    return [(' ', 'text'), (text, 'text'), (' ', 'text'), (f'{age} · {project}', 'dim'), (' ', 'text'), ('×', 'dim')]


LIST = [
    right(LIST_W, [(' Stashed prompts (3)', 'text', 'b')], [('✕', 'dim')]),
    [(' ', 'text'), ('[ this project ]', 'claude'), (' ', 'text'), ('all projects', 'text'), (' ', 'text'), ('clear', 'text')],
    item('rename the billing events before the migration …', '12m', 'api'),
    item('ask about the retry budget for the webhook', '2h', 'api'),
    item('check why /deploy skips the canary', '1d', 'api'),
]


def svg(theme, lines, width_cols, label):
    c = THEMES[theme]
    width = int(PADX * 2 + width_cols * CW)
    height = int(TOP + LH * len(lines) + 16)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="{escape(label)}">',
           f'<rect width="{width}" height="{height}" rx="10" fill="{c["panel"]}" stroke="{c["border"]}"/>']
    for i, dot in enumerate(['#ff5f57', '#febc2e', '#28c840']):
        out.append(f'<circle cx="{20 + i * 18}" cy="18" r="6" fill="{dot}"/>')
    out.append(f'<g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="{FS}">')
    for li, segs in enumerate(lines):
        out += runs(segs, TOP + LH * li + FS, c)
    out.append('</g></svg>')
    return '\n'.join(out) + '\n'


IMAGES = {
    'band': (BAND, BAND_W, 'prompt-stash band above the Claude Code prompt: 2 stashed, stash draft and list buttons, list under the pointer'),
    'list': (LIST, LIST_W, 'prompt-stash list: this project filter, three stashed drafts with age and project, a remove mark on each'),
}

if __name__ == '__main__':
    dest = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__))
    for name, (lines, cols, label) in IMAGES.items():
        for theme in THEMES:
            with open(f'{dest}/{name}-{theme}.svg', 'w') as f:
                f.write(svg(theme, lines, cols, label))
