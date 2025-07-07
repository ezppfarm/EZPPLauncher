export function estimateRefreshRate(): Promise<number> {
  return new Promise((resolve) => {
    const last = performance.now();
    let frames = 0;

    function loop() {
      const now = performance.now();
      frames++;

      if (now - last >= 1000) {
        console.log(`Estimated Refresh Rate: ${frames - 2} FPS`);
        resolve(frames - 2); // estimated Hz
      } else {
        requestAnimationFrame(loop);
      }
    }

    requestAnimationFrame(loop);
  });
}
