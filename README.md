# Auto Options Trading

A web-based options trading dashboard for Indian equity indices — Nifty 50, Bank Nifty, and Sensex. Runs five pre-defined strategies, evaluates signals using technical indicators, and executes trades either in paper (simulated) mode or live via the Groww Trade API.

## Features

- **5 Options Strategies**: Bull call spread, bear put spread, iron condor, calendar spread, momentum debit
- **Signal Engine**: RSI, MACD, Bollinger Bands, and IV rank analysis per strategy
- **Risk Management**: Per-trade risk cap, daily loss halt, max open positions, SL/TP brackets, kill switch
- **Paper Trading**: Starts with configurable capital, tracks realized + unrealized P&L
- **Live Trading**: Groww Trade API integration with dry-run validation mode
- **Learning System**: Adjusts strategy confidence based on closed trade outcomes
- **Real-time Dashboard**: SSE stream (~1.5s updates), spot price, IV rank, signals table, open positions

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **State**: Zustand
- **Broker**: Groww Trade API

## Setup

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
TRADING=paper                # paper | live
PAPER_CAPITAL=100000         # starting cash for simulation
MAX_RISK_PER_TRADE_PCT=1     # 1–5%
MAX_DAILY_LOSS_PCT=3         # daily loss halt threshold
MAX_OPEN_POSITIONS=3
GROWW_ACCESS_TOKEN=          # live only, server-side
KILL_SWITCH=0                # 1 = block all new entries
ORDER_DRY_RUN=1              # 1 = validate only, 0 = real orders
ORDER_API_SECRET=            # min 8 chars
```

## Run

```bash
# Development
npm run dev
# → http://localhost:3000

# Production
npm run build && npm start
```

## Usage

1. Select underlying (Nifty / BankNifty / Sensex)
2. Dashboard shows live spot price, IV rank, and strategy signals
3. In paper mode, trades auto-execute based on signal confidence
4. In live mode, set `TRADING=live`, provide `GROWW_ACCESS_TOKEN`, and set `ORDER_DRY_RUN=0`
5. Use `KILL_SWITCH=1` in `.env.local` to halt all new entries immediately

## Risk Warning

Options can lose 100% of premium. This is not investment advice. Always start in paper mode to validate strategies before using real capital.
