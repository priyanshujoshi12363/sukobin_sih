"""
Fills the official SIH 2026 idea template with Sukobin's content.

The template is authoritative. Its palette, its Times New Roman titles, its blue
footer bar and the SIH marks all stay exactly as they came.

It also asks eleven questions across five slides, in grey text the entrant is
meant to replace. The instructions slide says to use the template "without
changing the idea details pointers", so every one of those pointers is kept
here as a visible heading with its answer underneath - a judge reads the
question and the answer in the same glance:

  slide 2   Detailed explanation of the proposed solution
            How it addresses the problem
            Innovation and uniqueness of the solution
  slide 3   Technologies to be used
            Methodology and process for implementation
  slide 4   Analysis of the feasibility of the idea
            Potential challenges and risks
            Strategies for overcoming these challenges
  slide 5   Potential impact on the target audience
            Benefits of the solution (social, economic, environmental, etc.)
  slide 6   Details / Links of the reference and research work

The template caps the deck at six slides including the title and asks for
points, diagrams and infographics rather than paragraphs. Both are honoured,
and its own instructions slide is deleted, as it says to.

    python ppt/build.py

Output: SIH2026_Sukobin.pptx next to the template. Save it as PDF before
uploading - the portal takes nothing else.
"""

import os
import sys

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TEMPLATE = os.path.join(ROOT, "SIH2026-IDEA-Presentation-Format.pptx")
OUTPUT = os.path.join(ROOT, "SIH2026_Sukobin.pptx")

# ── the things only the team knows ──────────────────────────────────────────
PS_ID = "SIH26-MDoNER-01"
PS_TITLE = "AI-Enabled Logistics Accessibility Intelligence Platform for the North Eastern Region"
THEME = "Transportation & Logistics"
CATEGORY = "Software"
TEAM_ID = "<team id>"
TEAM_NAME = "Sukobin"

# ── palette lifted from the template's own theme ────────────────────────────
NAVY = RGBColor(0x1F, 0x49, 0x7D)
BLUE = RGBColor(0x00, 0x70, 0xC0)
STEEL = RGBColor(0x4F, 0x81, 0xBD)
INK = RGBColor(0x26, 0x2B, 0x33)
MUTED = RGBColor(0x5A, 0x63, 0x6E)
PAPER = RGBColor(0xF2, 0xF5, 0xF9)
RULE = RGBColor(0xC9, 0xD6, 0xE4)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GREEN = RGBColor(0x2E, 0x7D, 0x4F)
AMBER = RGBColor(0xC2, 0x5E, 0x1E)

BODY = "Arial"

TOP = 1.25
BOTTOM = 6.70
LEFT = 0.45
RIGHT = 12.88
FULL = RIGHT - LEFT


# ══ helpers ═════════════════════════════════════════════════════════════════
def shape_named(slide, *starts):
    for sh in slide.shapes:
        if sh.name.startswith(starts):
            return sh
    return None


def drop(shape):
    shape._element.getparent().remove(shape._element)


def delete_slide(prs, index):
    lst = prs.slides._sldIdLst
    items = list(lst)
    rId = items[index].get(
        "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    )
    prs.part.drop_rel(rId)
    lst.remove(items[index])


def textbox(slide, x, y, w, h):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Emu(0)
    tf.margin_top = tf.margin_bottom = Emu(0)
    return tb, tf


def para(tf, text, size=13, bold=False, color=INK, first=False,
         space_before=5, space_after=0, align=PP_ALIGN.LEFT, italic=False,
         font=BODY, line=0.95):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align  # never inherited - a shape default would centre it
    p.space_before = Pt(0 if first else space_before)
    p.space_after = Pt(space_after)
    p.line_spacing = line
    r = p.add_run()
    r.text = text
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.name = font
    r.font.color.rgb = color
    return p


def rich(tf, parts, size=13, first=False, space_before=5, line=0.95,
         align=PP_ALIGN.LEFT):
    """One paragraph, several runs - a bold lead-in then plain text."""
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    p.space_before = Pt(0 if first else space_before)
    p.space_after = Pt(0)
    p.line_spacing = line
    for text, bold, color in parts:
        r = p.add_run()
        r.text = text
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.name = BODY
        r.font.color.rgb = color
    return p


def band(slide, x, y, w, h, fill=PAPER, line=RULE, shape=MSO_SHAPE.ROUNDED_RECTANGLE):
    s = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    s.shadow.inherit = False
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(0.75)
    try:
        s.adjustments[0] = 0.08
    except (IndexError, ValueError):
        pass
    tf = s.text_frame
    tf.word_wrap = True
    # An autoshape centres its text in both axes by default. Every card here
    # holds a list, so the anchor is pinned before anything is written in.
    tf.vertical_anchor = MSO_ANCHOR.TOP
    tf.margin_left = Inches(0.12)
    tf.margin_right = Inches(0.12)
    tf.margin_top = Inches(0.06)
    tf.margin_bottom = Inches(0.06)
    return s


def pointer(slide, x, y, w, text):
    """A question the template asks, kept word for word as a heading."""
    _, tf = textbox(slide, x, y, w, 0.26)
    para(tf, text.upper(), size=10, bold=True, color=BLUE, first=True, line=1.0)
    rule = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(x), Inches(y + 0.205), Inches(w), Inches(0.014)
    )
    rule.fill.solid()
    rule.fill.fore_color.rgb = RULE
    rule.line.fill.background()
    rule.shadow.inherit = False
    return y + 0.32


def label(slide, x, y, w, text, color=NAVY):
    _, tf = textbox(slide, x, y, w, 0.24)
    para(tf, text.upper(), size=9, bold=True, color=color, first=True, line=1.0)
    return y + 0.26


def set_title(slide, text, size=32):
    t = shape_named(slide, "Title")
    if t is None:
        return
    # The placeholder spans the full slide, so a long title slides under the
    # SIH logo top-right and behind the team badge top-left. Keep it between.
    t.left = Inches(1.95)
    t.top = Inches(-0.02)
    t.width = Inches(8.55)
    t.height = Inches(1.15)
    tf = t.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    for r in list(p.runs)[1:]:
        r._r.getparent().remove(r._r)
    if not p.runs:
        p.add_run()
    r = p.runs[0]
    r.text = text
    r.font.size = Pt(size)
    r.font.bold = True
    r.font.name = "Times New Roman"
    r.font.color.rgb = NAVY
    for extra in list(tf.paragraphs)[1:]:
        extra._p.getparent().remove(extra._p)


def set_team_badge(slide):
    o = shape_named(slide, "Oval")
    if o is None:
        return
    tf = o.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    for r in list(p.runs)[1:]:
        r._r.getparent().remove(r._r)
    if not p.runs:
        p.add_run()
    r = p.runs[0]
    r.text = TEAM_NAME
    r.font.size = Pt(11)
    r.font.bold = True
    r.font.name = BODY


def clear_guidance(slide):
    """Remove the grey prompt block; its questions come back as headings."""
    for sh in list(slide.shapes):
        if sh.name.startswith("TextBox") and sh.has_text_frame:
            txt = sh.text_frame.text.strip().lower()
            if txt.startswith((
                "proposed solution", "technologies to be used",
                "analysis of the feasibility", "potential impact",
                "details / links",
            )):
                drop(sh)


# ══ slide 1 - title page ════════════════════════════════════════════════════
def build_title(slide):
    sub_ph = shape_named(slide, "Subtitle")
    if sub_ph is not None:
        sub_ph.top = Inches(1.12)
        sub_ph.height = Inches(1.25)
        stf = sub_ph.text_frame
        stf.clear()
        para(stf, "SUKOBIN", size=30, bold=True, color=NAVY, first=True,
             font="Times New Roman", line=1.0)
        para(stf, "Carriers as the sensor network", size=15, color=MUTED,
             space_before=3, line=1.0)

    tb = shape_named(slide, "TextBox 9")
    if tb is None:
        return
    tf = tb.text_frame
    tf.clear()
    tf.word_wrap = True

    rows = [
        ("Problem Statement ID", PS_ID),
        ("Problem Statement Title", PS_TITLE),
        ("Theme", THEME),
        ("PS Category", CATEGORY),
        ("Team ID", TEAM_ID),
        ("Team Name", TEAM_NAME),
    ]
    for i, (k, v) in enumerate(rows):
        size = 12.5 if k == "Problem Statement Title" else 13.5
        rich(tf, [(k + " – ", True, NAVY), (v, False, INK)],
             size=size, first=(i == 0), space_before=9, line=0.95)


# ══ slide 2 - proposed solution ═════════════════════════════════════════════
def build_idea(slide):
    clear_guidance(slide)
    set_title(slide, "EVERY VEHICLE ON THE ROAD IS A SENSOR", size=25)
    set_team_badge(slide)

    lw = 7.00
    rx = LEFT + lw + 0.30
    rw = RIGHT - rx

    # ── pointer 1 ──
    y = pointer(slide, LEFT, TOP, lw, "Detailed explanation of the proposed solution")
    _, tf = textbox(slide, LEFT, y, lw, 1.45)
    rich(tf, [("Nobody drives for us. ", True, NAVY),
              ("Anyone already travelling A to B enters their vehicle and route, "
               "and is offered only the parcels whose pickup and drop lie along "
               "that road, up to what the vehicle holds. No fleet, no contract, "
               "no empty return leg.", False, INK)],
         size=12, first=True, line=1.02)
    rich(tf, [("Those carriers stream GPS while they drive. ", True, NAVY),
              ("The rolling median of their speed against each road's baseline "
               "is a live accessibility reading, and the weather model turns "
               "that into a 72-hour closure forecast.", False, INK)],
         size=12, space_before=9, line=1.02)
    y += 1.50

    # ── pointer 3 ──
    y = pointer(slide, LEFT, y, lw, "Innovation and uniqueness of the solution")
    card = band(slide, LEFT, y, lw, 1.30)
    tf = card.text_frame
    for i, (lead, rest) in enumerate([
        ("The carrier network IS the sensor network — ",
         "one GPS stream both delivers goods and measures the road."),
        ("Coverage without hardware — ",
         "no roadside sensors, no dedicated fleet, nothing to power or maintain."),
        ("It improves as it is used — ",
         "every new carrier adds sensing density at zero marginal cost."),
    ]):
        rich(tf, [("•  " + lead, True, NAVY), (rest, False, INK)],
             size=11, first=(i == 0), space_before=8, line=1.0)
    y += 1.42

    # ── right: the loop, drawn ──
    yy = label(slide, rx, TOP + 0.06, rw, "One trip, two products")
    steps = [
        ("Driver declares  Dimapur → Imphal", True),
        ("Offered only parcels on that road", False),
        ("Drives — GPS every 20 s / 40 m", False),
        ("Median speed vs baseline → status", True),
        ("Alerts · forecast · re-route · dashboard", False),
    ]
    h, gap = 0.50, 0.16
    for i, (text, strong) in enumerate(steps):
        s = band(slide, rx, yy, rw, h,
                 fill=WHITE if strong else PAPER,
                 line=STEEL if strong else RULE)
        s.line.width = Pt(1.25 if strong else 0.75)
        tf = s.text_frame
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(tf, text, size=11, bold=strong, color=NAVY if strong else INK,
             first=True, align=PP_ALIGN.CENTER, line=0.92)
        yy += h
        if i < len(steps) - 1:
            a = slide.shapes.add_shape(
                MSO_SHAPE.DOWN_ARROW, Inches(rx + rw / 2 - 0.055),
                Inches(yy + 0.02), Inches(0.11), Inches(gap - 0.04))
            a.fill.solid()
            a.fill.fore_color.rgb = STEEL
            a.line.fill.background()
            a.shadow.inherit = False
            yy += gap

    # ── pointer 2, across the full width ──
    y = pointer(slide, LEFT, y, FULL,
                "How it addresses the problem — every clause of the problem statement")
    clauses = [
        ("a", "Real-time accessibility", "42 stretches, 3,567 km, live from driver GPS"),
        ("b", "Disruption prediction", "24 / 48 / 72 h closure risk on every road"),
        ("c", "Alternate routes + delay", "3 alternatives scored, condition-adjusted ETA"),
        ("d", "GPS tracking of essentials", "20 s pings, essential commodities flagged"),
        ("e", "Automated alerts", "blocked road, cut-off region, high-risk corridor"),
        ("f", "Field reporting", "photo + GPS + voice, queued when offline"),
        ("g", "Central dashboard", "district status, bottlenecks, emergency routes"),
        ("h", "Multilingual + offline", "10 languages, sync when the signal returns"),
    ]
    cw = (FULL - 3 * 0.12) / 4
    ch = 0.60
    for i, (letter, title, detail) in enumerate(clauses):
        cx = LEFT + (i % 4) * (cw + 0.12)
        cy = y + (i // 4) * (ch + 0.09)
        b = band(slide, cx, cy, cw, ch)
        tf = b.text_frame
        rich(tf, [("(%s)  " % letter, True, BLUE), (title, True, NAVY)],
             size=10.5, first=True, line=0.95)
        para(tf, detail, size=9, color=MUTED, space_before=2, line=0.95)


# ══ slide 3 - technical approach ════════════════════════════════════════════
def build_technical(slide):
    clear_guidance(slide)
    set_title(slide, "TECHNICAL APPROACH")
    set_team_badge(slide)

    # ── pointer 1 ──
    y = pointer(slide, LEFT, TOP, FULL,
                "Technologies to be used (programming languages, frameworks, hardware)")

    colw = (FULL - 2 * 0.22) / 3
    cols = [
        ("Software stack", [
            ("Backend", "Node.js · Express 5 · MongoDB with 2dsphere indexes · JWT"),
            ("Web", "React · Vite · MapLibre GL for the GIS dashboard"),
            ("Mobile", "Kotlin + XML — four Android apps: customer, merchant, driver, officer"),
            ("Cloud", "Render · MongoDB Atlas · Cloudinary · Firebase push"),
        ]),
        ("AI / ML", [
            ("Model", "Logistic regression, benchmarked against gradient-boosted stumps"),
            ("Features", "18 — antecedent rain, burst intensity, slope, terrain, closure history"),
            ("Trained on", "109,116 road-days of observed weather · 42 stretches x 877 days"),
            ("Scored", "AUC 0.883 · Brier 0.092 · held out after 2026-03-01"),
        ]),
        ("Hardware and external data", [
            ("Hardware", "None to deploy — the driver's own phone is the sensor"),
            ("Weather", "Open-Meteo archive + forecast, hourly"),
            ("Roads", "OSRM geometry and route alternates"),
            ("Transport DB", "VAHAN registration lookup at driver sign-up"),
        ]),
    ]
    for i, (heading, rows) in enumerate(cols):
        x = LEFT + i * (colw + 0.22)
        ly = label(slide, x, y, colw, heading)
        box = band(slide, x, ly, colw, 2.16)
        tf = box.text_frame
        for j, (k, v) in enumerate(rows):
            rich(tf, [(k + "  ", True, NAVY), (v, False, INK)],
                 size=10.5, first=(j == 0), space_before=9, line=1.0)

    # ── pointer 2 ──
    py = pointer(slide, LEFT, y + 2.58, FULL,
                 "Methodology and process for implementation")

    steps = [
        ("GPS ping", "every 20 s / 40 m"),
        ("Map-matched", "to a road ≤ 600 m"),
        ("45-min rolling", "median speed"),
        ("Road status", "OPEN → BLOCKED"),
        ("Alert engine", "10 languages"),
        ("Re-route + ETA", "for the corridor"),
    ]
    n = len(steps)
    aw = 0.28
    sw = (FULL - (n - 1) * aw) / n
    sh = 0.74
    for i, (head, tail) in enumerate(steps):
        x = LEFT + i * (sw + aw)
        strong = i in (0, 3, 5)
        s = band(slide, x, py, sw, sh,
                 fill=WHITE if strong else PAPER,
                 line=STEEL if strong else RULE)
        s.line.width = Pt(1.25 if strong else 0.75)
        tf = s.text_frame
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(tf, head, size=10.5, bold=True, color=NAVY, first=True,
             align=PP_ALIGN.CENTER, line=0.95)
        para(tf, tail, size=9, color=MUTED, align=PP_ALIGN.CENTER,
             space_before=1, line=0.95)
        if i < n - 1:
            a = slide.shapes.add_shape(
                MSO_SHAPE.RIGHT_ARROW, Inches(x + sw + 0.05),
                Inches(py + sh / 2 - 0.05), Inches(aw - 0.10), Inches(0.10))
            a.fill.solid()
            a.fill.fore_color.rgb = STEEL
            a.line.fill.background()
            a.shadow.inherit = False

    ny = py + sh + 0.22
    b = band(slide, LEFT, ny, FULL, 0.86, fill=WHITE, line=STEEL)
    b.line.width = Pt(1.25)
    tf = b.text_frame
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    rich(tf, [("Working prototype  ", True, NAVY),
              ("— four Android apps, the control dashboard and the backend are "
               "built and running against live data.  ", False, INK),
              ("Trust rule:  ", True, NAVY),
              ("a status needs at least 4 samples from at least 2 distinct "
               "vehicles, and a driver's report is capped at RESTRICTED until an "
               "officer confirms it, so one parked vehicle can never close a "
               "highway.", False, INK)],
         size=11, first=True, line=1.02)


# ══ slide 4 - feasibility and viability ═════════════════════════════════════
def build_feasibility(slide):
    clear_guidance(slide)
    set_title(slide, "FEASIBILITY AND VIABILITY")
    set_team_badge(slide)

    lw = 4.75
    rx = LEFT + lw + 0.32
    rw = RIGHT - rx
    chw = 2.72                      # challenge column
    stw = rw - chw - 0.14           # strategy column

    # ── pointer 1 ──
    y = pointer(slide, LEFT, TOP, lw, "Analysis of the feasibility of the idea")
    card = band(slide, LEFT, y, lw, 2.70)
    tf = card.text_frame
    for i, (n, what) in enumerate([
        ("42 stretches · 3,567 km", "real OSRM geometry, 12 corridors, 82 districts, 8 states"),
        ("4 Android apps + dashboard", "customer, merchant, driver, officer, control room"),
        ("195 / 195", "backend tests passing across 10 suites"),
        ("10 languages · 8,424 units", "every screen, zero English fallbacks"),
        ("100 % coverage", "status, live vehicle data and forecast on every road"),
    ]):
        rich(tf, [(n + "  ", True, BLUE), (what, False, INK)],
             size=11, first=(i == 0), space_before=11, line=1.0)

    ny = label(slide, LEFT, y + 2.84, lw,
               "Viable because scaling costs almost nothing")
    _, tf = textbox(slide, LEFT, ny, lw, 1.6)
    for i, t in enumerate([
        "No hardware to buy, install, power or maintain.",
        "A new district needs its road geometry seeded — hours, not procurement.",
        "Sensing density rises with adoption, at no extra cost per reading.",
        "Runs on managed cloud services already in use.",
    ]):
        rich(tf, [("•  ", True, STEEL), (t, False, INK)],
             size=11, first=(i == 0), space_before=9, line=1.0)

    # ── pointers 2 and 3, side by side so each risk faces its answer ──
    pointer(slide, rx, TOP, chw, "Potential challenges and risks")
    pointer(slide, rx + chw + 0.14, TOP, stw,
            "Strategies for overcoming these challenges")

    rows = [
        ("No public register of past road closures",
         "Labels drawn from a rainfall-threshold hazard function; verified field "
         "reports override them, and the dashboard states this openly."),
        ("One parked driver could read as a closure",
         "A status needs ≥ 4 samples from ≥ 2 distinct vehicles, else the "
         "reading is discarded and the road keeps its previous status."),
        ("Hill districts drop off the network",
         "Reports queue on the phone under a client ID and sync later; the "
         "server rejects duplicates, so nothing is filed twice."),
        ("Officers and drivers do not share a language",
         "Ten languages including Khasi, Mizo, Nagamese and Kokborok — spoken "
         "aloud as well as written, so literacy is not a barrier."),
        ("A quiet road has no vehicles to sense it",
         "The weather model forecasts every road regardless of traffic, and the "
         "dashboard shows honestly what is sensed and what is not."),
    ]
    yy = TOP + 0.32
    rh = 0.86
    for i, (risk, fix) in enumerate(rows):
        shade = PAPER if i % 2 else WHITE
        a = band(slide, rx, yy, chw, rh, fill=shade)
        a.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(a.text_frame, risk, size=10.5, bold=True, color=AMBER,
             first=True, line=0.98)

        b = band(slide, rx + chw + 0.14, yy, stw, rh, fill=shade)
        b.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(b.text_frame, fix, size=10, color=INK, first=True, line=1.0)

        arrow = slide.shapes.add_shape(
            MSO_SHAPE.RIGHT_ARROW, Inches(rx + chw + 0.025),
            Inches(yy + rh / 2 - 0.045), Inches(0.09), Inches(0.09))
        arrow.fill.solid()
        arrow.fill.fore_color.rgb = STEEL
        arrow.line.fill.background()
        arrow.shadow.inherit = False

        yy += rh + 0.09


# ══ slide 5 - impact and benefits ═══════════════════════════════════════════
def build_impact(slide):
    clear_guidance(slide)
    set_title(slide, "IMPACT AND BENEFITS")
    set_team_badge(slide)

    # ── pointer 1 ──
    y = pointer(slide, LEFT, TOP, FULL, "Potential impact on the target audience")
    who = [
        ("District administration",
         "A lifeline corridor's closure risk 72 hours out, ranked by how many "
         "people lose their only road."),
        ("Field officers",
         "One screen: weak points ranked with the reason each scored, and a "
         "queue of reports to confirm."),
        ("Drivers and small operators",
         "Income from a journey already being made — no fleet, no contract, "
         "no empty return leg."),
        ("People in remote blocks",
         "Medicines, rations and produce arrive — and an alert in the language "
         "spoken at home when they will not."),
    ]
    cw = (FULL - 3 * 0.18) / 4
    for i, (title, text) in enumerate(who):
        x = LEFT + i * (cw + 0.18)
        b = band(slide, x, y, cw, 1.42)
        tf = b.text_frame
        para(tf, title, size=11.5, bold=True, color=NAVY, first=True, line=0.95)
        para(tf, text, size=10.5, color=INK, space_before=4, line=0.98)

    # ── pointer 2 ──
    by = pointer(slide, LEFT, y + 1.58, FULL,
                 "Benefits of the solution (social, economic, environmental, etc.)")
    kinds = [
        ("Social", GREEN,
         "8 states · 82 districts. Alerts and voice reporting in 10 languages, "
         "four of which have almost no other software support."),
        ("Economic", BLUE,
         "No dedicated fleet, so moving one more parcel costs close to nothing. "
         "Spare capacity in vehicles already on the road becomes income."),
        ("Environmental", GREEN,
         "Fewer dedicated trips — a parcel rides in a vehicle that was making "
         "the journey anyway, instead of a second one setting out."),
        ("Governance", STEEL,
         "Every incident carries a photo, a GPS fix, a timestamp and the officer "
         "who confirmed it — an evidence trail, not a phone call."),
    ]
    kh = 0.70
    for i, (kind, colour, text) in enumerate(kinds):
        yy = by + i * (kh + 0.09)
        chip = band(slide, LEFT, yy, 1.58, kh, fill=colour, line=None)
        chip.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(chip.text_frame, kind, size=12, bold=True, color=WHITE, first=True,
             align=PP_ALIGN.CENTER)
        b = band(slide, LEFT + 1.70, yy, FULL - 1.70, kh)
        b.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(b.text_frame, text, size=11, color=INK, first=True, line=1.0)


# ══ slide 6 - research and references ═══════════════════════════════════════
def build_research(slide):
    clear_guidance(slide)
    set_title(slide, "RESEARCH AND REFERENCES")
    set_team_badge(slide)

    y = pointer(slide, LEFT, TOP, FULL,
                "Details / Links of the reference and research work")

    colw = (FULL - 0.24) / 2
    groups = [
        ("Data sources the platform runs on", [
            ("Open-Meteo Historical Weather API",
             "open-meteo.com/en/docs/historical-weather-api — observed hourly "
             "rainfall, snowfall and temperature; the model's training set"),
            ("OSRM — Open Source Routing Machine",
             "project-osrm.org — road geometry and route alternates, 42 stretches"),
            ("VAHAN / Parivahan registration lookup",
             "parivahan.gov.in — vehicle class and capacity at driver sign-up"),
            ("MapLibre GL JS + Esri Dark Gray Canvas",
             "maplibre.org — the GIS layer of the control dashboard"),
        ]),
        ("Problem and domain research", [
            ("MDoNER — problem statement and regional context",
             "mdoner.gov.in — NER connectivity gaps and infrastructure priorities"),
            ("NHIDCL / MoRTH national highway network",
             "nhidcl.com · morth.nic.in — corridor alignments and NH numbering "
             "used to seed the road network"),
            ("IMD rainfall climatology for the North East",
             "mausam.imd.gov.in — monsoon windows and the rain thresholds "
             "behind the hazard function"),
            ("GSI landslide susceptibility mapping",
             "gsi.gov.in — which stretches are treated as landslide-prone"),
        ]),
    ]
    for i, (heading, rows) in enumerate(groups):
        x = LEFT + i * (colw + 0.24)
        ly = label(slide, x, y, colw, heading)
        box = band(slide, x, ly, colw, 3.30)
        tf = box.text_frame
        for j, (title, detail) in enumerate(rows):
            para(tf, title, size=11, bold=True, color=NAVY,
                 first=(j == 0), space_before=22, line=0.95)
            para(tf, detail, size=9.5, color=MUTED, space_before=2, line=0.95)

    ny = y + 3.70
    b = band(slide, LEFT, ny, FULL, 0.92, fill=WHITE, line=STEEL)
    b.line.width = Pt(1.25)
    tf = b.text_frame
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    rich(tf, [("Honest note on the model  ", True, NAVY),
              ("— no public register of past NER road closures exists, so "
               "historical labels are drawn from a rainfall-threshold hazard "
               "function calibrated on IMD and GSI data. Verified field reports "
               "override every drawn label, and the dashboard says so on screen.",
               False, INK)],
         size=10.5, first=True, line=1.02)


# ══ main ════════════════════════════════════════════════════════════════════
def main():
    if not os.path.exists(TEMPLATE):
        sys.exit("template missing: %s" % TEMPLATE)

    prs = Presentation(TEMPLATE)
    slides = list(prs.slides)

    build_title(slides[0])
    build_idea(slides[1])
    build_technical(slides[2])
    build_feasibility(slides[3])
    build_impact(slides[4])
    build_research(slides[5])

    # The template's own last slide says to delete it before uploading.
    delete_slide(prs, 6)
    prs.save(OUTPUT)

    print("\nwrote %s  —  %d slides"
          % (os.path.relpath(OUTPUT, ROOT), len(Presentation(OUTPUT).slides)))
    print("all 11 template pointers answered under their own heading")
    if "<" in TEAM_ID:
        print("\nstill to fill in ppt/build.py:  TEAM_ID")
    print("Save as PDF before uploading - the portal accepts nothing else.\n")


if __name__ == "__main__":
    main()
