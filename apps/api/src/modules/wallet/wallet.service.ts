import mongoose, { type ClientSession, type Types } from 'mongoose';
import { DEFAULT_PLATFORM_CONFIG, formatKobo } from '@autodey/shared';
import {
  ConfigEntryModel,
  PaymentModel,
  WalletAccountModel,
  WalletTransactionModel,
  type IWalletAccount,
  type IWalletTransaction,
} from '../../models/index.js';
import { AppError } from '../../middleware/errors.js';
import { paymentAdapter } from '../../adapters/paystack.adapter.js';

export async function getPlatformDepositConfig(): Promise<{
  minDepositKobo: number;
  depositMultiplier: number;
  buyerDefaultForfeitPercent: number;
}> {
  const [minEntry, multEntry, forfeitEntry] = await Promise.all([
    ConfigEntryModel.findOne({ key: 'minDepositKobo' }).lean(),
    ConfigEntryModel.findOne({ key: 'depositMultiplier' }).lean(),
    ConfigEntryModel.findOne({ key: 'buyerDefaultForfeitPercent' }).lean(),
  ]);

  return {
    minDepositKobo:
      typeof minEntry?.value === 'number'
        ? minEntry.value
        : DEFAULT_PLATFORM_CONFIG.minDepositKobo,
    depositMultiplier:
      typeof multEntry?.value === 'number'
        ? multEntry.value
        : DEFAULT_PLATFORM_CONFIG.depositMultiplier,
    buyerDefaultForfeitPercent:
      typeof forfeitEntry?.value === 'number'
        ? forfeitEntry.value
        : DEFAULT_PLATFORM_CONFIG.buyerDefaultForfeitPercent,
  };
}

/**
 * Computes required refundable bidding deposit in integer kobo:
 * Default: N100,000 (10,000,000 kobo) unlocks up to N5,000,000 (50x multiplier = 2%).
 * Above N5,000,000, 2% (1 / depositMultiplier) of maxBidKobo is required.
 */
export function computeRequiredDepositKobo(
  maxBidKobo: number,
  minDepositKobo = DEFAULT_PLATFORM_CONFIG.minDepositKobo,
  depositMultiplier = DEFAULT_PLATFORM_CONFIG.depositMultiplier,
): number {
  const proportionalKobo = Math.ceil(maxBidKobo / depositMultiplier);
  return Math.max(minDepositKobo, proportionalKobo);
}

export async function getOrCreateWallet(
  userId: string | Types.ObjectId,
  session?: ClientSession,
): Promise<IWalletAccount> {
  const uid = new mongoose.Types.ObjectId(String(userId));
  let wallet = await WalletAccountModel.findOne({ userId: uid }).session(session ?? null);
  if (!wallet) {
    const created = await WalletAccountModel.create(
      [
        {
          userId: uid,
          availableKobo: 0,
          heldKobo: 0,
          forfeitedKobo: 0,
          currency: 'NGN',
        },
      ],
      session ? { session } : undefined,
    );
    wallet = created[0]!;
  }
  return wallet;
}

/**
 * Credits a refundable bidding deposit to a user's wallet with a mandatory WalletTransaction ledger entry.
 * Idempotent on `idempotencyKey`.
 */
export async function creditDepositToWallet(params: {
  userId: string | Types.ObjectId;
  amountKobo: number;
  reference: string;
  idempotencyKey: string;
  description?: string;
  session?: ClientSession;
}): Promise<{ wallet: IWalletAccount; transaction: IWalletTransaction; alreadyProcessed: boolean }> {
  if (!Number.isInteger(params.amountKobo) || params.amountKobo <= 0) {
    throw AppError.badRequest('INVALID_AMOUNT', 'Deposit amount must be a positive integer in kobo');
  }

  const existingTx = await WalletTransactionModel.findOne({
    idempotencyKey: params.idempotencyKey,
  }).session(params.session ?? null);

  if (existingTx) {
    const wallet = await getOrCreateWallet(params.userId, params.session);
    return { wallet, transaction: existingTx, alreadyProcessed: true };
  }

  const execute = async (sess: ClientSession) => {
    const wallet = await getOrCreateWallet(params.userId, sess);
    wallet.availableKobo += params.amountKobo;
    await wallet.save({ session: sess });

    const [tx] = await WalletTransactionModel.create(
      [
        {
          walletId: wallet._id,
          userId: wallet.userId,
          idempotencyKey: params.idempotencyKey,
          type: 'deposit',
          direction: 'credit',
          amountKobo: params.amountKobo,
          balanceAfterAvailableKobo: wallet.availableKobo,
          balanceAfterHeldKobo: wallet.heldKobo,
          referenceType: 'payment',
          referenceId: params.reference,
          description:
            params.description ??
            `Refundable bidding deposit credited (${formatKobo(params.amountKobo)})`,
        },
      ],
      { session: sess },
    );

    return { wallet, transaction: tx!, alreadyProcessed: false };
  };

  if (params.session) {
    return execute(params.session);
  }

  const session = await mongoose.startSession();
  try {
    let result!: { wallet: IWalletAccount; transaction: IWalletTransaction; alreadyProcessed: boolean };
    await session.withTransaction(async () => {
      result = await execute(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Calculates how much deposit is currently held for a specific user on a specific auction
 * by summing 'hold' minus 'release'/'forfeit' transactions for `auction:{auctionId}`.
 */
export async function getHeldDepositForAuctionKobo(
  userId: string | Types.ObjectId,
  auctionId: string | Types.ObjectId,
  session?: ClientSession,
): Promise<number> {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const refId = String(auctionId);
  const txs = await WalletTransactionModel.find({
    userId: uid,
    referenceType: 'auction',
    referenceId: refId,
  })
    .session(session ?? null)
    .lean();

  let netHeld = 0;
  for (const tx of txs) {
    if (tx.type === 'hold') {
      netHeld += tx.amountKobo;
    } else if (tx.type === 'release' || tx.type === 'forfeit') {
      netHeld -= tx.amountKobo;
    }
  }
  return Math.max(0, netHeld);
}

/**
 * Ensures the bidder has sufficient refundable bidding deposit for `maxBidKobo` on `auctionId`,
 * and places any additional required deposit into `heldKobo` via a double-entry `hold` ledger entry.
 */
export async function assertAndHoldDepositForBid(params: {
  userId: string | Types.ObjectId;
  auctionId: string | Types.ObjectId;
  maxBidKobo: number;
  minDepositKobo?: number;
  depositMultiplier?: number;
  session: ClientSession;
}): Promise<{ wallet: IWalletAccount; requiredDepositKobo: number; newlyHeldKobo: number }> {
  const requiredDepositKobo = computeRequiredDepositKobo(
    params.maxBidKobo,
    params.minDepositKobo,
    params.depositMultiplier,
  );

  const wallet = await getOrCreateWallet(params.userId, params.session);
  const alreadyHeldOnAuction = await getHeldDepositForAuctionKobo(
    params.userId,
    params.auctionId,
    params.session,
  );

  const additionalHoldNeeded = Math.max(0, requiredDepositKobo - alreadyHeldOnAuction);

  if (wallet.availableKobo < additionalHoldNeeded) {
    throw AppError.badRequest(
      'INSUFFICIENT_BIDDING_DEPOSIT',
      `A refundable bidding deposit of ${formatKobo(requiredDepositKobo)} is required to bid ${formatKobo(
        params.maxBidKobo,
      )}. Available deposit: ${formatKobo(wallet.availableKobo + alreadyHeldOnAuction)}.`,
    );
  }

  if (additionalHoldNeeded > 0) {
    wallet.availableKobo -= additionalHoldNeeded;
    wallet.heldKobo += additionalHoldNeeded;
    await wallet.save({ session: params.session });

    const holdIdempotencyKey = `hold:auction:${String(params.auctionId)}:user:${String(
      params.userId,
    )}:req:${requiredDepositKobo}:${Date.now()}`;

    await WalletTransactionModel.create(
      [
        {
          walletId: wallet._id,
          userId: wallet.userId,
          idempotencyKey: holdIdempotencyKey,
          type: 'hold',
          direction: 'debit',
          amountKobo: additionalHoldNeeded,
          balanceAfterAvailableKobo: wallet.availableKobo,
          balanceAfterHeldKobo: wallet.heldKobo,
          referenceType: 'auction',
          referenceId: String(params.auctionId),
          description: `Refundable bidding deposit locked for auction #${String(params.auctionId).slice(-6)}`,
        },
      ],
      { session: params.session },
    );
  }

  return {
    wallet,
    requiredDepositKobo,
    newlyHeldKobo: additionalHoldNeeded,
  };
}

/**
 * Releases held bidding deposits for all non-winning bidders when an auction closes.
 * Only the winner's deposit stays locked in `heldKobo` until settlement completes.
 */
export async function releaseNonWinnerAuctionHolds(params: {
  auctionId: string | Types.ObjectId;
  winnerId: string | Types.ObjectId | null;
  session?: ClientSession;
}): Promise<number> {
  const refId = String(params.auctionId);
  const winnerStr = params.winnerId ? String(params.winnerId) : null;

  const execute = async (sess: ClientSession) => {
    const holdTxs = await WalletTransactionModel.find({
      referenceType: 'auction',
      referenceId: refId,
      type: 'hold',
    })
      .session(sess)
      .lean();

    const bidderIds = Array.from(new Set(holdTxs.map((t) => String(t.userId))));
    let releasedCount = 0;

    for (const bidderIdStr of bidderIds) {
      if (winnerStr && bidderIdStr === winnerStr) {
        continue; // Winner's deposit stays locked until settlement
      }

      const netHeld = await getHeldDepositForAuctionKobo(bidderIdStr, refId, sess);
      if (netHeld <= 0) continue;

      const releaseKey = `release:auction:${refId}:user:${bidderIdStr}`;
      const existingRelease = await WalletTransactionModel.findOne({
        idempotencyKey: releaseKey,
      }).session(sess);
      if (existingRelease) continue;

      const wallet = await getOrCreateWallet(bidderIdStr, sess);
      const releaseAmount = Math.min(wallet.heldKobo, netHeld);
      if (releaseAmount <= 0) continue;

      wallet.heldKobo -= releaseAmount;
      wallet.availableKobo += releaseAmount;
      await wallet.save({ session: sess });

      await WalletTransactionModel.create(
        [
          {
            walletId: wallet._id,
            userId: wallet.userId,
            idempotencyKey: releaseKey,
            type: 'release',
            direction: 'credit',
            amountKobo: releaseAmount,
            balanceAfterAvailableKobo: wallet.availableKobo,
            balanceAfterHeldKobo: wallet.heldKobo,
            referenceType: 'auction',
            referenceId: refId,
            description: `Refundable bidding deposit released after auction #${refId.slice(-6)} ended`,
          },
        ],
        { session: sess },
      );

      releasedCount += 1;
    }

    return releasedCount;
  };

  if (params.session) {
    return execute(params.session);
  }

  const session = await mongoose.startSession();
  try {
    let count = 0;
    await session.withTransaction(async () => {
      count = await execute(session);
    });
    return count;
  } finally {
    await session.endSession();
  }
}

/**
 * Resolves the winner's locked deposit upon settlement completion or default/dispute.
 * - outcome === 'release': 100% of the winner's held deposit on this auction is returned to `availableKobo`.
 * - outcome === 'forfeit': `forfeitPercent` (default 50%) is moved to `forfeitedKobo` and the remainder is released to `availableKobo`.
 */
export async function resolveWinnerAuctionDeposit(params: {
  auctionId: string | Types.ObjectId;
  settlementId: string | Types.ObjectId;
  winnerId: string | Types.ObjectId;
  outcome: 'release' | 'forfeit';
  forfeitPercent?: number;
  session?: ClientSession;
}): Promise<{ releasedKobo: number; forfeitedKobo: number }> {
  const refId = String(params.auctionId);
  const settlementRef = String(params.settlementId);

  const execute = async (sess: ClientSession) => {
    const netHeld = await getHeldDepositForAuctionKobo(params.winnerId, refId, sess);
    if (netHeld <= 0) {
      return { releasedKobo: 0, forfeitedKobo: 0 };
    }

    const wallet = await getOrCreateWallet(params.winnerId, sess);
    const lockAmount = Math.min(wallet.heldKobo, netHeld);
    if (lockAmount <= 0) {
      return { releasedKobo: 0, forfeitedKobo: 0 };
    }

    if (params.outcome === 'release') {
      const releaseKey = `release:settlement:${settlementRef}:user:${String(params.winnerId)}`;
      const existing = await WalletTransactionModel.findOne({ idempotencyKey: releaseKey }).session(
        sess,
      );
      if (existing) {
        return { releasedKobo: existing.amountKobo, forfeitedKobo: 0 };
      }

      wallet.heldKobo -= lockAmount;
      wallet.availableKobo += lockAmount;
      await wallet.save({ session: sess });

      await WalletTransactionModel.create(
        [
          {
            walletId: wallet._id,
            userId: wallet.userId,
            idempotencyKey: releaseKey,
            type: 'release',
            direction: 'credit',
            amountKobo: lockAmount,
            balanceAfterAvailableKobo: wallet.availableKobo,
            balanceAfterHeldKobo: wallet.heldKobo,
            referenceType: 'auction',
            referenceId: refId,
            description: `Winner refundable bidding deposit unlocked upon settlement #${settlementRef.slice(-6)}`,
          },
        ],
        { session: sess },
      );

      return { releasedKobo: lockAmount, forfeitedKobo: 0 };
    }

    // Outcome === 'forfeit'
    const pct = params.forfeitPercent ?? DEFAULT_PLATFORM_CONFIG.buyerDefaultForfeitPercent;
    const forfeitedKobo = Math.round((lockAmount * pct) / 100);
    const releasedKobo = lockAmount - forfeitedKobo;

    const forfeitKey = `forfeit:settlement:${settlementRef}:user:${String(params.winnerId)}`;
    const existingForfeit = await WalletTransactionModel.findOne({
      idempotencyKey: forfeitKey,
    }).session(sess);
    if (existingForfeit) {
      return { releasedKobo, forfeitedKobo };
    }

    wallet.heldKobo -= lockAmount;
    wallet.forfeitedKobo += forfeitedKobo;
    wallet.availableKobo += releasedKobo;
    await wallet.save({ session: sess });

    if (forfeitedKobo > 0) {
      await WalletTransactionModel.create(
        [
          {
            walletId: wallet._id,
            userId: wallet.userId,
            idempotencyKey: forfeitKey,
            type: 'forfeit',
            direction: 'debit',
            amountKobo: forfeitedKobo,
            balanceAfterAvailableKobo: wallet.availableKobo,
            balanceAfterHeldKobo: wallet.heldKobo,
            referenceType: 'auction',
            referenceId: refId,
            description: `Deposit forfeiture (${pct}%) due to buyer settlement default on auction #${refId.slice(-6)}`,
          },
        ],
        { session: sess },
      );
    }

    if (releasedKobo > 0) {
      await WalletTransactionModel.create(
        [
          {
            walletId: wallet._id,
            userId: wallet.userId,
            idempotencyKey: `release-remainder:settlement:${settlementRef}:user:${String(params.winnerId)}`,
            type: 'release',
            direction: 'credit',
            amountKobo: releasedKobo,
            balanceAfterAvailableKobo: wallet.availableKobo,
            balanceAfterHeldKobo: wallet.heldKobo,
            referenceType: 'auction',
            referenceId: refId,
            description: `Remaining deposit released after default deduction on auction #${refId.slice(-6)}`,
          },
        ],
        { session: sess },
      );
    }

    return { releasedKobo, forfeitedKobo };
  };

  if (params.session) {
    return execute(params.session);
  }

  const session = await mongoose.startSession();
  try {
    let res = { releasedKobo: 0, forfeitedKobo: 0 };
    await session.withTransaction(async () => {
      res = await execute(session);
    });
    return res;
  } finally {
    await session.endSession();
  }
}

/**
 * Refunds / withdraws available refundable bidding deposit back to the user's bank / Paystack payment method.
 */
export async function withdrawAvailableDeposit(params: {
  userId: string | Types.ObjectId;
  amountKobo: number;
  bankName?: string;
  accountNumber?: string;
  idempotencyKey: string;
}): Promise<{ wallet: IWalletAccount; transaction: IWalletTransaction; refundReference: string }> {
  if (!Number.isInteger(params.amountKobo) || params.amountKobo <= 0) {
    throw AppError.badRequest('INVALID_AMOUNT', 'Withdrawal amount must be a positive integer in kobo');
  }

  const existingTx = await WalletTransactionModel.findOne({
    idempotencyKey: params.idempotencyKey,
  });
  if (existingTx) {
    const wallet = await getOrCreateWallet(params.userId);
    return {
      wallet,
      transaction: existingTx,
      refundReference: existingTx.referenceId,
    };
  }

  const session = await mongoose.startSession();
  try {
    let walletDoc!: IWalletAccount;
    let txDoc!: IWalletTransaction;
    let refundReference = '';

    await session.withTransaction(async () => {
      const wallet = await getOrCreateWallet(params.userId, session);
      if (wallet.availableKobo < params.amountKobo) {
        throw AppError.badRequest(
          'INSUFFICIENT_AVAILABLE_BALANCE',
          `Cannot withdraw ${formatKobo(params.amountKobo)}. Available unlocked deposit is ${formatKobo(
            wallet.availableKobo,
          )}.`,
        );
      }

      const lastPayment = await PaymentModel.findOne({
        userId: wallet.userId,
        purpose: 'bidding_deposit',
        status: 'success',
      })
        .sort({ createdAt: -1 })
        .session(session);

      const refundRes = await paymentAdapter.refundTransaction(
        lastPayment?.reference ?? `WDR_${Date.now()}`,
        params.amountKobo,
      );
      refundReference = refundRes.refundReference;

      wallet.availableKobo -= params.amountKobo;
      await wallet.save({ session });

      const [tx] = await WalletTransactionModel.create(
        [
          {
            walletId: wallet._id,
            userId: wallet.userId,
            idempotencyKey: params.idempotencyKey,
            type: 'refund',
            direction: 'debit',
            amountKobo: params.amountKobo,
            balanceAfterAvailableKobo: wallet.availableKobo,
            balanceAfterHeldKobo: wallet.heldKobo,
            referenceType: 'withdrawal',
            referenceId: refundReference,
            description: params.bankName
              ? `Refundable deposit withdrawal to ${params.bankName} (${params.accountNumber ?? '****'})`
              : `One-click Paystack refund of refundable bidding deposit (${formatKobo(params.amountKobo)})`,
          },
        ],
        { session },
      );

      walletDoc = wallet;
      txDoc = tx!;
    });

    return {
      wallet: walletDoc,
      transaction: txDoc,
      refundReference,
    };
  } finally {
    await session.endSession();
  }
}

