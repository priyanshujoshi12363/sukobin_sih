"""
Builds the SIH 2026 idea-submission deck for Sukobin.

Uses PowerPoint's default (Office) theme: the built-in slide layouts, theme
fonts and theme colours. Nothing is restyled or recoloured. The only shapes
added by hand are the small flow diagram on the technical slide and a few
tables, and those take their colours from the theme as well.

Six slides, in the order the SIH idea-submission format asks for:
    1  Title
    2  Proposed solution
    3  Technical approach
    4  Feasibility and viability
    5  Impact and benefits
    6  Research and references

The wording is deliberately plain. Every number in the deck is one that has
been checked against live data.
"""

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE
import os

# The default template is laid out for a 10 inch wide slide. We present in
# 16:9, so placeholders are widened by this factor to fill the slide.
SCALE = 13.333 / 10.0
SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)


def new_deck():
    prs = Presentation()          # default Office theme
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    return prs


def add(prs, layout_index):
    slide = prs.slides.add_slide(prs.slide_layouts[layout_index])

    # A placeholder that still inherits its position has no xfrm of its own.
    # Writing only left/width would create one with y = 0 and knock the shape
    # to the top of the slide, so read all four values first and write all four.
    for ph in slide.placeholders:
        left, top, width, height = ph.left, ph.top, ph.width, ph.height
        ph.left, ph.top = int(left * SCALE), top
        ph.width, ph.height = int(width * SCALE), height

    return slide


def set_title(slide, text, size=30):
    t = slide.shapes.title
    t.text = text
    t.left, t.top = Inches(0.85), Inches(0.25)
    t.width, t.height = Inches(11.6), Inches(0.8)
    for p in t.text_frame.paragraphs:
        p.alignment = PP_ALIGN.LEFT
        for run in p.runs:
            run.font.size = Pt(size)
    return t


def bullets(placeholder, items, size=15, space_after=6):
    """items: string, or (string, level), or (string, level, bold)."""
    tf = placeholder.text_frame
    tf.word_wrap = True
    tf.clear()

    for i, item in enumerate(items):
        if isinstance(item, str):
            content, level, bold = item, 0, False
        elif len(item) == 2:
            content, level, bold = item[0], item[1], False
        else:
            content, level, bold = item

        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.level = level
        p.space_after = Pt(space_after)
        run = p.add_run()
        run.text = content
        run.font.size = Pt(size - level)
        run.font.bold = bold
    return tf


def textbox(slide, x, y, w, h, lines, size=12, bold=False,
            align=PP_ALIGN.LEFT, space_after=6):
    box = slide.shapes.add_textbox(x, y, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.space_after = Pt(space_after)
        run = p.add_run()
        run.text = line
        run.font.size = Pt(size)
        run.font.bold = bold
    return box


def heading(slide, x, y, w, label, size=13):
    return textbox(slide, x, y, w, Inches(0.3), [label], size=size, bold=True)


def table(slide, x, y, w, h, rows, col_widths=None, font=11, header=True):
    shape = slide.shapes.add_table(len(rows), len(rows[0]), x, y, w, h)
    tbl = shape.table
    tbl.first_row = header

    if col_widths:
        for i, cw in enumerate(col_widths):
            tbl.columns[i].width = Inches(cw)

    for r, row in enumerate(rows):
        for c, value in enumerate(row):
            cell = tbl.cell(r, c)
            cell.text = value
            cell.margin_left = Inches(0.08)
            cell.margin_right = Inches(0.08)
            cell.margin_top = Inches(0.02)
            cell.margin_bottom = Inches(0.02)
            for p in cell.text_frame.paragraphs:
                p.space_after = Pt(0)
                for run in p.runs:
                    run.font.size = Pt(font)
    return tbl


# ─────────────────────────────────────────────────────────────────────────────
# 1  Title
# ─────────────────────────────────────────────────────────────────────────────
def slide_title(prs):
    s = add(prs, 0)                       # built-in Title Slide layout
    s.shapes.title.text = "Sukobin"
    s.shapes.title.top = Inches(1.0)

    sub = s.placeholders[1]
    sub.top = Inches(2.15)
    sub.height = Inches(1.4)

    tf = sub.text_frame
    tf.word_wrap = True
    tf.clear()

    lines = [
        ("A logistics and road-access platform for the North East", 18, True),
        ("Parcels travel with people who are already making the journey.", 14, False),
        ("Those same vehicles tell us which roads are open.", 14, False),
    ]
    for i, (t, size, bold) in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.CENTER
        p.space_after = Pt(6)
        run = p.add_run()
        run.text = t
        run.font.size = Pt(size)
        run.font.bold = bold

    rows = [
        ["Problem Statement", "SIH 2026 — MDoNER"],
        ["Organisation", "Ministry of Development of North Eastern Region"],
        ["Theme", "Transportation and Logistics"],
        ["Category", "Software"],
        ["Team Name", "< fill in >"],
        ["Team ID", "< fill in >"],
    ]
    table(s, Inches(3.6), Inches(4.05), Inches(6.2), Inches(2.1),
          rows, col_widths=[2.0, 4.2], font=11, header=False)


# ─────────────────────────────────────────────────────────────────────────────
# 2  Proposed solution
# ─────────────────────────────────────────────────────────────────────────────
def slide_solution(prs):
    s = add(prs, 1)                       # Title and Content
    set_title(s, "Proposed Solution")

    body = s.placeholders[1]
    body.left, body.top = Inches(0.85), Inches(1.2)
    body.width, body.height = Inches(11.6), Inches(2.5)

    bullets(body, [
        ("The problem", 0, True),
        ("Roads in the North East close often because of landslides, floods and snow. "
         "Medicines and food arrive late, and no one has a live picture of which roads are open.", 1),
        ("A normal courier fleet costs too much to run in these hills, so one was never built.", 1),
        ("Our solution", 0, True),
        ("Do not build a fleet. Use the vehicles that are already travelling.", 1),
        ("A driver enters their vehicle number and where they are going. The app shows only "
         "the parcels going the same way, and only as many as the vehicle can carry.", 1),
    ], size=14, space_after=4)

    heading(s, Inches(0.9), Inches(3.72), Inches(11.6), "Why this is different", size=14)
    textbox(s, Inches(0.9), Inches(4.06), Inches(11.6), Inches(0.6),
            ["Other systems learn that a road is blocked only when somebody reports it. "
             "Ours also notices when many vehicles suddenly slow down — and it notices "
             "because those same vehicles are already carrying the goods."],
            size=13)

    rows = [
        ["What the problem statement asks for", "How Sukobin answers it"],
        ["Watch roads and bridges in real time", "Live road status from driver GPS and officer reports"],
        ["Predict problems before they happen", "A risk score per road from rainfall, slope and past events"],
        ["Suggest other routes and likely delay", "Blocked roads are refused; delay is shown road by road"],
        ["Track vehicles carrying essentials", "Every parcel travels in a checked, tracked vehicle"],
        ["Send alerts automatically", "Blocked roads, risky roads and late deliveries are pushed out"],
        ["Let officers send photo reports", "Officers report from the spot, even with no signal"],
        ["Give one central dashboard", "District status, weak points, emergency view, live supplies"],
        ["Many languages, works offline", "Reports wait on the phone and upload later; alerts translated"],
    ]
    table(s, Inches(0.9), Inches(4.75), Inches(11.6), Inches(2.3),
          rows, col_widths=[4.7, 6.9], font=10.5)


# ─────────────────────────────────────────────────────────────────────────────
# 3  Technical approach
# ─────────────────────────────────────────────────────────────────────────────
def slide_technical(prs):
    s = add(prs, 5)                       # Title Only
    set_title(s, "Technical Approach")

    heading(s, Inches(0.9), Inches(1.15), Inches(8.2),
            "How the system decides whether a road is open", size=14)

    def box(x, y, w, h, lines, size=11):
        sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
        sh.shadow.inherit = False
        tf = sh.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = Inches(0.05)
        tf.margin_top = tf.margin_bottom = Inches(0.02)
        for i, line in enumerate(lines):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.alignment = PP_ALIGN.CENTER
            p.space_after = Pt(0)
            run = p.add_run()
            run.text = line
            run.font.size = Pt(size if i == 0 else size - 1.5)
            run.font.bold = (i == 0)
        return sh

    def arrow(x, y):
        sh = s.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, x, y, Inches(0.28), Inches(0.36))
        sh.shadow.inherit = False
        return sh

    box(Inches(0.9), Inches(1.55), Inches(3.6), Inches(0.82),
        ["Drivers on the road", "Phone sends location while driving"])
    box(Inches(5.0), Inches(1.55), Inches(3.6), Inches(0.82),
        ["Field officers", "Photo and note sent from the spot"])

    arrow(Inches(2.56), Inches(2.44))
    arrow(Inches(6.66), Inches(2.44))

    box(Inches(0.9), Inches(2.90), Inches(3.6), Inches(0.88),
        ["Compare the speed", "Are vehicles slower than usual on this road?"])
    box(Inches(5.0), Inches(2.90), Inches(3.6), Inches(0.88),
        ["Read the report", "Turn the note into type, seriousness and effect"])

    arrow(Inches(2.56), Inches(3.85))
    arrow(Inches(6.66), Inches(3.85))

    box(Inches(0.9), Inches(4.32), Inches(7.7), Inches(0.70),
        ["Decide the road status: open, slow, restricted or blocked"])

    arrow(Inches(4.61), Inches(5.09))

    for i, (t1, t2) in enumerate([
        ("Route matching", "blocked roads refused"),
        ("Dashboard", "weak points and forecast"),
        ("Alerts", "sent in the reader's own language"),
    ]):
        box(Inches(0.9) + i * Inches(2.65), Inches(5.56), Inches(2.4), Inches(0.78), [t1, t2])

    heading(s, Inches(9.1), Inches(1.55), Inches(3.4), "Rules that keep it safe")
    textbox(s, Inches(9.1), Inches(1.95), Inches(3.4), Inches(2.2),
            ["One vehicle cannot close a road. At least two must agree.",
             "A weak GPS signal is thrown away.",
             "A weather forecast warns of risk. It never says a road is shut.",
             "A single report is treated with care until an officer confirms it."],
            size=11)

    heading(s, Inches(9.1), Inches(4.32), Inches(3.4), "What we built it with")
    textbox(s, Inches(9.1), Inches(4.72), Inches(3.4), Inches(2.2),
            ["Four Android apps in Kotlin and XML",
             "Node.js, Express and MongoDB",
             "A model trained in plain JavaScript, no add-ons needed",
             "OSRM for real road routes",
             "Open-Meteo for rainfall and snow",
             "React and MapLibre for the dashboard"],
            size=11)


# ─────────────────────────────────────────────────────────────────────────────
# 4  Feasibility and viability
# ─────────────────────────────────────────────────────────────────────────────
def slide_feasibility(prs):
    s = add(prs, 5)
    set_title(s, "Feasibility and Viability")

    heading(s, Inches(0.9), Inches(1.15), Inches(11.6),
            "The system is already built and running on real data", size=14)

    rows = [
        ["Roads modelled", "Length covered", "Model trained on", "Forecast accuracy", "Built"],
        ["42 sections, 82 districts", "3,567 km", "1,09,116 road-days of real weather",
         "0.88 (1.0 is perfect)", "4 apps and 1 dashboard"],
    ]
    table(s, Inches(0.9), Inches(1.55), Inches(11.6), Inches(0.8),
          rows, col_widths=[2.3, 1.9, 3.1, 2.2, 2.1], font=11)

    heading(s, Inches(0.9), Inches(2.7), Inches(5.6), "What we have already tested")
    textbox(s, Inches(0.9), Inches(3.06), Inches(5.6), Inches(2.3),
            ["The forecast model was trained on two years of real recorded weather "
             "and tested only on later dates it had never seen. When it says 30%, "
             "the event happens about 30% of the time.",
             "As vehicle speeds dropped, one road moved from open to slow to blocked "
             "on its own, with no person involved, and the district alert followed.",
             "The system correctly read all 8 test reports written in mixed Hindi and "
             "English, including how long clearing would take.",
             "With a road marked blocked, the app refused to send a driver on it."],
            size=11)

    heading(s, Inches(6.9), Inches(2.7), Inches(5.6), "Problems we expect, and our answer")
    textbox(s, Inches(6.9), Inches(3.06), Inches(5.6), Inches(2.3),
            ["Would you trust a stranger with medicines? Drivers are placed in two "
             "groups. Anyone can carry normal parcels. Only trusted local drivers with "
             "a delivery record carry medicines and government supplies.",
             "Some roads carry very little traffic. A parcel can change hands at a town "
             "on the way instead of waiting for one driver to do the whole trip.",
             "Many areas have no mobile signal. Reports are saved on the phone and sent "
             "later, and are never counted twice."],
            size=11)

    heading(s, Inches(0.9), Inches(5.42), Inches(11.6), "Why it can keep running")

    rows2 = [
        ["No fleet to pay for", "Almost no added cost", "Road data comes free",
         "Ready for government use"],
        ["No vehicles to buy and no drivers to hire. The vehicles are already on the road.",
         "The journey happens anyway. The driver only makes a small detour.",
         "Road information is a by-product of deliveries, so it costs nothing extra.",
         "Runs on cloud servers and connects to weather and transport services."],
    ]
    table(s, Inches(0.9), Inches(5.78), Inches(11.6), Inches(1.15),
          rows2, col_widths=[2.9, 2.9, 2.9, 2.9], font=10.5)


# ─────────────────────────────────────────────────────────────────────────────
# 5  Impact and benefits
# ─────────────────────────────────────────────────────────────────────────────
def slide_impact(prs):
    s = add(prs, 5)
    set_title(s, "Impact and Benefits")

    heading(s, Inches(0.9), Inches(1.15), Inches(11.6),
            "What happens when a road closes", size=14)

    rows = [
        ["1. Heavy rain", "2. Officer reports", "3. System reads it",
         "4. Officer confirms", "5. Road marked shut", "6. System reacts"],
        ["Risk on that hill road goes up",
         "Photo and note sent from the spot",
         "Landslide, serious, road fully blocked",
         "A senior officer checks and agrees",
         "Vehicle speeds show nothing is moving",
         "Drivers rerouted and the district is shown as cut off"],
    ]
    table(s, Inches(0.9), Inches(1.55), Inches(11.6), Inches(1.15),
          rows, col_widths=[1.93, 1.93, 1.93, 1.93, 1.94, 1.94], font=10)

    heading(s, Inches(0.9), Inches(3.15), Inches(5.6), "For people")
    textbox(s, Inches(0.9), Inches(3.52), Inches(5.6), Inches(1.6),
            ["Medicines and food reach villages that courier companies do not serve.",
             "In an emergency, officials see a live map instead of making phone calls.",
             "Alerts arrive in the language the person actually reads."],
            size=12)

    heading(s, Inches(6.9), Inches(3.15), Inches(5.6), "For income")
    textbox(s, Inches(6.9), Inches(3.52), Inches(5.6), Inches(1.6),
            ["Ordinary travellers earn money on a trip they were making anyway.",
             "Shopkeepers in the hills can sell beyond their own town.",
             "Districts lose less money to stock running out and goods getting stuck."],
            size=12)

    heading(s, Inches(0.9), Inches(5.2), Inches(5.6), "For the environment")
    textbox(s, Inches(0.9), Inches(5.57), Inches(5.6), Inches(1.6),
            ["No new delivery fleet, so no extra vehicles on the road.",
             "Parcels ride in vehicles that were already going that way.",
             "Fewer empty trips on long mountain routes."],
            size=12)

    heading(s, Inches(6.9), Inches(5.2), Inches(5.6), "For government")
    textbox(s, Inches(6.9), Inches(5.57), Inches(5.6), Inches(1.6),
            ["One clear picture of road access across all districts.",
             "Field reports become proper records that can be checked later.",
             "Problems are seen coming, not only written down afterwards."],
            size=12)


# ─────────────────────────────────────────────────────────────────────────────
# 6  Research and references
# ─────────────────────────────────────────────────────────────────────────────
def slide_research(prs):
    s = add(prs, 5)
    set_title(s, "Research and References")

    heading(s, Inches(0.9), Inches(1.35), Inches(5.6), "Data and services we use")
    textbox(s, Inches(0.9), Inches(1.75), Inches(5.6), Inches(2.4),
            ["OSRM — real road routes and other ways round",
             "Open-Meteo — hourly rainfall, snow and temperature",
             "OpenStreetMap and Esri — base maps",
             "Vahan — checking vehicle registration numbers",
             "Firebase — sending notifications to phones",
             "MongoDB — storing and searching map data"],
            size=12)

    heading(s, Inches(6.9), Inches(1.35), Inches(5.6), "Main roads covered so far")
    textbox(s, Inches(6.9), Inches(1.75), Inches(5.6), Inches(2.4),
            ["NH-10 Siliguri to Gangtok — Sikkim's only main road",
             "NH-2 Dimapur to Kohima to Imphal — Manipur's supply line",
             "NH-6 Shillong to Silchar — cuts off the Barak Valley",
             "NH-13 Tezpur to Tawang — closed by snow from December",
             "NH-306 Silchar to Aizawl — Mizoram's all-weather road",
             "12 main routes in total, across all eight states"],
            size=12)

    heading(s, Inches(0.9), Inches(4.35), Inches(5.6), "Government sources")
    textbox(s, Inches(0.9), Inches(4.75), Inches(5.6), Inches(2.2),
            ["MDoNER — North East development plans",
             "NHIDCL and BRO — highway and border road condition",
             "NDMA — landslide and flood guidance",
             "IMD — rainfall levels that lead to landslides",
             "PMGSY — village road connectivity"],
            size=12)

    heading(s, Inches(6.9), Inches(4.35), Inches(5.6), "Ideas we build on")
    textbox(s, Inches(6.9), Inches(4.75), Inches(5.6), Inches(2.2),
            ["Judging road condition from vehicle speed is a known method in "
             "traffic engineering.",
             "Warning of landslides based on recent rainfall is widely used.",
             "Sharing spare space in vehicles that are already travelling is "
             "proven in other countries."],
            size=12)


def main():
    prs = new_deck()
    for fn in (slide_title, slide_solution, slide_technical,
               slide_feasibility, slide_impact, slide_research):
        fn(prs)

    out = os.path.normpath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "SIH2026_Sukobin.pptx")
    )
    prs.save(out)
    print("written:", out)


if __name__ == "__main__":
    main()
