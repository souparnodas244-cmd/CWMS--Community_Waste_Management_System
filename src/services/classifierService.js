const { Jimp } = require('jimp');

/**
 * WASTE IMAGE CLASSIFIER
 * -----------------------------------------------------------------------
 * The problem statement calls for a TensorFlow vision model that verifies
 * correct waste segregation from a photo. Training/shipping that model is
 * outside a backend-prototype's scope, so this module is a real, working
 * stand-in: it actually decodes the uploaded image and derives a
 * prediction from its color/brightness profile (organic waste trends
 * green/brown, recyclables trend bright/metallic, hazardous items trend
 * very dark or high-saturation warning colors).
 *
 * It is deliberately isolated behind one function, `classifyWasteImage`,
 * so swapping in a real model later (e.g. a TF.js/Keras model served from
 * a Python microservice) means changing this file only — every caller
 * (wasteLogService) is unaffected. That's the extension point for the
 * hackathon's ML/CV track.
 */

const TYPES = ['ORGANIC', 'RECYCLABLE', 'HAZARDOUS', 'MIXED'];

async function classifyWasteImage(imagePath) {
  const image = await Jimp.read(imagePath);
  image.resize({ w: 64, h: 64 }); // downsample for a fast, stable aggregate signal

  let rSum = 0, gSum = 0, bSum = 0, saturationSum = 0;
  const pixelCount = image.bitmap.width * image.bitmap.height;

  image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    rSum += r; gSum += g; bSum += b;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    saturationSum += max === 0 ? 0 : (max - min) / max;
  });

  const avg = { r: rSum / pixelCount, g: gSum / pixelCount, b: bSum / pixelCount };
  const brightness = (avg.r + avg.g + avg.b) / 3;
  const avgSaturation = saturationSum / pixelCount;

  // Simple, explainable scoring rules — replace with model.predict() output.
  const scores = { ORGANIC: 0, RECYCLABLE: 0, HAZARDOUS: 0, MIXED: 0 };

  scores.ORGANIC += Math.max(0, avg.g - Math.max(avg.r, avg.b)) / 255; // green/brown produce
  scores.ORGANIC += brightness < 140 ? 0.15 : 0;

  scores.RECYCLABLE += brightness > 150 ? 0.4 : 0;                    // plastics/metal/glass, bright
  scores.RECYCLABLE += avg.b > avg.g ? 0.2 : 0;                        // bluish tint (plastics/glass)

  scores.HAZARDOUS += brightness < 60 ? 0.35 : 0;                      // very dark items
  scores.HAZARDOUS += avgSaturation > 0.55 ? 0.25 : 0;                 // vivid warning colors

  scores.MIXED = 0.2; // baseline fallback so nothing is ever exactly zero everywhere

  const [predictedType, topScore] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const confidence = Math.min(0.97, Math.max(0.35, topScore / totalScore));

  return {
    predictedType: TYPES.includes(predictedType) ? predictedType : 'MIXED',
    confidence: Number(confidence.toFixed(2)),
    scores,
    modelVersion: 'heuristic-color-v0 (placeholder — swap for trained CV model)',
  };
}

module.exports = { classifyWasteImage };
