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

## 2) Vercel deploy (quick)

1. Push this folder to a GitHub repo (or include it in an existing repo).
2. Import project in Vercel.
3. In Vercel project settings, add environment variables:
   - `LYZR_API_KEY`
   - `LYZR_AGENT_ID`
4. Deploy.

## Notes

- API key is used only in server routes (`app/api/session/start` and `app/api/session/end`) and never exposed in browser code.
- Session lifecycle:
  - Start: `POST /v1/session/start`
  - End: `POST /v1/session/end`
