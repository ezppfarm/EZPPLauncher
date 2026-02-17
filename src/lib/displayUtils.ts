export function estimateRefreshRate(): Promise<number> {
  return new Promise((resolve) => {
    const last = performance.now();
    let frames = 0;

    function loop() {
      const now = performance.now();
      frames++;

      if (now - last >= 1000) {
        resolve(frames - 2);
      } else {
        requestAnimationFrame(loop);
      }
    }

    requestAnimationFrame(loop);
  });
}
