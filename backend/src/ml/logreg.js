// Logistic regression, mini-batch gradient descent with L2 and early stopping.
// Pure JS on purpose: the API host has no Python and no native build step, and
// a linear model is the only kind we can hand an officer a reason from.

const sigmoid = (z) => 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, z))));

export function fitScaler(X) {
  const d = X[0].length;
  const mean = new Array(d).fill(0);
  const std = new Array(d).fill(0);

  for (const row of X) for (let j = 0; j < d; j++) mean[j] += row[j];
  for (let j = 0; j < d; j++) mean[j] /= X.length;

  for (const row of X) for (let j = 0; j < d; j++) std[j] += (row[j] - mean[j]) ** 2;
  for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j] / X.length) || 1;

  return { mean, std };
}

export const applyScaler = (row, sc) => row.map((v, j) => (v - sc.mean[j]) / sc.std[j]);

export function trainLogreg(
  X,
  y,
  {
    lr = 0.12,
    epochs = 260,
    batchSize = 256,
    l2 = 1e-3,
    valFraction = 0.15,
    patience = 25,
    seed = 7,
  } = {}
) {
  const scaler = fitScaler(X);
  const Z = X.map((r) => applyScaler(r, scaler));
  const d = Z[0].length;

  let rand = seed;
  const rng = () => {
    rand = (rand * 1103515245 + 12345) & 0x7fffffff;
    return rand / 0x7fffffff;
  };

  const idx = Z.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const cut = Math.floor(idx.length * (1 - valFraction));
  const trainIdx = idx.slice(0, cut);
  const valIdx = idx.slice(cut);

  let w = new Array(d).fill(0);
  let b = 0;
  let best = { w: [...w], b, loss: Infinity, epoch: 0 };
  let stale = 0;
  const history = [];

  const loss = (ids) => {
    let s = 0;
    for (const i of ids) {
      const p = Math.min(1 - 1e-12, Math.max(1e-12, sigmoid(dot(Z[i], w) + b)));
      s += y[i] ? -Math.log(p) : -Math.log(1 - p);
    }
    return s / ids.length;
  };

  for (let epoch = 1; epoch <= epochs; epoch++) {
    for (let i = trainIdx.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [trainIdx[i], trainIdx[j]] = [trainIdx[j], trainIdx[i]];
    }

    for (let start = 0; start < trainIdx.length; start += batchSize) {
      const batch = trainIdx.slice(start, start + batchSize);
      const gw = new Array(d).fill(0);
      let gb = 0;

      for (const i of batch) {
        const err = sigmoid(dot(Z[i], w) + b) - y[i];
        for (let j = 0; j < d; j++) gw[j] += err * Z[i][j];
        gb += err;
      }

      const scale = lr / batch.length;
      for (let j = 0; j < d; j++) w[j] -= scale * gw[j] + lr * l2 * w[j];
      b -= scale * gb;
    }

    const vl = valIdx.length ? loss(valIdx) : loss(trainIdx);
    history.push(+vl.toFixed(5));

    if (vl < best.loss - 1e-5) {
      best = { w: [...w], b, loss: vl, epoch };
      stale = 0;
    } else if (++stale >= patience) {
      break;
    }
  }

  return {
    kind: "logreg",
    weights: best.w.map((v) => +v.toFixed(6)),
    bias: +best.b.toFixed(6),
    scaler: {
      mean: scaler.mean.map((v) => +v.toFixed(6)),
      std: scaler.std.map((v) => +v.toFixed(6)),
    },
    stoppedAtEpoch: best.epoch,
    valLoss: +best.loss.toFixed(5),
    lossHistory: history,
  };
}

const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

export function predictLogreg(model, row) {
  const z = applyScaler(row, model.scaler);
  return sigmoid(dot(z, model.weights) + model.bias);
}

// Per-feature signed contribution to the logit. This is what the officer app
// and the dashboard turn into "why".
export function explainLogreg(model, row) {
  const z = applyScaler(row, model.scaler);
  return model.weights.map((w, j) => w * z[j]);
}
