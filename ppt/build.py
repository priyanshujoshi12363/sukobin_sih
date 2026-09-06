"""
Fills the official SIH 2026 idea template with Sukobin's content.

The template is authoritative: its palette, its Times New Roman titles, its blue
footer bar and its slide order all stay exactly as they came. This script only
replaces the grey guidance text on slides 2-6 with real content, fills the title
page, and drops the instructions slide, which the template itself says to delete
before uploading.

The template also caps the deck at six slides including the title, so everything
has to earn its place. Nothing here is a paragraph; the instructions ask for
points, diagrams and infographics.

    python ppt/build.py

Output: SIH2026_Sukobin.pptx next to the template. Save it as PDF before
uploading - the portal takes nothing else.
"""

import copy
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

# ── the four things only the team knows ─────────────────────────────────────
PS_ID = "SIH26-MDoNER-01"
PS_TITLE = "AI-Enabled Logistics Accessibility Intelligence Platform for the North Eastern Region"
THEME = "Transportation & Logistics"
CATEGORY = "Software"
TEAM_ID = "<team id>"
TEAM_NAME = "Sukobin"

# ── palette lifted from the template's own theme ────────────────────────────
NAVY = RGBColor(0x1F, 0x49, 0x7D)     # theme dk1, the title colour
BLUE = RGBColor(0x00, 0x70, 0xC0)     # the footer bar
STEEL = RGBColor(0x4F, 0x81, 0xBD)    # theme accent1
INK = RGBColor(0x26, 0x2B, 0x33)
MUTED = RGBColor(0x5A, 0x63, 0x6E)
PAPER = RGBColor(0xF2, 0xF5, 0xF9)
RULE = RGBColor(0xC9, 0xD6, 0xE4)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GREEN = RGBColor(0x2E, 0x7D, 0x4F)
AMBER = RGBColor(0xC2, 0x5E, 0x1E)

BODY = "Arial"

# Content lives between the title and the footer bar.
TOP = 1.30
BOTTOM = 6.72
LEFT = 0.45
RIGHT = 12.88


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
    """One paragraph, several runs - for a bold lead-in then plain text."""
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
    s.text_frame.word_wrap = True
    # An autoshape centres its text in both axes by default. Every card here
    # holds a list, so both are pinned before anything is written into it.
    s.text_frame.vertical_anchor = MSO_ANCHOR.TOP
    s.text_frame.margin_left = Inches(0.13)
    s.text_frame.margin_right = Inches(0.13)
    s.text_frame.margin_top = Inches(0.07)
    s.text_frame.margin_bottom = Inches(0.07)
    return s


def eyebrow(slide, x, y, w, text, color=NAVY):
    _, tf = textbox(slide, x, y, w, 0.24)
    para(tf, text.upper(), size=10, bold=True, color=color, first=True, line=1.0)
    return y + 0.30


def flow_step(slide, x, y, w, h, text, fill, text_color, size=11.5, bold=False):
    s = band(slide, x, y, w, h, fill=fill, line=None)
    tf = s.text_frame
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    para(tf, text, size=size, bold=bold, color=text_color, first=True,
         align=PP_ALIGN.CENTER, line=0.92)
    return s


def down_arrow(slide, cx, y, h=0.17):
    a = slide.shapes.add_shape(
        MSO_SHAPE.DOWN_ARROW, Inches(cx - 0.055), Inches(y), Inches(0.11), Inches(h)
    )
    a.fill.solid()
    a.fill.fore_color.rgb = STEEL
    a.line.fill.background()
    a.shadow.inherit = False
    return a


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
    """The grey 'Describe your idea' prompt the template ships with."""
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


# ══ slide 2 - the idea ══════════════════════════════════════════════════════
def build_idea(slide):
    clear_guidance(slide)
    set_title(slide, "EVERY VEHICLE ON THE ROAD IS A SENSOR", size=25)
    set_team_badge(slide)

    colw = 7.05
    y = TOP

    y = eyebrow(slide, LEFT, y, colw, "The gap")
    _, tf = textbox(slide, LEFT, y, colw, 0.62)
    para(tf, "The NER has no road-condition sensor network. A district usually "
             "learns a road is shut when a truck is already stuck on it, and "
             "instrumenting 3,500 km of hill highway is not affordable.",
         size=13, color=INK, first=True, line=1.02)
    y += 0.74

    y = eyebrow(slide, LEFT, y, colw, "The idea")
    _, tf = textbox(slide, LEFT, y, colw, 0.92)
    rich(tf, [("Nobody drives for us. ", True, NAVY),
              ("Anyone already travelling A to B enters their vehicle and route, "
               "and sees only the parcels whose pickup and drop lie along that "
               "road, up to what the vehicle holds.", False, INK)],
         size=13, first=True, line=1.02)
    y += 1.00

    y = eyebrow(slide, LEFT, y, colw, "The turn that makes it intelligence")
    _, tf = textbox(slide, LEFT, y, colw, 0.92)
    rich(tf, [("Those carriers stream GPS while they drive. ", True, NAVY),
              ("The rolling median of their speed against each road's baseline "
               "is a live accessibility reading. One stream, two products: the "
               "goods move, and the road gets measured.", False, INK)],
         size=13, first=True, line=1.02)
    y += 1.02

    y = eyebrow(slide, LEFT, y, colw, "Why this is different")
    box = band(slide, LEFT, y, colw, 1.28, fill=PAPER, line=RULE)
    tf = box.text_frame
    for i, (lead, rest) in enumerate([
        ("Coverage without hardware — ", "no roadside sensors, no dedicated fleet."),
        ("Cost per reading falls to zero — ", "the driver was making the trip anyway."),
        ("It improves as it is used — ", "more carriers means denser sensing."),
    ]):
        rich(tf, [("•  " + lead, True, NAVY), (rest, False, INK)],
             size=12.5, first=(i == 0), space_before=6, line=0.98)

    # ── right: the loop, drawn ──
    x = 7.85
    w = RIGHT - x
    yy = TOP
    yy = eyebrow(slide, x, yy, w, "How one trip becomes both")

    steps = [
        ("Driver declares  Dimapur → Imphal", WHITE, NAVY, True),
        ("Sees only parcels lying on that road", PAPER, INK, False),
        ("Drives — phone streams GPS every 20 s", PAPER, INK, False),
        ("Median speed vs baseline → road status", WHITE, NAVY, True),
        ("Officers · forecasts · alerts · re-routes", PAPER, INK, False),
    ]
    h = 0.60
    gap = 0.235
    for i, (text, fill, tc, bold) in enumerate(steps):
        if fill is WHITE:
            s = flow_step(slide, x, yy, w, h, text, WHITE, tc, bold=bold)
            s.line.color.rgb = STEEL
            s.line.width = Pt(1.25)
        else:
            s = flow_step(slide, x, yy, w, h, text, fill, tc, bold=bold)
            s.line.color.rgb = RULE
            s.line.width = Pt(0.75)
        yy += h
        if i < len(steps) - 1:
            down_arrow(slide, x + w / 2, yy + 0.03, gap - 0.06)
            yy += gap

    yy += 0.10
    _, tf = textbox(slide, x, yy, w, 0.85)
    para(tf, "The carrier network and the sensor network are the same network. "
             "That is the whole idea.",
         size=12, bold=True, color=BLUE, first=True, align=PP_ALIGN.CENTER, line=1.05)


# ══ slide 3 - technical approach ════════════════════════════════════════════
def build_technical(slide):
    clear_guidance(slide)
    set_title(slide, "TECHNICAL APPROACH")
    set_team_badge(slide)

    y = TOP - 0.05
    colw = 3.98
    gapx = 0.24

    cols = [
        ("Built with", [
            ("Backend", "Node.js · Express 5 · MongoDB with 2dsphere · JWT"),
            ("Web", "React · Vite · MapLibre GL"),
            ("Mobile", "Kotlin + XML — four apps: customer, merchant, driver, officer"),
            ("Cloud", "Render · MongoDB Atlas · Cloudinary · FCM push"),
        ]),
        ("The model", [
            ("Type", "Logistic regression, benchmarked against gradient-boosted stumps"),
            ("Features", "18 — antecedent rain, burst intensity, slope, terrain, closure history"),
            ("Trained on", "109,116 road-days of observed weather, 42 stretches x 877 days"),
            ("Scored", "AUC 0.883 · Brier 0.092 · held out after 2026-03-01"),
        ]),
        ("Real data, not mock", [
            ("Weather", "Open-Meteo archive + forecast, hourly"),
            ("Roads", "OSRM geometry — 42 stretches / 3,567 km"),
            ("Vehicles", "VAHAN registration lookup"),
            ("Field", "Photos, GPS and voice from officers and drivers"),
        ]),
    ]

    for i, (heading, rows) in enumerate(cols):
        x = LEFT + i * (colw + gapx)
        eyebrow(slide, x, y, colw, heading)
        box = band(slide, x, y + 0.30, colw, 2.30, fill=PAPER, line=RULE)
        tf = box.text_frame
        for j, (k, v) in enumerate(rows):
            rich(tf, [(k + "  ", True, NAVY), (v, False, INK)],
                 size=11.5, first=(j == 0), space_before=10, line=1.0)

    # ── the pipeline, end to end ──
    py = y + 2.82
    eyebrow(slide, LEFT, py, 12.4, "From one GPS ping to a road status, an alert and a route")

    steps = [
        "GPS ping\nevery 20 s / 40 m",
        "Map-matched\nto a road ≤ 600 m",
        "45-min rolling\nmedian speed",
        "Status\nOPEN → BLOCKED",
        "Alert engine\n10 languages",
        "Re-route + ETA\nfor the corridor",
    ]
    n = len(steps)
    aw = 0.30
    total = 12.43
    sw = (total - (n - 1) * aw) / n
    sy = py + 0.34
    sh = 0.82
    for i, text in enumerate(steps):
        x = LEFT + i * (sw + aw)
        fill = WHITE if i in (0, 3, 5) else PAPER
        s = band(slide, x, sy, sw, sh, fill=fill, line=STEEL if fill is WHITE else RULE)
        s.line.width = Pt(1.25 if fill is WHITE else 0.75)
        tf = s.text_frame
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        head, tail = text.split("\n")
        para(tf, head, size=10.5, bold=True, color=NAVY, first=True,
             align=PP_ALIGN.CENTER, line=0.95)
        para(tf, tail, size=9.5, color=MUTED, align=PP_ALIGN.CENTER,
             space_before=1, line=0.95)
        if i < n - 1:
            a = slide.shapes.add_shape(
                MSO_SHAPE.RIGHT_ARROW,
                Inches(x + sw + 0.055), Inches(sy + sh / 2 - 0.055),
                Inches(aw - 0.11), Inches(0.11),
            )
            a.fill.solid()
            a.fill.fore_color.rgb = STEEL
            a.line.fill.background()
            a.shadow.inherit = False

    _, tf = textbox(slide, LEFT, sy + sh + 0.16, 12.43, 0.4)
    rich(tf, [("Trust rule — ", True, NAVY),
              ("a reading needs at least 4 samples from at least 2 distinct "
               "vehicles, so one parked driver can never close a highway. A "
               "driver's hazard report is capped at RESTRICTED until an officer "
               "confirms it.", False, INK)],
         size=11, first=True, line=1.0)


# ══ slide 4 - feasibility and viability ═════════════════════════════════════
def build_feasibility(slide):
    clear_guidance(slide)
    set_title(slide, "FEASIBILITY AND VIABILITY")
    set_team_badge(slide)

    y = TOP - 0.05
    lw = 5.15
    rw = RIGHT - (LEFT + lw + 0.30)
    rx = LEFT + lw + 0.30

    # ── left: it already exists ──
    eyebrow(slide, LEFT, y, lw, "Feasible because it is already built and measured")
    box = band(slide, LEFT, y + 0.30, lw, 2.95, fill=PAPER, line=RULE)
    tf = box.text_frame
    for i, (n, what) in enumerate([
        ("42 stretches · 3,567 km", "real OSRM geometry across 12 corridors, 82 districts, 8 states"),
        ("4 Android apps + dashboard", "customer, merchant, driver, officer, control room"),
        ("195 / 195", "backend tests passing across 10 suites"),
        ("10 languages · 8,424 units", "every screen, zero English fallbacks"),
        ("100 % coverage", "status known, live vehicle data and forecast on every road"),
    ]):
        rich(tf, [(n + "  ", True, BLUE), (what, False, INK)],
             size=11.5, first=(i == 0), space_before=13, line=1.0)

    ny = y + 3.42
    eyebrow(slide, LEFT, ny, lw, "Scaling costs almost nothing")
    _, tf = textbox(slide, LEFT, ny + 0.30, lw, 1.3)
    for i, t in enumerate([
        "No hardware to install, maintain or power.",
        "A new district needs its road geometry seeded — hours, not procurement.",
        "Sensing density rises with adoption, at no extra cost.",
    ]):
        rich(tf, [("•  ", True, STEEL), (t, False, INK)],
             size=11.5, first=(i == 0), space_before=11, line=1.0)

    # ── right: risks and what answers them ──
    eyebrow(slide, rx, y, rw, "Risks, and what answers each one")
    yy = y + 0.32
    rows = [
        ("No public register of past road closures",
         "Labels drawn from a rainfall-threshold hazard function; verified field "
         "reports override them. Stated openly on the dashboard."),
        ("One parked driver could read as a closure",
         "A status needs ≥ 4 samples from ≥ 2 vehicles, else it is discarded."),
        ("Hill districts drop off the network",
         "Reports queue on the phone with a client ID and sync later; duplicates "
         "are rejected, so nothing is filed twice."),
        ("Officers and drivers do not share a language",
         "Ten languages including Khasi, Mizo, Nagamese and Kokborok — spoken "
         "aloud as well as written."),
        ("A quiet road has no vehicles to sense it",
         "The weather model forecasts every road regardless of traffic; the "
         "dashboard shows honestly what is sensed and what is not."),
    ]
    rh = 0.86
    for i, (risk, fix) in enumerate(rows):
        b = band(slide, rx, yy, rw, rh, fill=WHITE if i % 2 == 0 else PAPER, line=RULE)
        tf = b.text_frame
        para(tf, risk, size=11, bold=True, color=AMBER, first=True, line=0.95)
        para(tf, fix, size=10, color=INK, space_before=2, line=0.95)
        yy += rh + 0.11


# ══ slide 5 - impact and benefits ═══════════════════════════════════════════
def build_impact(slide):
    clear_guidance(slide)
    set_title(slide, "IMPACT AND BENEFITS")
    set_team_badge(slide)

    y = TOP - 0.05

    # ── who it reaches ──
    eyebrow(slide, LEFT, y, 12.43, "Who it reaches")
    who = [
        ("District administration",
         "A lifeline corridor's closure risk 72 hours out, ranked by how many "
         "people lose their only road."),
        ("Field officers",
         "One screen: weak points ranked with the reason each one scored, and a "
         "queue of reports to confirm."),
        ("Drivers and small operators",
         "Income from a journey already being made — no fleet, no contract, no "
         "empty return leg."),
        ("People in remote blocks",
         "Medicines, rations and produce arrive, and an alert in the language "
         "spoken at home when they will not."),
    ]
    cw = (12.43 - 3 * 0.20) / 4
    for i, (title, text) in enumerate(who):
        x = LEFT + i * (cw + 0.20)
        b = band(slide, x, y + 0.30, cw, 1.42, fill=PAPER, line=RULE)
        tf = b.text_frame
        para(tf, title, size=11.5, bold=True, color=NAVY, first=True, line=0.95)
        para(tf, text, size=10.5, color=INK, space_before=4, line=0.98)

    # ── typed benefits ──
    by = y + 1.94
    eyebrow(slide, LEFT, by, 12.43, "Benefits")
    kinds = [
        ("Social", GREEN,
         "8 states · 82 districts. Alerts and voice reporting in 10 languages, "
         "including four with no other software support."),
        ("Economic", BLUE,
         "No dedicated fleet, so the marginal cost of moving one more parcel is "
         "near zero. Spare capacity in vehicles already moving becomes income."),
        ("Environmental", GREEN,
         "Fewer dedicated trips: a parcel rides in a vehicle that was making the "
         "journey regardless, instead of a second one setting out."),
        ("Governance", STEEL,
         "Every incident carries a photo, GPS fix, timestamp and the officer who "
         "confirmed it — an evidence trail, not a phone call."),
    ]
    kh = 0.70
    for i, (kind, colour, text) in enumerate(kinds):
        yy = by + 0.32 + i * (kh + 0.11)
        chip = band(slide, LEFT, yy, 1.62, kh, fill=colour, line=None)
        chip.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(chip.text_frame, kind, size=12.5, bold=True, color=WHITE, first=True,
             align=PP_ALIGN.CENTER)
        b = band(slide, LEFT + 1.74, yy, 12.43 - 1.74, kh, fill=PAPER, line=RULE)
        b.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
        para(b.text_frame, text, size=11.5, color=INK, first=True, line=1.0)


# ══ slide 6 - research and references ═══════════════════════════════════════
def build_research(slide):
    clear_guidance(slide)
    set_title(slide, "RESEARCH AND REFERENCES")
    set_team_badge(slide)

    y = TOP - 0.05
    colw = 6.10
    gapx = 0.23

    groups = [
        ("Data sources the platform runs on", [
            ("Open-Meteo Historical Weather API",
             "open-meteo.com/en/docs/historical-weather-api — observed hourly "
             "rainfall, snowfall and temperature; the model's training set"),
            ("OSRM — Open Source Routing Machine",
             "project-osrm.org — road geometry and alternates for all 42 stretches"),
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
             "used to seed the network"),
            ("IMD rainfall climatology for the North East",
             "mausam.imd.gov.in — monsoon windows and the rain thresholds "
             "behind the hazard function"),
            ("GSI landslide susceptibility mapping",
             "gsi.gov.in — which stretches are treated as landslide-prone"),
        ]),
    ]

    for i, (heading, rows) in enumerate(groups):
        x = LEFT + i * (colw + gapx)
        eyebrow(slide, x, y, colw, heading)
        box = band(slide, x, y + 0.30, colw, 3.60, fill=PAPER, line=RULE)
        tf = box.text_frame
        for j, (title, detail) in enumerate(rows):
            para(tf, title, size=11.5, bold=True, color=NAVY,
                 first=(j == 0), space_before=26, line=0.95)
            para(tf, detail, size=10, color=MUTED, space_before=2, line=0.95)

    ny = y + 4.06
    b = band(slide, LEFT, ny, 12.43, 1.05, fill=WHITE, line=STEEL)
    b.line.width = Pt(1.25)
    tf = b.text_frame
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    rich(tf, [("Working prototype  ", True, NAVY),
              ("— four Android apps, a control dashboard and the backend are "
               "built and running. The forecast model, the probe-sensing engine "
               "and the corridor matcher are covered by 195 automated tests.",
               False, INK)],
         size=11.5, first=True, line=1.0)


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

    print("\nwrote %s" % os.path.relpath(OUTPUT, ROOT))
    print("%d slides, %.2f x %.2f in"
          % (len(Presentation(OUTPUT).slides),
             prs.slide_width / 914400, prs.slide_height / 914400))
    if "<" in TEAM_ID:
        print("\nstill to fill in ppt/build.py:  TEAM_ID"
              "  (and PS_ID if the portal shows a different one)")
    print("Save as PDF before uploading - the portal accepts nothing else.\n")


if __name__ == "__main__":
    main()
