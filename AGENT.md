# instructions for agent
## 1. Alerts
- when the agent has finished a task, that generates a link, has a question or needs to ask for help, it should alert the user by sending a message to the user via Telegram. The message should include the link, question or request for help.

## 2. Function to recreate HTTPS link + Telegram alert
- Use `npm run dev:https:renew` to recreate the HTTPS tunnel link and send the Telegram alert automatically.
- The command stops previous Vite/cloudflared processes, creates a new link, and sends link + environment info via Telegram.
