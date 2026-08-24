import type { BoardTemplate } from './types'

/**
 * Restaurant TV menu templates — designed for 16:9 displays (1080p)
 * read from 3+ metres away: large type, high contrast, clear prices.
 */
export const TEMPLATES_BASIC: BoardTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    content: '<div style="width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #111; color: #fff; font-family: sans-serif; margin: 0; padding: 0; box-sizing: border-box; overflow: hidden;">\n  <h1>Your Menu Here</h1>\n</div>',
  },
  {
    id: 'classic-bistro',
    name: 'Classic Bistro',
    content: `<div style="width:100vw;height:100vh;background:#f7f2e8;color:#2b2118;font-family:Georgia,'Times New Roman',serif;display:flex;overflow:hidden;margin:0;padding:0;box-sizing:border-box;">
  <div style="width:26%;background:#7a1f1f;color:#f7f2e8;padding:4rem 2.5rem;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;">
    <div style="width:120px;height:120px;border-radius:50%;border:3px solid #d4a944;display:flex;align-items:center;justify-content:center;font-size:3.5rem;">🍷</div>
    <h1 style="font-size:3.4rem;line-height:1.1;margin:2rem 0 0.8rem;font-weight:700;">Maison<br/>Belle</h1>
    <p style="font-size:1.3rem;letter-spacing:0.35em;margin:0;color:#e8c987;">EST. 1987</p>
    <div style="width:60px;height:2px;background:#d4a944;margin:2rem auto;"></div>
    <p style="font-size:1.25rem;font-style:italic;line-height:1.6;margin:0;">Today's special:<br/><strong style="color:#e8c987;">Coq au Vin — $18</strong></p>
  </div>
  <div style="flex:1;padding:3.5rem 4rem;display:grid;grid-template-columns:1fr 1fr;gap:0 4rem;align-content:center;">
    <div>
      <h2 style="font-size:2.2rem;letter-spacing:0.18em;text-transform:uppercase;border-bottom:3px double #7a1f1f;padding-bottom:0.6rem;margin:0 0 1.6rem;color:#7a1f1f;">Starters</h2>
      <div style="margin-bottom:1.5rem;"><div style="display:flex;align-items:baseline;"><span style="font-size:1.65rem;font-weight:bold;">French Onion Soup</span><span style="flex:1;border-bottom:3px dotted #b39b74;margin:0 0.8rem;"></span><span style="font-size:1.65rem;font-weight:bold;color:#7a1f1f;">$8</span></div><p style="margin:0.35rem 0 0;font-size:1.15rem;color:#6b5d4d;">Gratinéed with gruyère &amp; sourdough</p></div>
      <div style="margin-bottom:1.5rem;"><div style="display:flex;align-items:baseline;"><span style="font-size:1.65rem;font-weight:bold;">Escargots</span><span style="flex:1;border-bottom:3px dotted #b39b74;margin:0 0.8rem;"></span><span style="font-size:1.65rem;font-weight:bold;color:#7a1f1f;">$11</span></div><p style="margin:0.35rem 0 0;font-size:1.15rem;color:#6b5d4d;">Garlic-herb butter, baguette points</p></div>
      <div style="margin-bottom:1.5rem;"><div style="display:flex;align-items:baseline;"><span style="font-size:1.65rem;font-weight:bold;">Salade Niçoise</span><span style="flex:1;border-bottom:3px dotted #b39b74;margin:0 0.8rem;"></span><span style="font-size:1.65rem;font-weight:bold;color:#7a1f1f;">$12</span></div><p style="margin:0.35rem 0 0;font-size:1.15rem;color:#6b5d4d;">Seared tuna, olives, soft egg</p></div>
    </div>
    <div>
      <h2 style="font-size:2.2rem;letter-spacing:0.18em;text-transform:uppercase;border-bottom:3px double #7a1f1f;padding-bottom:0.6rem;margin:0 0 1.6rem;color:#7a1f1f;">Mains</h2>
      <div style="margin-bottom:1.5rem;"><div style="display:flex;align-items:baseline;"><span style="font-size:1.65rem;font-weight:bold;">Steak Frites</span><span style="flex:1;border-bottom:3px dotted #b39b74;margin:0 0.8rem;"></span><span style="font-size:1.65rem;font-weight:bold;color:#7a1f1f;">$24</span></div><p style="margin:0.35rem 0 0;font-size:1.15rem;color:#6b5d4d;">Prime sirloin, maître d' butter</p></div>
      <div style="margin-bottom:1.5rem;"><div style="display:flex;align-items:baseline;"><span style="font-size:1.65rem;font-weight:bold;">Duck Confit</span><span style="flex:1;border-bottom:3px dotted #b39b74;margin:0 0.8rem;"></span><span style="font-size:1.65rem;font-weight:bold;color:#7a1f1f;">$22</span></div><p style="margin:0.35rem 0 0;font-size:1.15rem;color:#6b5d4d;">White beans, garlic sausage</p></div>
      <div style="margin-bottom:1.5rem;"><div style="display:flex;align-items:baseline;"><span style="font-size:1.65rem;font-weight:bold;">Ratatouille</span><span style="flex:1;border-bottom:3px dotted #b39b74;margin:0 0.8rem;"></span><span style="font-size:1.65rem;font-weight:bold;color:#7a1f1f;">$16</span></div><p style="margin:0.35rem 0 0;font-size:1.15rem;color:#6b5d4d;">Provençal vegetables, herbed couscous</p></div>
      <div style="margin-top:2rem;background:#2b2118;color:#f7f2e8;padding:1rem 1.6rem;border-radius:0.6rem;display:inline-block;">
        <span style="font-size:1.3rem;letter-spacing:0.12em;">🍽 DESSERT OF THE DAY — <strong style="color:#e8c987;">Crème Brûlée $7</strong></span>
      </div>
    </div>
  </div>
</div>`,
  },
  {
    id: 'cafe-morning',
    name: 'Café Morning',
    content: `<div style="width:100vw;height:100vh;background:linear-gradient(135deg,#fdf6ec 0%,#f5e6cf 100%);color:#3d2c23;font-family:'Trebuchet MS',Verdana,sans-serif;display:flex;flex-direction:column;overflow:hidden;margin:0;padding:3rem 4rem;box-sizing:border-box;">
  <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem;">
    <div style="display:flex;align-items:center;gap:1.4rem;">
      <div style="width:84px;height:84px;border-radius:50%;background:#8a5a33;display:flex;align-items:center;justify-content:center;font-size:2.6rem;">☕</div>
      <div>
        <h1 style="font-size:3.2rem;margin:0;letter-spacing:0.06em;">Sunrise Café</h1>
        <p style="margin:0.2rem 0 0;font-size:1.35rem;color:#8a5a33;letter-spacing:0.28em;">BREAKFAST · PASTRY · COFFEE</p>
      </div>
    </div>
    <div style="background:#8a5a33;color:#fdf6ec;padding:0.9rem 2rem;border-radius:999px;font-size:1.35rem;font-weight:bold;transform:rotate(-2deg);">☕ HAPPY HOUR 7–9 AM</div>
  </header>
  <div style="display:flex;gap:3.5rem;flex:1;">
    <div style="flex:1.15;background:#fffdf8;border-radius:1.4rem;padding:2.2rem 2.6rem;box-shadow:0 10px 30px rgba(90,61,38,0.12);">
      <h2 style="font-size:2rem;color:#8a5a33;margin:0 0 1.4rem;letter-spacing:0.14em;text-transform:uppercase;">Breakfast Plates</h2>
      <div style="display:flex;flex-direction:column;gap:1.3rem;">
        <div><div style="display:flex;align-items:baseline;"><span style="font-size:1.55rem;font-weight:bold;">Big Sunrise Platter</span><span style="flex:1;border-bottom:3px dotted #d9c4a6;margin:0 0.7rem;"></span><span style="font-size:1.7rem;font-weight:bold;color:#b3541e;">$13</span></div><p style="margin:0.25rem 0 0;font-size:1.15rem;color:#7a6a58;">Eggs your way, bacon, sausage, hash brown &amp; toast</p></div>
        <div><div style="display:flex;align-items:baseline;"><span style="font-size:1.55rem;font-weight:bold;">Avocado Smash Toast</span><span style="flex:1;border-bottom:3px dotted #d9c4a6;margin:0 0.7rem;"></span><span style="font-size:1.7rem;font-weight:bold;color:#b3541e;">$10</span></div><p style="margin:0.25rem 0 0;font-size:1.15rem;color:#7a6a58;">Sourdough, poached eggs, chilli flakes</p></div>
        <div><div style="display:flex;align-items:baseline;"><span style="font-size:1.55rem;font-weight:bold;">Buttermilk Pancakes</span><span style="flex:1;border-bottom:3px dotted #d9c4a6;margin:0 0.7rem;"></span><span style="font-size:1.7rem;font-weight:bold;color:#b3541e;">$9</span></div><p style="margin:0.25rem 0 0;font-size:1.15rem;color:#7a6a58;">Maple syrup, whipped butter, berries</p></div>
        <div><div style="display:flex;align-items:baseline;"><span style="font-size:1.55rem;font-weight:bold;">Veggie Omelette</span><span style="flex:1;border-bottom:3px dotted #d9c4a6;margin:0 0.7rem;"></span><span style="font-size:1.7rem;font-weight:bold;color:#b3541e;">$11</span></div><p style="margin:0.25rem 0 0;font-size:1.15rem;color:#7a6a58;">Three eggs, spinach, feta, roasted peppers</p></div>
      </div>
    </div>
    <div style="flex:0.85;display:flex;flex-direction:column;gap:1.6rem;">
      <div style="background:#8a5a33;color:#fdf6ec;border-radius:1.4rem;padding:2rem 2.4rem;flex:1;">
        <h2 style="font-size:1.9rem;margin:0 0 1.2rem;letter-spacing:0.14em;text-transform:uppercase;">Coffee Bar</h2>
        <div style="display:flex;flex-direction:column;gap:0.9rem;font-size:1.45rem;">
          <div style="display:flex;justify-content:space-between;"><span>Espresso / Macchiato</span><strong>$3</strong></div>
          <div style="display:flex;justify-content:space-between;"><span>Flat White</span><strong>$4</strong></div>
          <div style="display:flex;justify-content:space-between;"><span>Caramel Latte</span><strong>$5</strong></div>
          <div style="display:flex;justify-content:space-between;"><span>Cold Brew Tonic</span><strong>$5.50</strong></div>
        </div>
      </div>
      <div style="background:#fffdf8;border-radius:1.4rem;padding:1.6rem 2.4rem;box-shadow:0 10px 30px rgba(90,61,38,0.12);">
        <h2 style="font-size:1.6rem;margin:0 0 0.8rem;color:#8a5a33;">🥐 Fresh From The Oven</h2>
        <p style="margin:0;font-size:1.3rem;color:#7a6a58;">Butter croissants &amp; cinnamon rolls — baked every morning at 6 AM.</p>
      </div>
    </div>
  </div>
</div>`,
  },
]
