const { defineConfig, devices } = require("@playwright/test");

/**
 * The visual half of the preview suite. `check.js` is plain Node and is not run
 * from here; `testDir` keeps the two apart.
 */
module.exports = defineConfig({
  testDir: "./visual",

  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  /*
   * Baselines are shared, not per-machine.
   *
   * Playwright's default filename carries the OS and the project, which quietly
   * gives every contributor a private set that no one else's run can contradict
   * - the opposite of what a baseline is for. One name means a diff on someone
   * else's machine is a real disagreement, to be resolved rather than forked.
   * Its cost is that baselines belong to one environment: Linux, as CI runs.
   */
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",

  use: {
    viewport: { width: 900, height: 700 },
    // A retina-scaled run would diff against every baseline taken at 1x.
    deviceScaleFactor: 1,
    screenshot: "only-on-failure",
  },

  expect: {
    toHaveScreenshot: {
      // Font hinting differs a little between Linux images. Below roughly a
      // character's worth of pixels, so a construct that actually changed still
      // trips it.
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
      scale: "css",
    },
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
