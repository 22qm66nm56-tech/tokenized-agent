import { Router } from 'express';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { PumpAgent } from '@pump-fun/agent-payments-sdk';

const router = Router();
const USDC_DECIMALS = 6;
const USDC_HUMAN = (n) => `$${(n / 10 ** USDC_DECIMALS).toFixed(2)} USDC`;
const AGENT_PROGRAM = 'AgenTMiC2hvxGebTsgmsD4HHBa8WEcqGFf87iwRRxLo7';
const state = { totalPayments: 0, totalVolume: 0, events: [], startedAt: new Date().toISOString() };

function getAgent() {
  const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');
  const agent = new PumpAgent(new PublicKey(process.env.AGENT_TOKEN_MINT_ADDRESS), 'mainnet', connection);
  return { agent, connection };
}

// GET /api/agent/status
router.get('/agent/status', (_, res) => {
  const amount = Number(process.env.PRICE_AMOUNT ?? 0);
  res.json({ status: 'running', agentMint: process.env.AGENT_TOKEN_MINT_ADDRESS, agentProgram: AGENT_PROGRAM, currency: 'USDC', priceAmount: amount, priceHuman: USDC_HUMAN(amount), uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
});

// GET /api/agent/liquidity
router.get('/agent/liquidity', async (_, res) => {
  try {
    const { connection } = getAgent();
    const sigs = await connection.getSignaturesForAddress(new PublicKey(AGENT_PROGRAM), { limit: 20 });
    res.json({ agentMint: process.env.AGENT_TOKEN_MINT_ADDRESS, thisServer: { totalPaymentsConfirmed: state.totalPayments, totalVolumeHuman: USDC_HUMAN(state.totalVolume), recentPayments: state.events.slice(0, 10) }, onChain: { recentProgramTransactions: sigs.length, successfulTransactions: sigs.filter(s => !s.err).length, explorerUrl: 'https://solscan.io/account/' + AGENT_PROGRAM } });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// POST /api/agent/invoice - generate payment transaction for calling agent
router.post('/agent/invoice', async (req, res) => {
  try {
    const { userWallet } = req.body;
    if (!userWallet) return res.status(400).json({ error: 'userWallet is required' });
    const userPublicKey = new PublicKey(userWallet);
    const amount = Number(process.env.PRICE_AMOUNT);
    const memo = Math.floor(Math.random() * 900000000000) + 100000;
    const now = Math.floor(Date.now() / 1000);
    const { agent, connection } = getAgent();
    const currencyMint = new PublicKey(process.env.CURRENCY_MINT);
    const instructions = await agent.buildAcceptPaymentInstructions({ user: userPublicKey, currencyMint, amount, memo, startTime: now, endTime: now + 3600 });
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction(); tx.recentBlockhash = blockhash; tx.feePayer = userPublicKey; tx.add(...instructions);
    res.json({ transaction: tx.serialize({ requireAllSignatures: false }).toString('base64'), invoice: { amount, memo, startTime: now, endTime: now + 3600, currency: 'USDC', priceHuman: USDC_HUMAN(amount) }, blockhash, lastValidBlockHeight });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// POST /api/agent/verify - confirm payment on-chain
router.post('/agent/verify', async (req, res) => {
  try {
    const { userWallet, amount, memo, startTime, endTime } = req.body;
    if (!userWallet || amount == null || memo == null) return res.status(400).json({ error: 'Missing fields: userWallet, amount, memo, startTime, endTime' });
    const { agent } = getAgent();
    const paid = await agent.validateInvoicePayment({ tokenMint: new PublicKey(process.env.AGENT_TOKEN_MINT_ADDRESS), currencyMint: new PublicKey(process.env.CURRENCY_MINT), user: new PublicKey(userWallet), amount, memo, startTime, endTime });
    res.json({ paid, memo, userWallet, checkedAt: new Date().toISOString(), ...(!paid && { hint: 'Still confirming — retry in 2-3 seconds' }) });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// POST /api/agent/trigger - execute after verified payment
router.post('/agent/trigger', async (req, res) => {
  try {
    const { userWallet, amount, memo, startTime, endTime, action, payload } = req.body;
    if (!userWallet || amount == null || memo == null) return res.status(400).json({ error: 'Missing fields' });
    const { agent } = getAgent();
    const paid = await agent.validateInvoicePayment({ tokenMint: new PublicKey(process.env.AGENT_TOKEN_MINT_ADDRESS), currencyMint: new PublicKey(process.env.CURRENCY_MINT), user: new PublicKey(userWallet), amount, memo, startTime, endTime });
    if (!paid) return res.status(402).json({ error: 'Payment Required', paid: false, memo, hint: 'Call /invoice first, sign + send, then retry' });
    state.totalPayments += 1; state.totalVolume += amount;
    state.events.unshift({ memo, userWallet, amount, confirmedAt: new Date().toISOString(), action });
    if (state.events.length > 100) state.events.pop();
    res.json({ paid: true, triggered: true, agentMint: process.env.AGENT_TOKEN_MINT_ADDRESS, action: action ?? 'default', payload: payload ?? null, triggeredAt: new Date().toISOString(), message: 'Agent triggered. Payment confirmed on-chain. Liquidity building via pump.fun.' });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export default router;
