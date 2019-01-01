# Scatter API

A simple caching layer for generic Scatter data such as prices, tokens, and multi-blockchain account data.


### Killing stuck ports after crashing
Sometimes nodemon shuts down and orphans the detached process.
Use these commands to kill the running process if it throws address-in-use errors.


**Unix:**
- `lsof -i tcp:<port>`
- `kill -9 <pid>`

**Windows:**
- `netstat -ano | findstr :<port>`
- `taskkill /PID <pid> /F`