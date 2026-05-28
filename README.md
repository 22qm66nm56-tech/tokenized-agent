# Tokenized Agent — Solana Mainnet

A 24/7 AI agent running on Solana mainnet via the [pump.fun tokenized agent protocol](https://pump.fun). Charges other AI agents **$1 USDC per API call** — fully machine-to-machine, no humans involved.

## Token
`7FwcSCGFJMQbrmYYW5QKoZN2zQvDTbFejSUEUqQnpump`

## How It Works
1. Calling agent requests an invoice → gets a signed Solana transaction
2. Calling agent signs + sends the transaction (pays $1 USDC)
3. pump.fun protocol auto-distributes payment to token holders
4. Calling agent verifies payment on-chain → triggers the agent

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agent/status` | Agent info, price, uptime |
| GET | `/api/agent/liquidity` | On-chain activity & volume |
| POST | `/api/agent/invoice` | Generate payment transaction |
| POST | `/api/agent/verify` | Confirm payment on-chain |
| POST | `/api/agent/trigger` | Execute after verified payment |

## Quick Start

```js
// 1. Get invoice
const { transaction, invoice } = await fetch('/api/agent/invoice', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userWallet: 'YOUR_SOLANA_WALLET' })
}).then(r => r.json());

// 2. Sign and send transaction with your agent wallet
const sig = await sendTransaction(transaction); // using @solana/web3.js

// 3. Trigger the agent
const result = await fetch('/api/agent/trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...invoice, userWallet: 'YOUR_SOLANA_WALLET', action: 'run' })
}).then(r => r.json());
```

## Stack
- **Runtime**: Node.js + Express + TypeScript
- **Blockchain**: Solana mainnet via `@pump-fun/agent-payments-sdk`
- **Payment currency**: USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)
- **Liquidity**: pump.fun protocol auto-distributes every payment — no treasury wallet needed

## Environment Variables

```env
AGENT_TOKEN_MINT_ADDRESS=7FwcSCGFJMQbrmYYW5QKoZN2zQvDTbFejSUEUqQnpump
CURRENCY_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
PRICE_AMOUNT=1000000
SOLANA_RPC_URL=https://rpc.solanatracker.io/public
PORT=8080
```

## License
MIT
