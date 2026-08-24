import type { BoardTemplate } from './types'

export const TEMPLATES_THEMED: BoardTemplate[] = [
  {
    id: 'dark-steakhouse',
    name: 'Dark Steakhouse',
    content: `<div style="width:100vw;height:100vh;background:#121014;color:#f3ece1;font-family:'Didot','Playfair Display',Georgia,serif;display:flex;overflow:hidden;margin:0;padding:0;box-sizing:border-box;">
  <div style="width:30%;background-image:url('https://picsum.photos/seed/steak-grill/800/1100');background-size:cover;background-position:center;position:relative;">
    <div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent,#121014 96%);"></div>
    <div style="position:absolute;left:2.5rem;bottom:3rem;">
      <div style="font-size:1.15rem;letter-spacing:0.4em;color:#d3a94e;">OPEN FIRE</div>
      <div style="font-size:2rem;margin-top:0.5rem;font-style:italic;">Every cut rested,<br/>carved to order.</div>
    </div>
  </div>
  <div style="flex:1;padding:3.2rem 4rem;display:flex;flex-direction:column;">
    <header style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #3a3340;padding-bottom:1.6rem;margin-bottom:2.2rem;">
      <h1 style="font-size:3.8rem;margin:0;letter-spacing:0.1em;">EMBER &amp; OAK</h1>
      <p style="margin:0;font-size:1.25rem;color:#d3a94e;letter-spacing:0.35em;">STEAKHOUSE · GRILL</p>
    </header>
    <div style="display:flex;flex-direction:column;gap:1.7rem;flex:1;justify-content:center;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px dotted #3a3340;padding-bottom:0.9rem;">
        <div><span style="font-size:2rem;font-weight:bold;">Ribeye 400g</span><span style="font-size:1.15rem;color:#b7a993;margin-left:1.2rem;font-family:Verdana,sans-serif;">dry-aged 30 days</span></div>
        <span style="font-size:2.1rem;color:#d3a94e;">$38</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px dotted #3a3340;padding-bottom:0.9rem;">
        <div><span style="font-size:2rem;font-weight:bold;">Filet Mignon 250g</span><span style="font-size:1.15rem;color:#b7a993;margin-left:1.2rem;font-family:Verdana,sans-serif;">grass-fed, charred leek</span></div>
        <span style="font-size:2.1rem;color:#d3a94e;">$42</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px dotted #3a3340;padding-bottom:0.9rem;">
        <div><span style="font-size:2rem;font-weight:bold;">Tomahawk for Two</span><span style="font-size:1.15rem;color:#b7a993;margin-left:1.2rem;font-family:Verdana,sans-serif;">smoked bone marrow butter</span></div>
        <span style="font-size:2.1rem;color:#d3a94e;">$78</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <div><span style="font-size:2rem;font-weight:bold;">Lamb Rack</span><span style="font-size:1.15rem;color:#b7a993;margin-left:1.2rem;font-family:Verdana,sans-serif;">pistachio crust, mint jus</span></div>
        <span style="font-size:2.1rem;color:#d3a94e;">$36</span>
      </div>
    </div>
    <footer style="border-top:1px solid #3a3340;padding-top:1.4rem;display:flex;justify-content:space-between;font-size:1.25rem;color:#b7a993;font-family:Verdana,sans-serif;">
      <span>🥃 Whisky Flight — $22</span>
      <span>🥔 Truffle Pommes — $9</span>
      <span style="color:#d3a94e;">All mains include fire-roasted bread</span>
    </footer>
  </div>
</div>`,
  },
  {
    id: 'sushi-slate',
    name: 'Sushi Slate',
    content: `<div style="width:100vw;height:100vh;background:#0b0d0c;color:#f2f2ee;font-family:'Helvetica Neue',sans-serif;display:flex;flex-direction:column;overflow:hidden;margin:0;padding:3.5rem 5rem;box-sizing:border-box;">
  <header style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #2c2f2d;padding-bottom:1.8rem;margin-bottom:2.4rem;">
    <h1 style="font-size:3.6rem;font-weight:300;letter-spacing:0.32em;margin:0;">海 · KAIYO</h1>
    <span style="font-size:1.25rem;color:#8a8f8b;letter-spacing:0.2em;">OMAKASE &amp; NIGIRI BAR</span>
  </header>
  <div style="display:flex;gap:5rem;flex:1;">
    <div style="flex:1;display:flex;flex-direction:column;gap:1.9rem;">
      <h2 style="font-size:1.4rem;color:#c0392b;letter-spacing:0.3em;margin:0;font-weight:500;">SIGNATURE ROLLS</h2>
      <div style="display:flex;justify-content:space-between;align-items:baseline;"><div><span style="font-size:1.85rem;font-weight:500;">Dragon Roll</span><p style="margin:0.25rem 0 0;font-size:1.1rem;color:#8a8f8b;">Eel, cucumber, avocado crown</p></div><span style="font-size:1.8rem;font-weight:300;">$18</span></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;"><div><span style="font-size:1.85rem;font-weight:500;">Rainbow Roll</span><p style="margin:0.25rem 0 0;font-size:1.1rem;color:#8a8f8b;">Crab inside, sashimi mosaic</p></div><span style="font-size:1.8rem;font-weight:300;">$20</span></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;"><div><span style="font-size:1.85rem;font-weight:500;">Spicy Tuna Crisp</span><p style="margin:0.25rem 0 0;font-size:1.1rem;color:#8a8f8b;">Tempura flakes, sriracha aioli</p></div><span style="font-size:1.8rem;font-weight:300;">$16</span></div>
    </div>
    <div style="width:2px;background:linear-gradient(#2c2f2d, transparent);"></div>
    <div style="flex:1;display:flex;flex-direction:column;gap:1.9rem;">
      <h2 style="font-size:1.4rem;color:#c0392b;letter-spacing:0.3em;margin:0;font-weight:500;">NIGIRI · TWO PIECE</h2>
      <div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-size:1.85rem;font-weight:500;">Sake <span style="color:#8a8f8b;font-size:1.2rem;font-weight:300;margin-left:0.8rem;">salmon</span></span><span style="font-size:1.8rem;font-weight:300;">$8</span></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-size:1.85rem;font-weight:500;">Maguro <span style="color:#8a8f8b;font-size:1.2rem;font-weight:300;margin-left:0.8rem;">tuna</span></span><span style="font-size:1.8rem;font-weight:300;">$9</span></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-size:1.85rem;font-weight:500;">Hamachi <span style="color:#8a8f8b;font-size:1.2rem;font-weight:300;margin-left:0.8rem;">yellowtail</span></span><span style="font-size:1.8rem;font-weight:300;">$9</span></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;"><span style="font-size:1.85rem;font-weight:500;">Unagi <span style="color:#8a8f8b;font-size:1.2rem;font-weight:300;margin-left:0.8rem;">eel</span></span><span style="font-size:1.8rem;font-weight:300;">$10</span></div>
    </div>
    <div style="width:26%;border:1px solid #2c2f2d;border-radius:1.2rem;padding:2rem;display:flex;flex-direction:column;justify-content:center;text-align:center;background:#101211;">
      <div style="font-size:1.15rem;color:#8a8f8b;letter-spacing:0.28em;margin-bottom:1rem;">CHEF'S OMAKASE</div>
      <div style="font-size:3.4rem;font-weight:200;color:#c0392b;">$65</div>
      <div style="font-size:1.15rem;color:#8a8f8b;margin-top:1rem;line-height:1.6;">Nine courses chosen daily<br/>by our itamae</div>
    </div>
  </div>
</div>`,
  },
  {
    id: 'breakfast-diner',
    name: 'Breakfast Diner',
    content: `<div style="width:100vw;height:100vh;background:#fef7ec;color:#29304d;font-family:'Courier New',monospace;display:flex;flex-direction:column;overflow:hidden;margin:0;padding:0;box-sizing:border-box;border-top:20px solid #e4572e;border-bottom:20px solid #e4572e;">
  <header style="text-align:center;padding:2rem 0 1.2rem;background:#29304d;color:#fef7ec;">
    <h1 style="font-size:3.4rem;margin:0;letter-spacing:0.12em;">☆ THE GOLDEN WHISK ☆</h1>
    <p style="margin:0.4rem 0 0;font-size:1.4rem;letter-spacing:0.3em;color:#ffd166;">BREAKFAST SERVED ALL DAY</p>
  </header>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 4rem;padding:2.2rem 5rem;flex:1;align-content:start;">
    <div>
      <div style="display:flex;align-items:baseline;margin-bottom:1.5rem;"><span style="font-size:1.7rem;font-weight:bold;">Sunrise Combo</span><span style="flex:1;border-bottom:3px dashed #c9bfae;margin:0 0.7rem;"></span><span style="font-size:1.8rem;font-weight:bold;color:#e4572e;">$10.50</span></div>
      <div style="display:flex;align-items:baseline;margin-bottom:1.5rem;"><span style="font-size:1.7rem;font-weight:bold;">Stack of Pancakes (3)</span><span style="flex:1;border-bottom:3px dashed #c9bfae;margin:0 0.7rem;"></span><span style="font-size:1.8rem;font-weight:bold;color:#e4572e;">$8.00</span></div>
      <div style="display:flex;align-items:baseline;margin-bottom:1.5rem;"><span style="font-size:1.7rem;font-weight:bold;">Chicken &amp; Waffles</span><span style="flex:1;border-bottom:3px dashed #c9bfae;margin:0 0.7rem;"></span><span style="font-size:1.8rem;font-weight:bold;color:#e4572e;">$13.00</span></div>
      <div style="display:flex;align-items:baseline;margin-bottom:1.5rem;"><span style="font-size:1.7rem;font-weight:bold;">Corned Beef Hash</span><span style="flex:1;border-bottom:3px dashed #c9bfae;margin:0 0.7rem;"></span><span style="font-size:1.8rem;font-weight:bold;color:#e4572e;">$11.50</span></div>
      <div style="display:flex;align-items:baseline;margin-bottom:1.5rem;"><span style="font-size:1.7rem;font-weight:bold;">Biscuits &amp; Gravy</span><span style="flex:1;border-bottom:3px dashed #c9bfae;margin:0 0.7rem;"></span><span style="font-size:1.8rem;font-weight:bold;color:#e4572e;">$9.00</span></div>
    </div>
    <div>
      <div style="display:flex;align-items:baseline;margin-bottom:1.5rem;"><span style="font-size:1.7rem;font-weight:bold;">Veggie Scramble</span><span style="flex:1;border-bottom:3px dashed #c9bfae;margin:0 0.7rem;"></span><span style="font-size:1.8rem;font-weight:bold;color:#e4572e;">$10.00</span></div>
      <div style="display:flex;align-items:baseline;margin-bottom:1.5rem;"><span style="font-size:1.7rem;font-weight:bold;">French Toast Brioche</span><span style="flex:1;border-bottom:3px dashed #c9bfae;margin:0 0.7rem;"></span><span style="font-size:1.8rem;font-weight:bold;color:#e4572e;">$9.50</span></div>
      <div style="display:flex;align-items:baseline;margin-bottom:1.5rem;"><span style="font-size:1.7rem;font-weight:bold;">Steak &amp; Eggs</span><span style="flex:1;border-bottom:3px dashed #c9bfae;margin:0 0.7rem;"></span><span style="font-size:1.8rem;font-weight:bold;color:#e4572e;">$16.00</span></div>
      <div style="display:flex;align-items:baseline;margin-bottom:1.5rem;"><span style="font-size:1.7rem;font-weight:bold;">Fresh Fruit Bowl</span><span style="flex:1;border-bottom:3px dashed #c9bfae;margin:0 0.7rem;"></span><span style="font-size:1.8rem;font-weight:bold;color:#e4572e;">$6.50</span></div>
      <div style="display:flex;align-items:baseline;margin-bottom:1.5rem;"><span style="font-size:1.7rem;font-weight:bold;">Bottomless Coffee</span><span style="flex:1;border-bottom:3px dashed #c9bfae;margin:0 0.7rem;"></span><span style="font-size:1.8rem;font-weight:bold;color:#e4572e;">$3.50</span></div>
    </div>
  </div>
  <footer style="background:#ffd166;padding:1.1rem;text-align:center;font-size:1.45rem;font-weight:bold;color:#29304d;">
    ⭐ KIDS EAT FREE ON SUNDAYS ⭐ &nbsp;·&nbsp; Ask about our pie of the day!
  </footer>
</div>`,
  },
  {
    id: 'dessert-parlour',
    name: 'Dessert Parlour',
    content: `<div style="width:100vw;height:100vh;background:linear-gradient(150deg,#ffe9f0 0%,#fdf6ff 50%,#e8f9f4 100%);color:#4a2c40;font-family:'Trebuchet MS',sans-serif;display:flex;overflow:hidden;margin:0;padding:3rem 4rem;box-sizing:border-box;gap:3rem;">
  <div style="width:34%;background:#fff;border-radius:2rem;padding:3rem;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-shadow:0 16px 40px rgba(180,120,160,0.25);">
    <div style="font-size:5rem;">🍨</div>
    <h1 style="font-size:3rem;margin:1.2rem 0 0.4rem;color:#d63384;">Sugar &amp; Swirl</h1>
    <p style="margin:0;font-size:1.3rem;color:#9c7387;letter-spacing:0.24em;">DESSERT PARLOUR</p>
    <div style="margin-top:2.4rem;width:100%;background:linear-gradient(90deg,#d63384,#7bc4a4);color:#fff;border-radius:999px;padding:1.2rem;font-size:1.4rem;font-weight:bold;">🎉 2 SCOOPS + TOPPING $6</div>
  </div>
  <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:1.6rem;align-content:center;">
    <div style="background:#fff;border-radius:1.4rem;padding:1.6rem 2rem;display:flex;justify-content:space-between;align-items:center;box-shadow:0 8px 20px rgba(180,120,160,0.15);">
      <div><h2 style="margin:0;font-size:1.6rem;color:#d63384;">Berry Waffle Sundae</h2><p style="margin:0.3rem 0 0;font-size:1.1rem;color:#9c7387;">Waffle, vanilla scoop, berry compote</p></div>
      <span style="font-size:2rem;font-weight:900;color:#7bc4a4;">$9</span>
    </div>
    <div style="background:#fff;border-radius:1.4rem;padding:1.6rem 2rem;display:flex;justify-content:space-between;align-items:center;box-shadow:0 8px 20px rgba(180,120,160,0.15);">
      <div><h2 style="margin:0;font-size:1.6rem;color:#d63384;">Molten Choco Cake</h2><p style="margin:0.3rem 0 0;font-size:1.1rem;color:#9c7387;">Warm centre, salted caramel gelato</p></div>
      <span style="font-size:2rem;font-weight:900;color:#7bc4a4;">$8</span>
    </div>
    <div style="background:#fff;border-radius:1.4rem;padding:1.6rem 2rem;display:flex;justify-content:space-between;align-items:center;box-shadow:0 8px 20px rgba(180,120,160,0.15);">
      <div><h2 style="margin:0;font-size:1.6rem;color:#d63384;">Matcha Cheesecake</h2><p style="margin:0.3rem 0 0;font-size:1.1rem;color:#9c7387;">Basque style, white choc drizzle</p></div>
      <span style="font-size:2rem;font-weight:900;color:#7bc4a4;">$7.50</span>
    </div>
    <div style="background:#fff;border-radius:1.4rem;padding:1.6rem 2rem;display:flex;justify-content:space-between;align-items:center;box-shadow:0 8px 20px rgba(180,120,160,0.15);">
      <div><h2 style="margin:0;font-size:1.6rem;color:#d63384;">Banoffee Jar</h2><p style="margin:0.3rem 0 0;font-size:1.1rem;color:#9c7387;">Toffee, banana, crumble layers</p></div>
      <span style="font-size:2rem;font-weight:900;color:#7bc4a4;">$6.50</span>
    </div>
    <div style="background:#fff;border-radius:1.4rem;padding:1.6rem 2rem;display:flex;justify-content:space-between;align-items:center;box-shadow:0 8px 20px rgba(180,120,160,0.15);">
      <div><h2 style="margin:0;font-size:1.6rem;color:#d63384;">Classic Affogato</h2><p style="margin:0.3rem 0 0;font-size:1.1rem;color:#9c7387;">Espresso over fior di latte</p></div>
      <span style="font-size:2rem;font-weight:900;color:#7bc4a4;">$5.50</span>
    </div>
    <div style="background:#fff;border-radius:1.4rem;padding:1.6rem 2rem;display:flex;justify-content:space-between;align-items:center;box-shadow:0 8px 20px rgba(180,120,160,0.15);">
      <div><h2 style="margin:0;font-size:1.6rem;color:#d63384;">Milkshake Flight</h2><p style="margin:0.3rem 0 0;font-size:1.1rem;color:#9c7387;">Pick three mini shakes</p></div>
      <span style="font-size:2rem;font-weight:900;color:#7bc4a4;">$11</span>
    </div>
  </div>
</div>`,
  },
]
