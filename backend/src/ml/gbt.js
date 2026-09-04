// Gradient-boosted decision stumps on the log-odds scale.
// Kept deliberately small (depth-1 trees) so the whole ensemble still fits in
// the model artifact and every split is readable.

const sigmoid = (z) => 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, z))));

function bestStump(X, residual, featureIdx, candidates) {
  let best = null;

  for (const j of featureIdx) {
    for (const t of candidates[j]) {
      let lSum = 0;
      let lN = 0;
      let rSum = 0;
      let rN = 0;

      for (let i = 0; i < X.length; i++) {
        if (X[i][j] <= t) {
          lSum += residual[i];
          lN++;
        } else {
          rSum += residual[i];
          rN++;
        }
      }
      if (lN < 20 || rN < 20) continue;

      // squared-error reduction for a constant fit on each side
      const gain = (lSum * lSum) / lN + (rSum * rSum) / rN;
      if (!best || gain > best.gain) {
        best = { feature: j, threshold: t, left: lSum / lN, right: rSum / rN, gain };
      }
    }
  }
  return best;
}

function quantiles(X, j, k = 12) {
  const vals = X.map((r) => r[j]).sort((a, b) => a - b);
  const out = new Set();
  for (let q = 1; q < k; q++) {
    const v = vals[Math.floor((q / k) * (vals.length - 1))];
    if (Number.isFinite(v)) out.add(v);
  }
  return [...out];
}

export function trainGbt(
  X,
  y,
  { rounds = 160, lr = 0.09, valFraction = 0.15, patience = 20, seed = 11 } = {}
) {
  let rand = seed;
  const rng = () => {
    rand = (rand * 1103515245 + 12345) & 0x7fffffff;
    return rand / 0x7fffffff;
  };

  const idx = X.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const cut = Math.floor(idx.length * (1 - valFraction));
  const trainIdx = idx.slice(0, cut);
  const valIdx = idx.slice(cut);

  const Xt = trainIdx.map((i) => X[i]);
  const yt = trainIdx.map((i) => y[i]);
  const Xv = valIdx.map((i) => X[i]);
  const yv = valIdx.map((i) => y[i]);

  const d = X[0].length;
  const featureIdx = Array.from({ length: d }, (_, j) => j);
  const candidates = featureIdx.map((j) => quantiles(Xt, j));

  const pBar = yt.reduce((s, v) => s + v, 0) / yt.length;
  const base = Math.log(Math.max(1e-6, pBar) / Math.max(1e-6, 1 - pBar));

  const Ft = new Array(Xt.length).fill(base);
  const Fv = new Array(Xv.length).fill(base);

  const trees = [];
  let best = { trees: 0, loss: Infinity };
  let stale = 0;
  const history = [];

  const vloss = () => {
    let s = 0;
    for (let i = 0; i < Fv.length; i++) {
      const p = Math.min(1 - 1e-12, Math.max(1e-12, sigmoid(Fv[i])));
      s += yv[i] ? -Math.log(p) : -Math.log(1 - p);
    }
    return s / Math.max(1, Fv.length);
  };

  for (let r = 0; r < rounds; r++) {
    const residual = Ft.map((f, i) => yt[i] - sigmoid(f));
    const stump = bestStump(Xt, residual, featureIdx, candidates);
    if (!stump) break;

    // Newton step keeps the leaf values on the log-odds scale
    const leafValue = (side) => {
      let num = 0;
      let den = 0;
      for (let i = 0; i < Xt.length; i++) {
        const inSide = Xt[i][stump.feature] <= stump.threshold ? "left" : "right";
        if (inSide !== side) continue;
        const p = sigmoid(Ft[i]);
        num += yt[i] - p;
        den += p * (1 - p);
      }
      return den > 1e-9 ? num / den : 0;
    };

    const tree = {
      feature: stump.feature,
      threshold: +stump.threshold.toFixed(6),
      left: +(lr * leafValue("left")).toFixed(6),
      right: +(lr * leafValue("right")).toFixed(6),
    };
    trees.push(tree);

    for (let i = 0; i < Xt.length; i++)
      Ft[i] += Xt[i][tree.feature] <= tree.threshold ? tree.left : tree.right;
    for (let i = 0; i < Xv.length; i++)
      Fv[i] += Xv[i][tree.feature] <= tree.threshold ? tree.left : tree.right;

    const vl = vloss();
    history.push(+vl.toFixed(5));

    if (vl < best.loss - 1e-5) {
      best = { trees: trees.length, loss: vl };
      stale = 0;
    } else if (++stale >= patience) {
      break;
    }
  }

  return {
    kind: "gbt",
    base: +base.toFixed(6),
    trees: trees.slice(0, best.trees),
    valLoss: +best.loss.toFixed(5),
    lossHistory: history,
  };
}

export function predictGbt(model, row) {
  let f = model.base;
  for (const t of model.trees) f += row[t.feature] <= t.threshold ? t.left : t.right;
  return sigmoid(f);
}

export function explainGbt(model, row) {
  const d = row.length;
  const contrib = new Array(d).fill(0);
  for (const t of model.trees) {
    contrib[t.feature] += row[t.feature] <= t.threshold ? t.left : t.right;
  }
  return contrib;
}
