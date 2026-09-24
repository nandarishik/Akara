# Café playbooks (Phase 11)

Code is written from scratch. Formulas:

- Menu engineering: Kasavana & Smith (1982). Popularity index vs mix average; CM index vs average CM. Quadrants star / plowhorse / puzzle / dog at 1.0.
- Leaks: MarginChef `leaks.py` *approach* only — high food cost, price lag, bleeding bestseller, dead weight, waste spike. Biggest leak per item wins.
- Repricing: 15% cost rise, 30 stale days, +10% cap, nearest ₹5.
- GST: advisory slabs; every item includes `Consult your CA`.
- Delivery: price × (1 − commission) − food cost; defaults Swiggy 25% / Zomato 22%.
- Weather: rain / heat only; cache miss → no signal.
- Festivals: 14-day inclusive window.

Do not copy DecisionBox, Gueridon, or B.I.A.S.E.D. source.
