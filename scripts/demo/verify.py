"""Independently compute every demo answer and check it against the stored letter."""
import json, sys
from fractions import Fraction as F
from itertools import combinations
from math import comb, factorial, pi
import sympy as sp

def choice_value(s):
    return sp.nsimplify(sp.sympify(s.replace("pi", "pi")), rational=False)

computed = {}
computed["div35"] = sum(1 for n in range(1, 100) if (n % 3 == 0) != (n % 5 == 0))
computed["pow7"] = pow(7, 2026, 10)
a, b = sp.symbols("a b", positive=True)
sol = sp.solve([a + b - 17, a**2 + b**2 - 169], [a, b])
computed["rect"] = sol[0][0] * sol[0][1]
computed["candy"] = sum(1 for x in range(1, 7) for y in range(1, 7) if 6 - x - y >= 1)
computed["dice"] = F(sum(1 for i in range(1, 7) for j in range(1, 7) if (i * j) % 2 == 0), 36)
r, k = sp.symbols("r k")
computed["vieta"] = sp.solve([r + 2 * r - 7, r * 2 * r - k], [r, k], dict=True)[0][k]
computed["simtri"] = F(6) * F(10, 4)
computed["zeros"] = sum(50 // 5**i for i in range(1, 4))
s = 2
for n in range(1, 10): s += 2 * n
computed["seq"] = s
computed["digsum"] = sum(1 for n in range(1000, 10000) if sum(map(int, str(n))) == 4)
computed["nocons"] = sum(1 for m in range(1 << 10) if (m & (m >> 1)) == 0)
computed["ev6"] = sp.summation(sp.Symbol("n") * sp.Rational(5, 6)**(sp.Symbol("n") - 1) * sp.Rational(1, 6), (sp.Symbol("n"), 1, sp.oo))
computed["egypt"] = sum(1 for x in range(1, 1000) for y in range(1, 1000) if F(1, x) + F(1, y) == F(1, 6))
computed["sqcirc"] = sp.pi * 1**2 / 4
computed["fact1000"] = next(n for n in range(1, 100) if factorial(n) % 1000 == 0)
computed["coordtri"] = abs(6 * 5 - 0 * 2) / 2
computed["parity"] = sum(1 for n in range(1, 101) if (n * n + n) % 2 == 0)
x, y = sp.symbols("x y")
computed["logs"] = sp.simplify(sp.log(3, 2) * sp.log(32, 3))
computed["paths"] = comb(7, 3) - comb(3, 1) * comb(4, 2)
computed["incircle"] = F(3 * 4, 3 + 4 + 5)  # r = area / semiperimeter = 6/6

probs = json.load(open(sys.argv[1]))
bad = 0
for p in probs:
    val = sp.nsimplify(sp.sympify(str(computed[p["key"]])))
    matches = [L for L, c in p["choices"].items() if sp.simplify(choice_value(c) - val) == 0]
    status = "OK " if matches == [p["answer"]] else "BAD"
    if status == "BAD": bad += 1
    print(f"{status} {p['key']:9s} computed={val} matching_choices={matches} stored={p['answer']}")
letters = [p["answer"] for p in probs]
print("answer letter spread:", {L: letters.count(L) for L in "ABCDE"})
sys.exit(1 if bad else 0)
