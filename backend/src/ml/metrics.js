export function auc(yTrue, yProb) {
  const pairs = yTrue.map((y, i) => ({ y, p: yProb[i] })).sort((a, b) => a.p - b.p);

  // rank-sum with average ranks for ties
  let i = 0;
  const ranks = new Array(pairs.length);
  while (i < pairs.length) {
    let j = i;
    while (j + 1 < pairs.length && pairs[j + 1].p === pairs[i].p) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = avg;
    i = j + 1;
  }

  let sumPos = 0;
  let nPos = 0;
  for (let k = 0; k < pairs.length; k++) {
    if (pairs[k].y === 1) {
      sumPos += ranks[k];
      nPos++;
    }
  }
  const nNeg = pairs.length - nPos;
  if (nPos === 0 || nNeg === 0) return 0.5;
  return (sumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

export function brier(yTrue, yProb) {
  let s = 0;
  for (let i = 0; i < yTrue.length; i++) s += (yProb[i] - yTrue[i]) ** 2;
  return s / yTrue.length;
}

export function logLoss(yTrue, yProb) {
  const e = 1e-12;
  let s = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const p = Math.min(1 - e, Math.max(e, yProb[i]));
    s += yTrue[i] ? -Math.log(p) : -Math.log(1 - p);
  }
  return s / yTrue.length;
}

export function accuracy(yTrue, yProb, threshold = 0.5) {
  let ok = 0;
  for (let i = 0; i < yTrue.length; i++) if ((yProb[i] >= threshold ? 1 : 0) === yTrue[i]) ok++;
  return ok / yTrue.length;
}

// Precision/recall at the threshold an operator would actually alert on.
export function prAt(yTrue, yProb, threshold) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const pred = yProb[i] >= threshold ? 1 : 0;
    if (pred === 1 && yTrue[i] === 1) tp++;
    else if (pred === 1 && yTrue[i] === 0) fp++;
    else if (pred === 0 && yTrue[i] === 1) fn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision: +precision.toFixed(3), recall: +recall.toFixed(3), f1: +f1.toFixed(3), tp, fp, fn };
}

// Is a predicted 30% actually a 30%? Ten equal-width bins.
export function reliability(yTrue, yProb, bins = 10) {
  const out = [];
  for (let b = 0; b < bins; b++) {
    const lo = b / bins;
    const hi = (b + 1) / bins;
    const idx = [];
    for (let i = 0; i < yProb.length; i++) {
      if (yProb[i] >= lo && (yProb[i] < hi || (b === bins - 1 && yProb[i] <= hi))) idx.push(i);
    }
    if (!idx.length) continue;
    out.push({
      bin: `${lo.toFixed(1)}-${hi.toFixed(1)}`,
      n: idx.length,
      predicted: +(idx.reduce((s, i) => s + yProb[i], 0) / idx.length).toFixed(3),
      observed: +(idx.reduce((s, i) => s + yTrue[i], 0) / idx.length).toFixed(3),
    });
  }
  return out;
}

export function evaluate(yTrue, yProb) {
  return {
    n: yTrue.length,
    positives: yTrue.reduce((s, y) => s + y, 0),
    auc: +auc(yTrue, yProb).toFixed(4),
    brier: +brier(yTrue, yProb).toFixed(4),
    logLoss: +logLoss(yTrue, yProb).toFixed(4),
    accuracy: +accuracy(yTrue, yProb).toFixed(4),
    at50: prAt(yTrue, yProb, 0.5),
    at30: prAt(yTrue, yProb, 0.3),
  };
}
