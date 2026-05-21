---
description: Visualize and reduce your production build size
---

1. **Install Analyzer**:
   - Install the Next.js bundle analyzer.
     // turbo
   - Run `npm install @next/bundle-analyzer`

2. **Configure next.config.js**:
   - Wrap your config.

   ```js
   const withBundleAnalyzer = require("@next/bundle-analyzer")({
     enabled: process.env.ANALYZE === "true",
   });
   module.exports = withBundleAnalyzer({
     // Other config options
   });
   ```

3. **Run Analysis**:
   - Build with analysis enabled.
     // turbo
   - Run `ANALYZE=true npm run build`

4. **Pro Tips**:
   - Works with **TurboPack** in Next.js 15.
   - Look for large libraries (like `lodash` or `moment`) that can be tree-shaken or replaced.
   - Use `import { x } from 'package'` instead of `import package from 'package'`.
