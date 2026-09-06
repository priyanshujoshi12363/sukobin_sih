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
PS_ID = "26002"
PS_TITLE = "AI-Enabled Logistics Accessibility Intelligence Platform for the North Eastern Region"
ORG = "Ministry of Development of North Eastern Region (MDoNER)"
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
        sub_ph.top = Inches(1.10)
        sub_ph.height = Inches(1.30)
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
        ("Organization", ORG),
        ("Theme", THEME),
        ("PS Category", CATEGORY),
        ("Team ID", TEAM_ID),
        ("Team Name", TEAM_NAME),
    ]
    for i, (k, v) in enumerate(rows):
        size = 11.5 if len(v) > 60 else 12.5
        rich(tf, [(k + " – ", True, NAVY), (v, False, INK)],
             size=size, first=(i == 0), space_before=8, line=0.95)


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
    _, tf = textbox(slide, LEFT, y, lw, 1.30)
    rich(tf, [("Nobody drives for us. ", True, NAVY),
              ("A driver declares a journey they were making anyway, and is offered "
               "only the consignments lying along that road, within capacity. "
               "Instead of costly roadside sensors, vehicles already travelling the "
               "region become mobile road probes.", False, INK)],
         size=10.5, first=True, line=1.0)
    rich(tf, [("Their movement is the measurement. ", True, NAVY),
              ("Median speed against each road's baseline gives live accessibility; "
               "AI turns it into risk scores, 72-hour forecasts, alerts and "
               "alternate routes.", False, INK)],
         size=10.5, space_before=7, line=1.0)
    y += 1.38

    # ── pointer 3 ──
    y = pointer(slide, LEFT, y, lw, "Innovation and uniqueness of the solution")
    novel = [
        ("Carriers ARE the sensors",
         "one journey delivers goods and reads the road"),
        ("No hardware, no fleet",
         "nothing to install, power or maintain"),
        ("Voice reporting, 10 languages",
         "speak it; the model classifies and reads it back"),
        ("Offline-first field reports",
         "queue on the phone, sync later, never filed twice"),
        ("Explainable forecasts",
         "every number decomposes into the feature that drove it"),
        ("A trust ladder",
         "an unverified report can slow a road, never close one"),
        ("Photo + GPS evidence",
         "every incident carries proof, not a phone call"),
        ("It admits what it cannot see",
         "coverage is published, so grey never looks like broken"),
    ]
    nw = (lw - 0.14) / 2
    nh = 0.40
    for i, (title, detail) in enumerate(novel):
        nx = LEFT + (i % 2) * (nw + 0.14)
        ny = y + (i // 2) * (nh + 0.06)
        b = band(slide, nx, ny, nw, nh)
        tf = b.text_frame
        tf.margin_top = Inches(0.03)
        tf.margin_bottom = Inches(0.03)
        para(tf, title, size=9, bold=True, color=NAVY, first=True, line=0.92)
        para(tf, detail, size=7.5, color=MUTED, space_before=1, line=0.92)
    y += 4 * (nh + 0.06) + 0.10

    # ── right: how it addresses the problem, drawn ──
    yy = label(slide, rx, TOP + 0.30, rw, "One trip, two products")
    steps = [
        ("Driver declares  Dimapur \u2192 Imphal", True),
        ("Offered only consignments on that road", False),
        ("Drives \u2014 GPS every 20 s / 40 m", False),
        ("Median speed vs baseline \u2192 road status", True),
        ("Alerts \u00b7 forecast \u00b7 re-route \u00b7 dashboard", False),
    ]
    h, gap = 0.52, 0.17
    for i, (text, strong) in enumerate(steps):
        sp = band(slide, rx, yy, rw, h,
                  fill=WHITE if strong else PAPER,
                  line=STEEL if strong else RULE)
        sp.line.width = Pt(1.25 if strong else 0.75)
        tf = sp.text_frame
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(tf, text, size=10.5, bold=strong, color=NAVY if strong else INK,
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
                "How it addresses the problem \u2014 every clause of the problem statement")
    clauses = [
        ("a", "Road & bridge accessibility", "42 stretches, 3,567 km, 82 districts, live from GPS"),
        ("b", "Disruption prediction", "24 / 48 / 72 h closure risk on every road"),
        ("c", "Alternate routes + delay", "3 alternatives scored, condition-adjusted ETA"),
        ("d", "GPS tracking of essentials", "medicines, food, produce, construction material"),
        ("e", "Automated alerts", "blocked road, cut-off region, high-risk corridor"),
        ("f", "Field reporting", "photo + GPS + voice, queued when offline"),
        ("g", "Central dashboard", "district status, bottlenecks, emergency routes"),
        ("h", "Multilingual + offline", "10 languages, sync when the signal returns"),
    ]
    cw = (FULL - 3 * 0.12) / 4
    ch = 0.55
    for i, (letter, title, detail) in enumerate(clauses):
        cx = LEFT + (i % 4) * (cw + 0.12)
        cy = y + (i // 4) * (ch + 0.08)
        b = band(slide, cx, cy, cw, ch)
        tf = b.text_frame
        rich(tf, [("(%s)  " % letter, True, BLUE), (title, True, NAVY)],
             size=10, first=True, line=0.95)
        para(tf, detail, size=8.5, color=MUTED, space_before=2, line=0.95)


# ══ slide 3 - technical approach ════════════════════════════════════════════
def build_technical(slide):
    clear_guidance(slide)
    set_title(slide, "TECHNICAL APPROACH")
    set_team_badge(slide)

    # ── pointer 1 ──
    y = pointer(slide, LEFT, TOP, FULL,
                "Technologies to be used (programming languages, frameworks, hardware)")

    colw = (FULL - 2 * 0.20) / 3
    cols = [
        ("Software stack", [
            ("Mobile", "Kotlin + XML \u2014 4 Android apps: customer, merchant, partner, officer"),
            ("Web", "React \u00b7 Vite \u00b7 MapLibre GL dashboard"),
            ("Backend", "Node.js \u00b7 Express 5 \u00b7 MongoDB 2dsphere \u00b7 JWT"),
            ("Cloud", "Render \u00b7 Atlas \u00b7 Cloudinary \u00b7 FCM"),
        ]),
        ("AI / ML and data", [
            ("Model", "Logistic regression vs gradient-boosted stumps, 18 features"),
            ("Trained on", "109,116 road-days \u00b7 AUC 0.883 \u00b7 Brier 0.092"),
            ("Weather", "Open-Meteo archive + forecast, hourly"),
            ("Roads", "OSRM geometry and route alternates \u00b7 VAHAN lookup"),
        ]),
        ("Platform components", [
            ("Hardware", "None \u2014 the driver's own phone is the sensor"),
            ("Engines", "Route prediction \u00b7 GIS monitoring \u00b7 GPS tracking \u00b7 alerts"),
            ("Field layer", "Photo, GPS and voice reporting in 10 languages"),
            ("Resilience", "Offline queue, cloud storage, secure token auth"),
        ]),
    ]
    for i, (heading, rows) in enumerate(cols):
        x = LEFT + i * (colw + 0.20)
        ly = label(slide, x, y, colw, heading)
        box = band(slide, x, ly, colw, 1.66)
        tf = box.text_frame
        for j, (k, v) in enumerate(rows):
            rich(tf, [(k + "  ", True, NAVY), (v, False, INK)],
                 size=9.5, first=(j == 0), space_before=7, line=0.98)

    # ── pointer 2: the diagram, then the algorithms behind it ──
    py = pointer(slide, LEFT, y + 2.00, FULL,
                 "Methodology and process for implementation")

    steps = [
        ("Declare route", "driver states A \u2192 B"),
        ("Match corridor", "consignments on that road"),
        ("Stream GPS", "every 20 s / 40 m"),
        ("Map-match", "to a road \u2264 600 m"),
        ("Resolve status", "median speed vs baseline"),
        ("Alert + re-route", "and forecast 72 h"),
    ]
    n = len(steps)
    aw = 0.26
    sw = (FULL - (n - 1) * aw) / n
    sh = 0.62
    for i, (head_t, tail_t) in enumerate(steps):
        x = LEFT + i * (sw + aw)
        strong = i in (0, 4, 5)
        sp = band(slide, x, py, sw, sh,
                  fill=WHITE if strong else PAPER,
                  line=STEEL if strong else RULE)
        sp.line.width = Pt(1.25 if strong else 0.75)
        tf = sp.text_frame
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(tf, head_t, size=9.5, bold=True, color=NAVY, first=True,
             align=PP_ALIGN.CENTER, line=0.95)
        para(tf, tail_t, size=8, color=MUTED, align=PP_ALIGN.CENTER,
             space_before=1, line=0.95)
        if i < n - 1:
            a = slide.shapes.add_shape(
                MSO_SHAPE.RIGHT_ARROW, Inches(x + sw + 0.045),
                Inches(py + sh / 2 - 0.045), Inches(aw - 0.09), Inches(0.09))
            a.fill.solid()
            a.fill.fore_color.rgb = STEEL
            a.line.fill.background()
            a.shadow.inherit = False

    # ── the two algorithms, side by side ──
    ay = py + sh + 0.16
    half = (FULL - 0.24) / 2

    aly = label(slide, LEFT, ay, half, "Algorithm 1 \u2014 corridor matching")
    a1 = band(slide, LEFT, aly, half, 1.62)
    tf = a1.text_frame
    for j, t in enumerate([
        "1  Coarse fetch \u2014 bounding box around the route polyline",
        "2  Corridor \u2014 pickup and drop \u2264 10 km off the line, or inside the endpoint city",
        "3  Detour cap \u2014 mid-route deviation \u2264 24 km, else rejected",
        "4  Direction \u2014 driver \u2192 pickup \u2192 drop, projected along the line",
        "5  Score, then sequence stops by position so the route never doubles back",
    ]):
        para(tf, t, size=9, color=INK, first=(j == 0), space_before=5, line=0.95)
    rich(tf, [("score = 1.0 \u00d7 fee  \u2212  8.0 \u00d7 offRouteKm  \u2212  0.15 \u00d7 ageMinutes",
               True, BLUE)], size=9.5, space_before=7, line=1.0,
         align=PP_ALIGN.CENTER)

    a2y = label(slide, LEFT + half + 0.24, ay, half,
                "Algorithm 2 \u2014 probe sensing")
    a2 = band(slide, LEFT + half + 0.24, a2y, half, 1.62)
    tf = a2.text_frame
    para(tf, "45-minute rolling median of vehicle speed \u00f7 the road's own baseline:",
         size=9, color=INK, first=True, line=0.95)
    for j, (r, st, col) in enumerate([
        ("\u2264 0.15", "BLOCKED", AMBER),
        ("\u2264 0.35", "RESTRICTED", AMBER),
        ("\u2264 0.60", "SLOW", MUTED),
        ("> 0.60", "OPEN", GREEN),
    ]):
        rich(tf, [(r.ljust(8), True, NAVY), ("  \u2192  ", False, MUTED), (st, True, col)],
             size=9, space_before=4, line=0.95)
    rich(tf, [("Trust rule \u2014 ", True, NAVY),
              ("\u2265 4 samples from \u2265 2 distinct vehicles, else discarded. "
               "An unverified driver report is capped at RESTRICTED.", False, INK)],
         size=9, space_before=7, line=0.95)


# ══ slide 4 - feasibility, viability and the business model ═════════════════
def build_feasibility(slide):
    clear_guidance(slide)
    set_title(slide, "FEASIBILITY AND VIABILITY")
    set_team_badge(slide)

    lw = 4.62
    rx = LEFT + lw + 0.28
    rw = RIGHT - rx
    chw = 2.55
    stw = rw - chw - 0.12

    # ── pointer 1 ──
    y = pointer(slide, LEFT, TOP, lw, "Analysis of the feasibility of the idea")
    card = band(slide, LEFT, y, lw, 1.72)
    tf = card.text_frame
    para(tf, "Runs on smartphones, GPS, GIS and cloud services \u2014 no roadside "
             "hardware to procure, install or power. Modular, so weather, routing "
             "and government sources can be swapped per state.",
         size=9.5, color=INK, first=True, line=0.98)
    for i, (n, what) in enumerate([
        ("42 stretches \u00b7 3,567 km", "real OSRM geometry, 12 corridors, 8 states"),
        ("4 apps + dashboard", "built and running against live data"),
        ("195 / 195 tests", "10 suites \u00b7 10 languages \u00b7 0 English fallbacks"),
    ]):
        rich(tf, [(n + "  ", True, BLUE), (what, False, INK)],
             size=9.5, space_before=6, line=0.98)

    # ── business model ──
    by = label(slide, LEFT, y + 1.86, lw, "Business model \u2014 how it sustains itself")
    bcard = band(slide, LEFT, by, lw, 2.30, fill=WHITE, line=STEEL)
    bcard.line.width = Pt(1.25)
    tf = bcard.text_frame
    for i, (lead, rest) in enumerate([
        ("Flat platform fee  ",
         "\u20b95 per parcel, \u20b92 per shop order. The driver keeps the full "
         "delivery charge \u2014 that is what makes carrying worth it."),
        ("Government licence  ",
         "the accessibility dashboard sold per state or district to transport "
         "and disaster-management departments."),
        ("Merchant plans  ",
         "optional listing and analytics tiers for shops."),
        ("Cost side  ",
         "cloud only. No fleet, no vehicles, no hardware, so marginal cost per "
         "extra parcel is a payment-gateway fee."),
    ]):
        rich(tf, [(lead, True, NAVY), (rest, False, INK)],
             size=9.5, first=(i == 0), space_before=8, line=0.98)

    # ── pointers 2 and 3 ──
    pointer(slide, rx, TOP, chw, "Potential challenges and risks")
    pointer(slide, rx + chw + 0.12, TOP, stw,
            "Strategies for overcoming these challenges")

    rows = [
        ("Remote areas lose network",
         "Field reports queue on the phone under a client ID and sync later; the "
         "server rejects duplicates, so nothing is filed twice."),
        ("Noisy or inaccurate GPS",
         "Fixes worse than 120 m are dropped on the device, and a road status "
         "needs \u2265 4 samples from \u2265 2 distinct vehicles before it changes."),
        ("Incorrect user reports",
         "An unverified report is capped at RESTRICTED; only an officer's "
         "verification can close a road."),
        ("Uncertainty in AI predictions",
         "Every prediction is explainable by feature, calibration is published on "
         "screen, and current risk is kept separate from the forecast."),
        ("Roads close mid-journey",
         "The route planner scores three real alternatives and reports why each "
         "rejected one failed."),
        ("No historical closure dataset",
         "Labels come from a rainfall-threshold hazard function; verified field "
         "reports override them, and the platform says so openly."),
    ]
    yy = TOP + 0.32
    rh = 0.72
    for i, (risk, fix) in enumerate(rows):
        shade = PAPER if i % 2 else WHITE
        a = band(slide, rx, yy, chw, rh, fill=shade)
        a.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(a.text_frame, risk, size=9.5, bold=True, color=AMBER, first=True, line=0.98)
        b = band(slide, rx + chw + 0.12, yy, stw, rh, fill=shade)
        b.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(b.text_frame, fix, size=9, color=INK, first=True, line=0.98)
        ar = slide.shapes.add_shape(
            MSO_SHAPE.RIGHT_ARROW, Inches(rx + chw + 0.015),
            Inches(yy + rh / 2 - 0.04), Inches(0.08), Inches(0.08))
        ar.fill.solid()
        ar.fill.fore_color.rgb = STEEL
        ar.line.fill.background()
        ar.shadow.inherit = False
        yy += rh + 0.07


# ══ slide 5 - impact, benefits and the timeline ═════════════════════════════
def build_impact(slide):
    clear_guidance(slide)
    set_title(slide, "IMPACT AND BENEFITS")
    set_team_badge(slide)

    # ── pointer 1 ──
    y = pointer(slide, LEFT, TOP, FULL, "Potential impact on the target audience")
    who = [
        ("District administration",
         "Continuous visibility of accessibility, and a lifeline corridor's "
         "closure risk 72 hours out."),
        ("Field officers",
         "Weak points ranked with the reason each scored, and a queue of reports "
         "to verify."),
        ("Transporters and drivers",
         "Income from a journey already being made, and route conditions before "
         "setting out."),
        ("People in remote blocks",
         "Medicines, food, produce and construction material arrive \u2014 with an "
         "alert in the language spoken at home when they will not."),
    ]
    cw = (FULL - 3 * 0.16) / 4
    for i, (title, text) in enumerate(who):
        x = LEFT + i * (cw + 0.16)
        b = band(slide, x, y, cw, 1.34)
        tf = b.text_frame
        para(tf, title, size=10.5, bold=True, color=NAVY, first=True, line=0.95)
        para(tf, text, size=9, color=INK, space_before=3, line=0.98)

    # ── pointer 2 ──
    by = pointer(slide, LEFT, y + 1.48, FULL,
                 "Benefits of the solution (social, economic, environmental, etc.)")
    kinds = [
        ("Social", GREEN,
         "8 states, 82 districts. Alerts and voice reporting in 10 languages, four "
         "with almost no other software support."),
        ("Economic", BLUE,
         "Corridor matching turns spare capacity into income. No dedicated fleet, "
         "so cost per extra parcel is near zero."),
        ("Environmental", GREEN,
         "Fewer dedicated trips \u2014 a parcel rides in a vehicle already making "
         "the journey, not a second one."),
        ("Governance", STEEL,
         "Photo, GPS fix, timestamp and the verifying officer on every incident. "
         "An evidence trail, not a phone call."),
    ]
    for i, (kind, colour, text) in enumerate(kinds):
        x = LEFT + i * (cw + 0.16)
        chip = band(slide, x, by, cw, 0.34, fill=colour, line=None)
        chip.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(chip.text_frame, kind, size=10.5, bold=True, color=WHITE, first=True,
             align=PP_ALIGN.CENTER)
        b = band(slide, x, by + 0.38, cw, 0.98)
        b.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(b.text_frame, text, size=9, color=INK, first=True, line=0.98)

    # ── product development timeline ──
    ty = label(slide, LEFT, by + 1.50, FULL, "Product development timeline")
    phases = [
        ("Phase 1", "DONE", "Core platform", "4 apps, dashboard, 118 endpoints", GREEN),
        ("Phase 2", "DONE", "Intelligence layer", "probe sensing, forecast model, alerts, 10 languages", GREEN),
        ("Phase 3", "4 WEEKS", "Close the loop", "road-ahead warnings, mid-trip re-route, delay alerts", BLUE),
        ("Phase 4", "3 MONTHS", "District pilot", "one corridor with a state transport department", STEEL),
        ("Phase 5", "6-12 MONTHS", "Scale", "multi-state rollout, government system integration", MUTED),
    ]
    pw = (FULL - 4 * 0.12) / 5
    for i, (ph, when, title, detail, colour) in enumerate(phases):
        x = LEFT + i * (pw + 0.12)
        b = band(slide, x, ty, pw, 1.04,
                 fill=WHITE if colour in (GREEN, BLUE) else PAPER)
        tf = b.text_frame
        rich(tf, [(ph + "   ", True, NAVY), (when, True, colour)],
             size=8.5, first=True, line=0.95)
        para(tf, title, size=10, bold=True, color=NAVY, space_before=2, line=0.95)
        para(tf, detail, size=8, color=MUTED, space_before=1, line=0.95)
        # a small progress bar under each phase, filled for what is done
        barw = pw * (1.0 if when == "DONE" else 0.0)
        track = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE, Inches(x), Inches(ty + 1.08), Inches(pw), Inches(0.05))
        track.fill.solid()
        track.fill.fore_color.rgb = RULE
        track.line.fill.background()
        track.shadow.inherit = False
        if barw > 0:
            fillbar = slide.shapes.add_shape(
                MSO_SHAPE.RECTANGLE, Inches(x), Inches(ty + 1.08), Inches(barw), Inches(0.05))
            fillbar.fill.solid()
            fillbar.fill.fore_color.rgb = colour
            fillbar.line.fill.background()
            fillbar.shadow.inherit = False


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
             "open-meteo.com/en/docs/historical-weather-api \u2014 observed hourly "
             "rainfall, snowfall and temperature; the model's training set"),
            ("OSRM \u2014 Open Source Routing Machine",
             "project-osrm.org \u2014 real road geometry and route alternates"),
            ("VAHAN / Parivahan registration lookup",
             "parivahan.gov.in \u2014 vehicle class and capacity at driver sign-up"),
            ("MapLibre GL JS + Esri Dark Gray Canvas",
             "maplibre.org \u2014 the GIS layer of the control dashboard"),
        ]),
        ("Problem and domain research", [
            ("MDoNER \u2014 problem statement 26002",
             "mdoner.gov.in \u2014 NER connectivity gaps and infrastructure priorities"),
            ("NHIDCL / MoRTH national highway network",
             "nhidcl.com \u00b7 morth.nic.in \u2014 corridor alignments and NH numbering"),
            ("IMD rainfall climatology for the North East",
             "mausam.imd.gov.in \u2014 monsoon windows and the rain thresholds used"),
            ("GSI landslide susceptibility mapping",
             "gsi.gov.in \u2014 which stretches are treated as landslide-prone"),
        ]),
    ]
    for i, (heading, rows) in enumerate(groups):
        x = LEFT + i * (colw + 0.24)
        ly = label(slide, x, y, colw, heading)
        box = band(slide, x, ly, colw, 3.24)
        tf = box.text_frame
        for j, (title, detail) in enumerate(rows):
            para(tf, title, size=10.5, bold=True, color=NAVY,
                 first=(j == 0), space_before=23, line=0.95)
            para(tf, detail, size=9, color=MUTED, space_before=2, line=0.95)

    my = label(slide, LEFT, y + 3.62, FULL, "Method \u2014 how the model was built and judged")
    b = band(slide, LEFT, my, FULL, 0.94, fill=WHITE, line=STEEL)
    b.line.width = Pt(1.25)
    tf = b.text_frame
    rich(tf, [("Date-based evaluation \u2014 ", True, NAVY),
              ("trained on 109,116 road-days across 42 stretches x 877 days of "
               "observed weather, with everything after 2026-03-01 held out. "
               "AUC 0.883, Brier 0.092.", False, INK)],
         size=10, first=True, line=1.0)
    rich(tf, [("Stated openly: ", True, AMBER),
              ("no public register of past NER road closures exists, so historical "
               "labels are drawn from a rainfall-threshold hazard function "
               "calibrated on IMD and GSI data. Verified field reports override "
               "every drawn label.", False, INK)],
         size=10, space_before=5, line=1.0)


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

    print("\nwrote %s  -  %d slides"
          % (os.path.relpath(OUTPUT, ROOT), len(Presentation(OUTPUT).slides)))
    print("11 template pointers answered, plus the algorithms, business model "
          "and timeline")
    if "<" in TEAM_ID:
        print("\nstill to fill in ppt/build.py:  TEAM_ID")
    print("Save as PDF before uploading - the portal accepts nothing else.\n")


if __name__ == "__main__":
    main()
