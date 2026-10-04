import type { BoardTemplate } from './types'

export const TEMPLATES_GRID: BoardTemplate[] = [
  {
    id: 'pizzeria-board',
    name: 'Pizzeria Board',
    content: `<div style="width:100vw;height:100vh;background:#161210;color:#f6ead8;font-family:'Arial Black','Helvetica Neue',sans-serif;display:flex;flex-direction:column;overflow:hidden;margin:0;padding:0;box-sizing:border-box;">
  <div style="height:18px;background:repeating-linear-gradient(90deg,#c0392b 0 60px,#f6ead8 60px 120px);"></div>
  <header style="display:flex;justify-content:space-between;align-items:center;padding:2.2rem 4rem 1.4rem;">
    <h1 style="font-size:4.2rem;margin:0;letter-spacing:0.04em;color:#e74c3c;">Forno<span style="color:#f6c344;">·</span>Nova</h1>
    <div style="font-size:1.5rem;background:#f6c344;color:#161210;padding:0.7rem 1.8rem;border-radius:999px;font-weight:900;letter-spacing:0.06em;">🔥 WOOD-FIRED · 450°C</div>
  </header>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1.8rem;padding:1rem 4rem 3rem;flex:1;">
    <div style="background:#241d19;border-radius:1.2rem;padding:1.8rem;display:flex;flex-direction:column;border-top:6px solid #e74c3c;">
      <div style="font-size:1.15rem;color:#f6c344;letter-spacing:0.25em;margin-bottom:0.6rem;">CLASSICS</div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:0.7rem 0;border-bottom:2px dotted #4a3c33;"><span style="font-size:1.5rem;font-weight:900;">Margherita</span><span style="font-size:1.6rem;color:#e74c3c;font-weight:900;">$12</span></div>
      <p style="margin:0.3rem 0 1rem;font-size:1.05rem;color:#bfa98f;font-family:Arial,sans-serif;">San Marzano, fior di latte, basil</p>
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:0.7rem 0;border-bottom:2px dotted #4a3c33;"><span style="font-size:1.5rem;font-weight:900;">Marinara</span><span style="font-size:1.6rem;color:#e74c3c;font-weight:900;">$10</span></div>
      <p style="margin:0.3rem 0 1rem;font-size:1.05rem;color:#bfa98f;font-family:Arial,sans-serif;">Tomato, garlic, oregano</p>
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:0.7rem 0;"><span style="font-size:1.5rem;font-weight:900;">Quattro Formaggi</span><span style="font-size:1.6rem;color:#e74c3c;font-weight:900;">$15</span></div>
      <p style="margin:0.3rem 0 0;font-size:1.05rem;color:#bfa98f;font-family:Arial,sans-serif;">Four cheese blend, honey drizzle</p>
    </div>
    <div style="background:#241d19;border-radius:1.2rem;padding:1.8rem;display:flex;flex-direction:column;border-top:6px solid #f6c344;">
      <div style="font-size:1.15rem;color:#f6c344;letter-spacing:0.25em;margin-bottom:0.6rem;">SIGNATURE</div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:0.7rem 0;border-bottom:2px dotted #4a3c33;"><span style="font-size:1.5rem;font-weight:900;">Diavola</span><span style="font-size:1.6rem;color:#e74c3c;font-weight:900;">$16</span></div>
      <p style="margin:0.3rem 0 1rem;font-size:1.05rem;color:#bfa98f;font-family:Arial,sans-serif;">Spicy salami, chilli honey</p>
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:0.7rem 0;border-bottom:2px dotted #4a3c33;"><span style="font-size:1.5rem;font-weight:900;">Tartufo</span><span style="font-size:1.6rem;color:#e74c3c;font-weight:900;">$19</span></div>
      <p style="margin:0.3rem 0 1rem;font-size:1.05rem;color:#bfa98f;font-family:Arial,sans-serif;">Truffle cream, wild mushrooms</p>
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:0.7rem 0;"><span style="font-size:1.5rem;font-weight:900;">Burrata Pesto</span><span style="font-size:1.6rem;color:#e74c3c;font-weight:900;">$18</span></div>
      <p style="margin:0.3rem 0 0;font-size:1.05rem;color:#bfa98f;font-family:Arial,sans-serif;">Creamy burrata, basil pesto</p>
    </div>
    <div style="border-radius:1.2rem;overflow:hidden;position:relative;background-image:url('https://picsum.photos/seed/pizza-oven/700/900');background-size:cover;background-position:center;">
      <div style="position:absolute;inset:auto 0 0 0;background:linear-gradient(transparent,#161210 85%);padding:3rem 1.6rem 1.6rem;">
        <div style="font-size:1.9rem;font-weight:900;line-height:1.25;">🍕 BUY ANY LARGE PIZZA<br/><span style="color:#f6c344;">GET GARLIC KNOTS FREE</span></div>
      </div>
    </div>
  </div>
</div>`,
  },
  {
    id: 'taco-fiesta',
    name: 'Taco Fiesta',
    content: `<div style="width:100vw;height:100vh;background:#fdf3dd;color:#33302a;font-family:'Verdana',sans-serif;display:flex;overflow:hidden;margin:0;padding:0;box-sizing:border-box;">
  <div style="width:32%;background:#0e7a4e;color:#fdf3dd;padding:3.5rem 2.6rem;display:flex;flex-direction:column;justify-content:center;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;border-radius:50%;background:#f2a007;"></div>
    <div style="position:absolute;bottom:-60px;left:-30px;width:220px;height:220px;border-radius:50%;background:#0a5e3c;"></div>
    <h1 style="font-size:4.4rem;line-height:0.95;margin:0 0 1rem;transform:rotate(-3deg);text-shadow:5px 5px 0 #0a5e3c;">CASA<br/>TACO</h1>
    <p style="font-size:1.5rem;margin:0 0 2.5rem;letter-spacing:0.14em;">🌮 STREET FOOD KITCHEN</p>
    <div style="background:#f2a072;color:#33302a;padding:1.4rem 1.8rem;border-radius:1rem;transform:rotate(-2deg);box-shadow:6px 6px 0 #0a5e3c;">
      <div style="font-size:1.35rem;font-weight:bold;">🥤 TACO TUESDAY</div>
      <div style="font-size:1.9rem;font-weight:900;">ALL TACOS $2.50</div>
    </div>
  </div>
  <div style="flex:1;padding:3rem 3.5rem;display:flex;flex-direction:column;gap:1.6rem;justify-content:center;">
    <div style="display:flex;gap:1.6rem;">
      <div style="flex:1;background:#fff;border-radius:1.2rem;padding:1.8rem 2rem;box-shadow:0 8px 22px rgba(51,48,42,0.12);border:4px solid #0e7a4e;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;"><h2 style="font-size:1.8rem;margin:0;color:#0e7a4e;">Carne Asada</h2><span style="font-size:2rem;font-weight:900;color:#c0392b;">$3.75</span></div>
        <p style="margin:0.4rem 0 0;font-size:1.15rem;color:#6e6558;">Grilled steak, onion, cilantro, salsa verde</p>
      </div>
      <div style="flex:1;background:#fff;border-radius:1.2rem;padding:1.8rem 2rem;box-shadow:0 8px 22px rgba(51,48,42,0.12);border:4px solid #f2a007;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;"><h2 style="font-size:1.8rem;margin:0;color:#0e7a4e;">Al Pastor</h2><span style="font-size:2rem;font-weight:900;color:#c0392b;">$3.50</span></div>
        <p style="margin:0.4rem 0 0;font-size:1.15rem;color:#6e6558;">Marinated pork, pineapple, red onion</p>
      </div>
    </div>
    <div style="display:flex;gap:1.6rem;">
      <div style="flex:1;background:#fff;border-radius:1.2rem;padding:1.8rem 2rem;box-shadow:0 8px 22px rgba(51,48,42,0.12);border:4px solid #c0392b;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;"><h2 style="font-size:1.8rem;margin:0;color:#0e7a4e;">Baja Fish</h2><span style="font-size:2rem;font-weight:900;color:#c0392b;">$4.25</span></div>
        <p style="margin:0.4rem 0 0;font-size:1.15rem;color:#6e6558;">Crispy cod, chipotle mayo, slaw</p>
      </div>
      <div style="flex:1;background:#fff;border-radius:1.2rem;padding:1.8rem 2rem;box-shadow:0 8px 22px rgba(51,48,42,0.12);border:4px solid #33302a;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;"><h2 style="font-size:1.8rem;margin:0;color:#0e7a4e;">Hongos Vegan</h2><span style="font-size:2rem;font-weight:900;color:#c0392b;">$3.50</span></div>
        <p style="margin:0.4rem 0 0;font-size:1.15rem;color:#6e6558;">Roasted mushroom, avocado, salsa macha</p>
      </div>
    </div>
    <div style="background:#33302a;color:#fdf3dd;border-radius:1rem;padding:1.2rem 2rem;display:flex;justify-content:space-around;align-items:center;font-size:1.35rem;">
      <span>🧀 Quesadilla <strong>$7</strong></span><span>🌽 Elote Cup <strong>$4</strong></span><span>🍹 Agua Fresca <strong>$3</strong></span><span>🍮 Flan <strong>$4</strong></span>
    </div>
  </div>
</div>`,
  },
  {
    id: 'seafood-shack',
    name: 'Seafood Shack',
    content: `<div style="width:100vw;height:100vh;background:linear-gradient(160deg,#062a4a 0%,#0a3d63 55%,#0d5c86 100%);color:#eaf6ff;font-family:'Georgia',serif;display:flex;flex-direction:column;overflow:hidden;margin:0;padding:3rem 4.5rem;box-sizing:border-box;">
  <header style="text-align:center;margin-bottom:2.2rem;">
    <p style="margin:0;font-size:1.3rem;letter-spacing:0.5em;color:#7fd1ff;">THE BLUE PIER</p>
    <h1 style="font-size:3.8rem;margin:0.4rem 0 0.6rem;font-style:italic;">Fresh Catch of the Day 🐟</h1>
    <div style="width:140px;height:3px;background:#7fd1ff;margin:0 auto;"></div>
  </header>
  <div style="display:flex;gap:2.5rem;flex:1;">
    <div style="flex:1.1;background:rgba(255,255,255,0.06);border:1px solid rgba(127,209,255,0.35);border-radius:1.4rem;padding:2.4rem 2.8rem;backdrop-filter:blur(4px);">
      <h2 style="font-size:2rem;color:#7fd1ff;margin:0 0 1.6rem;letter-spacing:0.12em;text-transform:uppercase;">From the Ocean</h2>
      <div style="display:flex;flex-direction:column;gap:1.5rem;">
        <div><div style="display:flex;align-items:baseline;"><span style="font-size:1.65rem;font-weight:bold;">Grilled Salmon Plate</span><span style="flex:1;border-bottom:2px dotted rgba(127,209,255,0.5);margin:0 0.8rem;"></span><span style="font-size:1.75rem;font-weight:bold;color:#ffd166;">$21</span></div><p style="margin:0.3rem 0 0;font-size:1.15rem;color:#b8dcf0;">Lemon dill butter, seasonal vegetables</p></div>
        <div><div style="display:flex;align-items:baseline;"><span style="font-size:1.65rem;font-weight:bold;">Lobster Roll</span><span style="flex:1;border-bottom:2px dotted rgba(127,209,255,0.5);margin:0 0.8rem;"></span><span style="font-size:1.75rem;font-weight:bold;color:#ffd166;">$24</span></div><p style="margin:0.3rem 0 0;font-size:1.15rem;color:#b8dcf0;">Toasted brioche, herb aioli, fries</p></div>
        <div><div style="display:flex;align-items:baseline;"><span style="font-size:1.65rem;font-weight:bold;">Fish &amp; Chips</span><span style="flex:1;border-bottom:2px dotted rgba(127,209,255,0.5);margin:0 0.8rem;"></span><span style="font-size:1.75rem;font-weight:bold;color:#ffd166;">$16</span></div><p style="margin:0.3rem 0 0;font-size:1.15rem;color:#b8dcf0;">Beer-battered cod, mushy peas, tartar</p></div>
        <div><div style="display:flex;align-items:baseline;"><span style="font-size:1.65rem;font-weight:bold;">Shrimp Po' Boy</span><span style="flex:1;border-bottom:2px dotted rgba(127,209,255,0.5);margin:0 0.8rem;"></span><span style="font-size:1.75rem;font-weight:bold;color:#ffd166;">$15</span></div><p style="margin:0.3rem 0 0;font-size:1.15rem;color:#b8dcf0;">Crispy shrimp, remoulade, pickles</p></div>
      </div>
    </div>
    <div style="flex:0.75;display:flex;flex-direction:column;gap:1.8rem;">
      <div style="background:#ffd166;color:#062a4a;border-radius:1.4rem;padding:2rem;text-align:center;transform:rotate(1deg);box-shadow:0 14px 30px rgba(0,0,0,0.3);">
        <div style="font-size:1.25rem;font-weight:bold;letter-spacing:0.2em;">CHEF'S PLATTER FOR TWO</div>
        <div style="font-size:3rem;font-weight:900;margin-top:0.4rem;">$49</div>
        <div style="font-size:1.15rem;">Lobster · salmon · prawns · chowder</div>
      </div>
      <div style="flex:1;background:rgba(255,255,255,0.06);border-radius:1.4rem;padding:1.8rem 2.2rem;border:1px solid rgba(127,209,255,0.35);">
        <h2 style="font-size:1.5rem;color:#7fd1ff;margin:0 0 1rem;letter-spacing:0.1em;">Raw Bar</h2>
        <div style="display:flex;flex-direction:column;gap:0.8rem;font-size:1.35rem;">
          <div style="display:flex;justify-content:space-between;"><span>Oysters (half dozen)</span><strong>$14</strong></div>
          <div style="display:flex;justify-content:space-between;"><span>Tuna Tartare</span><strong>$16</strong></div>
          <div style="display:flex;justify-content:space-between;"><span>Ceviche del Día</span><strong>$13</strong></div>
        </div>
      </div>
    </div>
  </div>
</div>`,
  },
]
