export async function estimateFrameRate(): Promise<number> {
  return new Promise((resolve) => {
    const samples: number[] = [];
    let last = performance.now();

    const tick = () => {
      const now = performance.now();
      samples.push(now - last);
      last = now;

      if (samples.length < 60) {
        requestAnimationFrame(tick);
      } else {
        const avgDelta = samples.reduce((a, b) => a + b) / samples.length;
        resolve(Math.round(1000 / avgDelta));
      }
    };

    requestAnimationFrame(tick);
  });
}
