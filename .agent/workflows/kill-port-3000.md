---
description: Instantly find and kill the process hogging your dev port
---

1. **The Best Way (Cross-Platform)**:
   - Kill it in one command using npx. Works on Mac, Windows, and Linux.
     // turbo
   - Run `npx kill-port 3000`

2. **Mac/Linux Manual Method**:
   - Find PID: `lsof -ti:3000`
   - Kill it: `kill -9 $(lsof -ti:3000)`

3. **Windows Manual Method**:
   - Find PID: `netstat -ano | findstr :3000`
   - Kill it: `taskkill /PID <PID> /F`

4. **Pro Tips**:
   - This works for any port, just change 3000 to whatever you need.
   - Add an alias to your shell profile: `alias kill3000="npx kill-port 3000"`.
