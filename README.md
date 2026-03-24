# Lyzr Voice Agent Sandbox

Simple standalone app to test your Lyzr Studio voice agent with:
- one big mic button
- live transcript feed (you + agent)
- quick deploy path to Vercel

## 1) Local setup

Create your env file:

```bash
cp .env.example .env.local
```

Set values in `.env.local`:

```bash
LYZR_API_KEY=your_lyzr_api_key
LYZR_AGENT_ID=69c2cefaacdaaa90b7005cd5
```

Install + run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Start Mic**, allow microphone access, and start speaking.

## 2) Vercel deploy

1. Push this repo to GitHub (when this folder is the **repository root**, no extra config is needed).
2. In [Vercel](https://vercel.com/new): **Import** the repo. Framework is detected as **Next.js** (`vercel.json` sets `installCommand` + `buildCommand`).
3. If this folder lives inside a **monorepo**, set **Root Directory** to `voice-agent-sandbox`.
4. **Environment Variables** (add for **Production** and **Preview** if you want preview links to work):
   - `LYZR_API_KEY`
   - `LYZR_AGENT_ID`
5. **Deploy**. First build runs `npm ci` then `npm run build` (same as CI).

### Checklist

- [ ] Node **20.9+** on Vercel (matches `.nvmrc` / `package.json` `engines`).
- [ ] Mic / voice works only on **HTTPS** (Vercel preview + production URLs are fine).
- [ ] Redeploy after changing env vars.

## Notes

- API key is used only in server routes (`app/api/session/start` and `app/api/session/end`) and never exposed in browser code.
- Session lifecycle (Lyzr LiveKit API host):
  - Start: `POST .../v1/sessions/start`
  - End: `POST .../v1/sessions/end`
