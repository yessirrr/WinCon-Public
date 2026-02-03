
# Win Condition Summary Templates

Below is a collection of hard-coded summary variants grouped by analytic pillar.
Each variant should be used conditionally based on model output thresholds
(e.g., lift, confidence, performance rate, conversion %, etc.).

## Side-Half Identity Variants

- Strong attack-side skew on **{map}** (+{delta} pts, {confidence}% confidence).
- Leans heavily toward attack on **{map}** with a win rate delta of +{delta} pts.
- Prefers attacking setups on **{map}** – statistically significant skew.
- **Defense-leaning** on **{map}**: +{delta} pts in win rate, consistent across matches.
- Plays best defensively on **{map}**, with a {confidence}% confidence interval.
- **Balanced side performance** on most maps – no significant identity detected.
- Mixed identity across maps – flexible prep recommended.

## Closing Ability Under Pressure Variants

- Converts leads poorly from scorelines like 11–9 or 12–10 (rate: {conversion}%).
- Negative momentum coefficient – team struggles when pressured late.
- Weak closer: low lead conversion rates from match-point situations.
- **Choke-risk detected**: logistic model shows negative closing coefficient.
- Slightly below average in converting map-point scenarios.
- **Above-average finisher**: closes 12–10 leads with {conversion}% consistency.
- Strong late-game team – positive closing coefficient, resilient in pressure rounds.

## Player Outcome Dependence Variants

- **{player}** is the team’s hinge: +{lift} pts win rate when above median KD.
- High-leverage player: team win% jumps by +{lift} pts when **{player}** performs.
- Volatile carry: **{player}** drives results, but overperforms in only {frequency}% of maps.
- **{player}** consistency is key – large swing in win rate depending on their output.
- Team success loosely correlated with **{player}** performance – low dependency.
- No significant outcome dependence on individual players.

## Summary Conclusion Variants

- Strategic focus: force the team to play defense on **{map}**, where they underperform.
- Strategic focus: look to punish early if **{player}** starts hot – they’re win-triggered.
- Strategic focus: play for late-round conversions – this team folds under pressure.
- Strategic focus: limit executes on **{map}**, where they’re most comfortable.
- Strategic focus: team is structurally balanced – focus on role disruption.
- Strategic focus: apply economic pressure – win% drops with limited utility usage.

---

# Usage Notes

- Each section (side, closing, player, focus) should draw from this pool.
- Avoid repeating the same variant type across teams in the same report.
- Consider adding randomness or scenario tagging to rotate phrasing.
